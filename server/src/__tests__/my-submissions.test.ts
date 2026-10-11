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

jest.mock('../utils/storage', () => require('./helpers/memoryStorage'));

// My Submissions: the summary counts and the status / search / region / part-of-speech / slot filters on each list

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
const audioRouter = require('../routes/audio');
const submissionsRouter = require('../routes/submissions');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const VariantSuggestion = require('../models/VariantSuggestion');
const AudioClip = require('../models/AudioClip');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/concepts', conceptsRouter);
app.use('/api/variants', variantsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/audio', audioRouter);
app.use('/api/submissions', submissionsRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ success: false, error: { message: err.message || 'Internal server error' } });
});

const request = supertest(app);
let mongoServer;

async function makeUser() {
  const id = new mongoose.Types.ObjectId().toString();
  await User.create({ cognitoSub: id, username: `user-${id.slice(-6)}`, email: `${id.slice(-6)}@test.local`, role: 'user' });
  return { id, token: jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' }) };
}

const get = (path, token) => request.get(path).set('Authorization', `Bearer ${token}`);

let seq = 0;
const concept = (user, fields = {}) => {
  seq += 1;
  return Concept.create({ englishGloss: `gloss-${seq}`, partOfSpeech: 'noun', status: 'published', submittedBy: user.id, ...fields });
};
const variant = (c, user, fields = {}) => {
  seq += 1;
  return Variant.create({ concept: c._id, pashto: `کلمه${seq}`, region: 'Kohat', definition: `meaning ${seq}`, status: 'published', submittedBy: user.id, ...fields });
};
const clip = (v, user, fields = {}) => {
  seq += 1;
  return AudioClip.create({
    variant: v._id, slot: 'headword', storageKey: `k${seq}`, mimeType: 'audio/webm', sizeBytes: 10, durationMs: 1000, submittedBy: user.id, status: 'pending', ...fields,
  });
};

let me, other;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Variant.init(), AudioClip.init(), VariantSuggestion.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  [me, other] = await Promise.all([makeUser(), makeUser()]);
});

afterEach(async () => {
  await Promise.all([Concept.deleteMany({}), Variant.deleteMany({}), VariantSuggestion.deleteMany({}), AudioClip.deleteMany({}), User.deleteMany({})]);
});

describe('GET /api/submissions/summary', () => {
  test('requires a token', async () => {
    expect((await request.get('/api/submissions/summary')).status).toBe(401);
  });

  test('counts my own submissions by status across all four kinds and ignores other people\'s', async () => {
    const c1 = await concept(me, { status: 'pending' });
    await concept(me, { status: 'rejected' });
    await concept(me, { status: 'published', isDeleted: true });
    const theirs = await concept(other);
    const v1 = await variant(c1, me, { status: 'pending' });
    await variant(c1, me, { status: 'rejected', isDeleted: true });
    await variant(c1, me, { status: 'published', isDeleted: true });
    const theirVariant = await variant(theirs, other);
    await clip(v1, me, { slot: 'example' });
    await clip(v1, me, { slot: 'headword', status: 'withdrawn' });
    await clip(v1, other, { slot: 'form:masculine.singular.direct' });
    await VariantSuggestion.create({ variant: theirVariant._id, proposed: { forms: [] }, submittedBy: me.id, status: 'rejected' });
    await VariantSuggestion.create({ variant: v1._id, proposed: { phonetic: 'x' }, submittedBy: me.id, status: 'pending' });

    const res = await get('/api/submissions/summary', me.token);
    expect(res.status).toBe(200);
    expect(res.body.data.concepts).toEqual({ pending: 1, approved: 0, published: 0, rejected: 1, total: 2 });
    expect(res.body.data.variants).toEqual({ pending: 1, approved: 0, published: 0, rejected: 1, total: 2 });
    expect(res.body.data.audio).toEqual(expect.objectContaining({ pending: 1, withdrawn: 1, total: 2 }));
    expect(res.body.data.suggestions).toEqual({ pending: 0, approved: 0, published: 0, rejected: 1, total: 1 });
  });

  test('a new user gets zeros', async () => {
    const res = await get('/api/submissions/summary', me.token);
    expect(res.body.data.concepts.total).toBe(0);
    expect(res.body.data.audio.total).toBe(0);
  });
});

describe('GET /api/concepts/my-submissions — filters', () => {
  test('filters by status, part of speech and a case-insensitive gloss search', async () => {
    await concept(me, { englishGloss: 'Sunrise', status: 'pending' });
    await concept(me, { englishGloss: 'Run', partOfSpeech: 'verb', status: 'rejected' });
    await concept(me, { englishGloss: 'Moon', status: 'rejected' });
    await concept(other, { englishGloss: 'Sunset', status: 'pending' });

    const names = async (qs) => (await get(`/api/concepts/my-submissions?${qs}`, me.token)).body.data.map((c) => c.englishGloss).sort();
    expect(await names('status=rejected')).toEqual(['Moon', 'Run']);
    expect(await names('partOfSpeech=verb')).toEqual(['Run']);
    expect(await names('q=SUN')).toEqual(['Sunrise']);
    expect(await names('status=rejected&partOfSpeech=noun&q=moo')).toEqual(['Moon']);
  });

  test('a search with regex characters is treated as text; an invalid status is a 400', async () => {
    await concept(me, { englishGloss: 'a+b' });
    const hit = await get('/api/concepts/my-submissions?q=a%2Bb', me.token);
    expect(hit.body.data).toHaveLength(1);
    expect((await get('/api/concepts/my-submissions?q=.*', me.token)).body.data).toHaveLength(0);
    expect((await get('/api/concepts/my-submissions?status=nope', me.token)).status).toBe(400);
  });

  test('stays paginated and reports the filtered total', async () => {
    for (let i = 0; i < 3; i += 1) await concept(me, { status: 'rejected' });
    await concept(me, { status: 'pending' });
    const res = await get('/api/concepts/my-submissions?status=rejected&limit=2&page=2', me.token);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 3 });
  });
});

describe('GET /api/variants/my-submissions — filters', () => {
  test('filters by status, including soft-deleted rejected words', async () => {
    const c = await concept(me);
    await variant(c, me, { status: 'pending' });
    const rejected = await variant(c, me, { status: 'rejected', isDeleted: true });
    await variant(c, me, { status: 'published' });
    const res = await get('/api/variants/my-submissions?status=rejected', me.token);
    expect(res.body.data.map((v) => v._id)).toEqual([String(rejected._id)]);
    expect(res.body.meta.total).toBe(1);
  });

  test('searches Pashto, phonetic, definition and the English gloss, within my own words', async () => {
    const sun = await concept(me, { englishGloss: 'Sun' });
    const moon = await concept(me, { englishGloss: 'Moon' });
    const a = await variant(sun, me, { pashto: 'لمر', definition: 'bright star' });
    const b = await variant(moon, me, { pashto: 'سپوږمۍ', phonetic: 'spogmay', definition: 'night light' });
    await variant(sun, other, { pashto: 'لمر۲' });

    const ids = async (qs) => (await get(`/api/variants/my-submissions?${qs}`, me.token)).body.data.map((v) => v._id).sort();
    expect(await ids(`q=${encodeURIComponent('لمر')}`)).toEqual([String(a._id)]);
    expect(await ids('q=spogm')).toEqual([String(b._id)]);
    expect(await ids('q=NIGHT')).toEqual([String(b._id)]);
    expect(await ids('q=moon')).toEqual([String(b._id)]);
    expect(await ids('q=nothing')).toEqual([]);
  });

  test('combines status, region and search; needs=completion keeps overriding status', async () => {
    const c = await concept(me, { englishGloss: 'Sun' });
    const kohat = await variant(c, me, { status: 'pending', region: 'Kohat' });
    await variant(c, me, { status: 'pending', region: 'Hangu' });
    const res = await get('/api/variants/my-submissions?status=pending&region=Kohat&q=sun', me.token);
    expect(res.body.data.map((v) => v._id)).toEqual([String(kohat._id)]);

    const completion = await get('/api/variants/my-submissions?needs=completion&status=pending', me.token);
    expect(completion.body.data.every((v) => v.status === 'published')).toBe(true);
    expect((await get('/api/variants/my-submissions?status=nope', me.token)).status).toBe(400);
    expect((await get(`/api/variants/my-submissions?q=${'x'.repeat(101)}`, me.token)).status).toBe(400);
  });
});

describe('GET /api/audio/mine — filters', () => {
  test('filters by status and slot kind', async () => {
    const c = await concept(me);
    const v = await variant(c, me);
    const head = await clip(v, me, { slot: 'headword', status: 'published' });
    const ex = await clip(v, me, { slot: 'example', status: 'pending' });
    const form = await clip(v, me, { slot: 'form:masculine.singular.direct', status: 'pending' });
    const ids = async (qs) => (await get(`/api/audio/mine?${qs}`, me.token)).body.data.map((x) => x._id).sort();

    expect(await ids('status=pending')).toEqual([String(ex._id), String(form._id)].sort());
    expect(await ids('slot=form')).toEqual([String(form._id)]);
    expect(await ids('slot=headword')).toEqual([String(head._id)]);
    expect(await ids('slot=example&status=pending')).toEqual([String(ex._id)]);
    expect(await ids('slot=example&status=published')).toEqual([]);
  });

  test('accepts the audio-only statuses and rejects unknown ones', async () => {
    expect((await get('/api/audio/mine?status=withdrawn', me.token)).status).toBe(200);
    expect((await get('/api/audio/mine?status=nope', me.token)).status).toBe(400);
    expect((await get('/api/audio/mine?slot=nope', me.token)).status).toBe(400);
  });
});

describe('GET /api/suggestions/mine — status filter', () => {
  test('filters by a review status as well as open', async () => {
    const c = await concept(other);
    const v1 = await variant(c, other);
    const v2 = await variant(c, other);
    const v3 = await variant(c, other);
    await VariantSuggestion.create({ variant: v1._id, proposed: { forms: [] }, submittedBy: me.id, status: 'rejected' });
    await VariantSuggestion.create({ variant: v2._id, proposed: { forms: [] }, submittedBy: me.id, status: 'pending' });
    await VariantSuggestion.create({ variant: v3._id, proposed: { forms: [] }, submittedBy: me.id, status: 'published' });

    const count = async (qs) => (await get(`/api/suggestions/mine?scope=others&${qs}`, me.token)).body.meta.total;
    expect(await count('status=rejected')).toBe(1);
    expect(await count('status=published')).toBe(1);
    expect(await count('status=open')).toBe(1);
    expect(await count('')).toBe(3);
    expect((await get('/api/suggestions/mine?status=nope', me.token)).status).toBe(400);
  });
});
