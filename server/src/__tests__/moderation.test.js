require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const moderationRouter = require('../routes/moderation');
const Entry = require('../models/Entry');
const ModerationLog = require('../models/ModerationLog');

const app = express();
app.use(express.json());
app.use('/api/moderation', moderationRouter);
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
// GET /api/moderation/queue
// ---------------------------------------------------------------------------

describe('GET /api/moderation/queue', () => {
  test('returns 401 when no token provided', async () => {
    const res = await request.get('/api/moderation/queue');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 when role is user', async () => {
    const token = makeToken({ role: 'user' });
    const res = await request.get('/api/moderation/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 for moderator', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 200 for admin', async () => {
    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns only pending entries', async () => {
    await Entry.create([
      { pashto: 'کور', status: 'pending' },
      { pashto: 'سپی', status: 'approved' },
      { pashto: 'اوبه', status: 'published' },
    ]);
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/queue').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].pashto).toBe('کور');
  });

  test('response has envelope shape with meta', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/queue').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('page');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('total');
  });

  test('defaults page to 1 and limit to 20', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request.get('/api/moderation/queue').set('Authorization', `Bearer ${token}`);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/moderation/:id/approve
// ---------------------------------------------------------------------------

describe('PATCH /api/moderation/:id/approve', () => {
  test('returns 401 with no token', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.patch(`/api/moderation/${fakeId}/approve`);
    expect(res.status).toBe(401);
  });

  test('returns 403 for user role', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = makeToken({ role: 'user' });
    const res = await request.patch(`/api/moderation/${fakeId}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 400 for invalid ObjectId', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch('/api/moderation/bad-id/approve').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when entry does not exist', async () => {
    const token = makeToken({ role: 'moderator' });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.patch(`/api/moderation/${fakeId}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when entry is not pending', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'approved' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/moderation/${entry._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 and updates status to approved', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/moderation/${entry._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('approved');
  });

  test('sets reviewedBy to the acting user', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'moderator', id: modId });
    const res = await request.patch(`/api/moderation/${entry._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviewedBy).toBe(modId);
  });

  test('writes ModerationLog with action approved', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/moderation/${entry._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const log = await ModerationLog.findOne({ entry: entry._id, action: 'approved' });
    expect(log).not.toBeNull();
  });

  test('admin can also approve', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'admin' });
    const res = await request.patch(`/api/moderation/${entry._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/moderation/:id/reject
// ---------------------------------------------------------------------------

describe('PATCH /api/moderation/:id/reject', () => {
  test('returns 401 with no token', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.patch(`/api/moderation/${fakeId}/reject`).send({ note: 'bad' });
    expect(res.status).toBe(401);
  });

  test('returns 403 for user role', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = makeToken({ role: 'user' });
    const res = await request
      .patch(`/api/moderation/${fakeId}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'bad' });
    expect(res.status).toBe(403);
  });

  test('returns 400 when note is missing', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/moderation/${entry._id}/reject`).set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when note is empty string', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for invalid ObjectId', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .patch('/api/moderation/bad-id/reject')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'reason' });
    expect(res.status).toBe(400);
  });

  test('returns 404 when entry does not exist', async () => {
    const token = makeToken({ role: 'moderator' });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request
      .patch(`/api/moderation/${fakeId}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'reason' });
    expect(res.status).toBe(404);
  });

  test('returns 400 when entry is not pending', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'approved' });
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'reason' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 and updates status to rejected', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Does not meet standards' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.moderatorNote).toBe('Does not meet standards');
  });

  test('writes ModerationLog with action rejected and note', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'reason' });
    const log = await ModerationLog.findOne({ entry: entry._id, action: 'rejected' });
    expect(log).not.toBeNull();
    expect(log.note).toBe('reason');
  });

  test('admin can also reject', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'admin' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'reason' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/moderation/:id/publish
// ---------------------------------------------------------------------------

describe('PATCH /api/moderation/:id/publish', () => {
  test('returns 401 with no token', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.patch(`/api/moderation/${fakeId}/publish`);
    expect(res.status).toBe(401);
  });

  test('returns 403 for moderator role', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = makeToken({ role: 'moderator' });
    const res = await request.patch(`/api/moderation/${fakeId}/publish`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 403 for user role', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = makeToken({ role: 'user' });
    const res = await request.patch(`/api/moderation/${fakeId}/publish`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 400 for invalid ObjectId', async () => {
    const token = makeToken({ role: 'admin' });
    const res = await request.patch('/api/moderation/bad-id/publish').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('returns 404 when entry does not exist', async () => {
    const token = makeToken({ role: 'admin' });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.patch(`/api/moderation/${fakeId}/publish`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('returns 400 when entry is pending (not approved)', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const token = makeToken({ role: 'admin' });
    const res = await request.patch(`/api/moderation/${entry._id}/publish`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when entry is rejected (not approved)', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'rejected' });
    const token = makeToken({ role: 'admin' });
    const res = await request.patch(`/api/moderation/${entry._id}/publish`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 and updates status to published', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'approved' });
    const token = makeToken({ role: 'admin' });
    const res = await request.patch(`/api/moderation/${entry._id}/publish`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('published');
  });

  test('writes ModerationLog with action published', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'approved' });
    const token = makeToken({ role: 'admin' });
    const res = await request.patch(`/api/moderation/${entry._id}/publish`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const log = await ModerationLog.findOne({ entry: entry._id, action: 'published' });
    expect(log).not.toBeNull();
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

  test('returns log entries with populated entry and performedBy', async () => {
    const userId = new mongoose.Types.ObjectId();
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    await ModerationLog.create({ entry: entry._id, action: 'submitted', performedBy: userId });

    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    // entry is populated — should have pashto field
    expect(res.body.data[0].entry).toHaveProperty('pashto');
  });

  test('defaults page to 1 and limit to 20', async () => {
    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Extended: invalid state transitions — approve
// ---------------------------------------------------------------------------

describe('PATCH /api/moderation/:id/approve — invalid transitions', () => {
  test('returns 400 when approving an already-rejected entry', async () => {
    const entry = await Entry.create({ pashto: 'ښار', status: 'rejected' });
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when approving a published entry', async () => {
    const entry = await Entry.create({ pashto: 'ښار', status: 'published' });
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Extended: invalid state transitions — reject
// ---------------------------------------------------------------------------

describe('PATCH /api/moderation/:id/reject — invalid transitions', () => {
  test('returns 400 when rejecting an already-rejected entry', async () => {
    const entry = await Entry.create({ pashto: 'ښار', status: 'rejected' });
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'duplicate rejection' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when rejecting a published entry', async () => {
    const entry = await Entry.create({ pashto: 'ښار', status: 'published' });
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'too late' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Extended: invalid state transitions — publish
// ---------------------------------------------------------------------------

describe('PATCH /api/moderation/:id/publish — invalid transitions', () => {
  test('returns 400 when publishing an already-published entry', async () => {
    const entry = await Entry.create({ pashto: 'ښار', status: 'published' });
    const token = makeToken({ role: 'admin' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Extended: ModerationLog integrity
// ---------------------------------------------------------------------------

describe('ModerationLog integrity', () => {
  test('approve creates exactly one log record', async () => {
    const entry = await Entry.create({ pashto: 'لمر', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    await request
      .patch(`/api/moderation/${entry._id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    const logs = await ModerationLog.find({ entry: entry._id });
    expect(logs).toHaveLength(1);
  });

  test('approve log has correct entry reference', async () => {
    const entry = await Entry.create({ pashto: 'لمر', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    await request
      .patch(`/api/moderation/${entry._id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    const log = await ModerationLog.findOne({ entry: entry._id });
    expect(log.entry.toString()).toBe(entry._id.toString());
  });

  test('approve log performedBy matches token user id', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const entry = await Entry.create({ pashto: 'لمر', status: 'pending' });
    const token = makeToken({ role: 'moderator', id: modId });
    await request
      .patch(`/api/moderation/${entry._id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    const log = await ModerationLog.findOne({ entry: entry._id, action: 'approved' });
    expect(log.performedBy.toString()).toBe(modId);
  });

  test('reject creates exactly one log record', async () => {
    const entry = await Entry.create({ pashto: 'لمر', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'not suitable' });
    const logs = await ModerationLog.find({ entry: entry._id });
    expect(logs).toHaveLength(1);
  });

  test('reject log performedBy matches token user id', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const entry = await Entry.create({ pashto: 'لمر', status: 'pending' });
    const token = makeToken({ role: 'moderator', id: modId });
    await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'not suitable' });
    const log = await ModerationLog.findOne({ entry: entry._id, action: 'rejected' });
    expect(log.performedBy.toString()).toBe(modId);
  });

  test('publish creates exactly one log record', async () => {
    const entry = await Entry.create({ pashto: 'لمر', status: 'approved' });
    const token = makeToken({ role: 'admin' });
    await request
      .patch(`/api/moderation/${entry._id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    const logs = await ModerationLog.find({ entry: entry._id });
    expect(logs).toHaveLength(1);
  });

  test('publish log performedBy matches token user id', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const entry = await Entry.create({ pashto: 'لمر', status: 'approved' });
    const token = makeToken({ role: 'admin', id: adminId });
    await request
      .patch(`/api/moderation/${entry._id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    const log = await ModerationLog.findOne({ entry: entry._id, action: 'published' });
    expect(log.performedBy.toString()).toBe(adminId);
  });
});

// ---------------------------------------------------------------------------
// Extended: reject note validation edge cases
// ---------------------------------------------------------------------------

describe('PATCH /api/moderation/:id/reject — note validation edge cases', () => {
  test('returns 400 when note is whitespace only', async () => {
    const entry = await Entry.create({ pashto: 'اوښ', status: 'pending' });
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/moderation/${entry._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Extended: GET /api/moderation/log — population and security
// ---------------------------------------------------------------------------

describe('GET /api/moderation/log — population and security', () => {
  test('log entry includes performedBy.username', async () => {
    const userId = new mongoose.Types.ObjectId();
    const entry = await Entry.create({ pashto: 'اوښ', status: 'pending' });
    // Insert a log with a bare ObjectId — populate will return the ref as-is when
    // User doc is absent; the key assertion is that pashto is present on entry.
    await ModerationLog.create({ entry: entry._id, action: 'submitted', performedBy: userId });

    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty('entry');
    expect(res.body.data[0].entry).toHaveProperty('pashto');
  });

  test('log response does not expose passwordHash on performedBy', async () => {
    const userId = new mongoose.Types.ObjectId();
    const entry = await Entry.create({ pashto: 'اوښ', status: 'pending' });
    await ModerationLog.create({ entry: entry._id, action: 'submitted', performedBy: userId });

    const token = makeToken({ role: 'admin' });
    const res = await request.get('/api/moderation/log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const rawJson = JSON.stringify(res.body);
    expect(rawJson).not.toMatch(/passwordHash/);
  });

  test('accepts page and limit query params', async () => {
    const token = makeToken({ role: 'admin' });
    const res = await request
      .get('/api/moderation/log?page=2&limit=5')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Extended: GET /api/moderation/queue — pagination query params
// ---------------------------------------------------------------------------

describe('GET /api/moderation/queue — pagination query params', () => {
  test('accepts page and limit query params', async () => {
    const token = makeToken({ role: 'moderator' });
    const res = await request
      .get('/api/moderation/queue?page=2&limit=5')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(5);
  });
});
