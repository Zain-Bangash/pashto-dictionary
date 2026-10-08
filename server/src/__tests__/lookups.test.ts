jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: () => ({
      verify: async (token) => {
        const parts = (token || '').split('.');
        if (parts.length < 2) throw new Error('Invalid token');
        const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (!p.id && !p.sub) throw new Error('Invalid token');
        return { sub: p.id || p.sub, 'custom:role': p.role ?? 'user' };
      },
    }),
  },
}));

const mockCognitoSend = jest.fn();
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: mockCognitoSend })),
  SignUpCommand: jest.fn().mockImplementation((input) => ({ _type: 'SignUpCommand', input })),
  AdminConfirmSignUpCommand: jest.fn().mockImplementation((input) => ({ _type: 'AdminConfirmSignUpCommand', input })),
  AdminDeleteUserCommand: jest.fn().mockImplementation((input) => ({ _type: 'AdminDeleteUserCommand', input })),
  InitiateAuthCommand: jest.fn().mockImplementation((input) => ({ _type: 'InitiateAuthCommand', input })),
}));

// Admin-editable preset lists (region, part of speech) and how entries validate against them

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const lookupsRouter = require('../routes/lookups');
const conceptsRouter = require('../routes/concepts');
const variantsRouter = require('../routes/variants');
const authRouter = require('../routes/auth');
const moderationRouter = require('../routes/moderation');
const Lookup = require('../models/Lookup');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');
const { ensureSystemLookups } = require('../utils/lookups');

const app = express();
app.use(express.json());
app.use('/api/lookups', lookupsRouter);
app.use('/api/concepts', conceptsRouter);
app.use('/api/variants', variantsRouter);
app.use('/api/auth', authRouter);
app.use('/api/moderation', moderationRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ success: false, error: { message: err.message || 'Internal server error' } });
});

const request = supertest(app);
let mongoServer;

async function makeUser(role = 'user') {
  const id = new mongoose.Types.ObjectId().toString();
  await User.create({ cognitoSub: id, username: `user-${id.slice(-6)}`, email: `${id.slice(-6)}@test.local`, role });
  const token = jwt.sign({ id, username: 'testuser', role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { id, token };
}

const send = (method, path, token, body) => {
  const req = request[method](path);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};

const getRow = (type, key) => Lookup.findOne({ type, key });

async function addCustom(type, label) {
  const row = await Lookup.create({ type, key: label, label, order: 50 });
  return row;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Lookup.init();
  await ensureSystemLookups();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Promise.all([
    Lookup.deleteMany({}),
    Concept.deleteMany({}),
    Variant.deleteMany({}),
    ModerationLog.deleteMany({}),
    User.deleteMany({}),
  ]);
});

describe('ensureSystemLookups (seed)', () => {
  test('creates 5 regions and 6 parts of speech as system rows', async () => {
    expect(await Lookup.countDocuments({ type: 'region', isSystem: true })).toBe(5);
    expect(await Lookup.countDocuments({ type: 'partOfSpeech', isSystem: true })).toBe(6);
  });

  test('is idempotent and never overwrites an edited label or order', async () => {
    await Lookup.updateOne({ type: 'region', key: 'Kohat' }, { label: 'Kohat District', order: 9 });
    const inserted = await ensureSystemLookups();
    expect(inserted).toEqual([]);
    expect(await Lookup.countDocuments()).toBe(11);
    const kohat = await getRow('region', 'Kohat');
    expect(kohat.label).toBe('Kohat District');
    expect(kohat.order).toBe(9);
  });

  test('dry run reports missing rows without writing', async () => {
    await Lookup.deleteOne({ type: 'region', key: 'Thal' });
    const missing = await ensureSystemLookups({ dryRun: true });
    expect(missing).toEqual(['region:Thal']);
    expect(await getRow('region', 'Thal')).toBeNull();
  });
});

describe('GET /api/lookups (public)', () => {
  test('returns all rows sorted by type and order without auth, in the list envelope', async () => {
    const res = await request.get('/api/lookups');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.total).toBe(11);
    const regions = res.body.data.filter((r) => r.type === 'region').map((r) => r.key);
    expect(regions).toEqual(['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar']);
    expect(res.body.data[0]).toEqual(expect.objectContaining({ label: expect.any(String), active: true, isSystem: true }));
  });

  test('includes inactive rows flagged active:false, and filters by type', async () => {
    const custom = await addCustom('region', 'Kurram');
    await Lookup.updateOne({ _id: custom._id }, { active: false });
    const res = await request.get('/api/lookups?type=region');
    expect(res.body.data).toHaveLength(6);
    expect(res.body.data.find((r) => r.key === 'Kurram').active).toBe(false);
  });

  test('rejects an unknown type filter', async () => {
    const res = await request.get('/api/lookups?type=colour');
    expect(res.status).toBe(400);
  });
});

describe('admin-only access', () => {
  const calls = [
    ['post', '/api/lookups', { type: 'region', label: 'Kurram' }],
    ['put', '/api/lookups/order', { type: 'region', ids: [] }],
  ];

  test.each(['user', 'moderator'])('%s gets 403 on every mutation', async (role) => {
    const { token } = await makeUser(role);
    const kohat = await getRow('region', 'Kohat');
    const paths = [
      ...calls,
      ['patch', `/api/lookups/${kohat._id}`, { label: 'X' }],
      ['patch', `/api/lookups/${kohat._id}/deactivate`, {}],
      ['patch', `/api/lookups/${kohat._id}/reactivate`, {}],
    ];
    for (const [method, path, body] of paths) {
      const res = await send(method, path, token, body);
      expect(res.status).toBe(403);
    }
    expect(await Lookup.countDocuments()).toBe(11);
  });

  test('unauthenticated create gets 401', async () => {
    const res = await request.post('/api/lookups').send({ type: 'region', label: 'Kurram' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/lookups', () => {
  test('admin creates a value; key equals the label; it is appended and logged', async () => {
    const { id, token } = await makeUser('admin');
    const res = await send('post', '/api/lookups', token, { type: 'region', label: '  Kurram  ' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ key: 'Kurram', label: 'Kurram', active: true, isSystem: false, order: 5 }));

    const log = await ModerationLog.findOne({ action: 'lookup_changed' });
    expect(log.targetModel).toBe('Lookup');
    expect(String(log.targetId)).toBe(res.body.data._id);
    expect(log.performedBy).toBe(id);
    expect(log.changes).toEqual({ op: 'created', type: 'region', key: 'Kurram', label: 'Kurram' });
  });

  test('accepts Pashto script labels', async () => {
    const { token } = await makeUser('admin');
    const res = await send('post', '/api/lookups', token, { type: 'region', label: 'کرمه' });
    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe('کرمه');
  });

  test('rejects a duplicate label (case-insensitive) in the same type with 409', async () => {
    const { token } = await makeUser('admin');
    const res = await send('post', '/api/lookups', token, { type: 'region', label: 'kohat' });
    expect(res.status).toBe(409);
  });

  test('the same label in a different type is allowed', async () => {
    const { token } = await makeUser('admin');
    const res = await send('post', '/api/lookups', token, { type: 'partOfSpeech', label: 'Kohat' });
    expect(res.status).toBe(201);
  });

  test.each([
    [{ type: 'region', label: '' }, 'label'],
    [{ type: 'region', label: 'x'.repeat(51) }, 'label'],
    [{ type: 'region', label: '<script>' }, 'label'],
    [{ type: 'region', label: 'bad\u0007bell' }, 'label'],
    [{ type: 'region', label: 42 }, 'label'],
    [{ type: 'colour', label: 'Red' }, 'type'],
    [{ type: 'region', label: 'Kurram', order: -1 }, 'order'],
  ])('rejects invalid body %j', async (body, field) => {
    const { token } = await makeUser('admin');
    const res = await send('post', '/api/lookups', token, body);
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe(field);
  });

  test('caps each list at 100 values', async () => {
    const { token } = await makeUser('admin');
    await Lookup.insertMany(Array.from({ length: 95 }, (_, i) => ({ type: 'region', key: `R${i}`, label: `R${i}`, order: 10 + i })));
    const res = await send('post', '/api/lookups', token, { type: 'region', label: 'One too many' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/lookups/:id', () => {
  test('renames a system label; stored entries keep the key and show the new label', async () => {
    const { token } = await makeUser('admin');
    const concept = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Kohat', definition: 'def', status: 'published' });
    const kohat = await getRow('region', 'Kohat');

    const res = await send('patch', `/api/lookups/${kohat._id}`, token, { label: 'Kohat District' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ key: 'Kohat', label: 'Kohat District' }));

    const stored = await Variant.findById(variant._id);
    expect(stored.region).toBe('Kohat');
    const list = await request.get('/api/lookups?type=region');
    expect(list.body.data.find((r) => r.key === stored.region).label).toBe('Kohat District');

    const log = await ModerationLog.findOne({ action: 'lookup_changed' });
    expect(log.changes).toEqual({ op: 'updated', type: 'region', key: 'Kohat', label: { from: 'Kohat', to: 'Kohat District' } });
  });

  test('changes order and logs from/to', async () => {
    const { token } = await makeUser('admin');
    const thal = await getRow('region', 'Thal');
    const res = await send('patch', `/api/lookups/${thal._id}`, token, { order: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.order).toBe(0);
    const log = await ModerationLog.findOne({ action: 'lookup_changed' });
    expect(log.changes.order).toEqual({ from: 3, to: 0 });
  });

  test.each(['key', 'type', 'isSystem', 'active'])('rejects an attempt to change %s and leaves the row untouched', async (field) => {
    const { token } = await makeUser('admin');
    const kohat = await getRow('region', 'Kohat');
    const value = field === 'isSystem' || field === 'active' ? false : 'Changed';
    const res = await send('patch', `/api/lookups/${kohat._id}`, token, { label: 'New label', [field]: value });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe(field);
    const after = await getRow('region', 'Kohat');
    expect(after.label).toBe('Kohat');
    expect(after.isSystem).toBe(true);
    expect(after.active).toBe(true);
    expect(await ModerationLog.countDocuments()).toBe(0);
  });

  test('rejects a rename that collides with another value', async () => {
    const { token } = await makeUser('admin');
    const kohat = await getRow('region', 'Kohat');
    const res = await send('patch', `/api/lookups/${kohat._id}`, token, { label: 'HANGU' });
    expect(res.status).toBe(409);
  });

  test('requires label or order, and a valid id', async () => {
    const { token } = await makeUser('admin');
    const kohat = await getRow('region', 'Kohat');
    expect((await send('patch', `/api/lookups/${kohat._id}`, token, {})).status).toBe(400);
    expect((await send('patch', '/api/lookups/not-an-id', token, { label: 'X' })).status).toBe(400);
    expect((await send('patch', `/api/lookups/${new mongoose.Types.ObjectId()}`, token, { label: 'X' })).status).toBe(404);
  });

  test('writes no log when nothing actually changed', async () => {
    const { token } = await makeUser('admin');
    const kohat = await getRow('region', 'Kohat');
    const res = await send('patch', `/api/lookups/${kohat._id}`, token, { label: 'Kohat' });
    expect(res.status).toBe(200);
    expect(await ModerationLog.countDocuments()).toBe(0);
  });
});

describe('PUT /api/lookups/order', () => {
  test('reorders a whole list and writes one log entry', async () => {
    const { token } = await makeUser('admin');
    const rows = await Lookup.find({ type: 'region' }).sort({ order: 1 });
    const ids = rows.map((r) => String(r._id)).reverse();
    const res = await send('put', '/api/lookups/order', token, { type: 'region', ids });
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.key)).toEqual(['Parachinar', 'Thal', 'Tirah', 'Hangu', 'Kohat']);
    const logs = await ModerationLog.find({ action: 'lookup_changed' });
    expect(logs).toHaveLength(1);
    expect(logs[0].changes.op).toBe('reordered');
    expect(logs[0].changes.to).toEqual(['Parachinar', 'Thal', 'Tirah', 'Hangu', 'Kohat']);
  });

  test('rejects a partial list, duplicates, or ids from another type', async () => {
    const { token } = await makeUser('admin');
    const regions = (await Lookup.find({ type: 'region' })).map((r) => String(r._id));
    const pos = await getRow('partOfSpeech', 'noun');
    for (const ids of [regions.slice(1), [...regions.slice(1), regions[1]], [...regions.slice(1), String(pos._id)]]) {
      const res = await send('put', '/api/lookups/order', token, { type: 'region', ids });
      expect(res.status).toBe(400);
    }
  });
});

describe('deactivate / reactivate / delete', () => {
  test('system values cannot be deactivated', async () => {
    const { token } = await makeUser('admin');
    const kohat = await getRow('region', 'Kohat');
    const res = await send('patch', `/api/lookups/${kohat._id}/deactivate`, token, {});
    expect(res.status).toBe(400);
    expect((await getRow('region', 'Kohat')).active).toBe(true);
  });

  test('admin-added values can be deactivated and reactivated, each logged; repeats are rejected', async () => {
    const { token } = await makeUser('admin');
    const kurram = await addCustom('region', 'Kurram');

    const off = await send('patch', `/api/lookups/${kurram._id}/deactivate`, token, {});
    expect(off.status).toBe(200);
    expect(off.body.data.active).toBe(false);
    expect((await send('patch', `/api/lookups/${kurram._id}/deactivate`, token, {})).status).toBe(400);

    const on = await send('patch', `/api/lookups/${kurram._id}/reactivate`, token, {});
    expect(on.status).toBe(200);
    expect(on.body.data.active).toBe(true);
    expect((await send('patch', `/api/lookups/${kurram._id}/reactivate`, token, {})).status).toBe(400);

    const ops = (await ModerationLog.find({ action: 'lookup_changed' }).sort({ timestamp: 1 })).map((l) => l.changes.op);
    expect(ops).toEqual(['deactivated', 'reactivated']);
  });

  test('there is no delete endpoint', async () => {
    const { token } = await makeUser('admin');
    const kurram = await addCustom('region', 'Kurram');
    const res = await send('delete', `/api/lookups/${kurram._id}`, token);
    expect(res.status).toBe(404);
    expect(await getRow('region', 'Kurram')).not.toBeNull();
  });
});

describe('entries validate against active list values', () => {
  async function retired(type, label) {
    const row = await addCustom(type, label);
    await Lookup.updateOne({ _id: row._id }, { active: false });
    return row;
  }

  test('a new variant accepts an active admin-added region and rejects an inactive or unknown one', async () => {
    const { token } = await makeUser('user');
    const concept = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun' });
    await addCustom('region', 'Kurram');
    await retired('region', 'Bajaur');

    const ok = await send('post', '/api/variants', token, { conceptId: String(concept._id), pashto: 'اوبه', region: 'Kurram', definition: 'd' });
    expect(ok.status).toBe(201);

    for (const region of ['Bajaur', 'Kandahar']) {
      const res = await send('post', '/api/variants', token, { conceptId: String(concept._id), pashto: 'نور', region, definition: 'd' });
      expect(res.status).toBe(400);
      expect(res.body.error.field).toBe('region');
    }
  });

  test('a new concept rejects an inactive part of speech', async () => {
    const { token } = await makeUser('user');
    await retired('partOfSpeech', 'particle');
    const res = await send('post', '/api/concepts', token, { englishGloss: 'just', partOfSpeech: 'particle' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('partOfSpeech');
  });

  test('an existing entry with a now-inactive region still displays and can move through moderation', async () => {
    const { token: adminToken } = await makeUser('admin');
    await retired('region', 'Bajaur');
    const concept = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Bajaur', definition: 'd', status: 'pending' });

    const got = await request.get(`/api/variants/${variant._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(got.status).toBe(200);
    expect(got.body.data.region).toBe('Bajaur');

    expect((await send('patch', `/api/variants/${variant._id}/status`, adminToken, { status: 'approved' })).status).toBe(200);
    expect((await send('patch', `/api/variants/${variant._id}/status`, adminToken, { status: 'published' })).status).toBe(200);
  });

  test('resubmitting a rejected variant keeps an unchanged inactive region but cannot newly choose one', async () => {
    const { id, token } = await makeUser('user');
    await retired('region', 'Bajaur');
    await retired('region', 'Swat');
    const concept = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Bajaur', definition: 'd', status: 'rejected', submittedBy: id });

    const same = await send('patch', `/api/variants/${variant._id}`, token, { region: 'Bajaur', definition: 'better' });
    expect(same.status).toBe(200);

    await Variant.updateOne({ _id: variant._id }, { status: 'rejected' });
    const changed = await send('patch', `/api/variants/${variant._id}`, token, { region: 'Swat' });
    expect(changed.status).toBe(400);
    expect(changed.body.error.field).toBe('region');
  });

  test('moderator edit keeps an unchanged inactive region, rejects a newly chosen inactive one, and rejects an empty one', async () => {
    const { token } = await makeUser('moderator');
    await retired('region', 'Bajaur');
    const concept = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Kohat', definition: 'd', status: 'pending' });

    const bad = await send('patch', `/api/variants/${variant._id}/edit`, token, { region: 'Bajaur', note: 'n' });
    expect(bad.status).toBe(400);
    expect((await send('patch', `/api/variants/${variant._id}/edit`, token, { region: '', note: 'n' })).status).toBe(400);
    expect((await send('patch', `/api/variants/${variant._id}/edit`, token, { region: 'Hangu', note: 'n' })).status).toBe(200);

    await Variant.updateOne({ _id: variant._id }, { region: 'Bajaur' });
    expect((await send('patch', `/api/variants/${variant._id}/edit`, token, { region: 'Bajaur', definition: 'x', note: 'n' })).status).toBe(200);
  });

  test('concept edit and resubmit follow the same rule for part of speech', async () => {
    const { id, token } = await makeUser('user');
    const { token: modToken } = await makeUser('moderator');
    await retired('partOfSpeech', 'particle');
    const pending = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun' });
    const rejected = await Concept.create({ englishGloss: 'just', partOfSpeech: 'particle', status: 'rejected', submittedBy: id });

    expect((await send('patch', `/api/concepts/${pending._id}/edit`, modToken, { partOfSpeech: 'particle', note: 'n' })).status).toBe(400);
    expect((await send('patch', `/api/concepts/${pending._id}/edit`, modToken, { partOfSpeech: 'verb', note: 'n' })).status).toBe(200);
    expect((await send('patch', `/api/concepts/${rejected._id}`, token, { partOfSpeech: 'particle', englishGloss: 'only' })).status).toBe(200);
  });
});

describe('registration and profile use the shared region list', () => {
  function mockRegister(sub) {
    mockCognitoSend.mockReset();
    mockCognitoSend.mockImplementation((cmd) => {
      if (cmd._type === 'SignUpCommand') return Promise.resolve({ UserSub: sub });
      if (cmd._type === 'InitiateAuthCommand') return Promise.resolve({ AuthenticationResult: { AccessToken: 'fake-token' } });
      return Promise.resolve({});
    });
  }
  const body = (extra) => ({ username: 'newuser', email: 'new@test.local', password: 'Password1!', ...extra });

  test('accepts an admin-added region at registration', async () => {
    await addCustom('region', 'Kurram');
    mockRegister('reg-sub-1');
    const res = await request.post('/api/auth/register').send(body({ region: 'Kurram' }));
    expect(res.status).toBe(201);
    expect((await User.findOne({ email: 'new@test.local' })).region).toBe('Kurram');
  });

  test('rejects an inactive or unknown region at registration', async () => {
    const row = await addCustom('region', 'Bajaur');
    await Lookup.updateOne({ _id: row._id }, { active: false });
    mockRegister('reg-sub-2');
    for (const region of ['Bajaur', 'Kandahar']) {
      const res = await request.post('/api/auth/register').send(body({ region }));
      expect(res.status).toBe(400);
      expect(res.body.error.field).toBe('region');
    }
    expect(mockCognitoSend).not.toHaveBeenCalledWith(expect.objectContaining({ _type: 'SignUpCommand' }));
  });

  test('registration without a region still works', async () => {
    mockRegister('reg-sub-3');
    const res = await request.post('/api/auth/register').send(body({ region: '' }));
    expect(res.status).toBe(201);
  });

  test('profile update keeps an unchanged inactive region and rejects a newly chosen one', async () => {
    const { id, token } = await makeUser('user');
    const row = await addCustom('region', 'Bajaur');
    await Lookup.updateOne({ _id: row._id }, { active: false });
    await User.updateOne({ cognitoSub: id }, { region: 'Bajaur' });

    expect((await send('patch', '/api/auth/profile', token, { region: 'Bajaur', village: 'v' })).status).toBe(200);
    await User.updateOne({ cognitoSub: id }, { region: 'Kohat' });
    const res = await send('patch', '/api/auth/profile', token, { region: 'Bajaur' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('region');
  });
});

describe('moderation log', () => {
  test('admin can filter the log by lookup_changed and Lookup', async () => {
    const { token } = await makeUser('admin');
    await send('post', '/api/lookups', token, { type: 'region', label: 'Kurram' });
    const res = await request
      .get('/api/moderation/log?action=lookup_changed&targetModel=Lookup')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].action).toBe('lookup_changed');
  });
});
