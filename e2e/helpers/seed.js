'use strict';

const API = 'http://localhost:5000';

async function getAdminToken(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: 'e2e-admin@test.local', password: 'E2ePassword1!' },
  });
  const body = await res.json();
  return body.data.token;
}

/**
 * Creates a concept and transitions it all the way to published.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} adminToken
 * @param {string} [gloss]
 * @returns {Promise<Object>} The concept document returned by POST /api/concepts
 */
async function createPublishedConcept(request, adminToken, gloss = 'e2e-word') {
  const createRes = await request.post(`${API}/api/concepts`, {
    data: { englishGloss: gloss, partOfSpeech: 'noun' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { data: concept } = await createRes.json();

  await request.patch(`${API}/api/concepts/${concept._id}/status`, {
    data: { status: 'approved' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  await request.patch(`${API}/api/concepts/${concept._id}/status`, {
    data: { status: 'published' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  return concept;
}

/**
 * Creates a variant and transitions it all the way to published.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} adminToken
 * @param {string} conceptId
 * @param {Object} [overrides]
 * @returns {Promise<Object>} The variant document returned by POST /api/variants
 */
async function createPublishedVariant(request, adminToken, conceptId, overrides = {}) {
  const defaults = {
    conceptId,
    pashto: 'خور',
    phonetic: 'khor',
    region: 'Kohat',
    definition: 'sister',
  };
  const data = { ...defaults, ...overrides };

  const createRes = await request.post(`${API}/api/variants`, {
    data,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { data: variant } = await createRes.json();

  await request.patch(`${API}/api/variants/${variant._id}/status`, {
    data: { status: 'approved' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  await request.patch(`${API}/api/variants/${variant._id}/status`, {
    data: { status: 'published' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  return variant;
}

async function getModToken(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: 'e2e-mod@test.local', password: 'E2ePassword1!' },
  });
  const body = await res.json();
  return body.data.token;
}

async function getUserToken(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: 'e2e-user@test.local', password: 'E2ePassword1!' },
  });
  const body = await res.json();
  return body.data.token;
}

/**
 * Creates a pending concept submitted by the given token-holder.
 */
async function createPendingConcept(request, token, gloss) {
  const res = await request.post(`${API}/api/concepts`, {
    data: { englishGloss: gloss, partOfSpeech: 'noun' },
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await res.json();
  return data;
}

/**
 * Creates a pending variant submitted by the given token-holder.
 */
async function createPendingVariant(request, token, conceptId, overrides = {}) {
  const defaults = {
    conceptId,
    pashto: 'خور',
    phonetic: 'khor',
    region: 'Kohat',
    definition: 'sister (e2e pending)',
  };
  const res = await request.post(`${API}/api/variants`, {
    data: { ...defaults, ...overrides },
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await res.json();
  return data;
}

/**
 * Creates a concept and transitions it to approved (stops before published).
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} adminToken
 * @param {string} [gloss]
 * @returns {Promise<Object>} The concept document returned by POST /api/concepts
 */
async function createApprovedConcept(request, adminToken, gloss = 'e2e-approved-concept') {
  const createRes = await request.post(`${API}/api/concepts`, {
    data: { englishGloss: gloss, partOfSpeech: 'noun' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { data: concept } = await createRes.json();

  await request.patch(`${API}/api/concepts/${concept._id}/status`, {
    data: { status: 'approved' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  return concept;
}

/**
 * Creates a variant and transitions it to approved (stops before published).
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} adminToken
 * @param {string} conceptId
 * @param {Object} [overrides]
 * @returns {Promise<Object>} The variant document returned by POST /api/variants
 */
async function createApprovedVariant(request, adminToken, conceptId, overrides = {}) {
  const defaults = {
    conceptId,
    pashto: 'خور',
    phonetic: 'khor',
    region: 'Kohat',
    definition: 'sister',
  };
  const data = { ...defaults, ...overrides };

  const createRes = await request.post(`${API}/api/variants`, {
    data,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { data: variant } = await createRes.json();

  await request.patch(`${API}/api/variants/${variant._id}/status`, {
    data: { status: 'approved' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  return variant;
}

module.exports = {
  getAdminToken,
  getModToken,
  getUserToken,
  createPublishedConcept,
  createPublishedVariant,
  createApprovedConcept,
  createApprovedVariant,
  createPendingConcept,
  createPendingVariant,
};
