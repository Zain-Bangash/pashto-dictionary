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

// Grouped moderation queue — GET /api/moderation/queue
// and the approve-after-concept guard on PATCH /api/variants/:id/status

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const moderationRouter = require('../routes/moderation');
const variantsRouter = require('../routes/variants');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/moderation', moderationRouter);
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
  return jwt.sign({ id, username: 'testuser', role, ...overrides }, secret, { expiresIn: '7d' });
}

let glossSeq = 0;
function makeConcept(fields = {}) {
  glossSeq += 1;
  return Concept.create({ englishGloss: `gloss-${glossSeq}`, partOfSpeech: 'noun', ...fields });
}

let pashtoSeq = 0;
function makeVariant(concept, fields = {}) {
  pashtoSeq += 1;
  return Variant.create({ concept: concept._id, pashto: `اوبه${pashtoSeq}`, region: 'Kohat', definition: 'def', ...fields });
}

const get = (token, qs = '') =>
  request.get(`/api/moderation/queue${qs}`).set('Authorization', `Bearer ${token}`);

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

describe('GET /api/moderation/queue — auth', () => {
  it('returns 401 without a token', async () => {
    const res = await request.get('/api/moderation/queue');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a plain user', async () => {
    const token = await makeToken({ role: 'user' });
    const res = await get(token);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/moderation/queue — grouping', () => {
  it('nests pending variants under their pending concept', async () => {
    const token = await makeToken({ role: 'moderator' });
    const c = await makeConcept();
    await makeVariant(c);
    await makeVariant(c);

    const res = await get(token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(String(res.body.data[0]._id)).toBe(String(c._id));
    expect(res.body.data[0].variants).toHaveLength(2);
  });

  it('includes a published concept that has a pending variant, nesting only the pending one', async () => {
    const token = await makeToken({ role: 'moderator' });
    const c = await makeConcept({ status: 'published' });
    const pending = await makeVariant(c);
    await makeVariant(c, { status: 'published' });

    const res = await get(token);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('published');
    expect(res.body.data[0].variants).toHaveLength(1);
    expect(String(res.body.data[0].variants[0]._id)).toBe(String(pending._id));
  });

  it('excludes an approved concept with no pending variants from the pending queue', async () => {
    const token = await makeToken({ role: 'moderator' });
    await makeConcept({ status: 'approved' });

    const res = await get(token);
    expect(res.body.data).toHaveLength(0);
  });

  it('holds a moderator to pending even when asking for approved', async () => {
    const token = await makeToken({ role: 'moderator' });
    await makeConcept({ status: 'approved' });
    const pending = await makeConcept();

    const res = await get(token, '?status=approved');
    expect(res.body.data).toHaveLength(1);
    expect(String(res.body.data[0]._id)).toBe(String(pending._id));
  });

  it('admin approved filter returns approved concepts and concepts with approved variants', async () => {
    const token = await makeToken({ role: 'admin' });
    const approvedConcept = await makeConcept({ status: 'approved' });
    await makeVariant(approvedConcept, { status: 'approved' });
    await makeVariant(approvedConcept);
    const publishedConcept = await makeConcept({ status: 'published' });
    await makeVariant(publishedConcept, { status: 'approved' });
    await makeConcept();

    const res = await get(token, '?status=approved');
    expect(res.body.data).toHaveLength(2);
    for (const group of res.body.data) {
      expect(group.variants).toHaveLength(1);
      expect(group.variants[0].status).toBe('approved');
    }
  });

  it('excludes soft-deleted variants and soft-deleted concepts without waiting variants', async () => {
    const token = await makeToken({ role: 'moderator' });
    const c = await makeConcept();
    await makeVariant(c, { isDeleted: true });
    await makeConcept({ isDeleted: true });

    const res = await get(token);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].variants).toHaveLength(0);
  });

  it('still shows a pending variant whose concept was rejected and soft-deleted', async () => {
    const token = await makeToken({ role: 'moderator' });
    const c = await makeConcept({ status: 'rejected', isDeleted: true });
    await makeVariant(c);

    const res = await get(token);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('rejected');
    expect(res.body.data[0].variants).toHaveLength(1);
  });

  it('enriches submittedBy on concepts and variants', async () => {
    const subId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator' });
    await User.create({ cognitoSub: subId, username: 'submitter', email: 'sub@test.local', role: 'user' });
    const c = await makeConcept({ submittedBy: subId });
    await makeVariant(c, { submittedBy: subId });

    const res = await get(token);
    expect(res.body.data[0].submittedBy.username).toBe('submitter');
    expect(res.body.data[0].variants[0].submittedBy.username).toBe('submitter');
  });
});

describe('GET /api/moderation/queue — pagination and counts', () => {
  it('paginates by concept group', async () => {
    const token = await makeToken({ role: 'moderator' });
    const first = await makeConcept();
    const second = await makeConcept();

    const p1 = await get(token, '?limit=1&page=1');
    const p2 = await get(token, '?limit=1&page=2');
    expect(p1.body.meta.total).toBe(2);
    expect(p1.body.meta.limit).toBe(1);
    expect(p1.body.data).toHaveLength(1);
    expect(p2.body.data).toHaveLength(1);
    const ids = [p1.body.data[0]._id, p2.body.data[0]._id].map(String).sort();
    expect(ids).toEqual([String(first._id), String(second._id)].sort());
  });

  it('counts concepts plus variants per status for admin', async () => {
    const token = await makeToken({ role: 'admin' });
    const c = await makeConcept();
    await makeVariant(c);
    const a = await makeConcept({ status: 'approved' });
    await makeVariant(a, { status: 'approved' });

    const res = await get(token);
    expect(res.body.meta.pendingCount).toBe(2);
    expect(res.body.meta.approvedCount).toBe(2);
  });

  it('returns approvedCount 0 for a moderator', async () => {
    const token = await makeToken({ role: 'moderator' });
    await makeConcept({ status: 'approved' });

    const res = await get(token);
    expect(res.body.meta.approvedCount).toBe(0);
  });
});

describe('PATCH /api/variants/:id/status — approve requires an approved concept', () => {
  const patch = (token, id, body) =>
    request.patch(`/api/variants/${id}/status`).set('Authorization', `Bearer ${token}`).send(body);

  it('returns 400 when the concept is still pending and writes no log', async () => {
    const token = await makeToken({ role: 'moderator' });
    const c = await makeConcept();
    const v = await makeVariant(c);

    const res = await patch(token, v._id, { status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Cannot approve a variant whose concept has not been approved yet.');
    expect((await Variant.findById(v._id)).status).toBe('pending');
    expect(await ModerationLog.countDocuments({ targetId: v._id })).toBe(0);
  });

  it.each(['approved', 'published'])('approves when the concept is %s', async (conceptStatus) => {
    const token = await makeToken({ role: 'moderator' });
    const c = await makeConcept({ status: conceptStatus });
    const v = await makeVariant(c);

    const res = await patch(token, v._id, { status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(await ModerationLog.countDocuments({ targetId: v._id, action: 'approved' })).toBe(1);
  });

  it('still allows rejecting a variant under a pending concept', async () => {
    const token = await makeToken({ role: 'moderator' });
    const c = await makeConcept();
    const v = await makeVariant(c);

    const res = await patch(token, v._id, { status: 'rejected', moderatorNote: 'no' });
    expect(res.status).toBe(200);
  });

  it('still blocks publishing a variant whose concept is only approved', async () => {
    const token = await makeToken({ role: 'admin' });
    const c = await makeConcept({ status: 'approved' });
    const v = await makeVariant(c, { status: 'approved' });

    const res = await patch(token, v._id, { status: 'published' });
    expect(res.status).toBe(400);
  });
});
