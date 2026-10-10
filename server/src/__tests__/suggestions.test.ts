jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: () => ({
      verify: async (token) => {
        const parts = (token || '').split('.');
        if (parts.length < 2) throw new Error('Invalid token');
        const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (!p.id && !p.sub) throw new Error('Invalid token');
        return { sub: p.id || p.sub };
      },
    }),
  },
}));

// Suggestions: fill-only proposals for a user's own published variant, their state machine,
// publish-time merge, staff edit lock, cascades, plus admin approved → rejected and duplicate-key 409s

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const conceptsRouter = require('../routes/concepts');
const variantsRouter = require('../routes/variants');
const suggestionsRouter = require('../routes/suggestions');
const moderationRouter = require('../routes/moderation');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const VariantSuggestion = require('../models/VariantSuggestion');
const ModerationLog = require('../models/ModerationLog');
const FieldDefinition = require('../models/FieldDefinition');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/concepts', conceptsRouter);
app.use('/api/variants', variantsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/moderation', moderationRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ success: false, error: { message: err.message || 'Internal server error' } });
});

const request = supertest(app);
let mongoServer;

async function makeUser(role = 'user') {
  const id = new mongoose.Types.ObjectId().toString();
  await User.create({ cognitoSub: id, username: `user-${id.slice(-6)}`, email: `${id.slice(-6)}@test.local`, role });
  const token = jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { id, token };
}

const send = (method, path, token, body?) => {
  const req = request[method](path);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};

let seq = 0;
function makeConcept(fields = {}) {
  seq += 1;
  return Concept.create({ englishGloss: `gloss-${seq}`, partOfSpeech: 'noun', status: 'published', ...fields });
}
function makeVariant(concept, owner, fields = {}) {
  seq += 1;
  return Variant.create({
    concept: concept._id, pashto: `لمر${seq}`, region: 'Kohat', definition: 'sun', status: 'published', submittedBy: owner.id, ...fields,
  });
}

const plural = { kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'لمرونه' };
const singular = { kind: 'noun', gender: 'masculine', number: 'singular', case: 'direct', pashto: 'لمر' };

let owner, mod, admin, other;
async function setup(variantFields = {}, conceptFields = {}) {
  const concept = await makeConcept(conceptFields);
  const variant = await makeVariant(concept, owner, variantFields);
  return { concept, variant };
}
const propose = (variant, body, token = owner.token) => send('post', `/api/variants/${variant._id}/suggestions`, token, body);
const transition = (id, status, token, moderatorNote?) =>
  send('patch', `/api/suggestions/${id}/status`, token, { status, ...(moderatorNote && { moderatorNote }) });

async function approved(variant, body = { phonetic: 'lmar', example: 'لمر راختلی دی' }) {
  const res = await propose(variant, body);
  await transition(res.body.data._id, 'approved', mod.token);
  return res.body.data._id;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Variant.init(), VariantSuggestion.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  [owner, mod, admin, other] = await Promise.all([makeUser(), makeUser('moderator'), makeUser('admin'), makeUser()]);
});

afterEach(async () => {
  await Promise.all([
    Concept.deleteMany({}), Variant.deleteMany({}), VariantSuggestion.deleteMany({}),
    ModerationLog.deleteMany({}), FieldDefinition.deleteMany({}), User.deleteMany({}),
  ]);
});

describe('POST /api/variants/:id/suggestions — create', () => {
  test('creates a pending suggestion and leaves the live word unchanged', async () => {
    const { variant } = await setup();
    const res = await propose(variant, { phonetic: ' lmar ', example: 'لمر راختلی دی' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ status: 'pending', submittedBy: owner.id }));
    expect(res.body.data.proposed).toEqual(expect.objectContaining({ phonetic: 'lmar', example: 'لمر راختلی دی' }));

    const live = await Variant.findById(variant._id).lean();
    expect(live.phonetic).toBeUndefined();
    expect(live.status).toBe('published');
    expect(await ModerationLog.countDocuments({ targetModel: 'VariantSuggestion', action: 'submitted' })).toBe(1);
  });

  test('a filled field cannot be overwritten — 400 naming the field', async () => {
    const { variant } = await setup({ phonetic: 'lmar' });
    const res = await propose(variant, { phonetic: 'nmar' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('phonetic');
  });

  test('a filled form slot cannot be overwritten, but an empty one can be added', async () => {
    const { variant } = await setup({ forms: [singular] });
    const clash = await propose(variant, { forms: [{ ...singular, pashto: 'نمر' }] });
    expect(clash.status).toBe(400);
    expect(clash.body.error.field).toBe('forms.masculine.singular.direct');

    const ok = await propose(variant, { forms: [plural] });
    expect(ok.status).toBe(201);
  });

  test('a filled custom field cannot be overwritten; required fields cannot be suggested', async () => {
    await FieldDefinition.create({ appliesTo: 'variant', key: 'register', label: 'Register', type: 'text' });
    await FieldDefinition.create({ appliesTo: 'variant', key: 'source', label: 'Source', type: 'text', required: true });
    const { variant } = await setup({ extra: { register: 'Formal' } });

    const filled = await propose(variant, { extra: { register: 'Poetic' } });
    expect(filled.status).toBe(400);
    expect(filled.body.error.field).toBe('extra.register');

    const required = await propose(variant, { extra: { source: 'Book' } });
    expect(required.status).toBe(400);
    expect(required.body.error.field).toBe('extra.source');
  });

  test('core fields cannot be changed by a suggestion', async () => {
    const { variant } = await setup();
    const res = await propose(variant, { phonetic: 'lmar', definition: 'star' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('definition');
  });

  test('an empty proposal is rejected', async () => {
    const { variant } = await setup();
    const res = await propose(variant, { phonetic: '  ' });
    expect(res.status).toBe(400);
  });

  test('forms must match the concept part of speech', async () => {
    const { variant } = await setup({}, { partOfSpeech: 'adverb' });
    const res = await propose(variant, { forms: [plural] });
    expect(res.status).toBe(400);
  });

  test('a non-owner cannot suggest phonetic, example or extra fields', async () => {
    const { variant } = await setup();
    for (const body of [{ phonetic: 'lmar' }, { example: 'x' }, { extra: { note: 'x' } }, { phonetic: 'lmar', forms: [plural] }]) {
      const res = await propose(variant, body, other.token);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/only the word's submitter/i);
    }
    expect(await VariantSuggestion.countDocuments()).toBe(0);
  });

  test('a suggestion on an unpublished variant is rejected', async () => {
    const { variant } = await setup({ status: 'pending' });
    const res = await propose(variant, { phonetic: 'lmar' });
    expect(res.status).toBe(400);
  });

  test('only one open suggestion per variant', async () => {
    const { variant } = await setup();
    expect((await propose(variant, { phonetic: 'lmar' })).status).toBe(201);
    expect((await propose(variant, { example: 'x' })).status).toBe(409);
  });

  test('the unique index enforces one open suggestion even without the pre-check', async () => {
    const { variant } = await setup();
    await VariantSuggestion.create({ variant: variant._id, proposed: { phonetic: 'a' }, submittedBy: owner.id });
    await expect(VariantSuggestion.create({ variant: variant._id, proposed: { phonetic: 'b' }, submittedBy: owner.id }))
      .rejects.toMatchObject({ code: 11000 });
    await VariantSuggestion.create({ variant: variant._id, proposed: { phonetic: 'c' }, submittedBy: owner.id, status: 'rejected' });
  });
});

describe('PATCH /api/suggestions/:id/status — state machine', () => {
  test('moderator approves, admin publishes and the fields merge into the live word', async () => {
    const { variant } = await setup({ forms: [singular] });
    const created = await propose(variant, { phonetic: 'Lmar', example: 'لمر راختلی دی', forms: [plural] });
    const id = created.body.data._id;

    expect((await transition(id, 'approved', mod.token)).status).toBe(200);
    const live = await Variant.findById(variant._id).lean();
    expect(live.phonetic).toBeUndefined();

    const res = await transition(id, 'published', admin.token);
    expect(res.status).toBe(200);
    const merged = await Variant.findById(variant._id).lean();
    expect(merged).toEqual(expect.objectContaining({ phonetic: 'Lmar', normalizedPhonetic: 'lmar', example: 'لمر راختلی دی', status: 'published' }));
    expect(merged.forms.map((f) => f.number)).toEqual(['singular', 'plural']);
    expect(merged.forms[1].normalizedPashto).toBe('لمرونه');

    const applied = await ModerationLog.findOne({ targetModel: 'Variant', action: 'suggestion_applied' }).lean();
    expect(applied.changes.phonetic).toEqual({ from: '', to: 'Lmar' });
    expect(applied.changes['forms.masculine.plural.direct']).toEqual({ from: null, to: { pashto: 'لمرونه' } });
    expect(String(applied.changes.suggestionId)).toBe(id);
  });

  test('every transition writes a log entry', async () => {
    const { variant } = await setup();
    const id = await approved(variant);
    await transition(id, 'published', admin.token);
    const actions = (await ModerationLog.find({ targetModel: 'VariantSuggestion', targetId: id }).lean()).map((l) => l.action);
    expect(actions.sort()).toEqual(['approved', 'published', 'submitted']);
  });

  test('moderator cannot publish', async () => {
    const { variant } = await setup();
    const id = await approved(variant);
    const res = await transition(id, 'published', mod.token);
    expect(res.status).toBe(403);
  });

  test('invalid transitions return 400', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { phonetic: 'lmar' });
    expect((await transition(body.data._id, 'published', admin.token)).status).toBe(400);

    await transition(body.data._id, 'rejected', mod.token, 'no');
    expect((await transition(body.data._id, 'approved', admin.token)).status).toBe(400);
  });

  test('rejecting needs a note', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { phonetic: 'lmar' });
    expect((await transition(body.data._id, 'rejected', mod.token)).status).toBe(400);
  });

  test('moderator cannot approve or reject their own suggestion', async () => {
    const concept = await makeConcept();
    const variant = await makeVariant(concept, mod);
    const { body } = await propose(variant, { phonetic: 'lmar' }, mod.token);
    expect((await transition(body.data._id, 'approved', mod.token)).status).toBe(403);
  });

  test('admin can reject an approved suggestion with a note; moderator cannot', async () => {
    const { variant } = await setup();
    const id = await approved(variant);
    expect((await transition(id, 'rejected', mod.token, 'typo')).status).toBe(403);
    const res = await transition(id, 'rejected', admin.token, 'typo');
    expect(res.status).toBe(200);
    expect(res.body.data.suggestion).toEqual(expect.objectContaining({ status: 'rejected', moderatorNote: 'typo' }));
  });

  test('moderators only see pending suggestions; admins can list approved', async () => {
    const { variant } = await setup();
    await approved(variant);
    const modList = await send('get', '/api/moderation/suggestions?status=approved', mod.token);
    expect(modList.body.data).toHaveLength(0);
    const adminList = await send('get', '/api/moderation/suggestions?status=approved', admin.token);
    expect(adminList.body.data).toHaveLength(1);
    expect(adminList.body.data[0].variant.pashto).toBe(variant.pashto);
    expect(adminList.body.meta).toEqual(expect.objectContaining({ total: 1, approvedCount: 1, pendingCount: 0 }));
  });
});

describe('GET /api/moderation/suggestions?concept=', () => {
  test('lists open suggestions on one concept for the admin panel', async () => {
    const { concept, variant } = await setup();
    const elsewhere = await setup();
    const id = await approved(variant);
    await propose(elsewhere.variant, { phonetic: 'x' });

    const res = await send('get', `/api/moderation/suggestions?concept=${concept._id}`, admin.token);
    expect(res.status).toBe(200);
    expect(res.body.data.map((g) => g.suggestions.map((s) => s._id))).toEqual([[id]]);
    expect((await send('get', '/api/moderation/suggestions?concept=nope', admin.token)).status).toBe(400);
  });
});

describe('publish-time re-check', () => {
  test('a field filled since approval refuses the publish and keeps the suggestion approved', async () => {
    const { variant } = await setup();
    const id = await approved(variant);
    await Variant.updateOne({ _id: variant._id }, { phonetic: 'lmər' });

    const res = await transition(id, 'published', admin.token);
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('phonetic');
    expect((await VariantSuggestion.findById(id).lean()).status).toBe('approved');
    expect((await Variant.findById(variant._id).lean()).example).toBeUndefined();
  });

  test('a part-of-speech change that no longer allows the forms refuses the publish', async () => {
    const { concept, variant } = await setup();
    const id = await approved(variant, { forms: [plural] });
    await Concept.updateOne({ _id: concept._id }, { partOfSpeech: 'adverb' });
    const res = await transition(id, 'published', admin.token);
    expect(res.status).toBe(400);
    expect((await VariantSuggestion.findById(id).lean()).status).toBe('approved');
  });

  test('a word no longer published cannot have its suggestion published', async () => {
    const { variant } = await setup();
    const id = await approved(variant);
    await Variant.updateOne({ _id: variant._id }, { status: 'rejected', isDeleted: true });
    expect((await transition(id, 'published', admin.token)).status).toBe(400);
  });
});

describe('GET /api/moderation/log — suggestion entries', () => {
  test('filters by VariantSuggestion and suggestion_applied and labels entries with the word', async () => {
    const { variant } = await setup();
    const id = await approved(variant);
    await transition(id, 'published', admin.token);

    const bySuggestion = await send('get', '/api/moderation/log?targetModel=VariantSuggestion', admin.token);
    expect(bySuggestion.body.meta.total).toBe(3);
    expect(bySuggestion.body.data[0].target).toEqual(expect.objectContaining({ pashto: variant.pashto, region: 'Kohat' }));

    const applied = await send('get', '/api/moderation/log?action=suggestion_applied', admin.token);
    expect(applied.body.data).toHaveLength(1);
    expect(applied.body.data[0].targetModel).toBe('Variant');
  });
});

describe('PATCH /api/suggestions/:id — owner resubmit', () => {
  test('rejected → pending with new values', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { phonetic: 'lmar' });
    await transition(body.data._id, 'rejected', mod.token, 'spelling');
    const res = await send('patch', `/api/suggestions/${body.data._id}`, owner.token, { phonetic: 'lmaar' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ status: 'pending' }));
    expect(res.body.data.proposed.phonetic).toBe('lmaar');
    expect(res.body.data.moderatorNote).toBeUndefined();
    expect(await ModerationLog.countDocuments({ action: 'resubmitted', targetModel: 'VariantSuggestion' })).toBe(1);
  });

  test('non-owner gets 403; a pending suggestion cannot be resubmitted', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { phonetic: 'lmar' });
    expect((await send('patch', `/api/suggestions/${body.data._id}`, other.token, { phonetic: 'x' })).status).toBe(403);
    expect((await send('patch', `/api/suggestions/${body.data._id}`, owner.token, { phonetic: 'x' })).status).toBe(400);
  });
});

describe('PATCH /api/suggestions/:id/edit — admin edit inside the review', () => {
  test('admin edits a pending suggestion with a note and the diff is logged', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { phonetic: 'lmar', example: 'tpyo' });
    const res = await send('patch', `/api/suggestions/${body.data._id}/edit`, admin.token, { phonetic: 'lmar', example: 'typo', note: 'fixed' });
    expect(res.status).toBe(200);
    const log = await ModerationLog.findOne({ action: 'edited', targetModel: 'VariantSuggestion' }).lean();
    expect(log.changes).toEqual({ example: { from: 'tpyo', to: 'typo' } });
  });

  test('note is required; edits are still fill-only', async () => {
    const { variant } = await setup({ example: 'set' });
    const { body } = await propose(variant, { phonetic: 'lmar' });
    expect((await send('patch', `/api/suggestions/${body.data._id}/edit`, admin.token, { phonetic: 'x' })).status).toBe(400);
    const filled = await send('patch', `/api/suggestions/${body.data._id}/edit`, admin.token, { example: 'other', note: 'n' });
    expect(filled.status).toBe(400);
    expect(filled.body.error.field).toBe('example');
  });

  test('moderators and plain users cannot edit pending or approved suggestions', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { phonetic: 'lmar' });
    expect((await send('patch', `/api/suggestions/${body.data._id}/edit`, mod.token, { phonetic: 'x', note: 'n' })).status).toBe(403);
    await VariantSuggestion.deleteMany({});
    const id = await approved(variant);
    expect((await send('patch', `/api/suggestions/${id}/edit`, mod.token, { phonetic: 'x', note: 'n' })).status).toBe(403);
    expect((await send('patch', `/api/suggestions/${id}/edit`, owner.token, { phonetic: 'x', note: 'n' })).status).toBe(403);
    expect((await send('patch', `/api/suggestions/${id}/edit`, admin.token, { phonetic: 'x', note: 'n' })).status).toBe(200);
  });
});

describe('staff edit lock on proposed fields', () => {
  test('admin cannot edit a field an open suggestion proposes, but can edit others', async () => {
    const { variant } = await setup();
    await propose(variant, { phonetic: 'lmar' });
    const locked = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, { phonetic: 'lmər', note: 'n' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.field).toBe('phonetic');

    const other = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, { definition: 'the sun', example: 'ex', note: 'n' });
    expect(other.status).toBe(200);
  });

  test('a proposed form slot is locked; unchanged values are not', async () => {
    const { variant } = await setup({ forms: [singular] });
    await propose(variant, { forms: [plural] });
    const unchanged = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, { phonetic: '', forms: [singular], note: 'n' });
    expect(unchanged.status).toBe(200);
    const locked = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, { forms: [singular, plural], note: 'n' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.field).toBe('forms.masculine.plural.direct');
  });

  test('the lock lifts once the suggestion is rejected', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { phonetic: 'lmar' });
    await transition(body.data._id, 'rejected', mod.token, 'no');
    const res = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, { phonetic: 'lmər', note: 'n' });
    expect(res.status).toBe(200);
  });
});

describe('cascade when the word leaves published', () => {
  test('rejecting the variant rejects its open suggestion with a note', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { phonetic: 'lmar' });
    await send('patch', `/api/variants/${variant._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'wrong region' });
    const s = await VariantSuggestion.findById(body.data._id).lean();
    expect(s.status).toBe('rejected');
    expect(s.moderatorNote).toBe('The word was rejected: wrong region');
    expect(await ModerationLog.countDocuments({ targetModel: 'VariantSuggestion', action: 'rejected' })).toBe(1);
  });

  test('rejecting the concept cascades to suggestions on its variants', async () => {
    const { concept, variant } = await setup();
    const id = await approved(variant);
    await send('patch', `/api/concepts/${concept._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'dup' });
    expect((await VariantSuggestion.findById(id).lean()).status).toBe('rejected');
  });

  test('deleting the variant cascades', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { phonetic: 'lmar' });
    await send('delete', `/api/variants/${variant._id}`, admin.token);
    expect((await VariantSuggestion.findById(body.data._id).lean()).status).toBe('rejected');
  });
});

describe('admin approved → rejected for concepts and variants', () => {
  test('admin rejects an approved variant with a note; moderator gets 403; note required', async () => {
    const { variant } = await setup({ status: 'approved' });
    expect((await send('patch', `/api/variants/${variant._id}/status`, mod.token, { status: 'rejected', moderatorNote: 'n' })).status).toBe(403);
    expect((await send('patch', `/api/variants/${variant._id}/status`, admin.token, { status: 'rejected' })).status).toBe(400);
    const res = await send('patch', `/api/variants/${variant._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'n' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ status: 'rejected', isDeleted: true }));
  });

  test('admin rejects an approved concept and its variants cascade', async () => {
    const concept = await makeConcept({ status: 'approved' });
    const variant = await makeVariant(concept, owner, { status: 'approved' });
    expect((await send('patch', `/api/concepts/${concept._id}/status`, mod.token, { status: 'rejected', moderatorNote: 'n' })).status).toBe(403);
    const res = await send('patch', `/api/concepts/${concept._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'dup' });
    expect(res.status).toBe(200);
    expect((await Variant.findById(variant._id).lean()).status).toBe('rejected');
  });
});

describe('duplicate key handling on resubmit and edit', () => {
  test('resubmitting a rejected variant whose slot was taken meanwhile returns 409, not 500', async () => {
    const concept = await makeConcept();
    const rejected = await makeVariant(concept, owner, { pashto: 'لمر', status: 'rejected', isDeleted: true });
    await makeVariant(concept, other, { pashto: 'لمر', status: 'pending' });
    const res = await send('patch', `/api/variants/${rejected._id}`, owner.token, { definition: 'sun again' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already exists/);
  });

  test('creating a variant that clashes with a rejected one is allowed; with a live one is a clean 409', async () => {
    const concept = await makeConcept();
    await makeVariant(concept, other, { pashto: 'لمر', status: 'rejected', isDeleted: true });
    const body = { conceptId: String(concept._id), pashto: 'لمر', region: 'Kohat', definition: 'sun' };
    expect((await send('post', '/api/variants', owner.token, body)).status).toBe(201);
    const dup = await send('post', '/api/variants', owner.token, body);
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('This Pashto word already exists for this concept and region');
  });

  test('a staff edit onto an existing word returns 409, not 500', async () => {
    const concept = await makeConcept();
    await makeVariant(concept, other, { pashto: 'لمر' });
    const target = await makeVariant(concept, owner, { pashto: 'نمر', status: 'pending' });
    const res = await send('patch', `/api/variants/${target._id}/edit`, admin.token, { pashto: 'لمر', note: 'n' });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Community form suggestions: anyone may propose forms; one open suggestion per person per word
// ---------------------------------------------------------------------------

const femPlural = { kind: 'noun', gender: 'feminine', number: 'plural', case: 'direct', pashto: 'لمرې' };

async function publishFlow(id) {
  await transition(id, 'approved', mod.token);
  return transition(id, 'published', admin.token);
}

describe('community form suggestions — create', () => {
  test('any logged-in user can suggest forms for a published word', async () => {
    const { variant } = await setup();
    const res = await propose(variant, { forms: [plural] }, other.token);
    expect(res.status).toBe(201);
    expect(res.body.data.submittedBy).toBe(other.id);
  });

  test('different people can each have an open suggestion on the same word, but not two each', async () => {
    const { variant } = await setup();
    expect((await propose(variant, { forms: [plural] }, other.token)).status).toBe(201);
    expect((await propose(variant, { forms: [plural] }, mod.token)).status).toBe(201);
    expect((await propose(variant, { phonetic: 'lmar' })).status).toBe(201);

    const again = await propose(variant, { forms: [femPlural] }, other.token);
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe('You already have an open suggestion for this word');
    expect(await VariantSuggestion.countDocuments({ variant: variant._id })).toBe(3);
  });

  test('forms are refused when the part of speech has none', async () => {
    const { variant } = await setup({}, { partOfSpeech: 'adverb' });
    const res = await propose(variant, { forms: [plural] }, other.token);
    expect(res.status).toBe(400);
  });

  test('a client-supplied addedBy is rejected', async () => {
    const { variant } = await setup();
    const res = await propose(variant, { forms: [{ ...plural, addedBy: owner.id }] }, other.token);
    expect(res.status).toBe(400);
  });

  test('an unknown or deleted word is 404', async () => {
    const { variant } = await setup({ isDeleted: true });
    expect((await propose(variant, { forms: [plural] }, other.token)).status).toBe(404);
    expect((await send('post', `/api/variants/${new mongoose.Types.ObjectId()}/suggestions`, other.token, { forms: [plural] })).status).toBe(404);
  });
});

describe('community form suggestions — resubmit and admin edit stay forms-only', () => {
  test('a rejected non-owner suggestion can be resubmitted with forms, not other fields', async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { forms: [plural] }, other.token);
    await transition(body.data._id, 'rejected', mod.token, 'typo');

    const bad = await send('patch', `/api/suggestions/${body.data._id}`, other.token, { phonetic: 'x' });
    expect(bad.status).toBe(400);
    const ok = await send('patch', `/api/suggestions/${body.data._id}`, other.token, { forms: [femPlural] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('pending');
  });

  test("an admin cannot add phonetic to a non-owner's suggestion", async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { forms: [plural] }, other.token);
    const res = await send('patch', `/api/suggestions/${body.data._id}/edit`, admin.token, { forms: [plural], phonetic: 'x', note: 'n' });
    expect(res.status).toBe(400);
  });
});

describe('community form suggestions — publish and credit', () => {
  test("publishing credits the contributor on each new form; the owner's own forms carry no credit", async () => {
    const { variant } = await setup({ forms: [singular] });
    const { body } = await propose(variant, { forms: [plural] }, other.token);
    const res = await publishFlow(body.data._id);
    expect(res.status).toBe(200);

    const stored = await Variant.findById(variant._id).lean();
    const bySlot = Object.fromEntries(stored.forms.map((f) => [`${f.gender}.${f.number}.${f.case}`, f]));
    expect(bySlot['masculine.plural.direct'].addedBy).toBe(other.id);
    expect(bySlot['masculine.singular.direct'].addedBy).toBeUndefined();
  });

  test("the owner's own form suggestion is not credited separately", async () => {
    const { variant } = await setup();
    const { body } = await propose(variant, { forms: [plural] });
    await publishFlow(body.data._id);
    expect((await Variant.findById(variant._id).lean()).forms[0].addedBy).toBeUndefined();
  });

  test('credit survives a later suggestion and an admin correction of the same slot', async () => {
    const { variant } = await setup();
    const first = await propose(variant, { forms: [plural] }, other.token);
    await publishFlow(first.body.data._id);
    const second = await propose(variant, { forms: [femPlural] }, admin.token);
    await publishFlow(second.body.data._id);

    const fixed = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, {
      forms: [{ ...plural, pashto: 'لمرونو' }, femPlural], note: 'typo',
    });
    expect(fixed.status).toBe(200);

    const stored = await Variant.findById(variant._id).lean();
    const credit = Object.fromEntries(stored.forms.map((f) => [f.gender, f.addedBy]));
    expect(credit).toEqual({ masculine: other.id, feminine: admin.id });
  });

  test('when two people propose the same slot, the first published wins and the second is refused naming the slot', async () => {
    const { variant } = await setup();
    const a = await propose(variant, { forms: [plural] }, other.token);
    const b = await propose(variant, { forms: [{ ...plural, pashto: 'لمران' }] }, admin.token);
    await transition(b.body.data._id, 'approved', mod.token);

    expect((await publishFlow(a.body.data._id)).status).toBe(200);
    const refused = await transition(b.body.data._id, 'published', admin.token);
    expect(refused.status).toBe(400);
    expect(refused.body.error.field).toBe('forms.masculine.plural.direct');
    expect((await VariantSuggestion.findById(b.body.data._id)).status).toBe('approved');
  });

  test('the public concept page returns the contributor profile on credited forms', async () => {
    const { concept, variant } = await setup();
    await User.updateOne({ cognitoSub: other.id }, { region: 'Kohat', village: 'Usterzai' });
    const { body } = await propose(variant, { forms: [plural] }, other.token);
    await publishFlow(body.data._id);

    const res = await send('get', `/api/concepts/${concept._id}`);
    const [form] = res.body.data.variants[0].forms;
    expect(form.addedBy.username).toBe(`user-${other.id.slice(-6)}`);
    expect(form.addedBy.village).toBe('Usterzai');
  });
});

describe('admin edit lock covers every open suggestion', () => {
  test("a slot proposed by anyone's open suggestion is locked", async () => {
    const { variant } = await setup();
    await propose(variant, { phonetic: 'lmar' });
    await propose(variant, { forms: [plural] }, other.token);

    const locked = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, { forms: [plural], note: 'n' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.field).toBe('forms.masculine.plural.direct');
  });
});

describe('GET /api/moderation/suggestions — grouped by word', () => {
  test('groups every pending suggestion for a word together, oldest word first, paginated by word', async () => {
    const first = await setup();
    const second = await setup();
    const a = await propose(first.variant, { forms: [plural] }, other.token);
    await propose(second.variant, { forms: [plural] }, other.token);
    const c = await propose(first.variant, { forms: [{ ...plural, pashto: 'لمران' }] }, mod.token);

    const res = await send('get', '/api/moderation/suggestions?limit=1', mod.token);
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1, total: 2, pendingCount: 3 });
    expect(res.body.data).toHaveLength(1);
    const [group] = res.body.data;
    expect(String(group.variant._id)).toBe(String(first.variant._id));
    expect(group.variant.submittedBy.username).toBe(`user-${owner.id.slice(-6)}`);
    expect(group.suggestions.map((s) => s._id)).toEqual([a.body.data._id, c.body.data._id]);
    expect(group.suggestions[0].submittedBy.username).toBe(`user-${other.id.slice(-6)}`);

    const page2 = await send('get', '/api/moderation/suggestions?limit=1&page=2', mod.token);
    expect(String(page2.body.data[0].variant._id)).toBe(String(second.variant._id));
  });
});

describe('GET /api/suggestions/mine', () => {
  test("scope=others lists only suggestions on other people's words, newest first", async () => {
    const mine = await makeVariant(await makeConcept(), other);
    const { variant } = await setup();
    const elsewhere = await setup();
    await propose(mine, { phonetic: 'x' }, other.token);
    const a = await propose(variant, { forms: [plural] }, other.token);
    const b = await propose(elsewhere.variant, { forms: [plural] }, other.token);

    const res = await send('get', '/api/suggestions/mine?scope=others', other.token);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.map((s) => s._id)).toEqual([b.body.data._id, a.body.data._id]);
    expect(res.body.data[0].variant.concept.englishGloss).toBeDefined();
  });

  test('status=open and concept= narrow the list for the concept page', async () => {
    const { concept, variant } = await setup();
    const other2 = await setup();
    const open = await propose(variant, { forms: [plural] }, other.token);
    const closed = await propose(other2.variant, { forms: [plural] }, other.token);
    await transition(closed.body.data._id, 'rejected', mod.token, 'no');

    const res = await send('get', `/api/suggestions/mine?status=open&concept=${concept._id}`, other.token);
    expect(res.body.data.map((s) => s._id)).toEqual([open.body.data._id]);
    const all = await send('get', '/api/suggestions/mine', other.token);
    expect(all.body.meta.total).toBe(2);
  });

  test('never returns anyone else\'s suggestions and validates its query', async () => {
    const { variant } = await setup();
    await propose(variant, { forms: [plural] }, other.token);
    expect((await send('get', '/api/suggestions/mine', mod.token)).body.data).toEqual([]);
    expect((await send('get', '/api/suggestions/mine?scope=nope', other.token)).status).toBe(400);
    expect((await send('get', '/api/suggestions/mine?concept=nope', other.token)).status).toBe(400);
    expect((await send('get', '/api/suggestions/mine')).status).toBe(401);
  });
});

describe("My Submissions shows only the owner's own suggestion on each word", () => {
  test("someone else's open suggestion does not appear as the owner's latest suggestion", async () => {
    const { variant } = await setup();
    await propose(variant, { forms: [plural] }, other.token);

    const res = await send('get', '/api/variants/my-submissions', owner.token);
    const row = res.body.data.find((v) => String(v._id) === String(variant._id));
    expect(row.latestSuggestion).toBeNull();
  });
});
