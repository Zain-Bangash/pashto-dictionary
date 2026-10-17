jest.mock('../utils/storage', () => require('./helpers/memoryStorage'));

// Browse cards: the list, search and word-of-the-day carry the first word's live headword clip, and browse filters by region

require('dotenv').config();

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const conceptsRouter = require('../routes/concepts');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const AudioClip = require('../models/AudioClip');
const User = require('../models/User');
const Lookup = require('../models/Lookup');
const { ensureSystemLookups } = require('../utils/lookups');

const app = express();
app.use(express.json());
app.use('/api/concepts', conceptsRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ success: false, error: { message: err.message || 'Internal server error' } });
});

const request = supertest(app);
let mongoServer;
let seq = 0;

async function word(gloss, variants) {
  const concept = await Concept.create({ englishGloss: gloss, partOfSpeech: 'noun', status: 'published' });
  const created = [];
  for (const v of variants) {
    seq += 1;
    created.push(await Variant.create({
      concept: concept._id, pashto: v.exact ? v.pashto : `${v.pashto ?? 'لمر'}${seq}`, region: v.region ?? 'Kohat', definition: gloss,
      status: v.status ?? 'published', submittedBy: 'owner-sub', example: v.example, isDeleted: v.isDeleted,
    }));
  }
  return { concept, variants: created };
}

const clip = (variant, status = 'published', slot = 'headword') => AudioClip.create({
  variant: variant._id, slot, storageKey: `audio/${variant._id}/${status}-${slot}.webm`, mimeType: 'audio/webm',
  sizeBytes: 1000, durationMs: 1800, status, ...(status === 'published' ? { lane: 'live' } : status === 'pending' ? { lane: 'open' } : {}),
  submittedBy: 'speaker-sub',
});

const cardOf = (res, gloss) => res.body.data.find((c) => c.englishGloss === gloss);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([Concept.init(), Variant.init(), AudioClip.init(), Lookup.init()]);
});

beforeEach(async () => {
  await ensureSystemLookups();
  await User.create({ cognitoSub: 'speaker-sub', username: 'gul', email: 'gul@test.local', role: 'user', village: 'Shakardara', region: 'Kohat' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Promise.all([Concept.deleteMany({}), Variant.deleteMany({}), AudioClip.deleteMany({}), User.deleteMany({}), Lookup.deleteMany({})]);
});

describe('firstVariant.audio on browse cards', () => {
  test('the list carries the live headword clip with a signed URL and the speaker', async () => {
    const { variants } = await word('sun', [{}]);
    await clip(variants[0]);
    const res = await request.get('/api/concepts');
    expect(res.status).toBe(200);
    const audio = cardOf(res, 'sun').firstVariant.audio;
    expect(audio).toEqual(expect.objectContaining({ mimeType: 'audio/webm', durationMs: 1800 }));
    expect(audio.url).toMatch(/^https:\/\/storage\.test\/audio\//);
    expect(audio.submittedBy).toEqual(expect.objectContaining({ username: 'gul' }));
    expect(audio.storageKey).toBeUndefined();
  });

  test('no clip, a pending clip, or a clip of another slot gives null', async () => {
    const { variants } = await word('moon', [{ example: 'سپوږمۍ ښکاري' }]);
    await clip(variants[0], 'pending');
    await clip(variants[0], 'published', 'example');
    await word('star', [{}]);
    const res = await request.get('/api/concepts');
    expect(cardOf(res, 'moon').firstVariant.audio).toBeNull();
    expect(cardOf(res, 'star').firstVariant.audio).toBeNull();
  });

  test('exampleAudio carries the live example clip, or null without one', async () => {
    const { variants } = await word('moon', [{ example: 'سپوږمۍ ښکاري' }]);
    await clip(variants[0], 'published', 'example');
    await word('star', [{ example: 'ستوری ځلیږي' }]);
    const res = await request.get('/api/concepts');
    const exampleAudio = cardOf(res, 'moon').firstVariant.exampleAudio;
    expect(exampleAudio.url).toMatch(/^https:\/\/storage\.test\/audio\//);
    expect(exampleAudio.submittedBy).toEqual(expect.objectContaining({ username: 'gul' }));
    expect(exampleAudio.storageKey).toBeUndefined();
    expect(cardOf(res, 'moon').firstVariant.audio).toBeNull();
    expect(cardOf(res, 'star').firstVariant.exampleAudio).toBeNull();
  });

  test('word of the day carries exampleAudio too', async () => {
    const { variants } = await word('sun', [{ example: 'لمر راختلی دی' }]);
    await clip(variants[0], 'published', 'example');
    const res = await request.get('/api/concepts/wotd');
    expect(res.body.data.firstVariant.exampleAudio.url).toBeDefined();
  });

  test('search results carry it too', async () => {
    const { variants } = await word('water', [{}]);
    await clip(variants[0]);
    const res = await request.get('/api/concepts/search?q=water');
    expect(res.status).toBe(200);
    expect(cardOf(res, 'water').firstVariant.audio.url).toBeDefined();
  });

  test('a concept with no published word still lists with a null firstVariant and a zero count', async () => {
    await word('house', [{ status: 'pending' }]);
    const res = await request.get('/api/concepts');
    expect(cardOf(res, 'house')).toEqual(expect.objectContaining({ firstVariant: null, variantCount: 0 }));
  });

  test('word of the day carries the clip, or null without one', async () => {
    const { variants } = await word('sun', [{}]);
    let res = await request.get('/api/concepts/wotd');
    expect(res.body.data.firstVariant.audio).toBeNull();
    await clip(variants[0]);
    res = await request.get('/api/concepts/wotd');
    expect(res.body.data.firstVariant.audio.url).toBeDefined();
  });
});

describe('region filter', () => {
  test('the list keeps only concepts with a published word in the region, showing that word', async () => {
    const { variants: sun } = await word('sun', [{ region: 'Kohat', pashto: 'لمر' }, { region: 'Hangu', pashto: 'نمر' }]);
    await word('moon', [{ region: 'Kohat' }]);
    await word('star', [{ region: 'Hangu', status: 'pending' }, { region: 'Kohat' }]);

    const res = await request.get('/api/concepts?region=Hangu');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['sun']);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].firstVariant.region).toBe('Hangu');
    expect(String(res.body.data[0].firstVariant._id)).toBe(String(sun[1]._id));
    expect(res.body.data[0].variantCount).toBe(2);
  });

  test('search applies the region too', async () => {
    await word('sun', [{ region: 'Kohat' }]);
    await word('sunrise', [{ region: 'Hangu' }]);
    const res = await request.get('/api/concepts/search?q=sun&region=Hangu');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.englishGloss)).toEqual(['sunrise']);
    expect(res.body.meta.total).toBe(1);
  });

  test('region combines with domain and pages correctly', async () => {
    for (let i = 0; i < 3; i += 1) await word(`word-${i}`, [{ region: 'Thal' }]);
    await word('elsewhere', [{ region: 'Kohat' }]);
    const res = await request.get('/api/concepts?region=Thal&limit=2&page=2');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual(expect.objectContaining({ page: 2, limit: 2, total: 3 }));
  });

  test('an unknown region is refused', async () => {
    const list = await request.get('/api/concepts?region=Atlantis');
    expect(list.status).toBe(400);
    expect(list.body.error.field).toBe('region');
    expect((await request.get('/api/concepts/search?q=sun&region=Atlantis')).status).toBe(400);
  });
});

describe('moreWordCount: other distinct written words on the card', () => {
  const W = (pashto, region, extra = {}) => ({ pashto, region, exact: true, ...extra });
  const countFor = async (url, gloss) => cardOf(await request.get(url), gloss).moreWordCount;

  test('the same word in two regions is one word, not more', async () => {
    await word('sun', [W('لمر', 'Kohat'), W('لمر', 'Hangu')]);
    expect(await countFor('/api/concepts', 'sun')).toBe(0);
  });

  test('spellings that normalize alike count as the same word', async () => {
    await word('sun', [W('لمر', 'Kohat'), W('لَمر', 'Hangu')]);
    expect(await countFor('/api/concepts', 'sun')).toBe(0);
  });

  test('two different words give one more', async () => {
    await word('sun', [W('لمر', 'Kohat'), W('نمر', 'Hangu')]);
    expect(await countFor('/api/concepts', 'sun')).toBe(1);
  });

  test('unfiltered, every region counts; variantCount still counts every regional row', async () => {
    await word('sun', [W('لمر', 'Kohat'), W('نمر', 'Hangu'), W('لمر', 'Hangu'), W('ښمر', 'Thal')]);
    const card = cardOf(await request.get('/api/concepts'), 'sun');
    expect(card.moreWordCount).toBe(2);
    expect(card.variantCount).toBe(4);
  });

  test('with a region filter, only distinct words from that region count, minus the word shown', async () => {
    await word('sun', [W('لمر', 'Kohat'), W('نمر', 'Hangu'), W('لمر', 'Hangu'), W('ښمر', 'Thal'), W('ځمر', 'Hangu')]);
    const card = cardOf(await request.get('/api/concepts?region=Hangu'), 'sun');
    expect(card.firstVariant.region).toBe('Hangu');
    expect(card.moreWordCount).toBe(2);
    expect(cardOf(await request.get('/api/concepts?region=Thal'), 'sun').moreWordCount).toBe(0);
  });

  test('search results carry it too, honouring the region', async () => {
    await word('sun', [W('لمر', 'Kohat'), W('نمر', 'Kohat'), W('ښمر', 'Hangu')]);
    expect(await countFor('/api/concepts/search?q=sun', 'sun')).toBe(2);
    expect(await countFor('/api/concepts/search?q=sun&region=Kohat', 'sun')).toBe(1);
  });

  test('deleted and unpublished words are ignored', async () => {
    await word('sun', [
      W('لمر', 'Kohat'),
      W('نمر', 'Hangu', { status: 'pending' }),
      W('ښمر', 'Thal', { status: 'approved' }),
      W('ځمر', 'Tirah', { status: 'rejected', isDeleted: true }),
      W('ګمر', 'Parachinar', { isDeleted: true }),
    ]);
    expect(await countFor('/api/concepts', 'sun')).toBe(0);
  });

  test('a concept with no published word has 0', async () => {
    await word('house', [W('کور', 'Kohat', { status: 'pending' })]);
    expect(await countFor('/api/concepts', 'house')).toBe(0);
  });
});
