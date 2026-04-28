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

const app = express();
app.use(express.json());
app.use('/api/concepts', conceptsRouter);
app.use('/api/variants', variantsRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({
    success: false,
    error: { message: err.message || 'Internal server error' },
  });
});

const request = supertest(app);

let mongoServer;

function makeToken(overrides = {}) {
  const secret = process.env.JWT_SECRET || 'test-secret-for-jest';
  return jwt.sign(
    { id: new mongoose.Types.ObjectId().toString(), username: 'testuser', role: 'user', ...overrides },
    secret,
    { expiresIn: '7d' }
  );
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ---------------------------------------------------------------------------
// GET /api/concepts
// ---------------------------------------------------------------------------

describe('GET /api/concepts', () => {
  test('returns 200 with empty data when no published concepts exist', async () => {
    const res = await request.get('/api/concepts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBe(0);
  });

  test('returns only published concepts by default', async () => {
    await Concept.create([
      { englishGloss: 'house', partOfSpeech: 'noun', status: 'published' },
      { englishGloss: 'dog',   partOfSpeech: 'noun', status: 'pending' },
      { englishGloss: 'water', partOfSpeech: 'noun', status: 'approved' },
    ]);
    const res = await request.get('/api/concepts');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].englishGloss).toBe('house');
  });

  test('returns correct meta with page and limit', async () => {
    const res = await request.get('/api/concepts?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(10);
  });

  test('caps limit at 50', async () => {
    const res = await request.get('/api/concepts?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(50);
  });

  test('defaults page to 1 and limit to 20', async () => {
    const res = await request.get('/api/concepts');
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });

  test('response matches envelope shape', async () => {
    const res = await request.get('/api/concepts');
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('meta');
  });

  test('returns pending concepts when status=pending filter is used', async () => {
    await Concept.create([
      { englishGloss: 'house', partOfSpeech: 'noun', status: 'published' },
      { englishGloss: 'dog',   partOfSpeech: 'noun', status: 'pending' },
    ]);
    const res = await request.get('/api/concepts?status=pending');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].englishGloss).toBe('dog');
  });
});

// ---------------------------------------------------------------------------
// GET /api/concepts/suggest
// ---------------------------------------------------------------------------

describe('GET /api/concepts/suggest', () => {
  test('returns 400 when q is missing', async () => {
    const res = await request.get('/api/concepts/suggest');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns up to 5 matching concepts', async () => {
    await Concept.create([
      { englishGloss: 'house',   partOfSpeech: 'noun', status: 'published' },
      { englishGloss: 'house2',  partOfSpeech: 'noun', status: 'pending' },
      { englishGloss: 'water',   partOfSpeech: 'noun', status: 'published' },
    ]);
    const res = await request.get('/api/concepts/suggest?q=house');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const glosses = res.body.data.map((c) => c.englishGloss);
    expect(glosses).toContain('house');
  });
});

// ---------------------------------------------------------------------------
// GET /api/concepts/:id
// ---------------------------------------------------------------------------

describe('GET /api/concepts/:id', () => {
  test('returns 400 for invalid ObjectId', async () => {
    const res = await request.get('/api/concepts/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when concept does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.get(`/api/concepts/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when concept exists but is not published', async () => {
    const concept = await Concept.create({ englishGloss: 'dog', partOfSpeech: 'noun', status: 'pending' });
    const res = await request.get(`/api/concepts/${concept._id}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 with concept and variants when published', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    const res = await request.get(`/api/concepts/${concept._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.englishGloss).toBe('house');
    expect(Array.isArray(res.body.data.variants)).toBe(true);
  });

  test('response uses envelope shape', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    const res = await request.get(`/api/concepts/${concept._id}`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });
});

// ---------------------------------------------------------------------------
// POST /api/concepts
// ---------------------------------------------------------------------------

describe('POST /api/concepts', () => {
  const valid = () => ({ englishGloss: 'house', partOfSpeech: 'noun' });

  test('returns 401 when no token provided', async () => {
    const res = await request.post('/api/concepts').send(valid());
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when englishGloss is missing', async () => {
    const token = makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send({ partOfSpeech: 'noun' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when partOfSpeech is missing', async () => {
    const token = makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send({ englishGloss: 'house' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when partOfSpeech is invalid', async () => {
    const token = makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send({ englishGloss: 'house', partOfSpeech: 'emoji' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 201 with created concept on valid input', async () => {
    const token = makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.englishGloss).toBe('house');
  });

  test('sets status to pending on creation', async () => {
    const token = makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  test('creates a ModerationLog entry with action "submitted"', async () => {
    const token = makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    const log = await ModerationLog.findOne({ targetId: res.body.data._id, targetModel: 'Concept' });
    expect(log).not.toBeNull();
    expect(log.action).toBe('submitted');
  });

  test('sets submittedBy from the token user id', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken({ id: userId });
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.data.submittedBy).toBe(userId);
  });

  test('response uses envelope shape', async () => {
    const token = makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });
});

// ---------------------------------------------------------------------------
// POST /api/variants
// ---------------------------------------------------------------------------

describe('POST /api/variants', () => {
  let conceptId;

  beforeEach(async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    conceptId = concept._id.toString();
  });

  const valid = () => ({
    conceptId,
    pashto: 'کور',
    region: 'Kohat',
    definition: 'a dwelling place',
  });

  test('returns 401 when no token provided', async () => {
    const res = await request.post('/api/variants').send(valid());
    expect(res.status).toBe(401);
  });

  test('returns 400 when pashto is missing', async () => {
    const token = makeToken();
    const { pashto: _p, ...body } = valid();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when region is missing', async () => {
    const token = makeToken();
    const { region: _r, ...body } = valid();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when definition is missing', async () => {
    const token = makeToken();
    const { definition: _d, ...body } = valid();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when region is invalid', async () => {
    const token = makeToken();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send({ ...valid(), region: 'Kandahar' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 201 with created variant on valid input', async () => {
    const token = makeToken();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pashto).toBe('کور');
  });

  test('sets status to pending on creation', async () => {
    const token = makeToken();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  test('returns 409 when pashto word already exists', async () => {
    const token = makeToken();
    await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(valid());
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  test('creates a ModerationLog entry with action "submitted"', async () => {
    const token = makeToken();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    const log = await ModerationLog.findOne({ targetId: res.body.data._id, targetModel: 'Variant' });
    expect(log).not.toBeNull();
    expect(log.action).toBe('submitted');
  });

  test('accepts all valid region values', async () => {
    const regions = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];
    let pashtoCounter = 0;
    for (const region of regions) {
      const token = makeToken();
      const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send({
        ...valid(), region, pashto: `کور${pashtoCounter++}`,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.region).toBe(region);
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/concepts/search
// ---------------------------------------------------------------------------

describe('GET /api/concepts/search', () => {
  test('returns 400 when q is missing', async () => {
    const res = await request.get('/api/concepts/search');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Query is required');
  });

  test('returns empty data when no concepts match', async () => {
    const res = await request.get('/api/concepts/search?q=zzznomatch');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('returns concepts matching englishGloss substring', async () => {
    await Concept.create([
      { englishGloss: 'house', partOfSpeech: 'noun', status: 'published' },
      { englishGloss: 'water', partOfSpeech: 'noun', status: 'published' },
    ]);
    const res = await request.get('/api/concepts/search?q=hou');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].englishGloss).toBe('house');
  });

  test('ranks exact match above prefix above substring', async () => {
    await Concept.create([
      { englishGloss: 'ahouseb',  partOfSpeech: 'noun', status: 'published' },
      { englishGloss: 'house',    partOfSpeech: 'noun', status: 'published' },
      { englishGloss: 'housecat', partOfSpeech: 'noun', status: 'published' },
    ]);
    const res = await request.get('/api/concepts/search?q=house');
    expect(res.status).toBe(200);
    const glosses = res.body.data.map((c) => c.englishGloss);
    expect(glosses[0]).toBe('house');
    expect(glosses[1]).toBe('housecat');
    expect(glosses[2]).toBe('ahouseb');
  });

  test('does not return unpublished concepts', async () => {
    await Concept.create([
      { englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' },
      { englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' },
    ]);
    const res = await request.get('/api/concepts/search?q=house');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('includes variantCount in results', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    await Variant.create([
      { concept: concept._id, pashto: 'کور', region: 'Kohat',   definition: 'dwelling', status: 'published' },
      { concept: concept._id, pashto: 'کور۲', region: 'Hangu',  definition: 'dwelling', status: 'published' },
      { concept: concept._id, pashto: 'کور۳', region: 'Tirah',  definition: 'dwelling', status: 'pending' },
    ]);
    const res = await request.get('/api/concepts/search?q=house');
    expect(res.status).toBe(200);
    expect(res.body.data[0].variantCount).toBe(2);
  });

  test('returns concepts matched via variant phonetic field', async () => {
    const concept = await Concept.create({ englishGloss: 'mountain', partOfSpeech: 'noun', status: 'published' });
    await Variant.create({
      concept: concept._id,
      pashto: 'غر',
      phonetic: 'ghar',
      region: 'Kohat',
      definition: 'a large hill',
      status: 'published',
    });
    const res = await request.get('/api/concepts/search?q=ghar');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].englishGloss).toBe('mountain');
  });

  test('response uses standard envelope shape', async () => {
    const res = await request.get('/api/concepts/search?q=house');
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toMatchObject({ page: expect.any(Number), limit: expect.any(Number), total: expect.any(Number) });
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/concepts/:id/status
// ---------------------------------------------------------------------------

describe('PATCH /api/concepts/:id/status', () => {
  test('returns 401 with no token', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.patch(`/api/concepts/${fakeId}/status`).send({ status: 'approved' });
    expect(res.status).toBe(401);
  });

  test('returns 403 for user role', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = makeToken({ role: 'user' });
    const res = await request.patch(`/api/concepts/${fakeId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(403);
  });

  test('returns 400 for invalid ObjectId', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch('/api/concepts/bad-id/status').set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(400);
  });

  test('returns 200 and approves a pending concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });

  test('returns 400 when rejecting without moderatorNote', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'rejected' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 and rejects with a note', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'rejected', moderatorNote: 'Not accurate' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.moderatorNote).toBe('Not accurate');
  });

  test('returns 403 when non-admin tries to publish', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'published' });
    expect(res.status).toBe(403);
  });

  test('admin can publish an approved concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' });
    const token = makeToken({ role: 'admin' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
  });

  test('writes ModerationLog on status transition', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    const log = await ModerationLog.findOne({ targetId: concept._id, targetModel: 'Concept', action: 'approved' });
    expect(log).not.toBeNull();
  });

  test('returns 400 for invalid status transition', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(400);
  });
});
