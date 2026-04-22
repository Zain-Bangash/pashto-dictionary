require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

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

const request = supertest(app);

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
// POST /api/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  const valid = () => ({
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
  });

  test('returns 201 with token and user on success', async () => {
    const res = await request.post('/api/auth/register').send(valid());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.username).toBe('testuser');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('returns 400 when email is invalid', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when password is too short', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when username is missing', async () => {
    const { username: _u, ...body } = valid();
    const res = await request.post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 409 when email is already taken', async () => {
    await request.post('/api/auth/register').send(valid());
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), username: 'another' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('returns 409 when username is already taken', async () => {
    await request.post('/api/auth/register').send(valid());
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), email: 'other@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  const creds = { email: 'login@example.com', password: 'password123' };

  beforeEach(async () => {
    await request.post('/api/auth/register').send({
      username: 'loginuser',
      email: creds.email,
      password: creds.password,
    });
  });

  test('returns 200 with token on valid credentials', async () => {
    const res = await request.post('/api/auth/login').send(creds);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('returns 401 on wrong password', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ ...creds, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 401 on unknown email', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when email is invalid', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'bad', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

describe('GET /api/auth/me', () => {
  let token;

  beforeEach(async () => {
    const res = await request.post('/api/auth/register').send({
      username: 'meuser',
      email: 'me@example.com',
      password: 'password123',
    });
    token = res.body.data.token;
  });

  test('returns 200 with user payload from token', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('meuser');
  });

  test('returns 401 when no token is provided', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 401 when token is invalid', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
