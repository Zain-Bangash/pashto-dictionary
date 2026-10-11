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

// Semantic domains: an admin-managed Lookup list; concepts carry several, optional for submitters, editable by admins

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

const domain = (label, active = true) => Lookup.create({ type: 'semanticDomain', key: label, label, active });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Lookup.init(), Concept.init()]);
});

beforeEach(async () => {
  await ensureSystemLookups();
  await domain('Food');
  await domain('Farming');
  await domain('Retired', false);
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

describe('the domain list', () => {
  test('no domains are built in', async () => {
    await Lookup.deleteMany({ type: 'semanticDomain' });
    await ensureSystemLookups();
    expect(await Lookup.countDocuments({ type: 'semanticDomain' })).toBe(0);
  });

  test('an admin adds a domain and can deactivate it', async () => {
    const admin = await makeUser('admin');
    const res = await send('post', '/api/lookups', admin.token, { type: 'semanticDomain', label: 'Weather' });
    expect(res.status).toBe(201);
    const off = await send('patch', `/api/lookups/${res.body.data._id}/deactivate`, admin.token);
    expect(off.status).toBe(200);
  });

  test('a moderator cannot add a domain', async () => {
    const mod = await makeUser('moderator');
    const res = await send('post', '/api/lookups', mod.token, { type: 'semanticDomain', label: 'Weather' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/concepts with domains', () => {
  test('stores several active domains, without duplicates', async () => {
    const user = await makeUser();
    const res = await send('post', '/api/concepts', user.token, {
      englishGloss: 'bread', partOfSpeech: 'noun', semanticDomains: ['Food', 'Farming', 'Food'],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.semanticDomains).toEqual(['Food', 'Farming']);
  });

  test('domains are optional', async () => {
    const user = await makeUser();
    const res = await send('post', '/api/concepts', user.token, { englishGloss: 'bread', partOfSpeech: 'noun' });
    expect(res.status).toBe(201);
    expect(res.body.data.semanticDomains).toBeUndefined();
  });

  test.each([
    ['an unknown domain', ['Nope']],
    ['a deactivated domain', ['Retired']],
    ['a non-array value', 'Food'],
    ['more than 10 domains', Array.from({ length: 11 }, (_, i) => `D${i}`)],
  ])('rejects %s with 400', async (_name, semanticDomains) => {
    const user = await makeUser();
    const res = await send('post', '/api/concepts', user.token, { englishGloss: 'bread', partOfSpeech: 'noun', semanticDomains });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toMatch(/semanticDomains/);
    expect(await Concept.countDocuments()).toBe(0);
  });
});

describe('PATCH /api/concepts/:id/edit (admin)', () => {
  test('changes domains and logs the change', async () => {
    const admin = await makeUser('admin');
    const concept = await Concept.create({ englishGloss: 'bread', partOfSpeech: 'noun', status: 'published', semanticDomains: ['Food'] });
    const res = await send('patch', `/api/concepts/${concept._id}/edit`, admin.token, { semanticDomains: ['Food', 'Farming'], note: 'tagging' });
    expect(res.status).toBe(200);
    expect((await Concept.findById(concept._id)).semanticDomains).toEqual(['Food', 'Farming']);
    const log = await ModerationLog.findOne({ targetId: concept._id, action: 'edited' });
    expect(log.changes.semanticDomains).toEqual({ from: 'Food', to: 'Food, Farming' });
  });

  test('an empty list clears the domains', async () => {
    const admin = await makeUser('admin');
    const concept = await Concept.create({ englishGloss: 'bread', partOfSpeech: 'noun', status: 'published', semanticDomains: ['Food'] });
    await send('patch', `/api/concepts/${concept._id}/edit`, admin.token, { semanticDomains: [], note: 'untag' });
    expect((await Concept.findById(concept._id)).semanticDomains).toBeUndefined();
  });

  test('a deactivated domain already on the concept stays valid', async () => {
    const admin = await makeUser('admin');
    const concept = await Concept.create({ englishGloss: 'bread', partOfSpeech: 'noun', status: 'published', semanticDomains: ['Retired'] });
    const res = await send('patch', `/api/concepts/${concept._id}/edit`, admin.token, { semanticDomains: ['Retired', 'Food'], note: 'add' });
    expect(res.status).toBe(200);
  });

  test('a moderator cannot edit domains', async () => {
    const mod = await makeUser('moderator');
    const concept = await Concept.create({ englishGloss: 'bread', partOfSpeech: 'noun', status: 'published' });
    const res = await send('patch', `/api/concepts/${concept._id}/edit`, mod.token, { semanticDomains: ['Food'], note: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('resubmit (PATCH /api/concepts/:id)', () => {
  test('the submitter can set domains when resubmitting', async () => {
    const user = await makeUser();
    const concept = await Concept.create({ englishGloss: 'bread', partOfSpeech: 'noun', status: 'rejected', submittedBy: user.id });
    const res = await send('patch', `/api/concepts/${concept._id}`, user.token, { semanticDomains: ['Farming'] });
    expect(res.status).toBe(200);
    expect(res.body.data.semanticDomains).toEqual(['Farming']);
    expect(res.body.data.status).toBe('pending');
  });
});

describe('filtering by domain', () => {
  beforeEach(async () => {
    const bread = await Concept.create({ englishGloss: 'bread', partOfSpeech: 'noun', status: 'published', semanticDomains: ['Food'] });
    const plough = await Concept.create({ englishGloss: 'plough', partOfSpeech: 'noun', status: 'published', semanticDomains: ['Farming'] });
    await Variant.create({ concept: bread._id, pashto: 'ډوډۍ', phonetic: 'dodai', region: 'Kohat', definition: 'bread', status: 'published' });
    await Variant.create({ concept: plough._id, pashto: 'قلبه', phonetic: 'qulba', region: 'Kohat', definition: 'plough', status: 'published' });
  });

  test('GET /api/concepts?domain= returns only that domain, with a matching total', async () => {
    const res = await request.get('/api/concepts?domain=Food');
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['bread']);
    expect(res.body.meta.total).toBe(1);
  });

  test('GET /api/concepts/search?domain= narrows search results', async () => {
    const all = await request.get('/api/concepts/search?q=o');
    expect(all.body.data).toHaveLength(2);
    const res = await request.get('/api/concepts/search?q=o&domain=Farming');
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['plough']);
  });
});

describe('merging concepts', () => {
  test('the target gains the source domains', async () => {
    const admin = await makeUser('admin');
    const source = await Concept.create({ englishGloss: 'loaf', partOfSpeech: 'noun', status: 'published', semanticDomains: ['Food', 'Farming'] });
    const target = await Concept.create({ englishGloss: 'bread', partOfSpeech: 'noun', status: 'published', semanticDomains: ['Food'] });
    const res = await send('post', `/api/concepts/${source._id}/merge`, admin.token, { targetConceptId: target._id.toString(), note: 'same' });
    expect(res.status).toBe(200);
    expect((await Concept.findById(target._id)).semanticDomains).toEqual(['Food', 'Farming']);
    const log = await ModerationLog.findOne({ targetId: source._id, action: 'merged' });
    expect(log.changes.domainsAdded).toEqual(['Farming']);
  });
});
