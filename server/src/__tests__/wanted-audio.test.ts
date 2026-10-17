jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: () => ({ verify: async () => ({ sub: 'unused' }) }) },
}));

// GET /api/concepts/wanted-audio: published words in a region missing a headword or example recording

require('dotenv').config();

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const conceptsRouter = require('../routes/concepts');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const AudioClip = require('../models/AudioClip');
const Lookup = require('../models/Lookup');

const app = express();
app.use(express.json());
app.use('/api/concepts', conceptsRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ success: false, error: { message: err.message || 'Internal server error' } });
});

const request = supertest(app);
let mongoServer;

let seq = 0;
function makeConcept(fields = {}) {
  seq += 1;
  return Concept.create({ englishGloss: `gloss-${String(seq).padStart(3, '0')}`, partOfSpeech: 'noun', status: 'published', ...fields });
}
function makeVariant(concept, fields = {}) {
  seq += 1;
  return Variant.create({ concept: concept._id, pashto: `لمر${seq}`, region: 'Kohat', definition: 'def', status: 'published', submittedBy: 'owner-sub', ...fields });
}
const LANE = { pending: 'open', approved: 'open', published: 'live' };
function clip(variant, slot, status = 'published') {
  return AudioClip.create({
    variant: variant._id, slot, storageKey: `audio/${variant._id}/${slot}-${status}.webm`, mimeType: 'audio/webm',
    sizeBytes: 1000, durationMs: 1500, status, ...(LANE[status] && { lane: LANE[status] }), submittedBy: 'speaker-sub',
  });
}

const wantedAudio = (qs) => request.get(`/api/concepts/wanted-audio?${qs}`);
const missingOf = (res) => res.body.data.flatMap((c) => c.words.map((w) => w.missing));

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Variant.init(), AudioClip.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Promise.all([Concept.deleteMany({}), Variant.deleteMany({}), AudioClip.deleteMany({}), Lookup.deleteMany({})]);
});

describe('GET /api/concepts/wanted-audio', () => {
  test('is public and lists concepts whose words in the region lack recordings, alphabetically, in the envelope', async () => {
    const sun = await makeConcept({ englishGloss: 'Sun' });
    const apple = await makeConcept({ englishGloss: 'Apple' });
    const word = await makeVariant(sun, { pashto: 'لمر', phonetic: 'lmar', example: 'لمر راختلی دی' });
    await makeVariant(apple, { example: '' });

    const res = await wantedAudio('region=Kohat');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['Apple', 'Sun']);
    expect(res.body.data[1]).toEqual(expect.objectContaining({ partOfSpeech: 'noun' }));
    expect(res.body.data[1].words).toEqual([{
      variantId: String(word._id), pashto: 'لمر', phonetic: 'lmar', example: 'لمر راختلی دی', missing: ['headword', 'example'],
    }]);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
  });

  test('the example is wanted only when the word has example text', async () => {
    const concept = await makeConcept();
    await makeVariant(concept, { example: '   ' });
    expect(missingOf(await wantedAudio('region=Kohat'))).toEqual([['headword']]);
  });

  test.each(['published', 'pending', 'approved'])('a %s clip covers its slot', async (status) => {
    const concept = await makeConcept();
    const word = await makeVariant(concept, { example: 'مثال' });
    await clip(word, 'headword', status);
    expect(missingOf(await wantedAudio('region=Kohat'))).toEqual([['example']]);
  });

  test.each(['rejected', 'retired', 'withdrawn'])('a %s clip does not cover its slot', async (status) => {
    const concept = await makeConcept();
    const word = await makeVariant(concept);
    await clip(word, 'headword', status);
    expect(missingOf(await wantedAudio('region=Kohat'))).toEqual([['headword']]);
  });

  test('a fully recorded word leaves its concept out', async () => {
    const concept = await makeConcept();
    const word = await makeVariant(concept, { example: 'مثال' });
    await clip(word, 'headword');
    await clip(word, 'example');
    expect((await wantedAudio('region=Kohat')).body.meta.total).toBe(0);
  });

  test('form recordings are not wanted', async () => {
    const concept = await makeConcept();
    const word = await makeVariant(concept, { forms: [{ kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'لمرونه' }] });
    await clip(word, 'headword');
    expect((await wantedAudio('region=Kohat')).body.meta.total).toBe(0);
  });

  test('leaves out other regions, unpublished or deleted words, and unpublished or deleted concepts', async () => {
    const live = await makeConcept();
    await makeVariant(live, { region: 'Hangu' });
    await makeVariant(live, { status: 'pending' });
    await makeVariant(live, { status: 'approved' });
    await makeVariant(live, { isDeleted: true });
    await makeVariant(live, { status: 'rejected', isDeleted: true });
    await makeVariant(await makeConcept({ status: 'approved' }));
    await makeVariant(await makeConcept({ isDeleted: true }));
    expect((await wantedAudio('region=Kohat')).body.meta.total).toBe(0);
  });

  test('groups several words of one concept and lists only those missing something', async () => {
    const concept = await makeConcept();
    const first = await makeVariant(concept);
    const second = await makeVariant(concept, { pashto: 'نمر' });
    const recorded = await makeVariant(concept, { pashto: 'ورځ' });
    await clip(recorded, 'headword');
    const res = await wantedAudio('region=Kohat');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].words.map((w) => w.variantId)).toEqual([String(first._id), String(second._id)]);
  });

  test('slot narrows to words missing that recording', async () => {
    const a = await makeConcept({ englishGloss: 'A' });
    const b = await makeConcept({ englishGloss: 'B' });
    const wa = await makeVariant(a, { example: 'مثال' });
    await clip(wa, 'headword');
    await makeVariant(b, { example: '' });

    let res = await wantedAudio('region=Kohat&slot=example');
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['A']);
    expect(res.body.meta.total).toBe(1);
    res = await wantedAudio('region=Kohat&slot=headword');
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['B']);
  });

  test('q matches the English gloss, the Pashto word ignoring vowel marks, or the phonetic', async () => {
    const sun = await makeConcept({ englishGloss: 'Sun' });
    const moon = await makeConcept({ englishGloss: 'Moon' });
    const star = await makeConcept({ englishGloss: 'Star' });
    await makeVariant(sun, { pashto: 'لمر' });
    await makeVariant(moon, { pashto: 'سپوږمۍ', phonetic: 'spogmay' });
    await makeVariant(star, { pashto: 'ستوری' });

    expect((await wantedAudio('region=Kohat&q=sun')).body.data.map((c) => c.englishGloss)).toEqual(['Sun']);
    expect((await wantedAudio(`region=Kohat&q=${encodeURIComponent('لَمَر')}`)).body.data.map((c) => c.englishGloss)).toEqual(['Sun']);
    expect((await wantedAudio('region=Kohat&q=spog')).body.data.map((c) => c.englishGloss)).toEqual(['Moon']);
  });

  test('partOfSpeech and domain narrow the list', async () => {
    await Lookup.create({ type: 'semanticDomain', key: 'sky', label: 'Sky' });
    await makeVariant(await makeConcept({ englishGloss: 'Sun', semanticDomains: ['sky'] }));
    await makeVariant(await makeConcept({ englishGloss: 'Run', partOfSpeech: 'verb' }));
    expect((await wantedAudio('region=Kohat&partOfSpeech=verb')).body.data.map((c) => c.englishGloss)).toEqual(['Run']);
    expect((await wantedAudio('region=Kohat&domain=sky')).body.data.map((c) => c.englishGloss)).toEqual(['Sun']);
  });

  test('paginates by concept and caps the limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      const concept = await makeConcept();
      await makeVariant(concept);
      await makeVariant(concept, { pashto: `نمر${i}` });
    }
    const res = await wantedAudio('region=Kohat&page=2&limit=2');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].words).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 5 });
    expect((await wantedAudio('region=Kohat&limit=51')).status).toBe(400);
  });

  test('region is required and must be active; slot must be headword or example', async () => {
    expect((await wantedAudio('')).status).toBe(400);
    expect((await wantedAudio('region=Atlantis')).status).toBe(400);
    const bad = await wantedAudio('region=Kohat&slot=form');
    expect(bad.status).toBe(400);
    expect(bad.body.success).toBe(false);
  });
});
