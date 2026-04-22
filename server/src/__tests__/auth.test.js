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

// ---------------------------------------------------------------------------
// auth middleware — token boundary cases (extended)
// ---------------------------------------------------------------------------

describe('verifyToken middleware — boundary cases', () => {
  const jwt = require('jsonwebtoken');

  let token;

  beforeEach(async () => {
    const res = await request.post('/api/auth/register').send({
      username: 'boundaryuser',
      email: 'boundary@example.com',
      password: 'password123',
    });
    token = res.body.data.token;
  });

  test('returns 401 when Authorization header has no Bearer prefix', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', token);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBeDefined();
  });

  test('returns 401 when Authorization header is just "Bearer " with no token', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 401 when token is signed with the wrong secret', async () => {
    const badToken = jwt.sign(
      { id: 'fakeid', username: 'fakeuser', role: 'user' },
      'wrong-secret',
      { expiresIn: '7d' }
    );
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 401 when token is expired', async () => {
    const expiredToken = jwt.sign(
      { id: 'fakeid', username: 'expireduser', role: 'user' },
      process.env.JWT_SECRET || 'test-secret-for-jest',
      { expiresIn: '-1s' }
    );
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('error response envelope has error.message string', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error.message).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// requireRole middleware
// ---------------------------------------------------------------------------

describe('requireRole middleware', () => {
  const express = require('express');
  const supertest = require('supertest');
  const { verifyToken } = require('../middleware/auth');
  const { requireRole } = require('../middleware/requireRole');

  // Build a minimal app with two role-protected dummy routes
  const roleApp = express();
  roleApp.use(express.json());
  roleApp.get(
    '/admin-only',
    verifyToken,
    requireRole('admin'),
    (_req, res) => res.json({ success: true, data: { reached: true } })
  );
  roleApp.get(
    '/moderator-only',
    verifyToken,
    requireRole('moderator'),
    (_req, res) => res.json({ success: true, data: { reached: true } })
  );
  roleApp.get(
    '/user-only',
    verifyToken,
    requireRole('user'),
    (_req, res) => res.json({ success: true, data: { reached: true } })
  );

  const roleRequest = supertest(roleApp);

  let userToken;
  let adminToken;

  beforeEach(async () => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'test-secret-for-jest';

    userToken = jwt.sign(
      { id: 'uid1', username: 'regularuser', role: 'user' },
      secret,
      { expiresIn: '7d' }
    );
    adminToken = jwt.sign(
      { id: 'uid2', username: 'adminuser', role: 'admin' },
      secret,
      { expiresIn: '7d' }
    );
  });

  test('returns 403 when user role hits admin-only route', async () => {
    const res = await roleRequest
      .get('/admin-only')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Insufficient permissions');
  });

  test('returns 403 when user role hits moderator-only route', async () => {
    const res = await roleRequest
      .get('/moderator-only')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 when admin role hits admin-only route', async () => {
    const res = await roleRequest
      .get('/admin-only')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reached).toBe(true);
  });

  test('returns 403 when admin role hits user-only route', async () => {
    const res = await roleRequest
      .get('/user-only')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 when user role hits user-only route', async () => {
    const res = await roleRequest
      .get('/user-only')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 401 when no token is provided to role-protected route', async () => {
    const res = await roleRequest.get('/admin-only');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/register — additional validation and security cases
// ---------------------------------------------------------------------------

describe('POST /api/auth/register — additional cases', () => {
  const valid = () => ({
    username: 'extrauser',
    email: 'extra@example.com',
    password: 'password123',
  });

  test('returns 400 when email field is missing', async () => {
    const { email: _e, ...body } = valid();
    const res = await request.post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when password field is missing', async () => {
    const { password: _p, ...body } = valid();
    const res = await request.post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when username is whitespace only', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), username: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when password is exactly 7 characters (one below minimum)', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('validation error response includes error.field', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBeDefined();
  });

  test('register response envelope never contains passwordHash', async () => {
    const res = await request.post('/api/auth/register').send(valid());
    expect(res.status).toBe(201);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/passwordHash/);
  });

  test('duplicate email check is case-insensitive (email normalisation)', async () => {
    await request.post('/api/auth/register').send(valid());
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), username: 'differentuser', email: 'EXTRA@EXAMPLE.COM' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('409 error response includes error.field naming the duplicate field', async () => {
    await request.post('/api/auth/register').send(valid());
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), username: 'anotheruser2' });
    expect(res.status).toBe(409);
    expect(res.body.error.field).toBe('email');
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login — additional validation and security cases
// ---------------------------------------------------------------------------

describe('POST /api/auth/login — additional cases', () => {
  const creds = { email: 'loginextra@example.com', password: 'password123' };

  beforeEach(async () => {
    await request.post('/api/auth/register').send({
      username: 'loginextrauser',
      email: creds.email,
      password: creds.password,
    });
  });

  test('returns 400 when password field is missing on login', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: creds.email });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when email field is missing on login', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ password: creds.password });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('login response envelope never contains passwordHash', async () => {
    const res = await request.post('/api/auth/login').send(creds);
    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/passwordHash/);
  });

  test('login success response has correct envelope shape', async () => {
    const res = await request.post('/api/auth/login').send(creds);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('user');
  });

  test('login is case-insensitive for email', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ ...creds, email: 'LOGINEXTRA@EXAMPLE.COM' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me — additional cases
// ---------------------------------------------------------------------------

describe('GET /api/auth/me — additional cases', () => {
  let token;

  beforeEach(async () => {
    const res = await request.post('/api/auth/register').send({
      username: 'meuser2',
      email: 'me2@example.com',
      password: 'password123',
    });
    token = res.body.data.token;
  });

  test('me response envelope never contains passwordHash', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/passwordHash/);
  });

  test('me response has correct envelope shape', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('user');
  });

  test('me response user has expected fields', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    const { user } = res.body.data;
    expect(user.username).toBe('meuser2');
    expect(user.role).toBeDefined();
    expect(user.id).toBeDefined();
  });
});
