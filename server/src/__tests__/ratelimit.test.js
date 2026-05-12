// Phase 10 — Rate limiting on auth endpoints
// Window: 15 minutes, max 10 requests. The 11th request must receive 429.
// The 429 body must match the API envelope: { success: false, error: { message: "..." } }

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

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
// Rate limiting — POST /api/auth/login
// ---------------------------------------------------------------------------

describe('Rate limiting on POST /api/auth/login', () => {
  // Build a fresh app instance for each describe block so the rate-limit
  // store starts empty. The rate limiter must be applied to the auth router.
  let request;

  beforeAll(() => {
    const authRouter = require('../routes/auth');

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    // Minimal error handler so supertest sees JSON on unexpected errors
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({
        success: false,
        error: { message: err.message || 'Internal server error' },
      });
    });

    request = supertest(app);
  });

  it('allows the first 10 login attempts within the window', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request
        .post('/api/auth/login')
        .send({ email: `user${i}@example.com`, password: 'wrongpassword' });
      // Each attempt should be processed (401 or 400), never 429
      expect(res.status).not.toBe(429);
    }
  });

  it('returns 429 on the 11th login attempt within the window', async () => {
    // Send 10 requests to exhaust the limit
    for (let i = 0; i < 10; i++) {
      await request
        .post('/api/auth/login')
        .send({ email: `flood${i}@example.com`, password: 'wrongpassword' });
    }

    // The 11th must be rate-limited
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'flood11@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(429);
  });

  it('429 response matches API envelope: { success: false, error: { message: string } }', async () => {
    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      await request
        .post('/api/auth/login')
        .send({ email: `env${i}@example.com`, password: 'wrongpassword' });
    }

    const res = await request
      .post('/api/auth/login')
      .send({ email: 'env11@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(typeof res.body.error.message).toBe('string');
    expect(res.body.error.message.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting — POST /api/auth/register
// ---------------------------------------------------------------------------

describe('Rate limiting on POST /api/auth/register', () => {
  let request;

  beforeAll(() => {
    const authRouter = require('../routes/auth');

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({
        success: false,
        error: { message: err.message || 'Internal server error' },
      });
    });

    request = supertest(app);
  });

  it('returns 429 on the 11th register attempt within the window', async () => {
    // Send 10 register requests to exhaust the limit
    for (let i = 0; i < 10; i++) {
      await request
        .post('/api/auth/register')
        .send({
          username: `regflood${i}`,
          email: `regflood${i}@example.com`,
          password: 'password123',
        });
    }

    // The 11th must be rate-limited
    const res = await request
      .post('/api/auth/register')
      .send({
        username: 'regflood11',
        email: 'regflood11@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(429);
  });

  it('429 register response matches API envelope: { success: false, error: { message: string } }', async () => {
    for (let i = 0; i < 10; i++) {
      await request
        .post('/api/auth/register')
        .send({
          username: `regenv${i}`,
          email: `regenv${i}@example.com`,
          password: 'password123',
        });
    }

    const res = await request
      .post('/api/auth/register')
      .send({
        username: 'regenv11',
        email: 'regenv11@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(typeof res.body.error.message).toBe('string');
  });
});
