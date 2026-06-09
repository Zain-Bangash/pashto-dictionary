const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const User = require('../models/User');
const ModerationLog = require('../models/ModerationLog');

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
// Concept model
// ---------------------------------------------------------------------------

describe('Concept model', () => {
  const validConcept = () => ({ englishGloss: 'house', partOfSpeech: 'noun' });

  test('saves with required fields', async () => {
    const concept = await new Concept(validConcept()).save();
    expect(concept._id).toBeDefined();
  });

  test('rejects when englishGloss is missing', async () => {
    await expect(new Concept({ partOfSpeech: 'noun' }).save()).rejects.toThrow(/englishGloss/i);
  });

  test('rejects when partOfSpeech is missing', async () => {
    await expect(new Concept({ englishGloss: 'house' }).save()).rejects.toThrow(/partOfSpeech/i);
  });

  test('defaults status to "pending"', async () => {
    const concept = await new Concept(validConcept()).save();
    expect(concept.status).toBe('pending');
  });

  test('rejects an invalid status enum value', async () => {
    const concept = new Concept({ ...validConcept(), status: 'limbo' });
    await expect(concept.save()).rejects.toThrow(/status/i);
  });

  test('rejects an invalid partOfSpeech enum value', async () => {
    const concept = new Concept({ englishGloss: 'house', partOfSpeech: 'emoji' });
    await expect(concept.save()).rejects.toThrow(/partOfSpeech/i);
  });

  test('accepts all valid partOfSpeech values', async () => {
    const values = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];
    for (const pos of values) {
      const concept = await new Concept({ englishGloss: 'house', partOfSpeech: pos }).save();
      expect(concept.partOfSpeech).toBe(pos);
      await Concept.deleteOne({ _id: concept._id });
    }
  });

  test('accepts all valid status enum values', async () => {
    const statuses = ['pending', 'approved', 'rejected', 'published'];
    for (const status of statuses) {
      const concept = await new Concept({ ...validConcept(), status }).save();
      expect(concept.status).toBe(status);
      await Concept.deleteOne({ _id: concept._id });
    }
  });

  test('sets createdAt and updatedAt timestamps', async () => {
    const concept = await new Concept(validConcept()).save();
    expect(concept.createdAt).toBeInstanceOf(Date);
    expect(concept.updatedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Variant model
// ---------------------------------------------------------------------------

describe('Variant model', () => {
  let conceptId;

  beforeEach(async () => {
    const concept = await new Concept({ englishGloss: 'house', partOfSpeech: 'noun' }).save();
    conceptId = concept._id;
  });

  const validVariant = () => ({
    concept: conceptId,
    pashto: 'کور',
    region: 'Kohat',
    definition: 'a dwelling place',
  });

  test('saves with required fields', async () => {
    const variant = await new Variant(validVariant()).save();
    expect(variant._id).toBeDefined();
  });

  test('rejects when pashto is missing', async () => {
    const { pashto: _p, ...data } = validVariant();
    await expect(new Variant(data).save()).rejects.toThrow(/pashto/i);
  });

  test('rejects when region is missing', async () => {
    const { region: _r, ...data } = validVariant();
    await expect(new Variant(data).save()).rejects.toThrow(/region/i);
  });

  test('rejects when definition is missing', async () => {
    const { definition: _d, ...data } = validVariant();
    await expect(new Variant(data).save()).rejects.toThrow(/definition/i);
  });

  test('rejects when concept ref is missing', async () => {
    const { concept: _c, ...data } = validVariant();
    await expect(new Variant(data).save()).rejects.toThrow(/concept/i);
  });

  test('rejects an invalid region enum value', async () => {
    const variant = new Variant({ ...validVariant(), region: 'Kandahar' });
    await expect(variant.save()).rejects.toThrow(/region/i);
  });

  test('accepts all valid region values', async () => {
    const regions = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];
    let counter = 0;
    for (const region of regions) {
      const variant = await new Variant({ ...validVariant(), region, pashto: `کور${counter++}` }).save();
      expect(variant.region).toBe(region);
      await Variant.deleteOne({ _id: variant._id });
    }
  });

  test('defaults status to "pending"', async () => {
    const variant = await new Variant(validVariant()).save();
    expect(variant.status).toBe('pending');
  });

  test('rejects an invalid status enum value', async () => {
    const variant = new Variant({ ...validVariant(), status: 'limbo' });
    await expect(variant.save()).rejects.toThrow(/status/i);
  });

  test('sets createdAt and updatedAt timestamps', async () => {
    const variant = await new Variant(validVariant()).save();
    expect(variant.createdAt).toBeInstanceOf(Date);
    expect(variant.updatedAt).toBeInstanceOf(Date);
  });

  test('stores optional phonetic and example fields', async () => {
    const variant = await new Variant({ ...validVariant(), phonetic: 'kor', example: 'دا کور دی' }).save();
    expect(variant.phonetic).toBe('kor');
    expect(variant.example).toBe('دا کور دی');
  });
});

// ---------------------------------------------------------------------------
// User model
// ---------------------------------------------------------------------------

describe('User model', () => {
  const validUser = (suffix = '') => ({
    username: `testuser${suffix}`,
    email: `test${suffix}@example.com`,
  });

  test('saves with all required fields', async () => {
    const user = await new User(validUser()).save();
    expect(user._id).toBeDefined();
  });

  test('rejects when username is missing', async () => {
    const { username: _u, ...data } = validUser();
    await expect(new User(data).save()).rejects.toThrow(/username/i);
  });

  test('rejects when email is missing', async () => {
    const { email: _e, ...data } = validUser();
    await expect(new User(data).save()).rejects.toThrow(/email/i);
  });

  test('cognitoSub is not required (sparse unique field)', async () => {
    const user = await new User(validUser()).save();
    expect(user.cognitoSub).toBeUndefined();
  });

  test('defaults role to "user"', async () => {
    const user = await new User(validUser()).save();
    expect(user.role).toBe('user');
  });

  test('rejects an invalid role enum value', async () => {
    const user = new User({ ...validUser(), role: 'superadmin' });
    await expect(user.save()).rejects.toThrow(/role/i);
  });

  test('accepts all valid role enum values', async () => {
    const roles = ['user', 'moderator', 'admin'];
    for (let i = 0; i < roles.length; i++) {
      const user = await new User({ ...validUser(`_${i}`), role: roles[i] }).save();
      expect(user.role).toBe(roles[i]);
    }
  });

  test('enforces unique username constraint', async () => {
    await new User(validUser()).save();
    await expect(new User(validUser()).save()).rejects.toThrow(/duplicate|unique/i);
  });

  test('enforces unique email constraint', async () => {
    await new User(validUser()).save();
    const duplicate = { ...validUser(), username: 'differentuser' };
    await expect(new User(duplicate).save()).rejects.toThrow(/duplicate|unique/i);
  });

  test('lowercases the email field', async () => {
    const user = await new User({ ...validUser(), email: 'UPPER@EXAMPLE.COM' }).save();
    expect(user.email).toBe('upper@example.com');
  });

  test('sets createdAt and updatedAt timestamps', async () => {
    const user = await new User(validUser()).save();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Concept model — Phase 1 additions (normalizedGloss, soft-delete fields)
// ---------------------------------------------------------------------------

describe('Concept model — normalizedGloss pre-save hook', () => {
  test('normalizedGloss is automatically set on save from englishGloss (lowercase + trim)', async () => {
    const concept = await new Concept({ englishGloss: '  House  ', partOfSpeech: 'noun' }).save();
    expect(concept.normalizedGloss).toBe('house');
  });

  test('normalizedGloss updates when englishGloss changes and the doc is saved again', async () => {
    const concept = await new Concept({ englishGloss: 'Water', partOfSpeech: 'noun' }).save();
    expect(concept.normalizedGloss).toBe('water');

    concept.englishGloss = '  River  ';
    await concept.save();
    expect(concept.normalizedGloss).toBe('river');
  });
});

describe('Concept model — isDeleted soft-delete field', () => {
  test('isDeleted defaults to false on a new Concept', async () => {
    const concept = await new Concept({ englishGloss: 'tree', partOfSpeech: 'noun' }).save();
    expect(concept.isDeleted).toBe(false);
  });
});

describe('Concept model — normalizedGloss unique index with partial filter', () => {
  test('saving two active Concepts with the same englishGloss throws E11000', async () => {
    await new Concept({ englishGloss: 'fire', partOfSpeech: 'noun' }).save();
    await expect(
      new Concept({ englishGloss: 'fire', partOfSpeech: 'verb' }).save()
    ).rejects.toMatchObject({ code: 11000 });
  });

  test('saving a soft-deleted and an active Concept with the same normalizedGloss does NOT throw', async () => {
    await new Concept({ englishGloss: 'stone', partOfSpeech: 'noun', isDeleted: true }).save();
    await expect(
      new Concept({ englishGloss: 'stone', partOfSpeech: 'noun' }).save()
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Variant model — Phase 1 additions (normalizedPashto, normalizedPhonetic, soft-delete)
// ---------------------------------------------------------------------------

describe('Variant model — normalizedPashto pre-save hook', () => {
  let conceptId;

  beforeEach(async () => {
    const concept = await new Concept({ englishGloss: 'road', partOfSpeech: 'noun' }).save();
    conceptId = concept._id;
  });

  const baseVariant = () => ({
    concept: conceptId,
    pashto: '  لار  ',
    region: 'Kohat',
    definition: 'a road or path',
  });

  test('normalizedPashto is automatically set on save — trim + NFC, no lowercasing', async () => {
    const variant = await new Variant(baseVariant()).save();
    // trim is applied; NFC normalization; Arabic script is caseless so value matches NFC of trimmed input
    expect(variant.normalizedPashto).toBe('لار'.normalize('NFC'));
  });

  test('normalizedPhonetic is automatically set on save — lowercase + trim', async () => {
    const variant = await new Variant({ ...baseVariant(), phonetic: '  Laar  ' }).save();
    expect(variant.normalizedPhonetic).toBe('laar');
  });

  test('normalizedPhonetic is empty or undefined when phonetic is not provided', async () => {
    const variant = await new Variant(baseVariant()).save();
    // phonetic not supplied — normalizedPhonetic should be absent or empty
    expect(variant.normalizedPhonetic == null || variant.normalizedPhonetic === '').toBe(true);
  });
});

describe('Variant model — isDeleted soft-delete field', () => {
  let conceptId;

  beforeEach(async () => {
    const concept = await new Concept({ englishGloss: 'sky', partOfSpeech: 'noun' }).save();
    conceptId = concept._id;
  });

  test('isDeleted defaults to false on a new Variant', async () => {
    const variant = await new Variant({
      concept: conceptId,
      pashto: 'اسمان',
      region: 'Kohat',
      definition: 'the sky',
    }).save();
    expect(variant.isDeleted).toBe(false);
  });
});

describe('Variant model — compound unique index with partial filter', () => {
  let conceptId;

  beforeEach(async () => {
    const concept = await new Concept({ englishGloss: 'sun', partOfSpeech: 'noun' }).save();
    conceptId = concept._id;
  });

  const baseVariant = (overrides = {}) => ({
    concept: conceptId,
    pashto: 'لمر',
    region: 'Kohat',
    definition: 'the sun',
    ...overrides,
  });

  test('saving two active Variants with the same concept + pashto + region throws E11000', async () => {
    await new Variant(baseVariant()).save();
    await expect(
      new Variant(baseVariant()).save()
    ).rejects.toMatchObject({ code: 11000 });
  });

  test('saving a soft-deleted and an active Variant with the same concept + pashto + region does NOT throw', async () => {
    await new Variant(baseVariant({ isDeleted: true })).save();
    await expect(
      new Variant(baseVariant()).save()
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ModerationLog model
// ---------------------------------------------------------------------------

describe('ModerationLog model', () => {
  let conceptId;
  let userId;

  beforeEach(async () => {
    const concept = await new Concept({ englishGloss: 'house', partOfSpeech: 'noun' }).save();
    conceptId = concept._id;
    const user = await new User({
      username: 'loguser',
      email: 'loguser@example.com',
      passwordHash: 'hash',
    }).save();
    userId = user._id;
  });

  const validLog = () => ({
    targetModel: 'Concept',
    targetId: conceptId,
    action: 'submitted',
    performedBy: userId,
  });

  test('saves with all required fields', async () => {
    const log = await new ModerationLog(validLog()).save();
    expect(log._id).toBeDefined();
  });

  test('rejects when action is missing', async () => {
    const { action: _a, ...data } = validLog();
    await expect(new ModerationLog(data).save()).rejects.toThrow(/action/i);
  });

  test('rejects when performedBy is missing', async () => {
    const { performedBy: _p, ...data } = validLog();
    await expect(new ModerationLog(data).save()).rejects.toThrow(/performedBy/i);
  });

  test('rejects an invalid action enum value', async () => {
    const log = new ModerationLog({ ...validLog(), action: 'frobnicated' });
    await expect(log.save()).rejects.toThrow(/action/i);
  });

  test('accepts all valid action enum values', async () => {
    const actions = ['submitted', 'approved', 'rejected', 'published', 'resubmitted', 'deleted'];
    for (const action of actions) {
      const log = await new ModerationLog({ ...validLog(), action }).save();
      expect(log.action).toBe(action);
    }
  });

  test('defaults timestamp to approximately now', async () => {
    const before = Date.now();
    const log = await new ModerationLog(validLog()).save();
    const after = Date.now();
    expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(log.timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  test('stores an optional note', async () => {
    const log = await new ModerationLog({ ...validLog(), note: 'Looks good' }).save();
    expect(log.note).toBe('Looks good');
  });

  test('stores targetModel and targetId correctly', async () => {
    const log = await new ModerationLog(validLog()).save();
    expect(log.targetModel).toBe('Concept');
    expect(log.targetId.toString()).toBe(conceptId.toString());
  });
});
