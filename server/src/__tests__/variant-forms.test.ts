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

// Grammatical forms on variants: validation, resubmit/edit rules, edit diffs, display and search

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
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/concepts', conceptsRouter);
app.use('/api/variants', variantsRouter);
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

let seq = 0;
function makeConcept(fields = {}) {
  seq += 1;
  return Concept.create({ englishGloss: `gloss-${seq}`, partOfSpeech: 'noun', ...fields });
}
function makeVariant(concept, fields = {}) {
  seq += 1;
  return Variant.create({ concept: concept._id, pashto: `اوبه${seq}`, region: 'Kohat', definition: 'def', ...fields });
}

const plural = { kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'لمرونه', phonetic: 'lmaruna', example: 'لمرونه ځلیږي' };
const oblique = { kind: 'noun', gender: 'masculine', number: 'singular', case: 'oblique', pashto: 'لمر' };
const past = { kind: 'verb', verbForm: 'past', pashto: 'ولیکل' };

const variantBody = (conceptId, forms) => ({ conceptId: String(conceptId), pashto: 'لمر', region: 'Kohat', definition: 'sun', ...(forms && { forms }) });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Variant.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Promise.all([Concept.deleteMany({}), Variant.deleteMany({}), ModerationLog.deleteMany({}), User.deleteMany({})]);
});

describe('POST /api/variants with forms', () => {
  test('stores noun forms in canonical order with normalized text', async () => {
    const { token } = await makeUser();
    const concept = await makeConcept();
    const res = await send('post', '/api/variants', token, variantBody(concept._id, [plural, oblique]));
    expect(res.status).toBe(201);

    const stored = await Variant.findById(res.body.data._id).lean();
    expect(stored.forms.map((f) => [f.number, f.case])).toEqual([['singular', 'oblique'], ['plural', 'direct']]);
    expect(stored.forms[1]).toEqual(expect.objectContaining({ pashto: 'لمرونه', normalizedPashto: 'لمرونه', phonetic: 'lmaruna' }));
  });

  test('adjective concepts take noun-style forms', async () => {
    const { token } = await makeUser();
    const concept = await makeConcept({ partOfSpeech: 'adjective' });
    const res = await send('post', '/api/variants', token, variantBody(concept._id, [{ ...plural, gender: 'feminine' }]));
    expect(res.status).toBe(201);
  });

  test('verb concepts take verb forms', async () => {
    const { token } = await makeUser();
    const concept = await makeConcept({ partOfSpeech: 'verb' });
    const res = await send('post', '/api/variants', token, variantBody(concept._id, [past, { kind: 'verb', verbForm: 'infinitive', pashto: 'لیکل' }]));
    expect(res.status).toBe(201);
    expect(res.body.data.forms.map((f) => f.verbForm)).toEqual(['infinitive', 'past']);
  });

  test('a variant without forms has no forms field', async () => {
    const { token } = await makeUser();
    const concept = await makeConcept();
    const res = await send('post', '/api/variants', token, variantBody(concept._id));
    expect(res.status).toBe(201);
    expect((await Variant.findById(res.body.data._id).lean()).forms).toBeUndefined();
  });

  test.each([
    ['a duplicate form', 'noun', [plural, { ...plural, pashto: 'نور' }], 'This form is listed twice'],
    ['a noun form on a verb concept', 'verb', [plural], 'Noun forms are not allowed for this part of speech'],
    ['a verb form on a noun concept', 'noun', [past], 'Verb forms are not allowed for this part of speech'],
    ['any form on an adverb concept', 'adverb', [plural], 'Noun forms are not allowed for this part of speech'],
    ['a noun form without a case', 'noun', [{ ...plural, case: undefined }], 'Noun forms need a case'],
    ['a verb field on a noun form', 'noun', [{ ...plural, verbForm: 'past' }], 'Unknown form property'],
    ['a client-supplied normalizedPashto', 'noun', [{ ...plural, normalizedPashto: 'x' }], 'Unknown form property'],
    ['an unknown gender', 'noun', [{ ...plural, gender: 'neuter' }], 'Invalid gender'],
    ['an unknown kind', 'noun', [{ ...plural, kind: 'pronoun' }], 'Invalid form kind'],
    ['an empty Pashto text', 'noun', [{ ...plural, pashto: '  ' }], 'Form Pashto is required'],
    ['an over-long Pashto text', 'noun', [{ ...plural, pashto: 'ل'.repeat(101) }], 'Form pashto must be 100 characters or fewer'],
    ['an over-long example', 'noun', [{ ...plural, example: 'a'.repeat(501) }], 'Form example must be 500 characters or fewer'],
    ['a non-array forms value', 'noun', 'لمرونه', 'forms must be a list of at most 16 entries'],
    ['more than 16 forms', 'noun', Array.from({ length: 17 }, () => plural), 'forms must be a list of at most 16 entries'],
  ])('rejects %s', async (_name, partOfSpeech, forms, message) => {
    const { token } = await makeUser();
    const concept = await makeConcept({ partOfSpeech });
    const res = await send('post', '/api/variants', token, variantBody(concept._id, forms));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(message);
    expect(await Variant.countDocuments()).toBe(0);
  });

  test('the duplicate check stays on the headword only', async () => {
    const { token } = await makeUser();
    const concept = await makeConcept();
    await makeVariant(concept, { pashto: 'لمرونه' });
    const res = await send('post', '/api/variants', token, variantBody(concept._id, [plural]));
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/variants/:id (submitter resubmit)', () => {
  test('forms can be added on a rejected → pending resubmit', async () => {
    const { id, token } = await makeUser();
    const concept = await makeConcept();
    const variant = await makeVariant(concept, { submittedBy: id, status: 'rejected', isDeleted: true });
    const res = await send('patch', `/api/variants/${variant._id}`, token, { forms: [plural] });
    expect(res.status).toBe(200);
    const stored = await Variant.findById(variant._id).lean();
    expect(stored.status).toBe('pending');
    expect(stored.forms).toHaveLength(1);
  });

  test.each(['pending', 'published'])('a submitter cannot change forms on a %s variant', async (status) => {
    const { id, token } = await makeUser();
    const concept = await makeConcept();
    const variant = await makeVariant(concept, { submittedBy: id, status });
    const res = await send('patch', `/api/variants/${variant._id}`, token, { forms: [plural] });
    expect(res.status).toBe(400);
    expect((await Variant.findById(variant._id).lean()).forms).toBeUndefined();
  });

  test('another user gets 403', async () => {
    const owner = await makeUser();
    const { token } = await makeUser();
    const concept = await makeConcept();
    const variant = await makeVariant(concept, { submittedBy: owner.id, status: 'rejected', isDeleted: true });
    const res = await send('patch', `/api/variants/${variant._id}`, token, { forms: [plural] });
    expect(res.status).toBe(403);
  });

  test('a user cannot reach the staff edit route', async () => {
    const { id, token } = await makeUser();
    const concept = await makeConcept();
    const variant = await makeVariant(concept, { submittedBy: id, status: 'published' });
    const res = await send('patch', `/api/variants/${variant._id}/edit`, token, { forms: [plural], note: 'n' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/variants/:id/edit (staff)', () => {
  test('writes per-form diffs into the edited log', async () => {
    const { token } = await makeUser('admin');
    const concept = await makeConcept();
    const variant = await makeVariant(concept, { status: 'published', forms: [oblique] });
    const res = await send('patch', `/api/variants/${variant._id}/edit`, token, {
      forms: [plural, { ...oblique, pashto: 'لمره' }],
      note: 'add plural',
    });
    expect(res.status).toBe(200);

    const log = await ModerationLog.findOne({ action: 'edited' }).lean();
    expect(log.changes).toEqual({
      'forms.masculine.singular.oblique': { from: { pashto: 'لمر' }, to: { pashto: 'لمره' } },
      'forms.masculine.plural.direct': { from: null, to: { pashto: 'لمرونه', phonetic: 'lmaruna', example: 'لمرونه ځلیږي' } },
    });
    expect((await Variant.findById(variant._id).lean()).status).toBe('published');
  });

  test('omitting forms leaves them unchanged; [] clears them', async () => {
    const { token } = await makeUser('admin');
    const concept = await makeConcept();
    const variant = await makeVariant(concept, { forms: [plural] });

    await send('patch', `/api/variants/${variant._id}/edit`, token, { definition: 'new', note: 'n' });
    expect((await Variant.findById(variant._id).lean()).forms).toHaveLength(1);

    await send('patch', `/api/variants/${variant._id}/edit`, token, { forms: [], note: 'n' });
    expect((await Variant.findById(variant._id).lean()).forms).toBeUndefined();
    const logs = await ModerationLog.find({ action: 'edited' }).sort({ _id: 1 }).lean();
    expect(Object.keys(logs[0].changes)).toEqual(['definition']);
    expect(logs[1].changes).toEqual({ 'forms.masculine.plural.direct': { from: expect.objectContaining({ pashto: 'لمرونه' }), to: null } });
  });

  test('after a part-of-speech change, unchanged stored forms pass but new mismatched ones fail', async () => {
    const { token } = await makeUser('admin');
    const concept = await makeConcept({ partOfSpeech: 'verb' });
    const variant = await makeVariant(concept, { forms: [plural] });

    const kept = await send('patch', `/api/variants/${variant._id}/edit`, token, { forms: [plural, past], note: 'n' });
    expect(kept.status).toBe(200);

    const changed = await send('patch', `/api/variants/${variant._id}/edit`, token, { forms: [{ ...plural, pashto: 'نور' }], note: 'n' });
    expect(changed.status).toBe(400);
    expect(changed.body.error).toEqual({ message: 'Noun forms are not allowed for this part of speech', field: 'forms[0].kind' });
  });

  test('reassigning to another concept validates forms against the target', async () => {
    const { token } = await makeUser('admin');
    const noun = await makeConcept();
    const verb = await makeConcept({ partOfSpeech: 'verb' });
    const variant = await makeVariant(noun);
    const res = await send('patch', `/api/variants/${variant._id}/edit`, token, { concept: String(verb._id), forms: [plural], note: 'n' });
    expect(res.status).toBe(400);
    expect((await Variant.findById(variant._id).lean()).concept.toString()).toBe(String(noun._id));
  });
});

describe('old variants without forms', () => {
  test('load, edit and publish unchanged', async () => {
    const { token } = await makeUser('admin');
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'approved' });

    expect((await send('patch', `/api/variants/${variant._id}/edit`, token, { definition: 'x', note: 'n' })).status).toBe(200);
    expect((await send('patch', `/api/variants/${variant._id}/status`, token, { status: 'published' })).status).toBe(200);

    const detail = await send('get', `/api/concepts/${concept._id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.variants[0].forms).toBeUndefined();
  });
});

describe('public output', () => {
  test('concept detail returns forms without the internal normalized text', async () => {
    const concept = await makeConcept({ status: 'published' });
    await makeVariant(concept, { status: 'published', forms: [plural] });
    const res = await send('get', `/api/concepts/${concept._id}`);
    expect(res.body.data.variants[0].forms).toEqual([
      { kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'لمرونه', phonetic: 'lmaruna', example: 'لمرونه ځلیږي' },
    ]);
  });
});

describe('GET /api/concepts/search with Pashto', () => {
  async function published(gloss, fields) {
    const concept = await makeConcept({ englishGloss: gloss, status: 'published' });
    await makeVariant(concept, { status: 'published', ...fields });
    return concept;
  }

  test('a plural form finds the word', async () => {
    await published('sun', { pashto: 'لمر', forms: [plural] });
    const res = await send('get', `/api/concepts/search?q=${encodeURIComponent('لمرونه')}`);
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['sun']);
  });

  test('unpublished variants are not searched', async () => {
    const concept = await makeConcept({ englishGloss: 'sun', status: 'published' });
    await makeVariant(concept, { pashto: 'لمر', status: 'pending', forms: [plural] });
    const res = await send('get', `/api/concepts/search?q=${encodeURIComponent('لمرونه')}`);
    expect(res.body.data).toEqual([]);
  });

  test('ranks exact > prefix > contains, headword above form within a tier', async () => {
    await published('contains-headword', { pashto: 'ولمر' });
    await published('prefix-form', { pashto: 'الف', forms: [{ ...plural, pashto: 'لمرونه' }] });
    await published('exact-form', { pashto: 'ب', forms: [{ ...plural, pashto: 'لمر' }] });
    await published('prefix-headword', { pashto: 'لمرګی' });
    await published('exact-headword', { pashto: 'لمر' });

    const res = await send('get', `/api/concepts/search?q=${encodeURIComponent('لمر')}`);
    expect(res.body.data.map((c) => c.englishGloss)).toEqual([
      'exact-headword', 'exact-form', 'prefix-headword', 'prefix-form', 'contains-headword',
    ]);
  });

  test('English and phonetic ranking is unchanged', async () => {
    await published('beloved', {});
    await published('lovely', {});
    await published('love', {});
    const res = await send('get', '/api/concepts/search?q=love');
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['love', 'lovely', 'beloved']);
  });
});
