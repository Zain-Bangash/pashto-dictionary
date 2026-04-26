const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Entry = require('../models/Entry');
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
// Entry model
// ---------------------------------------------------------------------------

describe('Entry model', () => {
  const validEntry = () => ({ pashto: 'کور' });

  test('saves with only the required pashto field', async () => {
    const entry = await new Entry(validEntry()).save();
    expect(entry._id).toBeDefined();
  });

  test('rejects when pashto is missing', async () => {
    await expect(new Entry({}).save()).rejects.toThrow(/pashto/i);
  });

  test('defaults status to "pending"', async () => {
    const entry = await new Entry(validEntry()).save();
    expect(entry.status).toBe('pending');
  });

  test('rejects an invalid status enum value', async () => {
    const entry = new Entry({ pashto: 'کور', status: 'limbo' });
    await expect(entry.save()).rejects.toThrow(/status/i);
  });

  test('rejects an invalid partOfSpeech enum value', async () => {
    const entry = new Entry({ pashto: 'کور', partOfSpeech: 'interjection' });
    await expect(entry.save()).rejects.toThrow(/partOfSpeech/i);
  });

  test('rejects an invalid region enum value', async () => {
    const entry = new Entry({ pashto: 'کور', region: 'Kandahar' });
    await expect(entry.save()).rejects.toThrow(/region/i);
  });

  test('accepts all valid region values', async () => {
    const regions = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];
    for (const region of regions) {
      const entry = await new Entry({ pashto: 'کور', region }).save();
      expect(entry.region).toBe(region);
      await Entry.deleteOne({ _id: entry._id });
    }
  });

  test('accepts every valid partOfSpeech value', async () => {
    const values = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];
    for (const pos of values) {
      const entry = await new Entry({ pashto: 'کور', partOfSpeech: pos }).save();
      expect(entry.partOfSpeech).toBe(pos);
      await Entry.deleteOne({ _id: entry._id });
    }
  });

  test('stores a definition sub-document with required text', async () => {
    const entry = await new Entry({
      pashto: 'کور',
      definitions: [{ text: 'house', example: 'زه کور ته ځم' }],
    }).save();
    expect(entry.definitions[0].text).toBe('house');
    expect(entry.definitions[0].example).toBe('زه کور ته ځم');
  });

  test('rejects a definition sub-document missing text', async () => {
    const entry = new Entry({ pashto: 'کور', definitions: [{ example: 'only example' }] });
    await expect(entry.save()).rejects.toThrow(/definitions.*text|text.*required/i);
  });

  test('sets createdAt and updatedAt timestamps', async () => {
    const entry = await new Entry(validEntry()).save();
    expect(entry.createdAt).toBeInstanceOf(Date);
    expect(entry.updatedAt).toBeInstanceOf(Date);
  });

  test('accepts all valid status enum values', async () => {
    const statuses = ['pending', 'approved', 'rejected', 'published'];
    for (const status of statuses) {
      const entry = await new Entry({ pashto: 'کور', status }).save();
      expect(entry.status).toBe(status);
      await Entry.deleteOne({ _id: entry._id });
    }
  });
});

// ---------------------------------------------------------------------------
// User model
// ---------------------------------------------------------------------------

describe('User model', () => {
  const validUser = (suffix = '') => ({
    username: `testuser${suffix}`,
    email: `test${suffix}@example.com`,
    passwordHash: 'hashedpassword123',
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

  test('rejects when passwordHash is missing', async () => {
    const { passwordHash: _p, ...data } = validUser();
    await expect(new User(data).save()).rejects.toThrow(/passwordHash/i);
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
// ModerationLog model
// ---------------------------------------------------------------------------

describe('ModerationLog model', () => {
  let entryId;
  let userId;

  beforeEach(async () => {
    const entry = await new Entry({ pashto: 'کور' }).save();
    entryId = entry._id;
    const user = await new User({
      username: 'loguser',
      email: 'loguser@example.com',
      passwordHash: 'hash',
    }).save();
    userId = user._id;
  });

  const validLog = () => ({
    entry: entryId,
    action: 'submitted',
    performedBy: userId,
  });

  test('saves with all required fields', async () => {
    const log = await new ModerationLog(validLog()).save();
    expect(log._id).toBeDefined();
  });

  test('rejects when entry is missing', async () => {
    const { entry: _e, ...data } = validLog();
    await expect(new ModerationLog(data).save()).rejects.toThrow(/entry/i);
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
    const log = new ModerationLog({ ...validLog(), action: 'deleted' });
    await expect(log.save()).rejects.toThrow(/action/i);
  });

  test('accepts all valid action enum values', async () => {
    const actions = ['submitted', 'approved', 'rejected', 'published'];
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
});
