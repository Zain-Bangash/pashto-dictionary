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

// Admin edit/reject of published concepts and variants, and the concept-rejection cascade

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const conceptsRouter = require('../routes/concepts');
const variantsRouter = require('../routes/variants');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');

const app = express();
app.use(express.json());
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

async function makeUser(role = 'user') {
  const id = new mongoose.Types.ObjectId().toString();
  await User.create({ cognitoSub: id, username: `user-${id.slice(-6)}`, email: `${id.slice(-6)}@test.local`, role });
  const token = jwt.sign({ id, username: 'testuser', role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { id, token };
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

const patch = (path, token, body) =>
  request.patch(path).set('Authorization', `Bearer ${token}`).send(body);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Promise.all([
    Concept.deleteMany({}),
    Variant.deleteMany({}),
    ModerationLog.deleteMany({}),
    User.deleteMany({}),
  ]);
});

describe('PATCH /api/concepts/:id/status — published → rejected', () => {
  test('admin can reject a published concept with a note', async () => {
    const admin = await makeUser('admin');
    const concept = await makeConcept({ status: 'published' });

    const res = await patch(`/api/concepts/${concept._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'wrong gloss' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('rejected');
    const saved = await Concept.findById(concept._id);
    expect(saved.status).toBe('rejected');
    expect(saved.moderatorNote).toBe('wrong gloss');
    expect(saved.reviewedBy).toBe(admin.id);
    const log = await ModerationLog.findOne({ targetId: concept._id, action: 'rejected' });
    expect(log).not.toBeNull();
    expect(log.performedBy).toBe(admin.id);
    expect(log.note).toBe('wrong gloss');
  });

  test('moderator cannot reject a published concept', async () => {
    const mod = await makeUser('moderator');
    const concept = await makeConcept({ status: 'published' });

    const res = await patch(`/api/concepts/${concept._id}/status`, mod.token, { status: 'rejected', moderatorNote: 'nope' });

    expect(res.status).toBe(403);
    expect((await Concept.findById(concept._id)).status).toBe('published');
  });

  test('rejecting a published concept without a note returns 400', async () => {
    const admin = await makeUser('admin');
    const concept = await makeConcept({ status: 'published' });

    const res = await patch(`/api/concepts/${concept._id}/status`, admin.token, { status: 'rejected' });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('moderatorNote');
  });

  test('published concept still cannot move to approved', async () => {
    const admin = await makeUser('admin');
    const concept = await makeConcept({ status: 'published' });

    const res = await patch(`/api/concepts/${concept._id}/status`, admin.token, { status: 'approved' });

    expect(res.status).toBe(400);
  });

  test('rejected concept is no longer publicly visible', async () => {
    const admin = await makeUser('admin');
    const concept = await makeConcept({ status: 'published' });

    await patch(`/api/concepts/${concept._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'wrong' });
    const res = await request.get(`/api/concepts/${concept._id}`);

    expect(res.status).toBe(404);
  });
});

describe('Concept rejection cascade', () => {
  test('rejecting a published concept rejects its published, approved and pending variants with a readable note', async () => {
    const admin = await makeUser('admin');
    const concept = await makeConcept({ englishGloss: 'Sun', status: 'published' });
    const published = await makeVariant(concept, { status: 'published' });
    const approved  = await makeVariant(concept, { status: 'approved' });
    const pending   = await makeVariant(concept, { status: 'pending' });

    await patch(`/api/concepts/${concept._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'duplicate of Sunlight' });

    for (const v of [published, approved, pending]) {
      const saved = await Variant.findById(v._id);
      expect(saved.status).toBe('rejected');
      expect(saved.isDeleted).toBe(true);
      expect(saved.reviewedBy).toBe(admin.id);
      expect(saved.moderatorNote).toBe('Concept "Sun" was rejected: duplicate of Sunlight');
      const log = await ModerationLog.findOne({ targetId: v._id, targetModel: 'Variant', action: 'rejected' });
      expect(log).not.toBeNull();
    }
  });

  test('rejecting a pending concept also marks its variants rejected with the note', async () => {
    const mod = await makeUser('moderator');
    const concept = await makeConcept({ englishGloss: 'Moon', status: 'pending' });
    const variant = await makeVariant(concept, { status: 'pending' });

    await patch(`/api/concepts/${concept._id}/status`, mod.token, { status: 'rejected', moderatorNote: 'spelling' });

    const saved = await Variant.findById(variant._id);
    expect(saved.status).toBe('rejected');
    expect(saved.moderatorNote).toBe('Concept "Moon" was rejected: spelling');
  });

  test('cascaded variants show in the submitter\'s My Submissions as rejected with the note', async () => {
    const admin = await makeUser('admin');
    const submitter = await makeUser('user');
    const concept = await makeConcept({ englishGloss: 'Star', status: 'published' });
    const variant = await makeVariant(concept, { status: 'published', submittedBy: submitter.id });

    await patch(`/api/concepts/${concept._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'bad' });
    const res = await request.get('/api/variants/my-submissions').set('Authorization', `Bearer ${submitter.token}`);

    expect(res.status).toBe(200);
    const mine = res.body.data.find((v) => v._id === String(variant._id));
    expect(mine).toBeDefined();
    expect(mine.status).toBe('rejected');
    expect(mine.moderatorNote).toBe('Concept "Star" was rejected: bad');
  });
});

describe('PATCH /api/variants/:id/status — published → rejected', () => {
  test('admin can reject a published variant with a note', async () => {
    const admin = await makeUser('admin');
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'published' });

    const res = await patch(`/api/variants/${variant._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'wrong region' });

    expect(res.status).toBe(200);
    const saved = await Variant.findById(variant._id);
    expect(saved.status).toBe('rejected');
    expect(saved.isDeleted).toBe(true);
    expect(saved.moderatorNote).toBe('wrong region');
    const log = await ModerationLog.findOne({ targetId: variant._id, action: 'rejected' });
    expect(log.note).toBe('wrong region');
  });

  test('moderator cannot reject a published variant', async () => {
    const mod = await makeUser('moderator');
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'published' });

    const res = await patch(`/api/variants/${variant._id}/status`, mod.token, { status: 'rejected', moderatorNote: 'x' });

    expect(res.status).toBe(403);
    expect((await Variant.findById(variant._id)).status).toBe('published');
  });

  test('rejecting a published variant without a note returns 400', async () => {
    const admin = await makeUser('admin');
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'published' });

    const res = await patch(`/api/variants/${variant._id}/status`, admin.token, { status: 'rejected' });

    expect(res.status).toBe(400);
  });

  test('published variant still cannot move to approved', async () => {
    const admin = await makeUser('admin');
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'published' });

    const res = await patch(`/api/variants/${variant._id}/status`, admin.token, { status: 'approved' });

    expect(res.status).toBe(400);
  });
});

describe('Resubmitting after an admin rejects a published item', () => {
  test('submitter can resubmit a rejected concept → pending', async () => {
    const admin = await makeUser('admin');
    const submitter = await makeUser('user');
    const concept = await makeConcept({ status: 'published', submittedBy: submitter.id });
    await patch(`/api/concepts/${concept._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'fix gloss' });

    const res = await patch(`/api/concepts/${concept._id}`, submitter.token, { englishGloss: 'fixed gloss' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
  });

  test('submitter can resubmit a rejected variant → pending', async () => {
    const admin = await makeUser('admin');
    const submitter = await makeUser('user');
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'published', submittedBy: submitter.id });
    await patch(`/api/variants/${variant._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'fix def' });

    const res = await patch(`/api/variants/${variant._id}`, submitter.token, { definition: 'better def' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.isDeleted).toBe(false);
  });
});

describe('Editing published items is admin-only', () => {
  test('moderator cannot edit a published concept', async () => {
    const mod = await makeUser('moderator');
    const concept = await makeConcept({ status: 'published' });

    const res = await patch(`/api/concepts/${concept._id}/edit`, mod.token, { englishGloss: 'changed', note: 'n' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Only admins can edit published entries');
  });

  test('moderator cannot edit a published variant', async () => {
    const mod = await makeUser('moderator');
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'published' });

    const res = await patch(`/api/variants/${variant._id}/edit`, mod.token, { definition: 'changed', note: 'n' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Only admins can edit published entries');
  });

  test('moderator can still edit a pending concept', async () => {
    const mod = await makeUser('moderator');
    const concept = await makeConcept({ status: 'pending' });

    const res = await patch(`/api/concepts/${concept._id}/edit`, mod.token, { englishGloss: 'changed', note: 'n' });

    expect(res.status).toBe(200);
  });

  test('admin can edit a published concept and variant', async () => {
    const admin = await makeUser('admin');
    const concept = await makeConcept({ status: 'published' });
    const variant = await makeVariant(concept, { status: 'published' });

    const c = await patch(`/api/concepts/${concept._id}/edit`, admin.token, { englishGloss: 'changed', note: 'n' });
    const v = await patch(`/api/variants/${variant._id}/edit`, admin.token, { definition: 'changed', note: 'n' });

    expect(c.status).toBe(200);
    expect(c.body.data.status).toBe('published');
    expect(v.status).toBe(200);
    expect(v.body.data.status).toBe('published');
  });
});
