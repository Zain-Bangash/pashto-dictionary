// GET /api/concepts/:id lists, per variant, the other published concepts the same written word belongs to

require('dotenv').config();

const express = require('express');
const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('express-async-errors');
const conceptsRouter = require('../routes/concepts');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');

const app = express();
app.use(express.json());
app.use('/api/concepts', conceptsRouter);

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
  await Promise.all([Concept.deleteMany({}), Variant.deleteMany({})]);
});

const concept = (englishGloss, status = 'published', extra = {}) =>
  Concept.create({ englishGloss, partOfSpeech: 'noun', status, ...extra });
const variant = (c, pashto, region = 'Kohat', status = 'published', extra = {}) =>
  Variant.create({ concept: c._id, pashto, region, definition: 'd', status, ...extra });

async function alsoMeansOf(c) {
  const res = await request.get(`/api/concepts/${c._id}`);
  expect(res.status).toBe(200);
  return res.body.data.variants[0].alsoMeans;
}

test('lists other published concepts that use the same word, with their regions', async () => {
  const wall = await concept('wall');
  const fence = await concept('fence');
  const side = await concept('side');
  await variant(wall, 'دېوال');
  await variant(fence, 'دېوال', 'Hangu');
  await variant(fence, 'دېوال', 'Tirah');
  await variant(side, 'دېوال');
  expect(await alsoMeansOf(wall)).toEqual([
    { conceptId: String(fence._id), englishGloss: 'fence', regions: ['Hangu', 'Tirah'] },
    { conceptId: String(side._id), englishGloss: 'side', regions: ['Kohat'] },
  ]);
});

test('matches spellings that differ only by vowel marks or keyboard look-alikes', async () => {
  const house = await concept('house');
  const room = await concept('room');
  await variant(house, 'کور');
  await variant(room, 'كَور');
  expect((await alsoMeansOf(house)).map((m) => m.englishGloss)).toEqual(['room']);
});

test('ignores unpublished or deleted variants and concepts', async () => {
  const house = await concept('house');
  await variant(house, 'کور');
  await variant(await concept('a'), 'کور', 'Kohat', 'pending');
  await variant(await concept('b'), 'کور', 'Kohat', 'published', { isDeleted: true });
  await variant(await concept('c', 'approved'), 'کور');
  await variant(await concept('d', 'published', { isDeleted: true }), 'کور');
  expect(await alsoMeansOf(house)).toEqual([]);
});

test('other regions of the same concept are not listed', async () => {
  const house = await concept('house');
  await variant(house, 'کور');
  await variant(house, 'کور', 'Hangu');
  const res = await request.get(`/api/concepts/${house._id}`);
  for (const v of res.body.data.variants) expect(v.alsoMeans).toEqual([]);
});
