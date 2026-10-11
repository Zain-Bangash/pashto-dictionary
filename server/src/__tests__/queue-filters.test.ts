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
jest.mock('../utils/storage', () => require('./helpers/memoryStorage'));

// Queue filters: q (gloss / Pashto / phonetic), region and user (submitter's username) on all three queues; Overview counts

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const moderationRouter = require('../routes/moderation');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const VariantSuggestion = require('../models/VariantSuggestion');
const AudioClip = require('../models/AudioClip');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/moderation', moderationRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ success: false, error: { message: err.message || 'Internal server error' } });
});

const request = supertest(app);
let mongoServer;
let admin;
let spammer;
let honest;

async function makeUser(role, username) {
  const id = new mongoose.Types.ObjectId().toString();
  await User.create({ cognitoSub: id, username, email: `${username}@test.local`, role });
  const token = jwt.sign({ id, username, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { id, token };
}

const get = (path) => request.get(path).set('Authorization', `Bearer ${admin.token}`);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  admin = await makeUser('admin', 'boss');
  spammer = await makeUser('user', 'Spammy');
  honest = await makeUser('user', 'honest');
});

afterEach(async () => {
  await Promise.all([Concept.deleteMany({}), Variant.deleteMany({}), VariantSuggestion.deleteMany({}), AudioClip.deleteMany({}), User.deleteMany({})]);
});

describe('GET /api/moderation/queue filters', () => {
  let house;
  let water;
  beforeEach(async () => {
    house = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending', submittedBy: honest.id });
    water = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun', status: 'published', submittedBy: honest.id });
    await Variant.create({ concept: house._id, pashto: 'کور', phonetic: 'kor', region: 'Kohat', definition: 'd', status: 'pending', submittedBy: spammer.id });
    await Variant.create({ concept: water._id, pashto: 'اوبه', phonetic: 'oba', region: 'Hangu', definition: 'd', status: 'pending', submittedBy: honest.id });
  });

  test('user= lists only that submitter, case-insensitively, and counts follow', async () => {
    const res = await get('/api/moderation/queue?user=spammy');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const [group] = res.body.data;
    expect(group.englishGloss).toBe('house');
    expect(group.matched).toBe(false);
    expect(group.variants.map((v) => v.pashto)).toEqual(['کور']);
    expect(res.body.meta.pendingCount).toBe(1);
  });

  test('an unknown user matches nothing', async () => {
    const res = await get('/api/moderation/queue?user=nobody');
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.pendingCount).toBe(0);
  });

  test('region= keeps only variants from that region', async () => {
    const res = await get('/api/moderation/queue?region=Hangu');
    expect(res.body.data.map((g) => g.englishGloss)).toEqual(['water']);
  });

  test('q= matches the gloss, the Pashto word or the phonetic', async () => {
    expect((await get('/api/moderation/queue?q=hous')).body.data.map((g) => g.englishGloss)).toEqual(['house']);
    expect((await get(`/api/moderation/queue?q=${encodeURIComponent('اوبه')}`)).body.data.map((g) => g.englishGloss)).toEqual(['water']);
    expect((await get('/api/moderation/queue?q=kor')).body.data.map((g) => g.englishGloss)).toEqual(['house']);
  });

  test('a concept matching on its own is flagged matched', async () => {
    const res = await get('/api/moderation/queue?user=honest');
    const byGloss = Object.fromEntries(res.body.data.map((g) => [g.englishGloss, g]));
    expect(byGloss.house.matched).toBe(true);
    expect(byGloss.house.variants).toEqual([]);
    expect(byGloss.water.matched).toBe(false);
  });

  test('rejects an over-long search', async () => {
    const res = await get(`/api/moderation/queue?q=${'a'.repeat(101)}`);
    expect(res.status).toBe(400);
  });
});

describe('suggestion and audio queue filters', () => {
  let kor;
  let oba;
  beforeEach(async () => {
    const c = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    const w = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun', status: 'published' });
    kor = await Variant.create({ concept: c._id, pashto: 'کور', region: 'Kohat', definition: 'd', status: 'published', submittedBy: honest.id });
    oba = await Variant.create({ concept: w._id, pashto: 'اوبه', region: 'Hangu', definition: 'd', status: 'published', submittedBy: honest.id });
    await VariantSuggestion.create({ variant: kor._id, proposed: { phonetic: 'kor' }, submittedBy: spammer.id });
    await VariantSuggestion.create({ variant: oba._id, proposed: { phonetic: 'oba' }, submittedBy: honest.id });
    const clip = { slot: 'headword', mimeType: 'audio/webm', sizeBytes: 100, durationMs: 1000, status: 'pending', lane: 'open' };
    await AudioClip.create({ ...clip, variant: kor._id, storageKey: 'a', submittedBy: spammer.id });
    await AudioClip.create({ ...clip, variant: oba._id, storageKey: 'b', submittedBy: honest.id });
  });

  test('suggestions filter by user, region and search', async () => {
    const byUser = await get('/api/moderation/suggestions?user=Spammy');
    expect(byUser.body.data.map((g) => g.variant.pashto)).toEqual(['کور']);
    expect(byUser.body.meta.pendingCount).toBe(1);
    const byRegion = await get('/api/moderation/suggestions?region=Hangu');
    expect(byRegion.body.data.map((g) => g.variant.pashto)).toEqual(['اوبه']);
    const bySearch = await get('/api/moderation/suggestions?q=water');
    expect(bySearch.body.data.map((g) => g.variant.pashto)).toEqual(['اوبه']);
  });

  test('recordings filter by user, region and search', async () => {
    const byUser = await get('/api/moderation/audio?user=spammy');
    expect(byUser.body.data.map((c) => c.variant.pashto)).toEqual(['کور']);
    expect(byUser.body.meta.pendingCount).toBe(1);
    const byRegion = await get('/api/moderation/audio?region=Hangu');
    expect(byRegion.body.data.map((c) => c.variant.pashto)).toEqual(['اوبه']);
    const bySearch = await get('/api/moderation/audio?q=house');
    expect(bySearch.body.data.map((c) => c.variant.pashto)).toEqual(['کور']);
  });
});

describe('GET /api/moderation/stats queue breakdown', () => {
  test('counts what waits in each queue', async () => {
    const c = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' });
    const v = await Variant.create({ concept: c._id, pashto: 'کور', region: 'Kohat', definition: 'd', status: 'pending' });
    await VariantSuggestion.create({ variant: v._id, proposed: { phonetic: 'kor' }, submittedBy: honest.id });
    const res = await get('/api/moderation/stats');
    expect(res.body.data.queue).toEqual({
      entries: { pending: 1, approved: 1 },
      suggestions: { pending: 1, approved: 0 },
      audio: { pending: 0, approved: 0 },
    });
    expect(res.body.data.pending).toBe(1);
  });
});
