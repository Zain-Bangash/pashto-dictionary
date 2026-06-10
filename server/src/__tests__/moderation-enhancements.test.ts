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

// Phase 9.5 — Moderation Enhancements (Backend)
// Tests for:
//   1. ModerationLog schema — 'edited' and 'merged' action values, 'changes' field
//   2. PATCH /api/concepts/:id/edit
//   3. PATCH /api/variants/:id/edit
//   4. POST  /api/concepts/:sourceId/merge

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

async function makeToken(overrides = {}) {
  const secret = process.env.JWT_SECRET || 'test-secret-for-jest';
  const id = overrides.id ?? new mongoose.Types.ObjectId().toString();
  const role = overrides.role ?? 'user';
  await User.create({ cognitoSub: id, username: `user-${id.slice(-6)}`, email: `${id.slice(-6)}@test.local`, role });
  return jwt.sign(
    { id, username: 'testuser', role, ...overrides },
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
// 1. ModerationLog schema — 'edited' and 'merged' action values
// ---------------------------------------------------------------------------

describe('ModerationLog schema — edited and merged action values', () => {
  test("accepts 'edited' as a valid action value", async () => {
    const userId = new mongoose.Types.ObjectId();
    const concept = await Concept.create({ englishGloss: 'schema-edit-test', partOfSpeech: 'noun' });
    const log = await ModerationLog.create({
      targetModel: 'Concept',
      targetId: concept._id,
      action: 'edited',
      performedBy: userId,
      note: 'fixed gloss',
    });
    expect(log.action).toBe('edited');
  });

  test("accepts 'merged' as a valid action value", async () => {
    const userId = new mongoose.Types.ObjectId();
    const concept = await Concept.create({ englishGloss: 'schema-merge-test', partOfSpeech: 'noun' });
    const log = await ModerationLog.create({
      targetModel: 'Concept',
      targetId: concept._id,
      action: 'merged',
      performedBy: userId,
      note: 'merged into another concept',
    });
    expect(log.action).toBe('merged');
  });

  test('rejects an invalid action value', async () => {
    const userId = new mongoose.Types.ObjectId();
    const concept = await Concept.create({ englishGloss: 'schema-invalid-test', partOfSpeech: 'noun' });
    await expect(
      ModerationLog.create({
        targetModel: 'Concept',
        targetId: concept._id,
        action: 'invented_action',
        performedBy: userId,
      })
    ).rejects.toThrow();
  });

  test('changes field is optional and saves/retrieves a before-after diff object', async () => {
    const userId = new mongoose.Types.ObjectId();
    const concept = await Concept.create({ englishGloss: 'schema-changes-test', partOfSpeech: 'noun' });
    const changes = { englishGloss: { from: 'old gloss', to: 'new gloss' } };
    const log = await ModerationLog.create({
      targetModel: 'Concept',
      targetId: concept._id,
      action: 'edited',
      performedBy: userId,
      note: 'fixed gloss',
      changes,
    });
    const found = await ModerationLog.findById(log._id).lean();
    expect(found.changes).toBeDefined();
    expect(found.changes.englishGloss.from).toBe('old gloss');
    expect(found.changes.englishGloss.to).toBe('new gloss');
  });

  test('changes field is not required — log saves without it', async () => {
    const userId = new mongoose.Types.ObjectId();
    const concept = await Concept.create({ englishGloss: 'schema-nochanges-test', partOfSpeech: 'noun' });
    const log = await ModerationLog.create({
      targetModel: 'Concept',
      targetId: concept._id,
      action: 'approved',
      performedBy: userId,
    });
    expect(log._id).toBeDefined();
    expect(log.changes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. PATCH /api/concepts/:id/edit
// ---------------------------------------------------------------------------

describe('PATCH /api/concepts/:id/edit — auth and role', () => {
  test('returns 401 when no token is provided', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.patch(`/api/concepts/${fakeId}/edit`).send({ note: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 when role is user', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'user' });
    const res = await request
      .patch(`/api/concepts/${fakeId}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'test' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

describe('PATCH /api/concepts/:id/edit — not found', () => {
  test('returns 404 when concept does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/concepts/${fakeId}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'updated', note: 'fixed' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when concept is soft-deleted', async () => {
    const concept = await Concept.create({
      englishGloss: 'deleted-concept',
      partOfSpeech: 'noun',
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: new mongoose.Types.ObjectId(),
    });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'updated', note: 'fixed' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('PATCH /api/concepts/:id/edit — moderator self-edit restriction', () => {
  test('returns 403 when moderator tries to edit their own concept', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({
      englishGloss: 'self-edit-concept',
      partOfSpeech: 'noun',
      submittedBy: new mongoose.Types.ObjectId(modId),
    });
    const token = await makeToken({ role: 'moderator', id: modId });
    const res = await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'updated gloss', note: 'fixing my own' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('admin CAN edit their own concept — no 403', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({
      englishGloss: 'admin-self-edit',
      partOfSpeech: 'noun',
      submittedBy: new mongoose.Types.ObjectId(adminId),
    });
    const token = await makeToken({ role: 'admin', id: adminId });
    const res = await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'admin updated gloss', note: 'admin fixed it' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('PATCH /api/concepts/:id/edit — validation', () => {
  test('returns 400 when note is missing', async () => {
    const concept = await Concept.create({ englishGloss: 'note-required-concept', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'updated gloss' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('PATCH /api/concepts/:id/edit — happy path and ModerationLog', () => {
  test('updates englishGloss on the EXISTING document — same _id, no new doc created', async () => {
    const concept = await Concept.create({ englishGloss: 'original gloss', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'updated gloss', note: 'corrected translation' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id.toString()).toBe(concept._id.toString());
    expect(res.body.data.englishGloss).toBe('updated gloss');

    const count = await Concept.countDocuments({ englishGloss: { $in: ['original gloss', 'updated gloss'] } });
    expect(count).toBe(1);
  });

  test('updates partOfSpeech on the EXISTING document', async () => {
    const concept = await Concept.create({ englishGloss: 'pos-edit-concept', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ partOfSpeech: 'verb', note: 'wrong POS, corrected' });

    expect(res.status).toBe(200);
    expect(res.body.data.partOfSpeech).toBe('verb');
    expect(res.body.data._id.toString()).toBe(concept._id.toString());
  });

  test('returns updated concept in the success envelope', async () => {
    const concept = await Concept.create({ englishGloss: 'envelope-test', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'envelope updated', note: 'checking envelope' });

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.englishGloss).toBe('envelope updated');
  });

  test('writes a ModerationLog entry with action "edited" and targetModel "Concept"', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({ englishGloss: 'log-test-concept', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator', id: modId });
    await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'log test updated', note: 'audit this' });

    const log = await ModerationLog.findOne({ targetId: concept._id, targetModel: 'Concept', action: 'edited' });
    expect(log).not.toBeNull();
    expect(log.performedBy.toString()).toBe(modId);
    expect(log.note).toBe('audit this');
  });

  test('ModerationLog changes contains only changed fields with before/after values', async () => {
    const concept = await Concept.create({ englishGloss: 'changes-diff-concept', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'changed gloss', note: 'diff check' });

    const log = await ModerationLog.findOne({ targetId: concept._id, action: 'edited' }).lean();
    expect(log.changes).toBeDefined();
    expect(log.changes.englishGloss).toBeDefined();
    expect(log.changes.englishGloss.from).toBe('changes-diff-concept');
    expect(log.changes.englishGloss.to).toBe('changed gloss');
  });

  test('fields that were NOT changed do not appear in the changes diff', async () => {
    const concept = await Concept.create({ englishGloss: 'unchanged-fields-concept', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    await request
      .patch(`/api/concepts/${concept._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ englishGloss: 'changed only gloss', note: 'partial change' });

    const log = await ModerationLog.findOne({ targetId: concept._id, action: 'edited' }).lean();
    expect(log.changes).toBeDefined();
    expect(log.changes.englishGloss).toBeDefined();
    expect(log.changes.partOfSpeech).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. PATCH /api/variants/:id/edit
// ---------------------------------------------------------------------------

describe('PATCH /api/variants/:id/edit — auth and role', () => {
  test('returns 401 when no token is provided', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.patch(`/api/variants/${fakeId}/edit`).send({ note: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 when role is user', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'user' });
    const res = await request
      .patch(`/api/variants/${fakeId}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'test' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

describe('PATCH /api/variants/:id/edit — not found', () => {
  test('returns 404 when variant does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/variants/${fakeId}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pashto: 'updated', note: 'fixed' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when variant is soft-deleted', async () => {
    const concept = await Concept.create({ englishGloss: 'variant-del-concept', partOfSpeech: 'noun' });
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'deleted-variant',
      region: 'Kohat',
      definition: 'test',
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: new mongoose.Types.ObjectId(),
    });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pashto: 'updated', note: 'fixed' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('PATCH /api/variants/:id/edit — moderator self-edit restriction', () => {
  test('returns 403 when moderator tries to edit their own variant', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({ englishGloss: 'variant-self-edit-concept', partOfSpeech: 'noun' });
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'self-edit-variant',
      region: 'Kohat',
      definition: 'test',
      submittedBy: new mongoose.Types.ObjectId(modId),
    });
    const token = await makeToken({ role: 'moderator', id: modId });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pashto: 'updated pashto', note: 'fixing own' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('admin CAN edit their own variant — no 403', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const concept = await Concept.create({ englishGloss: 'admin-variant-self-edit', partOfSpeech: 'noun' });
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'admin-self-variant',
      region: 'Kohat',
      definition: 'test',
      submittedBy: new mongoose.Types.ObjectId(adminId),
    });
    const token = await makeToken({ role: 'admin', id: adminId });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ definition: 'updated definition', note: 'admin fixed it' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('PATCH /api/variants/:id/edit — validation', () => {
  test('returns 400 when note is missing', async () => {
    const concept = await Concept.create({ englishGloss: 'variant-note-required', partOfSpeech: 'noun' });
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'note-required-variant',
      region: 'Kohat',
      definition: 'test',
    });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pashto: 'updated' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('PATCH /api/variants/:id/edit — happy path and ModerationLog', () => {
  let concept;

  beforeEach(async () => {
    concept = await Concept.create({ englishGloss: 'variant-edit-concept', partOfSpeech: 'noun' });
  });

  test('updates pashto on the EXISTING document — same _id, no new doc created', async () => {
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'original-pashto',
      region: 'Kohat',
      definition: 'original definition',
    });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pashto: 'updated-pashto', note: 'corrected word' });

    expect(res.status).toBe(200);
    expect(res.body.data._id.toString()).toBe(variant._id.toString());
    expect(res.body.data.pashto).toBe('updated-pashto');

    const count = await Variant.countDocuments({ concept: concept._id });
    expect(count).toBe(1);
  });

  test('updates definition and example on the EXISTING document', async () => {
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'edit-def-variant',
      region: 'Kohat',
      definition: 'old definition',
    });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ definition: 'new definition', example: 'new example', note: 'improved' });

    expect(res.status).toBe(200);
    expect(res.body.data.definition).toBe('new definition');
    expect(res.body.data.example).toBe('new example');
    expect(res.body.data._id.toString()).toBe(variant._id.toString());
  });

  test('updates region on the EXISTING document', async () => {
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'edit-region-variant',
      region: 'Kohat',
      definition: 'test',
    });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ region: 'Hangu', note: 'wrong region fixed' });

    expect(res.status).toBe(200);
    expect(res.body.data.region).toBe('Hangu');
  });

  test('returns updated variant in the success envelope', async () => {
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'envelope-variant',
      region: 'Kohat',
      definition: 'test',
    });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ definition: 'envelope updated', note: 'checking envelope' });

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.definition).toBe('envelope updated');
  });

  test('writes a ModerationLog entry with action "edited" and targetModel "Variant"', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'log-test-variant',
      region: 'Kohat',
      definition: 'test',
    });
    const token = await makeToken({ role: 'moderator', id: modId });
    await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ definition: 'log updated', note: 'audit this variant' });

    const log = await ModerationLog.findOne({ targetId: variant._id, targetModel: 'Variant', action: 'edited' });
    expect(log).not.toBeNull();
    expect(log.performedBy.toString()).toBe(modId);
    expect(log.note).toBe('audit this variant');
  });

  test('ModerationLog changes has before/after for changed fields', async () => {
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'before-pashto',
      region: 'Kohat',
      definition: 'test',
    });
    const token = await makeToken({ role: 'moderator' });
    await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pashto: 'after-pashto', note: 'diff check' });

    const log = await ModerationLog.findOne({ targetId: variant._id, action: 'edited' }).lean();
    expect(log.changes).toBeDefined();
    expect(log.changes.pashto).toBeDefined();
    expect(log.changes.pashto.from).toBe('before-pashto');
    expect(log.changes.pashto.to).toBe('after-pashto');
  });

  test('fields that were NOT changed do not appear in the changes diff', async () => {
    const variant = await Variant.create({
      concept: concept._id,
      pashto: 'unchanged-pashto',
      region: 'Kohat',
      definition: 'unchanged definition',
    });
    const token = await makeToken({ role: 'moderator' });
    await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ definition: 'changed definition only', note: 'partial update' });

    const log = await ModerationLog.findOne({ targetId: variant._id, action: 'edited' }).lean();
    expect(log.changes.definition).toBeDefined();
    expect(log.changes.pashto).toBeUndefined();
    expect(log.changes.region).toBeUndefined();
  });
});

describe('PATCH /api/variants/:id/edit — concept reassignment', () => {
  let sourceConcept;
  let targetConcept;
  let variant;

  beforeEach(async () => {
    sourceConcept = await Concept.create({ englishGloss: 'reassign-source', partOfSpeech: 'noun' });
    targetConcept = await Concept.create({ englishGloss: 'reassign-target', partOfSpeech: 'noun' });
    variant = await Variant.create({
      concept: sourceConcept._id,
      pashto: 'reassign-variant',
      region: 'Kohat',
      definition: 'test',
    });
  });

  test('reassigns variant to target concept when concept field is provided', async () => {
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ concept: targetConcept._id.toString(), note: 'moved to correct concept' });

    expect(res.status).toBe(200);
    expect(res.body.data.concept.toString()).toBe(targetConcept._id.toString());
  });

  test('returns 404 when target concept does not exist', async () => {
    const token = await makeToken({ role: 'moderator' });
    const fakeConceptId = new mongoose.Types.ObjectId().toString();
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ concept: fakeConceptId, note: 'bad target' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 409 when reassignment would create a duplicate on the target concept', async () => {
    await Variant.create({
      concept: targetConcept._id,
      pashto: 'reassign-variant',
      region: 'Kohat',
      definition: 'already exists on target',
    });

    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ concept: targetConcept._id.toString(), note: 'duplicate attempt' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('ModerationLog changes.concept includes from/to with id and englishGloss', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator', id: modId });
    await request
      .patch(`/api/variants/${variant._id}/edit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ concept: targetConcept._id.toString(), note: 'reassigning' });

    const log = await ModerationLog.findOne({ targetId: variant._id, action: 'edited' }).lean();
    expect(log.changes).toBeDefined();
    expect(log.changes.concept).toBeDefined();
    expect(log.changes.concept.from).toBeDefined();
    expect(log.changes.concept.from.id.toString()).toBe(sourceConcept._id.toString());
    expect(log.changes.concept.from.englishGloss).toBe('reassign-source');
    expect(log.changes.concept.to).toBeDefined();
    expect(log.changes.concept.to.id.toString()).toBe(targetConcept._id.toString());
    expect(log.changes.concept.to.englishGloss).toBe('reassign-target');
  });
});

// ---------------------------------------------------------------------------
// 4. POST /api/concepts/:sourceId/merge
// ---------------------------------------------------------------------------

describe('POST /api/concepts/:sourceId/merge — auth and role', () => {
  test('returns 401 when no token is provided', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request.post(`/api/concepts/${fakeId}/merge`).send({ targetConceptId: fakeId, note: 'test' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 when role is user', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'user' });
    const res = await request
      .post(`/api/concepts/${fakeId}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: fakeId, note: 'test' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/concepts/:sourceId/merge — validation', () => {
  test('returns 404 when source concept does not exist', async () => {
    const fakeSrcId = new mongoose.Types.ObjectId().toString();
    const target = await Concept.create({ englishGloss: 'merge-target-exist', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .post(`/api/concepts/${fakeSrcId}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString(), note: 'merging' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when source concept is soft-deleted', async () => {
    const source = await Concept.create({
      englishGloss: 'deleted-merge-source',
      partOfSpeech: 'noun',
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: new mongoose.Types.ObjectId(),
    });
    const target = await Concept.create({ englishGloss: 'merge-target-active', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString(), note: 'merging' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 when target concept does not exist', async () => {
    const source = await Concept.create({ englishGloss: 'merge-source-active', partOfSpeech: 'noun' });
    const fakeTargetId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: fakeTargetId, note: 'merging' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when merging a concept into itself', async () => {
    const concept = await Concept.create({ englishGloss: 'self-merge', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .post(`/api/concepts/${concept._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: concept._id.toString(), note: 'self merge' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when note is missing', async () => {
    const source = await Concept.create({ englishGloss: 'merge-no-note-source', partOfSpeech: 'noun' });
    const target = await Concept.create({ englishGloss: 'merge-no-note-target', partOfSpeech: 'noun' });
    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString() });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/concepts/:sourceId/merge — happy path', () => {
  let source;
  let target;

  beforeEach(async () => {
    source = await Concept.create({ englishGloss: 'love and affection', partOfSpeech: 'noun' });
    target = await Concept.create({ englishGloss: 'love', partOfSpeech: 'noun' });
  });

  test('moves all non-deleted variants of source concept to target concept', async () => {
    await Variant.create([
      { concept: source._id, pashto: 'مینه', region: 'Kohat', definition: 'love' },
      { concept: source._id, pashto: 'مینه', region: 'Hangu', definition: 'love hangu' },
    ]);

    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString(), note: 'consolidating duplicates' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.moved).toBe(2);

    const movedVariants = await Variant.find({ concept: target._id, isDeleted: { $ne: true } });
    expect(movedVariants).toHaveLength(2);

    const remainingOnSource = await Variant.find({ concept: source._id, isDeleted: { $ne: true } });
    expect(remainingOnSource).toHaveLength(0);
  });

  test('does not move soft-deleted source variants', async () => {
    await Variant.create({
      concept: source._id,
      pashto: 'active-variant',
      region: 'Kohat',
      definition: 'active',
    });
    await Variant.create({
      concept: source._id,
      pashto: 'deleted-variant',
      region: 'Hangu',
      definition: 'deleted',
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: new mongoose.Types.ObjectId(),
    });

    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString(), note: 'merge test' });

    expect(res.status).toBe(200);
    expect(res.body.data.moved).toBe(1);
  });

  test('skips variants that would create duplicates on target', async () => {
    await Variant.create({
      concept: source._id,
      pashto: 'دوستي',
      region: 'Kohat',
      definition: 'friendship',
    });
    await Variant.create({
      concept: target._id,
      pashto: 'دوستي',
      region: 'Kohat',
      definition: 'already exists on target',
    });

    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString(), note: 'merge with skip' });

    expect(res.status).toBe(200);
    expect(res.body.data.moved).toBe(0);
    expect(Array.isArray(res.body.data.skipped)).toBe(true);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0]).toHaveProperty('id');
    expect(res.body.data.skipped[0]).toHaveProperty('reason');
  });

  test('updates variants in place — does not create new variant documents', async () => {
    const originalVariant = await Variant.create({
      concept: source._id,
      pashto: 'inplace-move',
      region: 'Kohat',
      definition: 'in-place update',
    });

    const token = await makeToken({ role: 'moderator' });
    await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString(), note: 'in-place move' });

    const found = await Variant.findById(originalVariant._id);
    expect(found).not.toBeNull();
    expect(found.concept.toString()).toBe(target._id.toString());
  });

  test('soft-deletes the source concept after merge', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const token = await makeToken({ role: 'admin', id: adminId });
    await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString(), note: 'merge and delete source' });

    const updatedSource = await Concept.findById(source._id);
    expect(updatedSource.isDeleted).toBe(true);
    expect(updatedSource.deletedAt).toBeDefined();
    expect(updatedSource.deletedBy.toString()).toBe(adminId);
  });

  test('writes a ModerationLog with action "merged" and correct changes', async () => {
    const modId = new mongoose.Types.ObjectId().toString();
    const v1 = await Variant.create({
      concept: source._id,
      pashto: 'log-merge-variant1',
      region: 'Kohat',
      definition: 'first',
    });
    const v2 = await Variant.create({
      concept: source._id,
      pashto: 'log-merge-variant2',
      region: 'Hangu',
      definition: 'second',
    });

    const token = await makeToken({ role: 'moderator', id: modId });
    await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString(), note: 'audit merge' });

    const log = await ModerationLog.findOne({ targetId: source._id, targetModel: 'Concept', action: 'merged' }).lean();
    expect(log).not.toBeNull();
    expect(log.performedBy.toString()).toBe(modId);
    expect(log.note).toBe('audit merge');
    expect(log.changes).toBeDefined();
    expect(log.changes.mergedInto.toString()).toBe(target._id.toString());
    expect(Array.isArray(log.changes.variantsMoved)).toBe(true);
    expect(log.changes.variantsMoved.map(String)).toEqual(
      expect.arrayContaining([v1._id.toString(), v2._id.toString()])
    );
    expect(Array.isArray(log.changes.variantsSkipped)).toBe(true);
  });

  test('response includes moved count and skipped array', async () => {
    await Variant.create({
      concept: source._id,
      pashto: 'response-shape-variant',
      region: 'Kohat',
      definition: 'test',
    });

    const token = await makeToken({ role: 'moderator' });
    const res = await request
      .post(`/api/concepts/${source._id}/merge`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetConceptId: target._id.toString(), note: 'response shape check' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('moved');
    expect(res.body.data).toHaveProperty('skipped');
    expect(typeof res.body.data.moved).toBe('number');
    expect(Array.isArray(res.body.data.skipped)).toBe(true);
  });
});
