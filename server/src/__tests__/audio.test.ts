jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: () => ({
      verify: async (token) => {
        const parts = (token || '').split('.');
        if (parts.length < 2) throw new Error('Invalid token');
        const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (!p.id && !p.sub) throw new Error('Invalid token');
        return { sub: p.id || p.sub };
      },
    }),
  },
}));
jest.mock('../utils/storage', () => require('./helpers/memoryStorage'));

// Pronunciation clips: upload checks (slot, format, real duration), the clip state machine,
// replacement publish ordering, cascades from the word, and text edits that retire clips

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const fs = require('fs');
const path = require('path');
const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const conceptsRouter = require('../routes/concepts');
const variantsRouter = require('../routes/variants');
const audioRouter = require('../routes/audio');
const moderationRouter = require('../routes/moderation');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const AudioClip = require('../models/AudioClip');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');
const storage = require('./helpers/memoryStorage');

const app = express();
app.use(express.json());
app.use('/api/concepts', conceptsRouter);
app.use('/api/variants', variantsRouter);
app.use('/api/audio', audioRouter);
app.use('/api/moderation', moderationRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ success: false, error: { message: err.message || 'Internal server error' } });
});

const request = supertest(app);
let mongoServer;

const TWO_SECONDS = fs.readFileSync(path.join(__dirname, 'fixtures', 'audio', 'chrome-2s.webm'));
const SIX_SECONDS = fs.readFileSync(path.join(__dirname, 'fixtures', 'audio', 'chrome-6s.webm'));

async function makeUser(role = 'user', fields = {}) {
  const id = new mongoose.Types.ObjectId().toString();
  await User.create({ cognitoSub: id, username: `user-${id.slice(-6)}`, email: `${id.slice(-6)}@test.local`, role, ...fields });
  const token = jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { id, token };
}

const send = (method, url, token, body?) => {
  const req = request[method](url);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};

function upload(variant, slot, token, bytes = TWO_SECONDS, type = 'audio/webm;codecs=opus') {
  const req = request.post(`/api/variants/${variant._id}/audio?slot=${encodeURIComponent(slot)}`).set('Content-Type', type);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(bytes);
}
const transition = (id, status, token, moderatorNote?) =>
  send('patch', `/api/audio/${id}/status`, token, { status, ...(moderatorNote && { moderatorNote }) });

let seq = 0;
let owner, speaker, other, mod, admin;

async function setup(variantFields = {}, conceptFields = {}) {
  seq += 1;
  const concept = await Concept.create({ englishGloss: `gloss-${seq}`, partOfSpeech: 'noun', status: 'published', ...conceptFields });
  const variant = await Variant.create({
    concept: concept._id, pashto: `لمر${seq}`, region: 'Kohat', definition: 'sun', status: 'published',
    submittedBy: owner.id, example: 'لمر راختلی دی', ...variantFields,
  });
  return { concept, variant };
}

async function live(variant, slot = 'headword', user = speaker) {
  const res = await upload(variant, slot, user.token);
  await transition(res.body.data._id, 'approved', mod.token);
  await transition(res.body.data._id, 'published', admin.token);
  return res.body.data._id;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Variant.init(), AudioClip.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  [owner, speaker, other, mod, admin] = await Promise.all([
    makeUser(), makeUser('user', { village: 'Shakardara', region: 'Kohat' }), makeUser(), makeUser('moderator'), makeUser('admin'),
  ]);
});

afterEach(async () => {
  storage.files.clear();
  storage.failures.remove = false;
  await Promise.all([
    Concept.deleteMany({}), Variant.deleteMany({}), AudioClip.deleteMany({}), ModerationLog.deleteMany({}), User.deleteMany({}),
  ]);
});

describe('POST /api/variants/:id/audio — upload', () => {
  test('any logged-in user can record a published word; the clip is pending and the file stored', async () => {
    const { variant } = await setup();
    const res = await upload(variant, 'headword', speaker.token);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ status: 'pending', slot: 'headword', mimeType: 'audio/webm', submittedBy: speaker.id }));
    expect(res.body.data.durationMs).toBeGreaterThan(1500);
    expect(res.body.data.url).toMatch(/^https:\/\/storage\.test\/audio\//);
    expect(res.body.data.storageKey).toBeUndefined();
    expect(storage.files.size).toBe(1);
    expect(await ModerationLog.countDocuments({ targetModel: 'AudioClip', action: 'submitted' })).toBe(1);
  });

  test('guests cannot upload', async () => {
    const { variant } = await setup();
    expect((await upload(variant, 'headword', null)).status).toBe(401);
  });

  test('only published, live words accept clips', async () => {
    const { variant: pending } = await setup({ status: 'pending' });
    expect((await upload(pending, 'headword', speaker.token)).status).toBe(400);
    const { variant: deleted } = await setup({ isDeleted: true });
    expect((await upload(deleted, 'headword', speaker.token)).status).toBe(400);
    expect(storage.files.size).toBe(0);
  });

  test('slot must exist on the word: example needs text, forms must suit the part of speech', async () => {
    const { variant } = await setup({ example: undefined });
    expect((await upload(variant, 'bogus slot', speaker.token)).status).toBe(400);
    const noExample = await upload(variant, 'example', speaker.token);
    expect(noExample.status).toBe(400);
    expect(noExample.body.error.field).toBe('slot');
    expect((await upload(variant, 'form:infinitive', speaker.token)).status).toBe(400);
  });

  test('an empty form slot accepts a clip, timed against the headword', async () => {
    const { variant } = await setup();
    const res = await upload(variant, 'form:masculine.plural.direct', speaker.token);
    expect(res.status).toBe(201);
  });

  test('the server checks the real duration against the slot limit', async () => {
    const { variant } = await setup();
    const res = await upload(variant, 'headword', speaker.token, SIX_SECONDS);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/up to 4 seconds/);
    expect((await upload(variant, 'example', speaker.token, SIX_SECONDS)).status).toBe(201);
  });

  test('bad bytes, a mismatched declared type, and oversize bodies are refused', async () => {
    const { variant } = await setup();
    expect((await upload(variant, 'headword', speaker.token, Buffer.from('<script>alert(1)</script>'), 'audio/webm')).status).toBe(400);
    const mismatch = await upload(variant, 'headword', speaker.token, TWO_SECONDS, 'audio/mpeg');
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.message).toMatch(/does not match/);
    expect((await upload(variant, 'headword', speaker.token, Buffer.alloc(1024 * 1024 + 10, 1))).status).toBe(413);
    expect((await upload(variant, 'headword', speaker.token, TWO_SECONDS, 'application/octet-stream')).status).toBe(201);
  });

  test('one open clip per slot: a second upload gets 409 and nothing extra is stored', async () => {
    const { variant } = await setup();
    await upload(variant, 'headword', speaker.token);
    const res = await upload(variant, 'headword', other.token);
    expect(res.status).toBe(409);
    expect(storage.files.size).toBe(1);
    expect((await upload(variant, 'example', other.token)).status).toBe(201);
  });
});

describe('PATCH /api/audio/:id/status — review', () => {
  test('moderator approves, admin publishes; the public word page then serves it with credit', async () => {
    const { concept, variant } = await setup();
    const res = await upload(variant, 'headword', speaker.token);

    let page = await request.get(`/api/concepts/${concept._id}`);
    expect(page.body.data.variants[0].audio).toEqual({});
    expect(page.body.data.variants[0].audioOpen).toEqual(['headword']);

    expect((await transition(res.body.data._id, 'approved', mod.token)).status).toBe(200);
    expect((await transition(res.body.data._id, 'published', mod.token)).status).toBe(403);
    expect((await transition(res.body.data._id, 'published', admin.token)).status).toBe(200);

    page = await request.get(`/api/concepts/${concept._id}`);
    const v = page.body.data.variants[0];
    expect(v.audio.headword.url).toMatch(/storage\.test/);
    expect(v.audio.headword.storageKey).toBeUndefined();
    expect(v.audio.headword.submittedBy).toEqual(expect.objectContaining({ village: 'Shakardara', region: 'Kohat' }));
    expect(v.audioOpen).toEqual([]);
    expect(v.audioSlots.map((s) => s.slot)).toEqual(expect.arrayContaining(['headword', 'example', 'form:feminine.singular.oblique']));
    expect(v.audioSlots.find((s) => s.slot === 'headword').maxSeconds).toBe(4);
    expect(await ModerationLog.countDocuments({ targetModel: 'Variant', action: 'audio_published' })).toBe(1);
  });

  test('moderators cannot review their own clips; a reject needs a note and deletes the file', async () => {
    const { variant } = await setup();
    const own = await upload(variant, 'headword', mod.token);
    expect((await transition(own.body.data._id, 'approved', mod.token)).status).toBe(403);

    expect((await transition(own.body.data._id, 'rejected', admin.token)).status).toBe(400);
    const rejected = await transition(own.body.data._id, 'rejected', admin.token, 'Background noise');
    expect(rejected.status).toBe(200);
    const clip = await AudioClip.findById(own.body.data._id).lean();
    expect(clip).toEqual(expect.objectContaining({ status: 'rejected', moderatorNote: 'Background noise' }));
    expect(clip.lane).toBeUndefined();
    expect(clip.fileDeletedAt).toBeDefined();
    expect(storage.files.size).toBe(0);
    expect((await transition(own.body.data._id, 'approved', admin.token)).status).toBe(400);
  });

  test('only admins reject approved or published clips', async () => {
    const { variant } = await setup();
    const id = await live(variant);
    expect((await transition(id, 'rejected', mod.token, 'no')).status).toBe(403);
    expect((await transition(id, 'rejected', admin.token, 'Wrong word')).status).toBe(200);
    expect(storage.files.size).toBe(0);
  });

  test('publishing a replacement retires the old clip and deletes its file after the switch', async () => {
    const { concept, variant } = await setup();
    const firstId = await live(variant);
    const second = await upload(variant, 'headword', other.token);
    expect(second.body.data.replaces).toBe(firstId);
    await transition(second.body.data._id, 'approved', mod.token);
    expect((await transition(second.body.data._id, 'published', admin.token)).status).toBe(200);

    const first = await AudioClip.findById(firstId).lean();
    expect(first).toEqual(expect.objectContaining({ status: 'retired', retiredReason: 'Replaced by a newer recording' }));
    expect(first.fileDeletedAt).toBeDefined();
    expect(storage.files.size).toBe(1);
    const page = await request.get(`/api/concepts/${concept._id}`);
    expect(page.body.data.variants[0].audio.headword._id).toBe(second.body.data._id);
  });

  test('a failed file delete never loses the new live clip and leaves the old file for cleanup', async () => {
    const { variant } = await setup();
    const firstId = await live(variant);
    const second = await upload(variant, 'headword', other.token);
    await transition(second.body.data._id, 'approved', mod.token);
    storage.failures.remove = true;
    expect((await transition(second.body.data._id, 'published', admin.token)).status).toBe(200);
    expect((await AudioClip.findById(second.body.data._id).lean()).lane).toBe('live');
    const first = await AudioClip.findById(firstId).lean();
    expect(first.status).toBe('retired');
    expect(first.fileDeletedAt).toBeUndefined();
  });

  test('publishing a clip that is not approved keeps the current clip live', async () => {
    const { variant } = await setup();
    const firstId = await live(variant);
    const second = await upload(variant, 'headword', other.token);
    expect((await transition(second.body.data._id, 'published', admin.token)).status).toBe(400);
    expect((await AudioClip.findById(firstId).lean()).status).toBe('published');
  });
});

describe('DELETE /api/audio/:id — withdraw', () => {
  test('the speaker can withdraw a pending clip, which frees the slot', async () => {
    const { variant } = await setup();
    const res = await upload(variant, 'headword', speaker.token);
    expect((await send('delete', `/api/audio/${res.body.data._id}`, other.token)).status).toBe(403);
    expect((await send('delete', `/api/audio/${res.body.data._id}`, speaker.token)).status).toBe(200);
    expect((await AudioClip.findById(res.body.data._id).lean()).status).toBe('withdrawn');
    expect(storage.files.size).toBe(0);
    expect(await ModerationLog.countDocuments({ targetModel: 'AudioClip', action: 'withdrawn' })).toBe(1);
    expect((await upload(variant, 'headword', other.token)).status).toBe(201);
  });

  test('a clip already approved cannot be withdrawn', async () => {
    const { variant } = await setup();
    const res = await upload(variant, 'headword', speaker.token);
    await transition(res.body.data._id, 'approved', mod.token);
    expect((await send('delete', `/api/audio/${res.body.data._id}`, speaker.token)).status).toBe(400);
  });
});

describe('cascades from the word', () => {
  test('rejecting the word rejects open clips; its live clip is hidden and returns when republished unchanged', async () => {
    const { concept, variant } = await setup();
    const liveId = await live(variant);
    const open = await upload(variant, 'example', other.token);

    await send('patch', `/api/variants/${variant._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'Check spelling' });
    expect((await AudioClip.findById(open.body.data._id).lean()).status).toBe('rejected');
    expect((await AudioClip.findById(liveId).lean()).status).toBe('published');

    expect((await send('patch', `/api/variants/${variant._id}`, owner.token, { definition: 'the sun' })).status).toBe(200);
    await send('patch', `/api/variants/${variant._id}/status`, mod.token, { status: 'approved' });
    await send('patch', `/api/variants/${variant._id}/status`, admin.token, { status: 'published' });
    const page = await request.get(`/api/concepts/${concept._id}`);
    expect(page.body.data.variants[0].audio.headword._id).toBe(liveId);
  });

  test('rejecting or deleting the concept rejects open clips on its variants', async () => {
    const { concept, variant } = await setup();
    const open = await upload(variant, 'headword', speaker.token);
    await send('patch', `/api/concepts/${concept._id}/status`, admin.token, { status: 'rejected', moderatorNote: 'Duplicate' });
    expect((await AudioClip.findById(open.body.data._id).lean()).status).toBe('rejected');

    const second = await setup();
    const open2 = await upload(second.variant, 'headword', speaker.token);
    await send('delete', `/api/concepts/${second.concept._id}`, admin.token);
    expect((await AudioClip.findById(open2.body.data._id).lean()).status).toBe('rejected');
  });
});

describe('text edits that retire clips', () => {
  test('changing the headword needs confirmation, then retires its clips and deletes the files', async () => {
    const { variant } = await setup();
    const liveId = await live(variant);
    const edit = { pashto: 'نمر', note: 'Spelling' };

    const warned = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, edit);
    expect(warned.status).toBe(409);
    expect(warned.body.error.field).toBe('confirmAudioRetire');
    expect(warned.body.error.retiring).toEqual([expect.objectContaining({ slot: 'headword', speaker: expect.stringMatching(/^user-/) })]);
    expect((await Variant.findById(variant._id).lean()).pashto).toBe(variant.pashto);

    const confirmed = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, { ...edit, confirmAudioRetire: true });
    expect(confirmed.status).toBe(200);
    expect((await AudioClip.findById(liveId).lean()).status).toBe('retired');
    expect(storage.files.size).toBe(0);
    expect(await ModerationLog.countDocuments({ targetModel: 'AudioClip', action: 'retired' })).toBe(1);
  });

  test('edits that leave the recorded text alone, or fill an empty form slot, keep clips', async () => {
    const { variant } = await setup();
    const headId = await live(variant);
    const formId = await live(variant, 'form:masculine.plural.direct');
    const res = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, {
      definition: 'the sun', note: 'Clarify',
      forms: [{ kind: 'noun', gender: 'masculine', number: 'plural', case: 'direct', pashto: 'لمرونه' }],
    });
    expect(res.status).toBe(200);
    expect((await AudioClip.findById(headId).lean()).status).toBe('published');
    expect((await AudioClip.findById(formId).lean()).status).toBe('published');
  });

  test('removing the example text retires the example clip', async () => {
    const { variant } = await setup();
    const exampleId = await live(variant, 'example');
    const res = await send('patch', `/api/variants/${variant._id}/edit`, admin.token, { example: '', note: 'Remove', confirmAudioRetire: true });
    expect(res.status).toBe(200);
    expect((await AudioClip.findById(exampleId).lean()).status).toBe('retired');
  });

  test('a part-of-speech change retires form-slot clips but not the headword', async () => {
    const { concept, variant } = await setup();
    const headId = await live(variant);
    const formId = await live(variant, 'form:masculine.plural.direct');
    const edit = { partOfSpeech: 'verb', note: 'It is a verb' };
    expect((await send('patch', `/api/concepts/${concept._id}/edit`, admin.token, edit)).status).toBe(409);
    expect((await send('patch', `/api/concepts/${concept._id}/edit`, admin.token, { ...edit, confirmAudioRetire: true })).status).toBe(200);
    expect((await AudioClip.findById(formId).lean()).status).toBe('retired');
    expect((await AudioClip.findById(headId).lean()).status).toBe('published');
  });
});

describe('queue and my recordings', () => {
  test('the queue shows the new clip beside the current live one, with counts', async () => {
    const { variant } = await setup();
    await live(variant);
    await upload(variant, 'headword', other.token);
    await upload(variant, 'example', other.token);

    const res = await send('get', '/api/moderation/audio', mod.token);
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual(expect.objectContaining({ total: 2, pendingCount: 2 }));
    const head = res.body.data.find((c) => c.slot === 'headword');
    expect(head.url).toMatch(/storage\.test/);
    expect(head.current.url).toMatch(/storage\.test/);
    expect(head.current.submittedBy.username).toMatch(/^user-/);
    expect(head.slotInfo).toEqual(expect.objectContaining({ text: variant.pashto, maxSeconds: 4 }));
    expect(head.variant.concept.englishGloss).toMatch(/^gloss-/);
    expect(res.body.data.find((c) => c.slot === 'example').current).toBeNull();

    expect((await send('get', '/api/moderation/audio', speaker.token)).status).toBe(403);
    const modApproved = await send('get', '/api/moderation/audio?status=approved', mod.token);
    expect(modApproved.body.data.every((c) => c.status === 'pending')).toBe(true);
  });

  test('my recordings lists my clips; only open or live ones get a playable URL', async () => {
    const { variant } = await setup();
    const kept = await upload(variant, 'headword', speaker.token);
    const dropped = await upload(variant, 'example', speaker.token);
    await transition(dropped.body.data._id, 'rejected', mod.token, 'Too quiet');

    const res = await send('get', '/api/audio/mine', speaker.token);
    expect(res.body.meta.total).toBe(2);
    const byId = Object.fromEntries(res.body.data.map((c) => [c._id, c]));
    expect(byId[kept.body.data._id].url).toMatch(/storage\.test/);
    expect(byId[dropped.body.data._id].url).toBeUndefined();
    expect(byId[dropped.body.data._id].moderatorNote).toBe('Too quiet');
    expect(byId[kept.body.data._id].variant.pashto).toBe(variant.pashto);
    expect(byId[kept.body.data._id].slotText).toBe(variant.pashto);
  });
});
