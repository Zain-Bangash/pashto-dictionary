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

/**
 * Phase — Stats endpoint + Variant GET operations
 *
 * Covers four untested areas:
 *  1. GET /api/stats
 *  2. GET /api/variants          (list — moderator/admin only)
 *  3. GET /api/variants/:id      (single — published = public, non-published = moderator+)
 *  4. GET /api/variants/search   (text search — published only)
 */

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const statsRouter    = require('../routes/stats');
const variantsRouter = require('../routes/variants');
const conceptsRouter = require('../routes/concepts');
const Concept  = require('../models/Concept');
const Variant  = require('../models/Variant');
const User     = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/stats',    statsRouter);
app.use('/api/variants', variantsRouter);
app.use('/api/concepts', conceptsRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({
    success: false,
    error: { message: err.message || 'Internal server error' },
  });
});

const request = supertest(app);

let mongoServer;

async function makeToken(overrides = {}) {
  const id = overrides.id ?? new mongoose.Types.ObjectId().toString();
  const role = overrides.role ?? 'user';
  await User.create({ cognitoSub: id, username: `user-${id.slice(-6)}`, email: `${id.slice(-6)}@test.local`, role });
  return jwt.sign(
    { id, username: 'testuser', role, ...overrides },
    process.env.JWT_SECRET || 'test-secret-for-jest',
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
// 1. GET /api/stats
// ---------------------------------------------------------------------------

describe('GET /api/stats', () => {
  test('returns 200 with envelope shape', async () => {
    const res = await request.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('data');
  });

  test('data contains publishedVariants field', async () => {
    const res = await request.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('publishedVariants');
    expect(typeof res.body.data.publishedVariants).toBe('number');
  });

  test('data contains registeredUsers field', async () => {
    const res = await request.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('registeredUsers');
    expect(typeof res.body.data.registeredUsers).toBe('number');
  });

  test('data contains variantsThisMonth field', async () => {
    const res = await request.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('variantsThisMonth');
    expect(typeof res.body.data.variantsThisMonth).toBe('number');
  });

  test('publishedVariants reflects actual published variant count', async () => {
    const concept = await Concept.create({ englishGloss: 'sky', partOfSpeech: 'noun', status: 'published' });
    await Variant.create([
      { concept: concept._id, pashto: 'اسمان', region: 'Kohat', definition: 'sky', status: 'published' },
      { concept: concept._id, pashto: 'آسمان', region: 'Hangu', definition: 'sky', status: 'pending' },
    ]);
    const res = await request.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.publishedVariants).toBe(1);
  });

  test('publishedVariants excludes soft-deleted published variants', async () => {
    const concept = await Concept.create({ englishGloss: 'moon', partOfSpeech: 'noun', status: 'published' });
    await Variant.create([
      { concept: concept._id, pashto: 'سپوږمۍ', region: 'Kohat', definition: 'moon', status: 'published' },
      { concept: concept._id, pashto: 'سپوږمي', region: 'Hangu', definition: 'moon', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() },
    ]);
    const res = await request.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.publishedVariants).toBe(1);
  });

  test('registeredUsers reflects actual user count', async () => {
    await User.create([
      { username: 'alice', email: 'alice@test.com', passwordHash: 'hash1', role: 'user' },
      { username: 'bob',   email: 'bob@test.com',   passwordHash: 'hash2', role: 'user' },
    ]);
    const res = await request.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.registeredUsers).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. GET /api/variants  (list — moderator/admin only)
// ---------------------------------------------------------------------------

describe('GET /api/variants', () => {
  test('returns 401 when no token provided', async () => {
    const res = await request.get('/api/variants');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 when role is user', async () => {
    const token = await makeToken({ role: 'user' });
    const res = await request.get('/api/variants').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 for moderator', async () => {
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/variants').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 200 for admin', async () => {
    const token = await makeToken({ role: 'admin' });
    const res = await request.get('/api/variants').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('response uses envelope shape with meta', async () => {
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/variants').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('page');
    expect(res.body.meta).toHaveProperty('limit');
    expect(res.body.meta).toHaveProperty('total');
  });

  test('defaults page to 1 and limit to 20', async () => {
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/variants').set('Authorization', `Bearer ${token}`);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });

  test('caps limit at 50', async () => {
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/variants?limit=100').set('Authorization', `Bearer ${token}`);
    expect(res.body.meta.limit).toBe(50);
  });

  test('returns all variants (all statuses) when no status filter is set', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    await Variant.create([
      { concept: concept._id, pashto: 'کور',  region: 'Kohat', definition: 'house', status: 'pending' },
      { concept: concept._id, pashto: 'کور۲', region: 'Hangu', definition: 'house', status: 'published' },
    ]);
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/variants').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(2);
  });

  test('filters by status when status query param is provided', async () => {
    const concept = await Concept.create({ englishGloss: 'tree', partOfSpeech: 'noun', status: 'published' });
    await Variant.create([
      { concept: concept._id, pashto: 'ونه',  region: 'Kohat', definition: 'tree', status: 'pending' },
      { concept: concept._id, pashto: 'وني', region: 'Hangu', definition: 'tree', status: 'published' },
    ]);
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/variants?status=pending').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].pashto).toBe('ونه');
  });

  test('does not return soft-deleted variants', async () => {
    const concept = await Concept.create({ englishGloss: 'stone', partOfSpeech: 'noun', status: 'published' });
    await Variant.create({ concept: concept._id, pashto: 'ډبره', region: 'Kohat', definition: 'stone', status: 'published' });
    await Variant.create({ concept: concept._id, pashto: 'ډبره۲', region: 'Hangu', definition: 'stone', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get('/api/variants').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].pashto).toBe('ډبره');
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/variants/:id  (published = public, non-published = moderator+)
// ---------------------------------------------------------------------------

describe('GET /api/variants/:id', () => {
  test('returns 400 for an invalid ObjectId', async () => {
    const res = await request.get('/api/variants/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when variant does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.get(`/api/variants/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 for a soft-deleted variant', async () => {
    const concept = await Concept.create({ englishGloss: 'fire', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'اور', region: 'Kohat', definition: 'fire', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const res = await request.get(`/api/variants/${variant._id}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 for a published variant without authentication', async () => {
    const concept = await Concept.create({ englishGloss: 'water', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'اوبه', region: 'Kohat', definition: 'water', status: 'published' });
    const res = await request.get(`/api/variants/${variant._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pashto).toBe('اوبه');
  });

  test('returns 403 for a non-published variant when no token is provided', async () => {
    const concept = await Concept.create({ englishGloss: 'wind', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'باد', region: 'Kohat', definition: 'wind', status: 'pending' });
    const res = await request.get(`/api/variants/${variant._id}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 for a non-published variant when role is user', async () => {
    const concept = await Concept.create({ englishGloss: 'cloud', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'وریځ', region: 'Kohat', definition: 'cloud', status: 'pending' });
    const token = await makeToken({ role: 'user' });
    const res = await request.get(`/api/variants/${variant._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 for a pending variant when role is moderator', async () => {
    const concept = await Concept.create({ englishGloss: 'road', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'لار', region: 'Kohat', definition: 'road', status: 'pending' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request.get(`/api/variants/${variant._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pashto).toBe('لار');
  });

  test('returns 200 for a pending variant when role is admin', async () => {
    const concept = await Concept.create({ englishGloss: 'bridge', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'دهلیز', region: 'Kohat', definition: 'bridge', status: 'pending' });
    const token = await makeToken({ role: 'admin' });
    const res = await request.get(`/api/variants/${variant._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('response uses envelope shape', async () => {
    const concept = await Concept.create({ englishGloss: 'sun', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'لمر', region: 'Kohat', definition: 'sun', status: 'published' });
    const res = await request.get(`/api/variants/${variant._id}`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('pashto');
  });

  test('concept field is populated in the response', async () => {
    const concept = await Concept.create({ englishGloss: 'river', partOfSpeech: 'noun', status: 'published' });
    const variant = await Variant.create({ concept: concept._id, pashto: 'سیند', region: 'Kohat', definition: 'river', status: 'published' });
    const res = await request.get(`/api/variants/${variant._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.concept).toBeDefined();
    expect(res.body.data.concept.englishGloss).toBe('river');
  });
});

// ---------------------------------------------------------------------------
// 4. GET /api/variants/search  (text search — published, not soft-deleted)
// ---------------------------------------------------------------------------

describe('GET /api/variants/search', () => {
  test('returns 400 when q param is missing', async () => {
    const res = await request.get('/api/variants/search');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/search query is required/i);
  });

  test('returns 400 when q param is empty string', async () => {
    const res = await request.get('/api/variants/search?q=');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 with empty data when no variants match', async () => {
    const res = await request.get('/api/variants/search?q=zzznomatch');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('response uses standard envelope shape with meta', async () => {
    const res = await request.get('/api/variants/search?q=house');
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: expect.any(Number), limit: expect.any(Number), total: expect.any(Number) });
  });

  test('does not return unpublished variants', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    await Variant.create({ concept: concept._id, pashto: 'کور', region: 'Kohat', definition: 'a house', status: 'pending' });
    const res = await request.get('/api/variants/search?q=house');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('does not return soft-deleted published variants', async () => {
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    await Variant.create({ concept: concept._id, pashto: 'کور', region: 'Kohat', definition: 'a house deleted', status: 'published', isDeleted: true, deletedAt: new Date(), deletedBy: new mongoose.Types.ObjectId() });
    const res = await request.get('/api/variants/search?q=house');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('defaults page to 1 and limit to 20', async () => {
    const res = await request.get('/api/variants/search?q=anything');
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });

  test('accepts page and limit query params', async () => {
    const res = await request.get('/api/variants/search?q=anything&page=2&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(5);
  });
});
