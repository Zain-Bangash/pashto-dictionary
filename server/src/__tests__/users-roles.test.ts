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

// Admin promotes users to moderator and demotes moderators; every change is logged

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const usersRouter = require('../routes/users');
const moderationRouter = require('../routes/moderation');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);
app.use('/api/moderation', moderationRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ success: false, error: { message: err.message || 'Internal server error' } });
});

const request = supertest(app);

let mongoServer;

async function makeUser(role = 'user') {
  const id = new mongoose.Types.ObjectId().toString();
  const doc = await User.create({ cognitoSub: id, username: `user-${id.slice(-6)}`, email: `${id.slice(-6)}@test.local`, role });
  const token = jwt.sign({ id, username: 'testuser', role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { id, token, doc };
}

const setRole = (target, token, body) =>
  request.patch(`/api/users/${target}/role`).set('Authorization', `Bearer ${token}`).send(body);

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
  for (const key in collections) await collections[key].deleteMany({});
});

describe('PATCH /api/users/:id/role — happy path', () => {
  test('admin promotes a user to moderator and the change is logged with the note', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');

    const res = await setRole(target.doc._id, admin.token, { role: 'moderator', note: 'trusted reviewer' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('moderator');
    expect((await User.findById(target.doc._id)).role).toBe('moderator');

    const log = await ModerationLog.findOne({ action: 'role_changed' }).lean();
    expect(log.targetModel).toBe('User');
    expect(String(log.targetId)).toBe(String(target.doc._id));
    expect(log.performedBy).toBe(admin.id);
    expect(log.note).toBe('trusted reviewer');
    expect(log.changes).toEqual({ role: { from: 'user', to: 'moderator' } });
  });

  test('admin demotes a moderator without a note', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('moderator');

    const res = await setRole(target.doc._id, admin.token, { role: 'user' });

    expect(res.status).toBe(200);
    expect((await User.findById(target.doc._id)).role).toBe('user');
    const log = await ModerationLog.findOne({ action: 'role_changed' }).lean();
    expect(log.note).toBeUndefined();
    expect(log.changes).toEqual({ role: { from: 'moderator', to: 'user' } });
  });

  test('the new role applies on the next request — a demoted moderator loses queue access', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('moderator');
    const queue = () => request.get('/api/moderation/stats').set('Authorization', `Bearer ${target.token}`);

    expect((await queue()).status).toBe(200);
    await setRole(target.doc._id, admin.token, { role: 'user' });
    expect((await queue()).status).toBe(403);
  });
});

describe('PATCH /api/users/:id/role — refusals', () => {
  test('moderators and users get 403', async () => {
    const target = await makeUser('user');
    for (const role of ['user', 'moderator']) {
      const { token } = await makeUser(role);
      expect((await setRole(target.doc._id, token, { role: 'moderator' })).status).toBe(403);
    }
    expect((await User.findById(target.doc._id)).role).toBe('user');
  });

  test('an admin cannot change their own role', async () => {
    const admin = await makeUser('admin');
    const res = await setRole(admin.doc._id, admin.token, { role: 'user' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/your own role/i);
    expect((await User.findById(admin.doc._id)).role).toBe('admin');
  });

  test("another admin's role cannot be changed", async () => {
    const admin = await makeUser('admin');
    const other = await makeUser('admin');
    const res = await setRole(other.doc._id, admin.token, { role: 'moderator' });
    expect(res.status).toBe(400);
    expect((await User.findById(other.doc._id)).role).toBe('admin');
  });

  test('nobody can be promoted to admin', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('moderator');
    const res = await setRole(target.doc._id, admin.token, { role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('role');
    expect((await User.findById(target.doc._id)).role).toBe('moderator');
  });

  test('an unchanged role is refused and nothing is logged', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('moderator');
    const res = await setRole(target.doc._id, admin.token, { role: 'moderator' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/already a moderator/);
    expect(await ModerationLog.countDocuments({ action: 'role_changed' })).toBe(0);
  });

  test('invalid id is 400, unknown user is 404, over-long note is 400', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    expect((await setRole('nope', admin.token, { role: 'moderator' })).status).toBe(400);
    expect((await setRole(new mongoose.Types.ObjectId(), admin.token, { role: 'moderator' })).status).toBe(404);
    expect((await setRole(target.doc._id, admin.token, { role: 'moderator', note: 'x'.repeat(501) })).status).toBe(400);
  });
});

describe('GET /api/users — pagination', () => {
  test('returns the requested page with the total', async () => {
    const admin = await makeUser('admin');
    for (let i = 0; i < 4; i += 1) await makeUser('user');

    const res = await request.get('/api/users?page=2&limit=2').set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 5 });
  });

  test('rejects an invalid page', async () => {
    const admin = await makeUser('admin');
    const res = await request.get('/api/users?page=0').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });
});

describe('Moderation log shows the user a role change targeted', () => {
  test('role_changed entries carry the target username', async () => {
    const admin = await makeUser('admin');
    const target = await makeUser('user');
    await setRole(target.doc._id, admin.token, { role: 'moderator' });

    const res = await request.get('/api/moderation/log?action=role_changed').set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].target.username).toBe(target.doc.username);
  });
});
