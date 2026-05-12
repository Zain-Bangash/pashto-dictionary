/**
 * Health route tests.
 *
 * PREREQUISITE: server/src/index.js does not export `app`, so Supertest
 * cannot import it directly. This file reconstructs the minimal Express app
 * from its parts (the same way index.js does, minus mongoose.connect) so the
 * route can be tested in isolation.
 *
 * To allow importing index.js directly in future tests, add this line to
 * server/src/index.js BEFORE the mongoose.connect block:
 *   module.exports = app;
 */

const express = require('express');
const supertest = require('supertest');
const healthRouter = require('../routes/health');

const app = express();
app.use(express.json());
app.use('/api', healthRouter);

const request = supertest(app);

describe('GET /api/health', () => {
  test('returns HTTP 200', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
  });

  test('response envelope has success: true', async () => {
    const res = await request.get('/api/health');
    expect(res.body.success).toBe(true);
  });

  test('data.status is "ok"', async () => {
    const res = await request.get('/api/health');
    expect(res.body.data.status).toBe('ok');
  });

  test('data.timestamp is present and parseable as a date', async () => {
    const res = await request.get('/api/health');
    expect(res.body.data.timestamp).toBeDefined();
    expect(Number.isNaN(Date.parse(res.body.data.timestamp))).toBe(false);
  });
});
