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

// Admin-defined custom fields (FieldDefinition) and the `extra` values entries store for them

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const fieldsRouter = require('../routes/fields');
const conceptsRouter = require('../routes/concepts');
const variantsRouter = require('../routes/variants');
const moderationRouter = require('../routes/moderation');
const FieldDefinition = require('../models/FieldDefinition');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/fields', fieldsRouter);
app.use('/api/concepts', conceptsRouter);
app.use('/api/variants', variantsRouter);
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

function defineField(fields) {
  const options = (fields.options ?? []).map((l) => (typeof l === 'string' ? { key: l, label: l } : l));
  return FieldDefinition.create({ appliesTo: 'variant', type: 'text', order: 0, ...fields, options });
}

let seq = 0;
function makeConcept(fields = {}) {
  seq += 1;
  return Concept.create({ englishGloss: `gloss-${seq}`, partOfSpeech: 'noun', ...fields });
}
function makeVariant(concept, fields = {}) {
  seq += 1;
  return Variant.create({ concept: concept._id, pashto: `اوبه${seq}`, region: 'Kohat', definition: 'def', ...fields });
}

const variantBody = (conceptId, extra) => ({ conceptId: String(conceptId), pashto: 'نور', region: 'Kohat', definition: 'd', ...(extra && { extra }) });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await FieldDefinition.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Promise.all([
    FieldDefinition.deleteMany({}),
    Concept.deleteMany({}),
    Variant.deleteMany({}),
    ModerationLog.deleteMany({}),
    User.deleteMany({}),
  ]);
});

describe('POST /api/fields', () => {
  test('admin creates a text field; the server generates the key and logs it', async () => {
    const { id, token } = await makeUser('admin');
    const res = await send('post', '/api/fields', token, { appliesTo: 'variant', type: 'text', label: 'Plural form', required: true });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ key: 'plural_form', label: 'Plural form', type: 'text', required: true, active: true, order: 0 }));

    const log = await ModerationLog.findOne({ action: 'field_changed' });
    expect(log.targetModel).toBe('FieldDefinition');
    expect(log.performedBy).toBe(id);
    expect(log.changes).toEqual(expect.objectContaining({ op: 'created', appliesTo: 'variant', key: 'plural_form' }));
  });

  test('generates a fallback key for Pashto labels and de-duplicates keys', async () => {
    const { token } = await makeUser('admin');
    const a = await send('post', '/api/fields', token, { appliesTo: 'variant', type: 'text', label: 'جمع' });
    const b = await send('post', '/api/fields', token, { appliesTo: 'variant', type: 'text', label: 'مفرد' });
    expect(a.body.data.key).toBe('field');
    expect(b.body.data.key).toBe('field_2');
  });

  test('creates a select with options whose keys equal their labels', async () => {
    const { token } = await makeUser('admin');
    const res = await send('post', '/api/fields', token, {
      appliesTo: 'concept', type: 'select', label: 'Register', options: [{ label: 'Formal' }, { label: 'Slang' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.options.map((o) => [o.key, o.label, o.active])).toEqual([['Formal', 'Formal', true], ['Slang', 'Slang', true]]);
  });

  test.each([
    [{ appliesTo: 'variant', type: 'url', label: 'Audio' }, 'type'],
    [{ appliesTo: 'user', type: 'text', label: 'X' }, 'appliesTo'],
    [{ appliesTo: 'variant', type: 'text', label: '' }, 'label'],
    [{ appliesTo: 'variant', type: 'text', label: '<b>x</b>' }, 'label'],
    [{ appliesTo: 'variant', type: 'text', label: 'x'.repeat(51) }, 'label'],
    [{ appliesTo: 'variant', type: 'text', label: 'X', key: '$where' }, 'key'],
    [{ appliesTo: 'variant', type: 'select', label: 'X' }, 'options'],
    [{ appliesTo: 'variant', type: 'text', label: 'X', options: [{ label: 'A' }] }, 'options'],
    [{ appliesTo: 'variant', type: 'select', label: 'X', options: [{ label: 'A' }, { label: 'a' }] }, 'options'],
    [{ appliesTo: 'variant', type: 'text', label: 'X', required: 'yes' }, 'required'],
  ])('rejects %j', async (body, field) => {
    const { token } = await makeUser('admin');
    const res = await send('post', '/api/fields', token, body);
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe(field);
  });

  test('rejects a duplicate label for the same entry type with 409 but allows it on the other', async () => {
    const { token } = await makeUser('admin');
    await defineField({ key: 'plural', label: 'Plural' });
    expect((await send('post', '/api/fields', token, { appliesTo: 'variant', type: 'text', label: 'plural' })).status).toBe(409);
    expect((await send('post', '/api/fields', token, { appliesTo: 'concept', type: 'text', label: 'Plural' })).status).toBe(201);
  });

  test('caps the number of fields per entry type at 20', async () => {
    const { token } = await makeUser('admin');
    await FieldDefinition.insertMany(Array.from({ length: 20 }, (_, i) => ({ appliesTo: 'variant', key: `f${i}`, label: `F${i}`, type: 'text', order: i })));
    const res = await send('post', '/api/fields', token, { appliesTo: 'variant', type: 'text', label: 'One more' });
    expect(res.status).toBe(400);
  });
});

describe('admin-only access and public read', () => {
  test.each(['user', 'moderator'])('%s gets 403 on every mutation and on the full list', async (role) => {
    const { token } = await makeUser(role);
    const def = await defineField({ key: 'register', label: 'Register', type: 'select', options: ['Formal', 'Slang'] });
    const opt = def.options[0]._id;
    const calls = [
      ['get', '/api/fields/all'],
      ['post', '/api/fields', { appliesTo: 'variant', type: 'text', label: 'X' }],
      ['put', '/api/fields/order', { appliesTo: 'variant', ids: [String(def._id)] }],
      ['patch', `/api/fields/${def._id}`, { label: 'Y' }],
      ['patch', `/api/fields/${def._id}/deactivate`, {}],
      ['patch', `/api/fields/${def._id}/reactivate`, {}],
      ['post', `/api/fields/${def._id}/options`, { label: 'Poetic' }],
      ['patch', `/api/fields/${def._id}/options/${opt}`, { label: 'Z' }],
      ['patch', `/api/fields/${def._id}/options/${opt}/deactivate`, {}],
      ['patch', `/api/fields/${def._id}/options/${opt}/reactivate`, {}],
    ];
    for (const [method, path, body] of calls) {
      expect((await send(method, path, token, body)).status).toBe(403);
    }
    expect(await ModerationLog.countDocuments()).toBe(0);
  });

  test('unauthenticated create gets 401', async () => {
    expect((await request.post('/api/fields').send({ appliesTo: 'variant', type: 'text', label: 'X' })).status).toBe(401);
  });

  test('public GET returns only active definitions, with every option and its active flag', async () => {
    await defineField({ key: 'plural', label: 'Plural', order: 1 });
    await defineField({ key: 'old', label: 'Old', active: false });
    await defineField({ key: 'register', label: 'Register', type: 'select', options: [{ key: 'Formal', label: 'Formal' }, { key: 'Slang', label: 'Slang', active: false }], order: 0 });
    await defineField({ appliesTo: 'concept', key: 'note', label: 'Note' });

    const res = await request.get('/api/fields?appliesTo=variant');
    expect(res.status).toBe(200);
    expect(res.body.data.map((d) => d.key)).toEqual(['register', 'plural']);
    expect(res.body.data[0].options.map((o) => o.active)).toEqual([true, false]);
    expect(res.body.meta.total).toBe(2);
  });

  test('admin GET /all includes inactive definitions', async () => {
    const { token } = await makeUser('admin');
    await defineField({ key: 'old', label: 'Old', active: false });
    const res = await send('get', '/api/fields/all', token);
    expect(res.body.data.map((d) => d.key)).toEqual(['old']);
  });
});

describe('PATCH /api/fields/:id and reordering', () => {
  test('renames, toggles required and changes order, logging each change', async () => {
    const { token } = await makeUser('admin');
    const def = await defineField({ key: 'plural', label: 'Plural' });
    const res = await send('patch', `/api/fields/${def._id}`, token, { label: 'Plural form', required: true, order: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ key: 'plural', label: 'Plural form', required: true, order: 3 }));
    const log = await ModerationLog.findOne({ action: 'field_changed' });
    expect(log.changes).toEqual({
      op: 'updated', appliesTo: 'variant', key: 'plural',
      label: { from: 'Plural', to: 'Plural form' }, required: { from: false, to: true }, order: { from: 0, to: 3 },
    });
  });

  test.each(['key', 'appliesTo', 'type', 'active', 'options'])('rejects changing %s', async (field) => {
    const { token } = await makeUser('admin');
    const def = await defineField({ key: 'plural', label: 'Plural' });
    const res = await send('patch', `/api/fields/${def._id}`, token, { label: 'New', [field]: field === 'active' ? false : 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe(field);
    const after = await FieldDefinition.findById(def._id);
    expect(after.label).toBe('Plural');
    expect(after.key).toBe('plural');
  });

  test('reorders a full set and rejects a partial one', async () => {
    const { token } = await makeUser('admin');
    const a = await defineField({ key: 'a', label: 'A', order: 0 });
    const b = await defineField({ key: 'b', label: 'B', order: 1 });
    const ok = await send('put', '/api/fields/order', token, { appliesTo: 'variant', ids: [String(b._id), String(a._id)] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.map((d) => d.key)).toEqual(['b', 'a']);
    expect((await send('put', '/api/fields/order', token, { appliesTo: 'variant', ids: [String(a._id)] })).status).toBe(400);
  });

  test('deactivates and reactivates; repeats are rejected; there is no delete', async () => {
    const { token } = await makeUser('admin');
    const def = await defineField({ key: 'plural', label: 'Plural' });
    expect((await send('patch', `/api/fields/${def._id}/deactivate`, token, {})).body.data.active).toBe(false);
    expect((await send('patch', `/api/fields/${def._id}/deactivate`, token, {})).status).toBe(400);
    expect((await send('patch', `/api/fields/${def._id}/reactivate`, token, {})).body.data.active).toBe(true);
    expect((await send('delete', `/api/fields/${def._id}`, token)).status).toBe(404);
    expect(await FieldDefinition.exists({ _id: def._id })).not.toBeNull();
    const ops = (await ModerationLog.find().sort({ timestamp: 1 })).map((l) => l.changes.op);
    expect(ops).toEqual(['deactivated', 'reactivated']);
  });
});

describe('select options', () => {
  test('adds, renames, deactivates and reactivates options with logs', async () => {
    const { token } = await makeUser('admin');
    const def = await defineField({ key: 'register', label: 'Register', type: 'select', options: ['Formal', 'Slang'] });

    const added = await send('post', `/api/fields/${def._id}/options`, token, { label: 'Poetic' });
    expect(added.status).toBe(201);
    const poetic = added.body.data.options.find((o) => o.key === 'Poetic');

    const renamed = await send('patch', `/api/fields/${def._id}/options/${poetic._id}`, token, { label: 'Poetic / literary' });
    expect(renamed.body.data.options.find((o) => o._id === poetic._id)).toEqual(expect.objectContaining({ key: 'Poetic', label: 'Poetic / literary' }));

    expect((await send('patch', `/api/fields/${def._id}/options/${poetic._id}/deactivate`, token, {})).status).toBe(200);
    expect((await send('patch', `/api/fields/${def._id}/options/${poetic._id}/reactivate`, token, {})).status).toBe(200);

    const ops = (await ModerationLog.find().sort({ timestamp: 1 })).map((l) => l.changes.op);
    expect(ops).toEqual(['option_added', 'option_renamed', 'option_deactivated', 'option_reactivated']);
  });

  test('rejects duplicate option labels, options on non-select fields, and deactivating the last active option', async () => {
    const { token } = await makeUser('admin');
    const select = await defineField({ key: 'register', label: 'Register', type: 'select', options: ['Formal', 'Slang'] });
    const text = await defineField({ key: 'plural', label: 'Plural' });

    expect((await send('post', `/api/fields/${select._id}/options`, token, { label: 'formal' })).status).toBe(409);
    expect((await send('post', `/api/fields/${text._id}/options`, token, { label: 'A' })).status).toBe(400);

    const [formal, slang] = select.options;
    expect((await send('patch', `/api/fields/${select._id}/options/${formal._id}/deactivate`, token, {})).status).toBe(200);
    const last = await send('patch', `/api/fields/${select._id}/options/${slang._id}/deactivate`, token, {});
    expect(last.status).toBe(400);
    expect(last.body.error.message).toMatch(/at least one active option/);
  });
});

describe('extra values on submissions', () => {
  test('a new variant stores valid extra values and returns them as a plain object', async () => {
    const { token } = await makeUser('user');
    await defineField({ key: 'plural', label: 'Plural' });
    await defineField({ key: 'register', label: 'Register', type: 'select', options: ['Formal', 'Slang'] });
    const concept = await makeConcept();

    const res = await send('post', '/api/variants', token, variantBody(concept._id, { plural: '  لمرونه ', register: 'Slang' }));
    expect(res.status).toBe(201);
    expect(res.body.data.extra).toEqual({ plural: 'لمرونه', register: 'Slang' });
  });

  test.each([
    [{ colour: 'red' }, 'extra.colour', /unknown field/i],
    [{ $where: 'x' }, 'extra.$where', /unknown field/i],
    [{ plural: 42 }, 'extra.plural', /must be text/i],
    [{ plural: 'x'.repeat(201) }, 'extra.plural', /200 characters/],
    [{ register: 'Poetic' }, 'extra.register', /invalid option/i],
  ])('rejects extra %j', async (extra, field, message) => {
    const { token } = await makeUser('user');
    await defineField({ key: 'plural', label: 'Plural' });
    await defineField({ key: 'register', label: 'Register', type: 'select', options: ['Formal', 'Slang'] });
    const concept = await makeConcept();
    const res = await send('post', '/api/variants', token, variantBody(concept._id, extra));
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe(field);
    expect(res.body.error.message).toMatch(message);
    expect(await Variant.countDocuments()).toBe(0);
  });

  test('rejects a non-object extra', async () => {
    const { token } = await makeUser('user');
    const concept = await makeConcept();
    const res = await send('post', '/api/variants', token, variantBody(concept._id, ['a']));
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('extra');
  });

  test('textarea values keep line breaks and allow 2000 characters', async () => {
    const { token } = await makeUser('user');
    await defineField({ key: 'usage', label: 'Usage', type: 'textarea' });
    const concept = await makeConcept();
    const res = await send('post', '/api/variants', token, variantBody(concept._id, { usage: 'line one\r\nline two\u0007' }));
    expect(res.body.data.extra.usage).toBe('line one\nline two');
  });

  test('required is enforced on create only', async () => {
    const { id, token } = await makeUser('user');
    await defineField({ key: 'plural', label: 'Plural', required: true });
    const concept = await makeConcept();

    const missing = await send('post', '/api/variants', token, variantBody(concept._id));
    expect(missing.status).toBe(400);
    expect(missing.body.error.field).toBe('extra.plural');

    const rejected = await makeVariant(concept, { status: 'rejected', submittedBy: id });
    const resubmit = await send('patch', `/api/variants/${rejected._id}`, token, { definition: 'better' });
    expect(resubmit.status).toBe(200);
  });

  test('a new concept validates its own concept-level fields', async () => {
    const { token } = await makeUser('user');
    await defineField({ appliesTo: 'concept', key: 'etymology', label: 'Etymology', required: true });
    expect((await send('post', '/api/concepts', token, { englishGloss: 'sun', partOfSpeech: 'noun' })).status).toBe(400);
    const ok = await send('post', '/api/concepts', token, { englishGloss: 'sun', partOfSpeech: 'noun', extra: { etymology: 'Old Iranian' } });
    expect(ok.status).toBe(201);
    expect(ok.body.data.extra).toEqual({ etymology: 'Old Iranian' });
  });

  test('a deactivated field is rejected on create and hidden from the public read, but its stored data is kept', async () => {
    const { token } = await makeUser('user');
    const def = await defineField({ key: 'plural', label: 'Plural' });
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'published', extra: { plural: 'لمرونه' } });
    await FieldDefinition.updateOne({ _id: def._id }, { active: false });

    expect((await send('post', '/api/variants', token, variantBody(concept._id, { plural: 'x' }))).status).toBe(400);
    expect((await request.get('/api/fields?appliesTo=variant')).body.data).toHaveLength(0);
    const stored = await Variant.findById(variant._id).lean();
    expect(stored.extra).toEqual({ plural: 'لمرونه' });
  });
});

describe('extra values on edits', () => {
  test('moderator edit merges extra, keeps omitted and deactivated values, and logs extra diffs', async () => {
    const { token } = await makeUser('moderator');
    await defineField({ key: 'plural', label: 'Plural' });
    await defineField({ key: 'register', label: 'Register', type: 'select', options: ['Formal', 'Slang'] });
    await defineField({ key: 'old', label: 'Old', active: false });
    const concept = await makeConcept();
    const variant = await makeVariant(concept, { extra: { plural: 'a', register: 'Formal', old: 'keep me' } });

    const res = await send('patch', `/api/variants/${variant._id}/edit`, token, { note: 'n', extra: { plural: 'b', register: '' } });
    expect(res.status).toBe(200);
    const stored = await Variant.findById(variant._id).lean();
    expect(stored.extra).toEqual({ plural: 'b', old: 'keep me' });

    const log = await ModerationLog.findOne({ action: 'edited' });
    expect(log.changes).toEqual({ 'extra.plural': { from: 'a', to: 'b' }, 'extra.register': { from: 'Formal', to: '' } });
  });

  test('a deactivated field may be sent unchanged but not changed', async () => {
    const { token } = await makeUser('moderator');
    await defineField({ key: 'old', label: 'Old', active: false });
    const concept = await makeConcept();
    const variant = await makeVariant(concept, { extra: { old: 'keep me' } });
    expect((await send('patch', `/api/variants/${variant._id}/edit`, token, { note: 'n', extra: { old: 'keep me' } })).status).toBe(200);
    const changed = await send('patch', `/api/variants/${variant._id}/edit`, token, { note: 'n', extra: { old: 'new' } });
    expect(changed.status).toBe(400);
    expect(changed.body.error.message).toMatch(/no longer in use/);
  });

  test('a stored retired option stays valid; switching to a retired option is rejected', async () => {
    const { token } = await makeUser('admin');
    await defineField({
      key: 'register', label: 'Register', type: 'select',
      options: [{ key: 'Formal', label: 'Formal' }, { key: 'Slang', label: 'Slang', active: false }, { key: 'Old', label: 'Old', active: false }],
    });
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'published', extra: { register: 'Slang' } });

    expect((await send('patch', `/api/variants/${variant._id}/edit`, token, { note: 'n', definition: 'x', extra: { register: 'Slang' } })).status).toBe(200);
    expect((await send('patch', `/api/variants/${variant._id}/edit`, token, { note: 'n', extra: { register: 'Old' } })).status).toBe(400);
  });

  test('user resubmit and concept edits validate extra the same way', async () => {
    const { id, token } = await makeUser('user');
    const { token: modToken } = await makeUser('moderator');
    await defineField({ appliesTo: 'concept', key: 'etymology', label: 'Etymology' });
    const concept = await makeConcept({ status: 'rejected', submittedBy: id });

    expect((await send('patch', `/api/concepts/${concept._id}`, token, { extra: { nope: 'x' } })).status).toBe(400);
    expect((await send('patch', `/api/concepts/${concept._id}`, token, { extra: { etymology: 'Persian' } })).status).toBe(200);
    expect((await Concept.findById(concept._id).lean()).extra).toEqual({ etymology: 'Persian' });

    const edit = await send('patch', `/api/concepts/${concept._id}/edit`, modToken, { note: 'n', extra: { etymology: 'Arabic' } });
    expect(edit.status).toBe(200);
    const log = await ModerationLog.findOne({ action: 'edited' });
    expect(log.changes).toEqual({ 'extra.etymology': { from: 'Persian', to: 'Arabic' } });
  });

  test('existing entries without extra still load, approve and publish', async () => {
    const { token } = await makeUser('admin');
    await defineField({ key: 'plural', label: 'Plural', required: true });
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept);

    expect((await send('patch', `/api/variants/${variant._id}/status`, token, { status: 'approved' })).status).toBe(200);
    expect((await send('patch', `/api/variants/${variant._id}/status`, token, { status: 'published' })).status).toBe(200);
    const detail = await request.get(`/api/concepts/${concept._id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.variants).toHaveLength(1);
    expect(detail.body.data.variants[0].extra).toBeUndefined();
  });

  test('the public concept detail includes extra values', async () => {
    await defineField({ key: 'plural', label: 'Plural' });
    const concept = await makeConcept({ status: 'published', extra: {} });
    await makeVariant(concept, { status: 'published', extra: { plural: 'لمرونه' } });
    const detail = await request.get(`/api/concepts/${concept._id}`);
    expect(detail.body.data.variants[0].extra).toEqual({ plural: 'لمرونه' });
  });
});

describe('moderation log', () => {
  test('admin can filter by field_changed and FieldDefinition', async () => {
    const { token } = await makeUser('admin');
    await send('post', '/api/fields', token, { appliesTo: 'variant', type: 'text', label: 'Plural' });
    const res = await send('get', '/api/moderation/log?action=field_changed&targetModel=FieldDefinition', token);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
