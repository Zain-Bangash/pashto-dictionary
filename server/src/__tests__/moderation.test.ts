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
const moderationRouter = require('../routes/moderation');
const conceptsRouter = require('../routes/concepts');
const variantsRouter = require('../routes/variants');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');

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
// GET /api/moderation/concepts/queue
// ---------------------------------------------------------------------------

describe('GET /api/moderation/concepts/queue', () => {
  test('returns 401 when no token provided', async () => {
    const res = await request.get('/api/moderation/concepts/queue');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 when role is user', async () => {
    const token = await makeToken({ role: 'user' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 for moderator', async () => {
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 200 for admin', async () => {
    const token = await makeToken({ role: 'admin' });
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
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].englishGloss).toBe('house');
  });

  test('response has envelope shape with meta', async () => {
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('page');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('total');
  });

  test('defaults page to 1 and limit to 20', async () => {
    const token = await makeToken({ role: 'moderator' });
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
    const token = await makeToken({ role: 'user' });
    const res = await request.get('/api/moderation/variants/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 200 and only pending variants', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    await Variant.create([
      { concept: concept._id, pashto: 'کور', region: 'Kohat', definition: 'house', status: 'pending' },
      { concept: concept._id, pashto: 'کور2', region: 'Hangu', definition: 'house', status: 'approved' },
    ]);
    const token = await makeToken({ role: 'moderator' });
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
    const token = await makeToken({ role: 'user' });
    const res = await request.get('/api/moderation/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 200 with counts for moderator', async () => {
    await Concept.create([
      { englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' },
      { englishGloss: 'dog',   partOfSpeech: 'noun', status: 'published' },
    ]);
    const token = await makeToken({ role: 'moderator' });
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
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 403 for user role', async () => {
    const token = await makeToken({ role: 'user' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 200 for admin with envelope shape', async () => {
    const token = await makeToken({ role: 'admin' });
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

    const token = await makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('targetModel', 'Concept');
  });

  test('defaults page to 1 and limit to 20', async () => {
    const token = await makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });

  test('accepts page and limit query params', async () => {
    const token = await makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log?page=2&limit=5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(5);
  });

  test('does not expose passwordHash in response', async () => {
    const userId = new mongoose.Types.ObjectId();
    const concept = await Concept.create({ englishGloss: 'test', partOfSpeech: 'noun', status: 'pending' });
    await ModerationLog.create({ targetModel: 'Concept', targetId: concept._id, action: 'submitted', performedBy: userId });

    const token = await makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const rawJson = JSON.stringify(res.body);
    expect(rawJson).not.toMatch(/passwordHash/);
  });

  test('populates performedBy with username when User has matching cognitoSub', async () => {
    const token = await makeToken({ role: 'admin', id: 'sub-enrich-test' });
    const concept = await Concept.create({ englishGloss: 'river', partOfSpeech: 'noun', status: 'pending' });
    await ModerationLog.create({ targetModel: 'Concept', targetId: concept._id, action: 'submitted', performedBy: 'sub-enrich-test' });

    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].performedBy).toHaveProperty('username');
    expect(res.body.data[0].performedBy).toHaveProperty('cognitoSub', 'sub-enrich-test');
  });

  test('populates target.englishGloss for Concept log entries', async () => {
    const token = await makeToken({ role: 'admin' });
    const concept = await Concept.create({ englishGloss: 'mountain', partOfSpeech: 'noun', status: 'pending' });
    await ModerationLog.create({ targetModel: 'Concept', targetId: concept._id, action: 'submitted', performedBy: 'any-sub' });

    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].target).toHaveProperty('englishGloss', 'mountain');
  });

  test('filters by action query param', async () => {
    const token = await makeToken({ role: 'admin' });
    const concept = await Concept.create({ englishGloss: 'sky', partOfSpeech: 'noun', status: 'pending' });
    await ModerationLog.create({ targetModel: 'Concept', targetId: concept._id, action: 'submitted', performedBy: 'any-sub' });
    await ModerationLog.create({ targetModel: 'Concept', targetId: concept._id, action: 'approved', performedBy: 'any-sub' });

    const res = await request.get('/api/moderation/log?action=approved').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((e) => e.action === 'approved')).toBe(true);
    expect(res.body.meta.total).toBe(1);
  });

  test('filters by targetModel query param', async () => {
    const token = await makeToken({ role: 'admin' });
    const concept = await Concept.create({ englishGloss: 'fire', partOfSpeech: 'noun', status: 'pending' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'اور', region: 'Kohat', definition: 'fire', status: 'pending', submittedBy: 'any-sub' });
    await ModerationLog.create({ targetModel: 'Concept', targetId: concept._id, action: 'submitted', performedBy: 'any-sub' });
    await ModerationLog.create({ targetModel: 'Variant', targetId: variant._id, action: 'submitted', performedBy: 'any-sub' });

    const res = await request.get('/api/moderation/log?targetModel=Variant').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((e) => e.targetModel === 'Variant')).toBe(true);
    expect(res.body.meta.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// State machine via /api/concepts/:id/status
// ---------------------------------------------------------------------------

describe('Concept state machine — invalid transitions', () => {
  test('returns 400 when approving an already-approved concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when approving a published concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when publishing a pending concept', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = await makeToken({ role: 'admin' });
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
    const token = await makeToken({ role: 'moderator' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    const logs = await ModerationLog.find({ targetId: concept._id, targetModel: 'Concept' });
    expect(logs).toHaveLength(1);
  });

  test('approve log has correct targetId and targetModel', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = await makeToken({ role: 'moderator' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    const log = await ModerationLog.findOne({ targetId: concept._id, targetModel: 'Concept', action: 'approved' });
    expect(log).not.toBeNull();
    expect(log.targetId.toString()).toBe(concept._id.toString());
    expect(log.targetModel).toBe('Concept');
  });

  test('approve log performedBy matches token user id', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = await makeToken({ role: 'moderator', id: modId });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    const log = await ModerationLog.findOne({ targetId: concept._id, action: 'approved' });
    expect(log.performedBy.toString()).toBe(modId);
  });

  test('reject log has note field', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'pending' });
    const token = await makeToken({ role: 'moderator' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'rejected', moderatorNote: 'not suitable' });
    const log = await ModerationLog.findOne({ targetId: concept._id, action: 'rejected' });
    expect(log).not.toBeNull();
    expect(log.note).toBe('not suitable');
  });

  test('publish concept creates exactly one log record', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'approved' });
    const token = await makeToken({ role: 'admin' });
    await request.patch(`/api/concepts/${concept._id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'published' });
    const logs = await ModerationLog.find({ targetId: concept._id, targetModel: 'Concept' });
    expect(logs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — Soft-delete filtering in moderation queues
// ---------------------------------------------------------------------------

describe('GET /api/moderation/concepts/queue — excludes soft-deleted concepts', () => {
  test('does not return a soft-deleted pending concept in the queue', async () => {
    await Concept.create({ englishGloss: 'visible', partOfSpeech: 'noun', status: 'pending' });
    await Concept.create({ englishGloss: 'hidden', partOfSpeech: 'noun', status: 'pending', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/concepts/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const glosses = res.body.data.map((c) => c.englishGloss);
    expect(glosses).toContain('visible');
    expect(glosses).not.toContain('hidden');
  });
});

describe('GET /api/moderation/variants/queue — excludes soft-deleted variants', () => {
  test('does not return a soft-deleted pending variant in the queue', async () => {
    const concept = await Concept.create({ englishGloss: 'tree', partOfSpeech: 'noun', status: 'published' });
    await Variant.create({ concept: concept._id, pashto: 'ونه', region: 'Kohat', definition: 'tree visible', status: 'pending' });
    await Variant.create({ concept: concept._id, pashto: 'وني', region: 'Hangu', definition: 'tree hidden', status: 'pending', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/variants/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const definitions = res.body.data.map((v) => v.definition);
    expect(definitions).toContain('tree visible');
    expect(definitions).not.toContain('tree hidden');
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Moderator self-approval restriction in moderation flow
// ---------------------------------------------------------------------------

describe('Moderator self-approval — concept status transitions (moderation context)', () => {
  test('moderator cannot approve their own pending concept', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: modId });
    const concept = await Concept.create({
      englishGloss: 'modselfreview1',
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

  test('moderator cannot reject their own pending concept', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: modId });
    const concept = await Concept.create({
      englishGloss: 'modselfreject2',
      partOfSpeech: 'noun',
      status: 'pending',
      submittedBy: new mongoose.Types.ObjectId(modId),
    });
    const res = await request
      .patch(`/api/concepts/${concept._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rejected', moderatorNote: 'conflict of interest' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/cannot approve or reject their own/i);
  });

  test('admin is NOT restricted — can approve their own concept', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'admin', id: adminId });
    const concept = await Concept.create({
      englishGloss: 'adminownsubmit2',
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
// Concept-variant state integrity — publish guard
// ---------------------------------------------------------------------------

describe('Concept-variant integrity — publish guard', () => {
  test('returns 400 when publishing a variant whose concept is not published', async () => {
    const concept = await Concept.create({ englishGloss: 'guard-test', partOfSpeech: 'noun', status: 'approved' });
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'ازمیون',
      region: 'Kohat',
      definition: 'test',
      status: 'approved',
    });
    const token = await makeToken({ role: 'admin' });
    const res = await request
      .patch(`/api/variants/${variant._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/not yet published/i);
  });

  test('returns 200 when publishing a variant whose concept is published', async () => {
    const concept = await Concept.create({ englishGloss: 'guard-pass', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'خوشال',
      region: 'Kohat',
      definition: 'happy',
      status: 'approved',
    });
    const token = await makeToken({ role: 'admin' });
    const res = await request
      .patch(`/api/variants/${variant._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
  });
});

// ---------------------------------------------------------------------------
// Concept-variant state integrity — cascade reject
// ---------------------------------------------------------------------------

describe('Concept-variant integrity — cascade reject', () => {
  test('rejecting a concept soft-deletes its pending variants', async () => {
    const concept = await Concept.create({ englishGloss: 'cascade-pending', partOfSpeech: 'noun', status: 'pending' });
    const v1 = await Variant.create({ concept: concept._id, pashto: 'کور', region: 'Kohat', definition: 'home', status: 'pending' });
    const v2 = await Variant.create({ concept: concept._id, pashto: 'کور', region: 'Hangu', definition: 'home', status: 'pending' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/concepts/${concept._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rejected', moderatorNote: 'not valid' });
    expect(res.status).toBe(200);
    const saved1 = await Variant.findById(v1._id);
    const saved2 = await Variant.findById(v2._id);
    expect(saved1.isDeleted).toBe(true);
    expect(saved2.isDeleted).toBe(true);
  });

  test('rejecting a pending concept also soft-deletes its already-approved variants', async () => {
    const concept = await Concept.create({ englishGloss: 'cascade-approved-variant', partOfSpeech: 'noun', status: 'pending' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'سیند', region: 'Kohat', definition: 'river', status: 'approved' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/concepts/${concept._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rejected', moderatorNote: 'not valid' });
    expect(res.status).toBe(200);
    const saved = await Variant.findById(variant._id);
    expect(saved.isDeleted).toBe(true);
  });

  test('rejecting a pending concept writes ModerationLog entries for cascaded variants', async () => {
    const concept = await Concept.create({ englishGloss: 'cascade-log', partOfSpeech: 'noun', status: 'pending' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'غر', region: 'Kohat', definition: 'mountain', status: 'pending' });
    const token = await makeToken({ role: 'moderator' });
    await request
      .patch(`/api/concepts/${concept._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rejected', moderatorNote: 'invalid' });
    const cascadeLog = await ModerationLog.findOne({
      targetId: variant._id,
      targetModel: 'Variant',
      action: 'rejected',
    });
    expect(cascadeLog).not.toBeNull();
    expect(cascadeLog.note).toBe('Cascaded from concept rejection');
  });

  test('already-deleted variants are not affected by concept rejection cascade', async () => {
    const concept = await Concept.create({ englishGloss: 'cascade-skip', partOfSpeech: 'noun', status: 'pending' });
    const deletedVariant = await Variant.create({
      concept: concept._id,
      pashto: 'اوبه',
      region: 'Kohat',
      definition: 'water',
      status: 'pending',
      isDeleted: true,
      deletedAt: new Date(),
    });
    const token = await makeToken({ role: 'moderator' });
    await request
      .patch(`/api/concepts/${concept._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rejected', moderatorNote: 'invalid' });
    const logs = await ModerationLog.find({ targetId: deletedVariant._id, targetModel: 'Variant', action: 'rejected' });
    expect(logs).toHaveLength(0);
  });
});

describe('Moderator self-approval — variant status transitions (moderation context)', () => {
  let modConcept;

  beforeEach(async () => {
    modConcept = await Concept.create({ englishGloss: 'river', partOfSpeech: 'noun', status: 'published' });
  });

  test('moderator cannot approve a variant they submitted', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: modId });
    const variant = await Variant.create({
      concept: modConcept._id,
      pashto: 'سیند',
      region: 'Kohat',
      definition: 'river',
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

  test('a different moderator CAN approve a variant submitted by another moderator', async () => {
    const submitterModId = new mongoose.Types.ObjectId().toString();
    const reviewerModId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: reviewerModId });
    const variant = await Variant.create({
      concept: modConcept._id,
      pashto: 'سیند',
      region: 'Kohat',
      definition: 'river',
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
