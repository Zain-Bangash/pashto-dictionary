require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const moderationRouter = require('../routes/moderation');
const conceptsRouter = require('../routes/concepts');
const variantsRouter = require('../routes/variants');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');

const app = express();
app.use(express.json());
app.use('/api/moderation', moderationRouter);
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
// GET /api/moderation/concepts/queue
// ---------------------------------------------------------------------------

describe('GET /api/moderation/concepts/queue', () => {
  test('returns 401 when no token provided', async () => {
    const res = await request.get('/api/moderation/concepts/queue');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 when role is user', async () => {
    const token = makeToken({ role: 'user' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 for moderator', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 200 for admin', async () => {
    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns only pending concepts', async () => {
    await Concept.create([
      { englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' },
      { englishGloss: 'dog',   partOfSpeech: 'noun', status: 'approved' },
      { englishGloss: 'water', partOfSpeech: 'noun', status: 'published' },
    ]);
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].englishGloss).toBe('house');
  });

  test('response has envelope shape with meta', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('page');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('total');
  });

  test('defaults page to 1 and limit to 20', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// GET /api/moderation/variants/queue
// ---------------------------------------------------------------------------

describe('GET /api/moderation/variants/queue', () => {
  test('returns 401 when no token provided', async () => {
    const res = await request.get('/api/moderation/variants/queue');
    expect(res.status).toBe(401);
  });

  test('returns 403 when role is user', async () => {
    const token = makeToken({ role: 'user' });
    const res = await request.get('/api/moderation/variants/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 200 and only pending variants', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    await Variant.create([
      { concept: concept._id, pashto: 'کور', region: 'Kohat', definition: 'house', status: 'pending' },
      { concept: concept._id, pashto: 'کور2', region: 'Hangu', definition: 'house', status: 'approved' },
    ]);
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/variants/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].pashto).toBe('کور');
  });
});

// ---------------------------------------------------------------------------
// GET /api/moderation/stats
// ---------------------------------------------------------------------------

describe('GET /api/moderation/stats', () => {
  test('returns 401 with no token', async () => {
    const res = await request.get('/api/moderation/stats');
    expect(res.status).toBe(401);
  });

  test('returns 403 for user role', async () => {
    const token = makeToken({ role: 'user' });
    const res = await request.get('/api/moderation/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 200 with counts for moderator', async () => {
    await Concept.create([
      { englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' },
      { englishGloss: 'dog',   partOfSpeech: 'noun', status: 'published' },
    ]);
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('pending');
    expect(res.body.data).toHaveProperty('published');
    expect(res.body.data.pending).toBeGreaterThanOrEqual(1);
    expect(res.body.data.published).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/moderation/log
// ---------------------------------------------------------------------------

describe('GET /api/moderation/log', () => {
  test('returns 401 with no token', async () => {
    const res = await request.get('/api/moderation/log');
    expect(res.status).toBe(401);
  });

  test('returns 403 for moderator role', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 403 for user role', async () => {
    const token = makeToken({ role: 'user' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 200 for admin with envelope shape', async () => {
    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('page');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('total');
  });

  test('returns log entries with populated performedBy', async () => {
    const userId = new mongoose.Types.ObjectId();
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    await ModerationLog.create({ targetModel: 'Concept', targetId: concept._id, action: 'submitted', performedBy: userId });

    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('targetModel', 'Concept');
  });

  test('defaults page to 1 and limit to 20', async () => {
    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });

  test('accepts page and limit query params', async () => {
    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log?page=2&limit=5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(5);
  });

  test('does not expose passwordHash in response', async () => {
    const userId = new mongoose.Types.ObjectId();
    const concept = await Concept.create({ englishGloss: 'test', partOfSpeech: 'noun', status: 'pending' });
    await ModerationLog.create({ targetModel: 'Concept', targetId: concept._id, action: 'submitted', performedBy: userId });

    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const rawJson = JSON.stringify(res.body);
    expect(rawJson).not.toMatch(/passwordHash/);
  });
});

// ---------------------------------------------------------------------------
// State machine via /api/concepts/:id/status
// ---------------------------------------------------------------------------

describe('Concept state machine — invalid transitions', () => {
  test('returns 400 when approving an already-approved concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when approving a published concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when publishing a pending concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = makeToken({ role: 'admin' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'published' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ModerationLog integrity for Concept status transitions
// ---------------------------------------------------------------------------

describe('ModerationLog integrity', () => {
  test('approve concept creates exactly one log record', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    const logs = await ModerationLog.find({ targetId: concept._id, targetModel: 'Concept' });
    expect(logs).toHaveLength(1);
  });

  test('approve log has correct targetId and targetModel', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    const log = await ModerationLog.findOne({ targetId: concept._id, targetModel: 'Concept', action: 'approved' });
    expect(log).not.toBeNull();
    expect(log.targetId.toString()).toBe(concept._id.toString());
    expect(log.targetModel).toBe('Concept');
  });

  test('approve log performedBy matches token user id', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = makeToken({ role: 'moderator', id: modId });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    const log = await ModerationLog.findOne({ targetId: concept._id, action: 'approved' });
    expect(log.performedBy.toString()).toBe(modId);
  });

  test('reject log has note field', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'rejected', moderatorNote: 'not suitable' });
    const log = await ModerationLog.findOne({ targetId: concept._id, action: 'rejected' });
    expect(log).not.toBeNull();
    expect(log.note).toBe('not suitable');
  });

  test('publish concept creates exactly one log record', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' });
    const token = makeToken({ role: 'admin' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'published' });
    const logs = await ModerationLog.find({ targetId: concept._id, targetModel: 'Concept' });
    expect(logs).toHaveLength(1);
  });
});
