'use strict';

const { test, expect } = require('@playwright/test');
const {
  getAdminToken,
  getModToken,
  createPublishedConcept,
  createPublishedVariant,
} = require('../helpers/seed.js');

const API = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Block 1 — Search normalisation (UI)
// Verifies that the search index is case-insensitive and supports partial
// phonetic matching so users find words regardless of how they type them.
// ---------------------------------------------------------------------------

test.describe('Integrity — search normalisation', () => {
  // serial mode: forces a single worker so beforeAll runs exactly once and
  // avoids a second worker racing to create the same concept with a 409.
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let concept;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminToken(request);
    // Use a unique E2E-prefixed gloss with mixed case so it never collides with
    // live dictionary data, while still letting us prove case-insensitive search.
    concept = await createPublishedConcept(request, adminToken, 'e2e-NormCase');
    await createPublishedVariant(request, adminToken, concept._id, {
      pashto: 'مینه',
      phonetic: 'meena',
      region: 'Kohat',
      definition: 'normalisation test (e2e integrity)',
    });
  });

  // Exact-case gloss match — baseline to confirm seeding worked.
  test('exact-case gloss returns the concept card', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Search Pashto words…').fill('e2e-NormCase');
    await page.getByPlaceholder('Search Pashto words…').press('Enter');
    await expect(page).toHaveURL(/\/concepts\?q=e2e-NormCase/);
    await expect(page.getByText(concept.englishGloss, { exact: true })).toBeVisible();
  });

  // Lowercase query must match a mixed-case gloss — search must be case-insensitive.
  test('lowercase query returns the concept card', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Search Pashto words…').fill('e2e-normcase');
    await page.getByPlaceholder('Search Pashto words…').press('Enter');
    await expect(page).toHaveURL(/\/concepts\?q=e2e-normcase/);
    await expect(page.getByText(concept.englishGloss, { exact: true })).toBeVisible();
  });

  // All-caps query must also match — search normalisation goes both directions.
  test('all-caps query returns the concept card', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Search Pashto words…').fill('E2E-NORMCASE');
    await page.getByPlaceholder('Search Pashto words…').press('Enter');
    await expect(page).toHaveURL(/\/concepts\?q=E2E-NORMCASE/);
    await expect(page.getByText(concept.englishGloss, { exact: true })).toBeVisible();
  });

  // Partial phonetic prefix must surface the concept — 'meen' is a prefix of 'meena'.
  test('partial phonetic "meen" returns the concept card', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Search Pashto words…').fill('meen');
    await page.getByPlaceholder('Search Pashto words…').press('Enter');
    await expect(page).toHaveURL(/\/concepts\?q=meen/);
    await expect(page.getByText(concept.englishGloss, { exact: true })).toBeVisible();
  });

  // Full phonetic match must return the concept — verifies phonetic field is indexed.
  test('full phonetic "meena" returns the concept card', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Search Pashto words…').fill('meena');
    await page.getByPlaceholder('Search Pashto words…').press('Enter');
    await expect(page).toHaveURL(/\/concepts\?q=meena/);
    await expect(page.getByText(concept.englishGloss, { exact: true })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Block 2 — Soft-delete visibility (API + browser)
// Verifies that deleted concepts and variants are invisible in every surface
// where a guest could encounter them, preserving data integrity for readers.
// ---------------------------------------------------------------------------

test.describe('Integrity — soft-delete visibility', () => {
  let adminToken;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminToken(request);
  });

  // A deleted concept must disappear from the browse list — guests must not see
  // ghost entries after an admin removes a word.
  test('deleted concept is absent from /concepts browse page', async ({ page, request }) => {
    const concept = await createPublishedConcept(request, adminToken, 'e2e-deleted-browse');
    await request.delete(`${API}/api/concepts/${concept._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    await page.goto('/concepts');
    await expect(page.getByText(concept.englishGloss)).not.toBeVisible();
  });

  // A deleted concept must not appear in search results — ensures the search index
  // is updated (or filtered) on delete and not just the browse list.
  test('deleted concept is absent from search results', async ({ page, request }) => {
    const concept = await createPublishedConcept(request, adminToken, 'e2e-deleted-search');
    await request.delete(`${API}/api/concepts/${concept._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    await page.goto(`/concepts?q=${encodeURIComponent(concept.englishGloss)}`);
    await expect(page.getByText(concept.englishGloss)).not.toBeVisible();
  });

  // Navigating directly to a deleted concept's URL must render the not-found state —
  // guards against bookmarked or shared links surfacing deleted content.
  test('navigating directly to a deleted concept URL renders "Entry not found."', async ({ page, request }) => {
    const concept = await createPublishedConcept(request, adminToken, 'e2e-deleted-direct');
    await request.delete(`${API}/api/concepts/${concept._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    await page.goto(`/concepts/${concept._id}`);
    await expect(page.getByText('Entry not found.')).toBeVisible();
  });

  // A deleted variant's region tab must vanish from the detail page while a sibling
  // variant's tab remains — partial deletes must not break the whole concept view.
  test('deleted variant tab is absent; surviving sibling tab remains', async ({ page, request }) => {
    const concept = await createPublishedConcept(request, adminToken, 'e2e-variant-delete');

    const kohatVariant = await createPublishedVariant(request, adminToken, concept._id, {
      pashto: 'ورور',
      phonetic: 'wror-kohat',
      region: 'Kohat',
      definition: 'brother - Kohat (e2e)',
    });
    await createPublishedVariant(request, adminToken, concept._id, {
      pashto: 'ورور',
      phonetic: 'wror-hangu',
      region: 'Hangu',
      definition: 'brother - Hangu (e2e)',
    });

    // Delete only the Kohat variant.
    await request.delete(`${API}/api/variants/${kohatVariant._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    await page.goto(`/concepts/${concept._id}`);

    // The deleted region tab must not be present.
    await expect(page.getByRole('button', { name: 'Kohat' })).not.toBeVisible();

    // The surviving region tab must still be present.
    await expect(page.getByRole('button', { name: 'Hangu' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Block 3 — Moderator self-approval restriction (request fixture)
// Verifies the business rule that a moderator cannot approve their own
// submissions, preventing a conflict-of-interest bypass in the moderation flow.
// ---------------------------------------------------------------------------

test.describe('Integrity — moderator self-approval restriction', () => {
  let adminToken;
  let modToken;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminToken(request);
    modToken = await getModToken(request);
  });

  // A mod who submits a concept must be blocked from approving it themselves —
  // the server enforces the four-eyes principle at the API level.
  test('mod cannot approve a concept they submitted — returns 403', async ({ request }) => {
    // Mod submits the concept so submittedBy === mod's user ID.
    const createRes = await request.post(`${API}/api/concepts`, {
      data: { englishGloss: 'e2e-self-approve-concept', partOfSpeech: 'noun' },
      headers: { Authorization: `Bearer ${modToken}` },
    });
    const { data: concept } = await createRes.json();

    // Mod then tries to approve their own submission.
    const approveRes = await request.patch(`${API}/api/concepts/${concept._id}/status`, {
      data: { status: 'approved' },
      headers: { Authorization: `Bearer ${modToken}` },
    });

    expect(approveRes.status()).toBe(403);
    const body = await approveRes.json();
    expect(body.error.message).toBe('Moderators cannot approve or reject their own submissions');
  });

  // Same restriction must apply to variants — a mod cannot short-circuit review
  // by submitting and immediately approving a variant.
  test('mod cannot approve a variant they submitted — returns 403', async ({ request }) => {
    // Admin creates and publishes the parent concept so the mod has a valid conceptId.
    const concept = await createPublishedConcept(request, adminToken, 'e2e-self-approve-variant-parent');

    // Mod submits the variant.
    const createRes = await request.post(`${API}/api/variants`, {
      data: {
        conceptId: concept._id,
        pashto: 'غر',
        phonetic: 'ghar',
        region: 'Kohat',
        definition: 'mountain (e2e self-approve)',
      },
      headers: { Authorization: `Bearer ${modToken}` },
    });
    const { data: variant } = await createRes.json();

    // Mod then tries to approve their own variant.
    const approveRes = await request.patch(`${API}/api/variants/${variant._id}/status`, {
      data: { status: 'approved' },
      headers: { Authorization: `Bearer ${modToken}` },
    });

    expect(approveRes.status()).toBe(403);
    const body = await approveRes.json();
    expect(body.error.message).toBe('Moderators cannot approve or reject their own submissions');
  });

  // Admin submitting and approving their own concept must succeed — the restriction
  // applies only to the moderator role, not to admins.
  test('admin can approve a concept they submitted — returns 200', async ({ request }) => {
    const createRes = await request.post(`${API}/api/concepts`, {
      data: { englishGloss: 'e2e-admin-self-approve', partOfSpeech: 'noun' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { data: concept } = await createRes.json();

    const approveRes = await request.patch(`${API}/api/concepts/${concept._id}/status`, {
      data: { status: 'approved' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(approveRes.status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Block 4 — Duplicate prevention (request fixture)
// Verifies the uniqueness constraints so the dictionary stays clean: one
// canonical entry per English gloss, and one variant per Pashto+region pair.
// ---------------------------------------------------------------------------

test.describe('Integrity — duplicate prevention', () => {
  let adminToken;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminToken(request);
  });

  // First submission of a new gloss must succeed — confirms the baseline works.
  test('first POST of concept "Duplicate Test" returns 201', async ({ request }) => {
    const res = await request.post(`${API}/api/concepts`, {
      data: { englishGloss: 'Duplicate Test', partOfSpeech: 'noun' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(201);
  });

  // Exact-case duplicate must be rejected — prevents twin entries for the same word.
  test('second POST of same gloss "duplicate test" (lowercase) returns 409', async ({ request }) => {
    const res = await request.post(`${API}/api/concepts`, {
      data: { englishGloss: 'duplicate test', partOfSpeech: 'noun' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(409);
  });

  // Padded gloss must also be rejected — whitespace trimming must happen before
  // the uniqueness check so users cannot sneak in near-duplicates.
  test('POST of padded gloss "  Duplicate Test  " returns 409', async ({ request }) => {
    const res = await request.post(`${API}/api/concepts`, {
      data: { englishGloss: '  Duplicate Test  ', partOfSpeech: 'noun' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(409);
  });

  // First variant for a Pashto+region combination must succeed — baseline check.
  test('first POST of variant pashto "آب" + Kohat returns 201', async ({ request }) => {
    // Create a fresh parent concept for the variant duplicate tests.
    const conceptRes = await request.post(`${API}/api/concepts`, {
      data: { englishGloss: 'e2e-variant-dup-parent', partOfSpeech: 'noun' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { data: concept } = await conceptRes.json();

    // Store the concept ID on the test context via a shared variable.
    // Playwright test.describe blocks share the outer scope, so we attach it
    // to a module-level variable scoped to this describe block.
    variantDupConceptId = concept._id;

    const res = await request.post(`${API}/api/variants`, {
      data: {
        conceptId: concept._id,
        pashto: 'آب',
        phonetic: 'aab',
        region: 'Kohat',
        definition: 'water (e2e dup)',
      },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(201);
  });

  // Identical Pashto+region under the same concept must be rejected — prevents
  // the same regional variant being submitted multiple times.
  test('second POST of same pashto "آب" + Kohat under same concept returns 409', async ({ request }) => {
    const res = await request.post(`${API}/api/variants`, {
      data: {
        conceptId: variantDupConceptId,
        pashto: 'آب',
        phonetic: 'aab-dup',
        region: 'Kohat',
        definition: 'water duplicate (e2e)',
      },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(409);
  });

  // Same Pashto word in a different region must be allowed — regional variation
  // is the entire point of the dictionary.
  test('POST of same pashto "آب" with region Hangu returns 201', async ({ request }) => {
    const res = await request.post(`${API}/api/variants`, {
      data: {
        conceptId: variantDupConceptId,
        pashto: 'آب',
        phonetic: 'aab-hangu',
        region: 'Hangu',
        definition: 'water - Hangu (e2e)',
      },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(201);
  });
});

// Module-level variable shared across the variant duplicate tests within Block 4.
// Declared outside all describe/test blocks so the sequential tests can pass
// the concept ID from the "first POST" test to the two that follow it.
let variantDupConceptId;
