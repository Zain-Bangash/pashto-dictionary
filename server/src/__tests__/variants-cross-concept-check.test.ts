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
 * GET /api/variants/cross-concept-check
 *
 * Checks whether a given Pashto word (after normalisation: .trim().normalize('NFC'))
 * already exists as a Variant under a DIFFERENT concept than the one supplied.
 *
 * Used to surface a non-blocking warning in the UI/moderation flow.
 *
 * Auth: requireAuth (valid JWT required)
 *
 * Query params:
 *   pashto     — the Pashto script string to check (required, non-empty)
 *   conceptId  — the concept the caller is working under (required, valid ObjectId)
 *
 * Success:
 *   200  { success: true, data: { conflicts: [{ conceptId, englishGloss, status }] } }
 *        conflicts is deduplicated by concept
 *
 * Errors:
 *   400  pashto missing or empty
 *   400  conceptId missing or invalid ObjectId
 *   401  no auth token
 */

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const variantsRouter = require('../routes/variants');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/variants', variantsRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({
    success: false,
    error: { message: err.message || 'Internal server error' },
  });
});

const request = supertest(app);

let mongoServer: any;

async function makeToken(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) ?? new mongoose.Types.ObjectId().toString();
  const role = (overrides.role as string) ?? 'user';
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
// GET /api/variants/cross-concept-check
// ---------------------------------------------------------------------------

describe('GET /api/variants/cross-concept-check', () => {
  // ---- Auth boundary --------------------------------------------------------

  it('returns 401 when no auth token is provided', async () => {
    const conceptId = new mongoose.Types.ObjectId().toString();
    const res = await request.get(
      `/api/variants/cross-concept-check?pashto=کور&conceptId=${conceptId}`
    );
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ---- Input validation ----------------------------------------------------

  it('returns 400 when pashto query param is missing', async () => {
    const token = await makeToken();
    const conceptId = new mongoose.Types.ObjectId().toString();
    const res = await request
      .get(`/api/variants/cross-concept-check?conceptId=${conceptId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when pashto query param is an empty string', async () => {
    const token = await makeToken();
    const conceptId = new mongoose.Types.ObjectId().toString();
    const res = await request
      .get(`/api/variants/cross-concept-check?pashto=&conceptId=${conceptId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when conceptId query param is missing', async () => {
    const token = await makeToken();
    const res = await request
      .get('/api/variants/cross-concept-check?pashto=کور')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when conceptId is not a valid ObjectId', async () => {
    const token = await makeToken();
    const res = await request
      .get('/api/variants/cross-concept-check?pashto=کور&conceptId=not-a-valid-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ---- Happy path: no conflicts anywhere -----------------------------------

  it('returns 200 with empty conflicts array when the pashto word does not exist at all', async () => {
    const token = await makeToken();
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });

    const res = await request
      .get(`/api/variants/cross-concept-check?pashto=کور&conceptId=${concept._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('conflicts');
    expect(Array.isArray(res.body.data.conflicts)).toBe(true);
    expect(res.body.data.conflicts).toHaveLength(0);
  });

  // ---- Happy path: pashto exists but ONLY under the same concept -----------

  it('returns 200 with empty conflicts when the same normalizedPashto exists only under the supplied concept', async () => {
    const token = await makeToken();
    const concept = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });

    // Two regions, same concept — should NOT be a conflict
    await Variant.create([
      { concept: concept._id, pashto: 'کور', region: 'Kohat', definition: 'house', status: 'published' },
      { concept: concept._id, pashto: 'کور', region: 'Hangu', definition: 'house', status: 'pending' },
    ]);

    const res = await request
      .get(`/api/variants/cross-concept-check?pashto=کور&conceptId=${concept._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conflicts).toHaveLength(0);
  });

  // ---- Happy path: conflict detected under a different concept -------------

  it('returns 200 with one conflict entry when the same normalizedPashto exists under a different concept', async () => {
    const token = await makeToken();

    const conceptA = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    const conceptB = await Concept.create({ englishGloss: 'home', partOfSpeech: 'noun', status: 'published' });

    // Variant under conceptB with the same Pashto
    await Variant.create({
      concept: conceptB._id,
      pashto: 'کور',
      region: 'Kohat',
      definition: 'home',
      status: 'published',
    });

    // We are checking against conceptA — the word already lives under conceptB
    const res = await request
      .get(`/api/variants/cross-concept-check?pashto=کور&conceptId=${conceptA._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conflicts).toHaveLength(1);

    const conflict = res.body.data.conflicts[0];
    expect(conflict).toHaveProperty('conceptId');
    expect(conflict).toHaveProperty('englishGloss', 'home');
    expect(conflict).toHaveProperty('status');
  });

  // ---- Deduplication by concept --------------------------------------------

  it('deduplicates conflicts so multiple regions under the same other concept count as one entry', async () => {
    const token = await makeToken();

    const conceptA = await Concept.create({ englishGloss: 'dwelling', partOfSpeech: 'noun', status: 'published' });
    const conceptB = await Concept.create({ englishGloss: 'home', partOfSpeech: 'noun', status: 'published' });

    // Two different regions under conceptB — both have the same Pashto word
    await Variant.create([
      { concept: conceptB._id, pashto: 'کور', region: 'Kohat', definition: 'home', status: 'published' },
      { concept: conceptB._id, pashto: 'کور', region: 'Hangu', definition: 'home', status: 'pending' },
    ]);

    const res = await request
      .get(`/api/variants/cross-concept-check?pashto=کور&conceptId=${conceptA._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Despite two Variant documents, there must be exactly ONE conflict entry (for conceptB)
    expect(res.body.data.conflicts).toHaveLength(1);
    expect(res.body.data.conflicts[0].englishGloss).toBe('home');
  });

  // ---- Normalisation -------------------------------------------------------

  it('normalises the pashto param (trims whitespace) before matching', async () => {
    const token = await makeToken();

    const conceptA = await Concept.create({ englishGloss: 'house', partOfSpeech: 'noun', status: 'published' });
    const conceptB = await Concept.create({ englishGloss: 'home', partOfSpeech: 'noun', status: 'published' });

    await Variant.create({
      concept: conceptB._id,
      pashto: 'کور',  // stored normalised without padding
      region: 'Kohat',
      definition: 'home',
      status: 'published',
    });

    // Sending with surrounding spaces — should still be found after trim+NFC
    const res = await request
      .get(`/api/variants/cross-concept-check?pashto=%20کور%20&conceptId=${conceptA._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conflicts).toHaveLength(1);
  });
});
