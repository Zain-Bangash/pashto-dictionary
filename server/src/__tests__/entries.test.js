require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const entriesRouter = require('../routes/entries');
const Entry = require('../models/Entry');
const ModerationLog = require('../models/ModerationLog');

const app = express();
app.use(express.json());
app.use('/api/entries', entriesRouter);
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
// GET /api/entries
// ---------------------------------------------------------------------------

describe('GET /api/entries', () => {
  test('returns 200 with empty data when no published entries exist', async () => {
    const res = await request.get('/api/entries');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBe(0);
  });

  test('returns only published entries', async () => {
    await Entry.create([
      { pashto: 'کور', status: 'published' },
      { pashto: 'سپی', status: 'pending' },
      { pashto: 'اوبه', status: 'approved' },
    ]);
    const res = await request.get('/api/entries');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].pashto).toBe('کور');
  });

  test('returns correct meta with page and limit', async () => {
    const res = await request.get('/api/entries?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(10);
  });

  test('caps limit at 50', async () => {
    const res = await request.get('/api/entries?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(50);
  });

  test('defaults page to 1 and limit to 20', async () => {
    const res = await request.get('/api/entries');
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });

  test('response matches envelope shape', async () => {
    const res = await request.get('/api/entries');
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('meta');
  });
});

// ---------------------------------------------------------------------------
// GET /api/entries/search
// ---------------------------------------------------------------------------

describe('GET /api/entries/search', () => {
  test('returns 400 when q is missing', async () => {
    const res = await request.get('/api/entries/search');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Search query is required');
  });

  test('returns 400 when q is empty string', async () => {
    const res = await request.get('/api/entries/search?q=');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Search query is required');
  });

  test('returns 200 with results when q is provided', async () => {
    await Entry.create({ pashto: 'کور', status: 'published' });
    const res = await request.get('/api/entries/search?q=کور');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  test('does not return non-published entries in search', async () => {
    await Entry.create([
      { pashto: 'کور', status: 'published' },
      { pashto: 'کور', status: 'pending' },
    ]);
    const res = await request.get('/api/entries/search?q=کور');
    expect(res.status).toBe(200);
    const statuses = res.body.data.map((e) => e.status);
    expect(statuses.every((s) => s === 'published')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/entries/:id
// ---------------------------------------------------------------------------

describe('GET /api/entries/:id', () => {
  test('returns 400 for invalid ObjectId', async () => {
    const res = await request.get('/api/entries/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBeDefined();
  });

  test('returns 404 when entry does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.get(`/api/entries/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when entry exists but is not published', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'pending' });
    const res = await request.get(`/api/entries/${entry._id}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 with entry when published', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'published' });
    const res = await request.get(`/api/entries/${entry._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pashto).toBe('کور');
  });

  test('response uses envelope shape', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'published' });
    const res = await request.get(`/api/entries/${entry._id}`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });
});

// ---------------------------------------------------------------------------
// POST /api/entries
// ---------------------------------------------------------------------------

describe('POST /api/entries', () => {
  const valid = () => ({
    pashto: 'کور',
    definitions: [{ text: 'house' }],
  });

  test('returns 401 when no token provided', async () => {
    const res = await request.post('/api/entries').send(valid());
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when pashto is missing', async () => {
    const token = makeToken();
    const { pashto: _p, ...body } = valid();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when definitions array is empty', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...valid(), definitions: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when definitions is missing', async () => {
    const token = makeToken();
    const { definitions: _d, ...body } = valid();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when a definition is missing text', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...valid(), definitions: [{ example: 'only example' }] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 201 with created entry on valid input', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(valid());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pashto).toBe('کور');
  });

  test('sets status to pending on creation', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(valid());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  test('creates a ModerationLog entry with action "submitted"', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(valid());
    expect(res.status).toBe(201);
    const log = await ModerationLog.findOne({ entry: res.body.data._id });
    expect(log).not.toBeNull();
    expect(log.action).toBe('submitted');
  });

  test('sets submittedBy from the token user id', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken({ id: userId });
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(valid());
    expect(res.status).toBe(201);
    expect(res.body.data.submittedBy).toBe(userId);
  });

  test('response uses envelope shape', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(valid());
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });

  test('accepts optional fields phonetic, region, partOfSpeech', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...valid(),
        phonetic: 'kor',
        region: 'Kandahar',
        partOfSpeech: 'noun',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.phonetic).toBe('kor');
    expect(res.body.data.region).toBe('Kandahar');
    expect(res.body.data.partOfSpeech).toBe('noun');
  });
});

// ---------------------------------------------------------------------------
// GET /api/entries — additional edge cases
// ---------------------------------------------------------------------------

describe('GET /api/entries — edge cases', () => {
  test('page=0 is clamped to 1', async () => {
    const res = await request.get('/api/entries?page=0');
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
  });

  test('page=-1 is clamped to 1', async () => {
    const res = await request.get('/api/entries?page=-1');
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
  });

  test('limit=0 falls back to default of 20 (falsy parseInt coerces to default)', async () => {
    // parseInt('0') === 0 which is falsy, so `0 || 20` evaluates to 20
    const res = await request.get('/api/entries?limit=0');
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(20);
  });

  test('rejected entries are excluded from listing', async () => {
    await Entry.create([
      { pashto: 'کور', status: 'published' },
      { pashto: 'سپی', status: 'rejected' },
    ]);
    const res = await request.get('/api/entries');
    expect(res.status).toBe(200);
    const statuses = res.body.data.map((e) => e.status);
    expect(statuses.every((s) => s === 'published')).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  test('meta.total reflects only published count', async () => {
    await Entry.create([
      { pashto: 'کور', status: 'published' },
      { pashto: 'سپی', status: 'pending' },
      { pashto: 'اوبه', status: 'approved' },
      { pashto: 'ښار', status: 'rejected' },
    ]);
    const res = await request.get('/api/entries');
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/entries/search — additional edge cases
// ---------------------------------------------------------------------------

describe('GET /api/entries/search — additional edge cases', () => {
  test('whitespace-only q returns 400', async () => {
    const res = await request.get('/api/entries/search?q=%20%20%20');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Search query is required');
  });

  test('approved entries are excluded from search results', async () => {
    await Entry.create([
      { pashto: 'کور', status: 'published' },
      { pashto: 'کور', status: 'approved' },
    ]);
    const res = await request.get('/api/entries/search?q=کور');
    expect(res.status).toBe(200);
    const statuses = res.body.data.map((e) => e.status);
    expect(statuses.every((s) => s === 'published')).toBe(true);
  });

  test('rejected entries are excluded from search results', async () => {
    await Entry.create([
      { pashto: 'کور', status: 'published' },
      { pashto: 'کور', status: 'rejected' },
    ]);
    const res = await request.get('/api/entries/search?q=کور');
    expect(res.status).toBe(200);
    const statuses = res.body.data.map((e) => e.status);
    expect(statuses.every((s) => s === 'published')).toBe(true);
  });

  test('search response has meta with page, limit, total', async () => {
    await Entry.create({ pashto: 'کور', status: 'published' });
    const res = await request.get('/api/entries/search?q=کور');
    expect(res.status).toBe(200);
    expect(res.body.meta).toHaveProperty('page');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('total');
  });

  test('search caps limit at 50', async () => {
    const res = await request.get('/api/entries/search?q=کور&limit=200');
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// GET /api/entries/:id — additional status cases
// ---------------------------------------------------------------------------

describe('GET /api/entries/:id — non-published statuses', () => {
  test('approved entry returns 404', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'approved' });
    const res = await request.get(`/api/entries/${entry._id}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBeDefined();
  });

  test('rejected entry returns 404', async () => {
    const entry = await Entry.create({ pashto: 'کور', status: 'rejected' });
    const res = await request.get(`/api/entries/${entry._id}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('400 error response has success:false and error.message', async () => {
    const res = await request.get('/api/entries/not-valid-id');
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toBe('Invalid entry id');
  });
});

// ---------------------------------------------------------------------------
// POST /api/entries — additional validation and ModerationLog cases
// ---------------------------------------------------------------------------

describe('POST /api/entries — additional validation', () => {
  const valid = () => ({
    pashto: 'کور',
    definitions: [{ text: 'house' }],
  });

  test('invalid partOfSpeech enum value returns 400', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...valid(), partOfSpeech: 'emoji' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when second definition in array is missing text', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...valid(), definitions: [{ text: 'house' }, { example: 'only example' }] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('validation error response includes error.field', async () => {
    const token = makeToken();
    const { pashto: _p, ...body } = valid();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBeDefined();
  });

  test('ModerationLog performedBy matches token user id', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = makeToken({ id: userId });
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(valid());
    expect(res.status).toBe(201);
    const log = await ModerationLog.findOne({ entry: res.body.data._id });
    expect(log).not.toBeNull();
    expect(log.performedBy.toString()).toBe(userId);
  });

  test('ModerationLog entry field references the created entry id', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send(valid());
    expect(res.status).toBe(201);
    const log = await ModerationLog.findOne({ entry: res.body.data._id });
    expect(log).not.toBeNull();
    expect(log.entry.toString()).toBe(res.body.data._id);
  });

  test('returns 400 when pashto is whitespace only', async () => {
    const token = makeToken();
    const res = await request
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ pashto: '   ', definitions: [{ text: 'house' }] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
