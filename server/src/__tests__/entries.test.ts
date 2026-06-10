// Decode existing jwt.sign() tokens so verifyToken middleware accepts them
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
  res.status(err.status || 500).json({
    success: false,
    error: { message: err.message || 'Internal server error' },
  });
});

const request = supertest(app);

let mongoServer;

async function makeToken(overrides = {}) {
  const secret = process.env.JWT_SECRET || 'test-secret-for-jest';
  const id = overrides.id ?? new mongoose.Types.ObjectId().toString();
  const role = overrides.role ?? 'user';
  await User.create({ cognitoSub: id, username: `user-${id.slice(-6)}`, email: `${id.slice(-6)}@test.local`, role });
  return jwt.sign(
    { id, username: 'testuser', role, ...overrides },
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

  test('returns pending concepts when status=pending filter is used by a moderator', async () => {
    await Concept.create([
      { englishGloss: 'house', partOfSpeech: 'noun', status: 'published' },
      { englishGloss: 'dog',   partOfSpeech: 'noun', status: 'pending' },
    ]);
    const modToken = await makeToken({ role: 'moderator' });
    const res = await request
      .get('/api/concepts?status=pending')
      .set('Authorization', `Bearer ${modToken}`);
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
    const token = await makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send({ partOfSpeech: 'noun' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when partOfSpeech is missing', async () => {
    const token = await makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send({ englishGloss: 'house' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when partOfSpeech is invalid', async () => {
    const token = await makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send({ englishGloss: 'house', partOfSpeech: 'emoji' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 201 with created concept on valid input', async () => {
    const token = await makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.englishGloss).toBe('house');
  });

  test('sets status to pending on creation', async () => {
    const token = await makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  test('creates a ModerationLog entry with action "submitted"', async () => {
    const token = await makeToken();
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    const log = await ModerationLog.findOne({ targetId: res.body.data._id, targetModel: 'Concept' });
    expect(log).not.toBeNull();
    expect(log.action).toBe('submitted');
  });

  test('sets submittedBy from the token user id', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ id: userId });
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.data.submittedBy).toBe(userId);
  });

  test('response uses envelope shape', async () => {
    const token = await makeToken();
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
    const token = await makeToken();
    const { pashto: _p, ...body } = valid();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when region is missing', async () => {
    const token = await makeToken();
    const { region: _r, ...body } = valid();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when definition is missing', async () => {
    const token = await makeToken();
    const { definition: _d, ...body } = valid();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when region is invalid', async () => {
    const token = await makeToken();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send({ ...valid(), region: 'Kandahar' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 201 with created variant on valid input', async () => {
    const token = await makeToken();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pashto).toBe('کور');
  });

  test('sets status to pending on creation', async () => {
    const token = await makeToken();
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  test('returns 409 when pashto word already exists', async () => {
    const token = await makeToken();
    await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(valid());
    const res = await request.post('/api/variants').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  test('creates a ModerationLog entry with action "submitted"', async () => {
    const token = await makeToken();
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
      const token = await makeToken();
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
      { englishGloss: 'house pending',  partOfSpeech: 'noun', status: 'pending' },
      { englishGloss: 'house approved', partOfSpeech: 'noun', status: 'approved' },
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
    const token = await makeToken({ role: 'user' });
    const res = await request.patch(`/api/concepts/${fakeId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(403);
  });

  test('returns 400 for invalid ObjectId', async () => {
    const token = await makeToken({ role: 'moderator' });
    const res = await request.patch('/api/concepts/bad-id/status').set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(400);
  });

  test('returns 200 and approves a pending concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });

  test('returns 400 when rejecting without moderatorNote', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'rejected' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 and rejects with a note', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'rejected', moderatorNote: 'Not accurate' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.moderatorNote).toBe('Not accurate');
  });

  test('returns 403 when non-admin tries to publish', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'published' });
    expect(res.status).toBe(403);
  });

  test('admin can publish an approved concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' });
    const token = await makeToken({ role: 'admin' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
  });

  test('writes ModerationLog on status transition', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = await makeToken({ role: 'moderator' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    const log = await ModerationLog.findOne({ targetId: concept._id, targetModel: 'Concept', action: 'approved' });
    expect(log).not.toBeNull();
  });

  test('returns 400 for invalid status transition', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — Soft-delete: DELETE /api/concepts/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/concepts/:id', () => {
  test('returns 403 when role is moderator', async () => {
    const concept = await Concept.create({ englishGloss: 'fire', partOfSpeech: 'noun', status: 'published' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.delete(`/api/concepts/${concept._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 when role is user', async () => {
    const concept = await Concept.create({ englishGloss: 'fire', partOfSpeech: 'noun', status: 'published' });
    const token = await makeToken({ role: 'user' });
    const res = await request.delete(`/api/concepts/${concept._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 401 when no token is provided', async () => {
    const concept = await Concept.create({ englishGloss: 'fire', partOfSpeech: 'noun', status: 'published' });
    const res = await request.delete(`/api/concepts/${concept._id}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when concept does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'admin' });
    const res = await request.delete(`/api/concepts/${fakeId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('admin soft-deletes the concept and returns 200 with updated doc', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({ englishGloss: 'fire', partOfSpeech: 'noun', status: 'published' });
    const token = await makeToken({ role: 'admin', id: adminId });
    const res = await request.delete(`/api/concepts/${concept._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isDeleted).toBe(true);
    expect(res.body.data.deletedAt).toBeDefined();
    expect(res.body.data.deletedBy).toBe(adminId);
  });

  test('soft-delete sets isDeleted, deletedAt, deletedBy on the document in the database', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({ englishGloss: 'fire', partOfSpeech: 'noun', status: 'published' });
    const token = await makeToken({ role: 'admin', id: adminId });
    await request.delete(`/api/concepts/${concept._id}`).set('Authorization', `Bearer ${token}`);
    const updated = await Concept.findById(concept._id);
    expect(updated.isDeleted).toBe(true);
    expect(updated.deletedAt).toBeDefined();
    expect(updated.deletedBy.toString()).toBe(adminId);
  });

  test('writes a ModerationLog entry with action "deleted"', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({ englishGloss: 'fire', partOfSpeech: 'noun', status: 'published' });
    const token = await makeToken({ role: 'admin', id: adminId });
    await request.delete(`/api/concepts/${concept._id}`).set('Authorization', `Bearer ${token}`);
    const log = await ModerationLog.findOne({ targetId: concept._id, targetModel: 'Concept', action: 'deleted' });
    expect(log).not.toBeNull();
    expect(log.performedBy.toString()).toBe(adminId);
  });

  test('response uses the envelope shape', async () => {
    const concept = await Concept.create({ englishGloss: 'fire', partOfSpeech: 'noun', status: 'published' });
    const token = await makeToken({ role: 'admin' });
    const res = await request.delete(`/api/concepts/${concept._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — Soft-delete: DELETE /api/variants/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/variants/:id', () => {
  let concept;

  beforeEach(async () => {
    concept = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun', status: 'published' });
  });

  test('returns 403 when role is moderator', async () => {
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Kohat', definition: 'water', status: 'published' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.delete(`/api/variants/${variant._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 401 when no token is provided', async () => {
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Kohat', definition: 'water', status: 'published' });
    const res = await request.delete(`/api/variants/${variant._id}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when variant does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'admin' });
    const res = await request.delete(`/api/variants/${fakeId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('admin soft-deletes the variant and returns 200 with updated doc', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Kohat', definition: 'water', status: 'published' });
    const token = await makeToken({ role: 'admin', id: adminId });
    const res = await request.delete(`/api/variants/${variant._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isDeleted).toBe(true);
    expect(res.body.data.deletedAt).toBeDefined();
    expect(res.body.data.deletedBy).toBe(adminId);
  });

  test('soft-delete sets isDeleted, deletedAt, deletedBy on the document in the database', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Kohat', definition: 'water', status: 'published' });
    const token = await makeToken({ role: 'admin', id: adminId });
    await request.delete(`/api/variants/${variant._id}`).set('Authorization', `Bearer ${token}`);
    const updated = await Variant.findById(variant._id);
    expect(updated.isDeleted).toBe(true);
    expect(updated.deletedAt).toBeDefined();
    expect(updated.deletedBy.toString()).toBe(adminId);
  });

  test('writes a ModerationLog entry with action "deleted"', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Kohat', definition: 'water', status: 'published' });
    const token = await makeToken({ role: 'admin', id: adminId });
    await request.delete(`/api/variants/${variant._id}`).set('Authorization', `Bearer ${token}`);
    const log = await ModerationLog.findOne({ targetId: variant._id, targetModel: 'Variant', action: 'deleted' });
    expect(log).not.toBeNull();
    expect(log.performedBy.toString()).toBe(adminId);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — Soft-delete filtering: concepts are invisible after deletion
// ---------------------------------------------------------------------------

describe('Soft-deleted Concept is invisible to all public query paths', () => {
  test('GET /api/concepts/:id returns 404 for a soft-deleted concept', async () => {
    const concept = await Concept.create({ englishGloss: 'river', partOfSpeech: 'noun', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const res = await request.get(`/api/concepts/${concept._id}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/concepts does not include soft-deleted concepts', async () => {
    await Concept.create({ englishGloss: 'river', partOfSpeech: 'noun', status: 'published' });
    await Concept.create({ englishGloss: 'stone', partOfSpeech: 'noun', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const res = await request.get('/api/concepts');
    expect(res.status).toBe(200);
    const glosses = res.body.data.map((c) => c.englishGloss);
    expect(glosses).toContain('river');
    expect(glosses).not.toContain('stone');
  });

  test('GET /api/concepts/search does not return soft-deleted concepts', async () => {
    await Concept.create({ englishGloss: 'mountain', partOfSpeech: 'noun', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const res = await request.get('/api/concepts/search?q=mountain');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('GET /api/concepts/suggest does not return soft-deleted concepts', async () => {
    await Concept.create({ englishGloss: 'valley', partOfSpeech: 'noun', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const res = await request.get('/api/concepts/suggest?q=valley');
    expect(res.status).toBe(200);
    const glosses = res.body.data.map((c) => c.englishGloss);
    expect(glosses).not.toContain('valley');
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — Soft-delete filtering: variants are invisible after deletion
// ---------------------------------------------------------------------------

describe('Soft-deleted Variant is invisible to all public query paths', () => {
  let concept;

  beforeEach(async () => {
    concept = await Concept.create({ englishGloss: 'sky', partOfSpeech: 'noun', status: 'published' });
  });

  test('GET /api/variants/:id returns 404 for a soft-deleted variant', async () => {
    const variant = await Variant.create({ concept: concept._id, pashto: 'اسمان', region: 'Kohat', definition: 'sky', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const res = await request.get(`/api/variants/${variant._id}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/concepts/:id does not include soft-deleted variants in the variants array', async () => {
    await Variant.create({ concept: concept._id, pashto: 'اسمان', region: 'Kohat', definition: 'sky', status: 'published' });
    await Variant.create({ concept: concept._id, pashto: 'آسمان', region: 'Hangu', definition: 'sky deleted', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const res = await request.get(`/api/concepts/${concept._id}`);
    expect(res.status).toBe(200);
    const variantDefinitions = res.body.data.variants.map((v) => v.definition);
    expect(variantDefinitions).toContain('sky');
    expect(variantDefinitions).not.toContain('sky deleted');
  });

  test('GET /api/variants/search does not return soft-deleted variants', async () => {
    await Variant.create({ concept: concept._id, pashto: 'اسمان', region: 'Kohat', definition: 'the sky above', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const res = await request.get('/api/variants/search?q=اسمان');
    expect(res.status).toBe(200);
    const pashtos = res.body.data.map((v) => v.pashto);
    expect(pashtos).not.toContain('اسمان');
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Normalized duplicate detection: POST /api/concepts
// ---------------------------------------------------------------------------

describe('POST /api/concepts — normalized duplicate detection', () => {
  const valid = () => ({ englishGloss: 'house', partOfSpeech: 'noun' });

  test('returns 409 when concept with exact same englishGloss already exists', async () => {
    const token = await makeToken();
    await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending', normalizedGloss: 'house' });
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send(valid());
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  test('returns 409 when concept with same gloss but different case already exists (normalized match)', async () => {
    const token = await makeToken();
    await Concept.create({ englishGloss: 'House', partOfSpeech: 'noun', status: 'pending', normalizedGloss: 'house' });
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send({ englishGloss: 'house', partOfSpeech: 'noun' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  test('returns 409 when concept with same gloss but extra whitespace already exists (normalized match)', async () => {
    const token = await makeToken();
    await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending', normalizedGloss: 'house' });
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send({ englishGloss: '  house  ', partOfSpeech: 'noun' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  test('returns 201 when concept with a different gloss is submitted', async () => {
    const token = await makeToken();
    await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending', normalizedGloss: 'house' });
    const res = await request.post('/api/concepts').set('Authorization', `Bearer ${token}`).send({ englishGloss: 'water', partOfSpeech: 'noun' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Normalized duplicate detection: POST /api/variants
// ---------------------------------------------------------------------------

describe('POST /api/variants — normalized duplicate detection', () => {
  let conceptIdForDupTest;

  beforeEach(async () => {
    const concept = await Concept.create({ englishGloss: 'duphouse', partOfSpeech: 'noun', status: 'published' });
    conceptIdForDupTest = concept._id.toString();
  });

  test('returns 409 when variant with same pashto + concept + region already exists (normalized)', async () => {
    const token = await makeToken();
    await Variant.create({
      concept: conceptIdForDupTest,
      pashto: 'کور',
      normalizedPashto: 'کور'.trim().normalize('NFC'),
      region: 'Kohat',
      definition: 'existing dwelling',
      status: 'pending',
    });
    const res = await request
      .post('/api/variants')
      .set('Authorization', `Bearer ${token}`)
      .send({ conceptId: conceptIdForDupTest, pashto: 'کور', region: 'Kohat', definition: 'a dwelling place' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  test('returns 201 when same pashto word is submitted for a different region', async () => {
    const token = await makeToken();
    await Variant.create({
      concept: conceptIdForDupTest,
      pashto: 'کور',
      normalizedPashto: 'کور'.trim().normalize('NFC'),
      region: 'Kohat',
      definition: 'existing dwelling',
      status: 'pending',
    });
    const res = await request
      .post('/api/variants')
      .set('Authorization', `Bearer ${token}`)
      .send({ conceptId: conceptIdForDupTest, pashto: 'کور', region: 'Hangu', definition: 'a dwelling place' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('returns 201 when resubmitting the same pashto + region after prior rejection (rejected does not block)', async () => {
    const token = await makeToken();
    await Variant.create({
      concept: conceptIdForDupTest,
      pashto: 'کور',
      normalizedPashto: 'کور'.trim().normalize('NFC'),
      region: 'Kohat',
      definition: 'rejected dwelling',
      status: 'rejected',
      isDeleted: true,
      deletedAt: new Date(),
    });
    const res = await request
      .post('/api/variants')
      .set('Authorization', `Bearer ${token}`)
      .send({ conceptId: conceptIdForDupTest, pashto: 'کور', region: 'Kohat', definition: 'resubmit after rejection' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Moderator self-approval restriction: PATCH /api/concepts/:id/status
// ---------------------------------------------------------------------------

describe('PATCH /api/concepts/:id/status — moderator self-approval restriction', () => {
  test('moderator gets 403 when trying to approve a concept they submitted', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: modId });
    const concept = await Concept.create({
      englishGloss: 'selfapprovetest1',
      partOfSpeech: 'noun',
      status: 'pending',
      submittedBy: new mongoose.Types.ObjectId(modId),
    });
    const res = await request
      .patch(`/api/concepts/${concept._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/cannot approve or reject their own/i);
  });

  test('moderator gets 403 when trying to reject a concept they submitted', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: modId });
    const concept = await Concept.create({
      englishGloss: 'selfrejecttest1',
      partOfSpeech: 'noun',
      status: 'pending',
      submittedBy: new mongoose.Types.ObjectId(modId),
    });
    const res = await request
      .patch(`/api/concepts/${concept._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rejected', moderatorNote: 'nope' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/cannot approve or reject their own/i);
  });

  test('a different moderator (not the submitter) can approve the concept', async () => {
    const submitterModId = new mongoose.Types.ObjectId().toString();
    const reviewerModId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: reviewerModId });
    const concept = await Concept.create({
      englishGloss: 'othermodapprove1',
      partOfSpeech: 'noun',
      status: 'pending',
      submittedBy: new mongoose.Types.ObjectId(submitterModId),
    });
    const res = await request
      .patch(`/api/concepts/${concept._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });

  test('admin can approve a concept they submitted themselves', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'admin', id: adminId });
    const concept = await Concept.create({
      englishGloss: 'adminselfapprove1',
      partOfSpeech: 'noun',
      status: 'pending',
      submittedBy: new mongoose.Types.ObjectId(adminId),
    });
    const res = await request
      .patch(`/api/concepts/${concept._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Moderator self-approval restriction: PATCH /api/variants/:id/status
// ---------------------------------------------------------------------------

describe('PATCH /api/variants/:id/status — moderator self-approval restriction', () => {
  let variantSelfApprovalConcept;

  beforeEach(async () => {
    variantSelfApprovalConcept = await Concept.create({ englishGloss: 'wind', partOfSpeech: 'noun', status: 'published' });
  });

  test('moderator gets 403 when trying to approve a variant they submitted', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: modId });
    const variant = await Variant.create({
      concept: variantSelfApprovalConcept._id,
      pashto: 'باد',
      region: 'Kohat',
      definition: 'wind',
      status: 'pending',
      submittedBy: new mongoose.Types.ObjectId(modId),
    });
    const res = await request
      .patch(`/api/variants/${variant._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/cannot approve or reject their own/i);
  });

  test('a different moderator can approve a variant they did not submit', async () => {
    const submitterModId = new mongoose.Types.ObjectId().toString();
    const reviewerModId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: reviewerModId });
    const variant = await Variant.create({
      concept: variantSelfApprovalConcept._id,
      pashto: 'باد',
      region: 'Kohat',
      definition: 'wind',
      status: 'pending',
      submittedBy: new mongoose.Types.ObjectId(submitterModId),
    });
    const res = await request
      .patch(`/api/variants/${variant._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// Soft-delete DB persistence — record survives as isDeleted: true
// ---------------------------------------------------------------------------

describe('Soft-delete DB persistence — Concept', () => {
  test('soft-deleted concept still exists in DB with isDeleted:true', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const adminToken = await makeToken({ role: 'admin', id: adminId });
    const concept = await Concept.create({ englishGloss: 'persistence-concept', partOfSpeech: 'noun' });

    await request
      .delete(`/api/concepts/${concept._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const found = await Concept.findById(concept._id);
    expect(found).not.toBeNull();
    expect(found.isDeleted).toBe(true);
    expect(found.deletedAt).toBeDefined();
    expect(found.deletedBy.toString()).toBe(adminId);
  });
});

describe('Soft-delete DB persistence — Variant', () => {
  test('soft-deleted variant still exists in DB with isDeleted:true', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const adminToken = await makeToken({ role: 'admin', id: adminId });
    const concept = await Concept.create({ englishGloss: 'persistence-variant-concept', partOfSpeech: 'noun' });
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'ساه',
      region: 'Kohat',
      definition: 'breath',
    });

    await request
      .delete(`/api/variants/${variant._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const found = await Variant.findById(variant._id);
    expect(found).not.toBeNull();
    expect(found.isDeleted).toBe(true);
    expect(found.deletedAt).toBeDefined();
    expect(found.deletedBy.toString()).toBe(adminId);
  });
});

// ---------------------------------------------------------------------------
// Soft-delete enables reuse — same identity can be re-submitted after delete
// ---------------------------------------------------------------------------

describe('Soft-delete enables Concept reuse', () => {
  test('same englishGloss can be submitted again after the original is soft-deleted', async () => {
    const adminToken = await makeToken({ role: 'admin' });
    const userToken = await makeToken({ role: 'user' });

    const original = await Concept.create({ englishGloss: 'Rebirth Test', partOfSpeech: 'noun' });
    await request
      .delete(`/api/concepts/${original._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request
      .post('/api/concepts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ englishGloss: 'Rebirth Test', partOfSpeech: 'noun' });

    expect(res.status).toBe(201);
    expect(res.body.data.englishGloss).toBe('Rebirth Test');
  });
});

describe('Soft-delete enables Variant reuse', () => {
  test('same pashto+concept+region can be submitted again after the original is soft-deleted', async () => {
    const adminToken = await makeToken({ role: 'admin' });
    const userToken = await makeToken({ role: 'user' });

    const concept = await Concept.create({ englishGloss: 'reuse-variant-concept', partOfSpeech: 'noun' });

    const original = await Variant.create({
      concept: concept._id,
      pashto: 'رڼا',
      region: 'Kohat',
      definition: 'light',
    });

    await request
      .delete(`/api/variants/${original._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request
      .post('/api/variants')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        conceptId: concept._id.toString(),
        pashto: 'رڼا',
        region: 'Kohat',
        definition: 'light (resubmitted)',
      });

    expect(res.status).toBe(201);
  });
});
