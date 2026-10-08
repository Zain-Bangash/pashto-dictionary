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

// GET /api/concepts/wanted (gap finder) and GET /api/variants/my-submissions completion filters

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
const VariantSuggestion = require('../models/VariantSuggestion');
const FieldDefinition = require('../models/FieldDefinition');
const Lookup = require('../models/Lookup');
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
  return { id, token: jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' }) };
}

let seq = 0;
function makeConcept(fields = {}) {
  seq += 1;
  return Concept.create({ englishGloss: `gloss-${String(seq).padStart(3, '0')}`, partOfSpeech: 'noun', status: 'published', ...fields });
}
function makeVariant(concept, fields = {}) {
  seq += 1;
  return Variant.create({ concept: concept._id, pashto: `لمر${seq}`, region: 'Kohat', definition: 'def', status: 'published', ...fields });
}

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
  await Promise.all([
    Concept.deleteMany({}), Variant.deleteMany({}), VariantSuggestion.deleteMany({}),
    FieldDefinition.deleteMany({}), User.deleteMany({}),
  ]);
});

const wanted = (qs) => request.get(`/api/concepts/wanted?${qs}`);

describe('GET /api/concepts/wanted', () => {
  test('is public and lists published concepts with no variant in the region, alphabetically', async () => {
    const b = await makeConcept({ englishGloss: 'Bread' });
    const a = await makeConcept({ englishGloss: 'Apple' });
    const covered = await makeConcept({ englishGloss: 'Cloud' });
    await makeVariant(covered, { region: 'Kohat' });
    await makeVariant(a, { region: 'Hangu' });

    const res = await wanted('region=Kohat');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['Apple', 'Bread']);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
    expect(String(res.body.data[1]._id)).toBe(String(b._id));
  });

  test.each(['pending', 'approved', 'published'])('a %s variant in the region hides the concept', async (status) => {
    const concept = await makeConcept();
    await makeVariant(concept, { status });
    expect((await wanted('region=Kohat')).body.meta.total).toBe(0);
  });

  test('a rejected (soft-deleted) variant also hides the concept', async () => {
    const concept = await makeConcept();
    await makeVariant(concept, { status: 'rejected', isDeleted: true });
    expect((await wanted('region=Kohat')).body.meta.total).toBe(0);
  });

  test('an admin-deleted variant does not hide the concept', async () => {
    const concept = await makeConcept();
    await makeVariant(concept, { status: 'published', isDeleted: true });
    expect((await wanted('region=Kohat')).body.meta.total).toBe(1);
  });

  test('excludes unpublished and soft-deleted concepts', async () => {
    await makeConcept({ status: 'pending' });
    await makeConcept({ status: 'approved' });
    await makeConcept({ isDeleted: true });
    expect((await wanted('region=Kohat')).body.meta.total).toBe(0);
  });

  test('search filters by gloss and the total reflects it', async () => {
    await makeConcept({ englishGloss: 'Sun' });
    await makeConcept({ englishGloss: 'Sunset' });
    await makeConcept({ englishGloss: 'Moon' });
    const res = await wanted('region=Kohat&q=sun');
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['Sun', 'Sunset']);
    expect(res.body.meta.total).toBe(2);
  });

  test('paginates', async () => {
    for (let i = 0; i < 5; i += 1) await makeConcept();
    const res = await wanted('region=Kohat&page=2&limit=2');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 5 });
  });

  test('region is required and must be an active region', async () => {
    expect((await wanted('')).status).toBe(400);
    expect((await wanted('region=Atlantis')).status).toBe(400);
    await Lookup.create({ type: 'region', key: 'Orakzai', label: 'Orakzai', active: false });
    expect((await wanted('region=Orakzai')).status).toBe(400);
  });
});

describe('GET /api/variants/my-submissions — completion', () => {
  let owner;
  const mine = (qs = '') => request.get(`/api/variants/my-submissions${qs}`).set('Authorization', `Bearer ${owner.token}`);

  beforeEach(async () => {
    owner = await makeUser();
  });

  test('published variants carry missingFields; forms only when the part of speech allows them', async () => {
    const noun = await makeConcept();
    const adverb = await makeConcept({ partOfSpeech: 'adverb' });
    await makeVariant(noun, { submittedBy: owner.id });
    await makeVariant(adverb, { submittedBy: owner.id, phonetic: 'x' });

    const res = await mine();
    const byPos = Object.fromEntries(res.body.data.map((v) => [v.concept.partOfSpeech, v]));
    expect(byPos.noun.missingFields).toEqual(['phonetic', 'example', 'forms']);
    expect(byPos.adverb.missingFields).toEqual(['example']);
    expect(byPos.noun.concept.englishGloss).toBeDefined();
    expect(res.body.meta.needsCompletionCount).toBe(2);
  });

  test('only optional active custom fields count as missing', async () => {
    await FieldDefinition.create({ appliesTo: 'variant', key: 'register', label: 'Register', type: 'text' });
    await FieldDefinition.create({ appliesTo: 'variant', key: 'source', label: 'Source', type: 'text', required: true });
    await FieldDefinition.create({ appliesTo: 'variant', key: 'old', label: 'Old', type: 'text', active: false });
    const concept = await makeConcept({ partOfSpeech: 'adverb' });
    await makeVariant(concept, { submittedBy: owner.id, phonetic: 'p', example: 'e' });
    const res = await mine();
    expect(res.body.data[0].missingFields).toEqual(['extra.register']);
  });

  test('pending and rejected variants have no missing fields and are not counted', async () => {
    const concept = await makeConcept();
    await makeVariant(concept, { submittedBy: owner.id, status: 'pending' });
    await makeVariant(concept, { submittedBy: owner.id, status: 'rejected', isDeleted: true });
    const res = await mine();
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((v) => v.missingFields.length === 0)).toBe(true);
    expect(res.body.meta.needsCompletionCount).toBe(0);
  });

  test('needs=completion lists only published, non-deleted words with gaps', async () => {
    const concept = await makeConcept({ partOfSpeech: 'adverb' });
    await makeVariant(concept, { submittedBy: owner.id });
    await makeVariant(concept, { submittedBy: owner.id, phonetic: 'p', example: 'e' });
    await makeVariant(concept, { submittedBy: owner.id, status: 'pending' });
    await makeVariant(concept, { submittedBy: owner.id, isDeleted: true });
    const res = await mine('?needs=completion');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  test('missing narrows by field and region filters', async () => {
    const concept = await makeConcept({ partOfSpeech: 'adverb' });
    await makeVariant(concept, { submittedBy: owner.id, phonetic: 'p' });
    await makeVariant(concept, { submittedBy: owner.id, example: 'e' });
    await makeVariant(concept, { submittedBy: owner.id, example: 'e', region: 'Hangu' });

    expect((await mine('?needs=completion&missing=phonetic')).body.meta.total).toBe(2);
    expect((await mine('?needs=completion&missing=phonetic&region=Hangu')).body.meta.total).toBe(1);
    expect((await mine('?needs=completion&missing=example')).body.meta.total).toBe(1);
    expect((await mine('?region=Hangu')).body.meta.needsCompletionCount).toBe(1);
  });

  test('partially filled forms are fillable but not missing; forms_partial finds them', async () => {
    const concept = await makeConcept();
    const form = { kind: 'noun', gender: 'masculine', number: 'singular', case: 'direct', pashto: 'لمر' };
    await makeVariant(concept, { submittedBy: owner.id, phonetic: 'p', example: 'e', forms: [form] });

    const all = await mine();
    expect(all.body.data[0]).toEqual(expect.objectContaining({ missingFields: [], fillableFields: ['forms'], formsFilled: 1, formsTotal: 8 }));
    expect(all.body.meta.needsCompletionCount).toBe(0);
    expect((await mine('?needs=completion')).body.meta.total).toBe(0);
    expect((await mine('?needs=completion&missing=forms_partial')).body.meta.total).toBe(1);
  });

  test('pagination meta reflects the filter', async () => {
    const concept = await makeConcept({ partOfSpeech: 'adverb' });
    for (let i = 0; i < 3; i += 1) await makeVariant(concept, { submittedBy: owner.id });
    await makeVariant(concept, { submittedBy: owner.id, phonetic: 'p', example: 'e' });
    const res = await mine('?needs=completion&page=2&limit=2');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual(expect.objectContaining({ page: 2, limit: 2, total: 3, needsCompletionCount: 3 }));
  });

  test('each row carries its latest suggestion', async () => {
    const concept = await makeConcept();
    const v = await makeVariant(concept, { submittedBy: owner.id });
    await VariantSuggestion.create({ variant: v._id, proposed: { phonetic: 'a' }, submittedBy: owner.id, status: 'rejected', moderatorNote: 'no' });
    const res = await mine();
    expect(res.body.data[0].latestSuggestion).toEqual(expect.objectContaining({ status: 'rejected', moderatorNote: 'no' }));
  });

  test('only my own variants are listed', async () => {
    const someone = await makeUser();
    const concept = await makeConcept();
    await makeVariant(concept, { submittedBy: someone.id });
    expect((await mine()).body.data).toHaveLength(0);
  });

  test('rejects an invalid missing filter', async () => {
    expect((await mine('?needs=completion&missing=$where')).status).toBe(400);
  });
});
