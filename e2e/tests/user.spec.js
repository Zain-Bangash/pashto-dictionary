'use strict';

/**
 * E2E tests for the User section of USER-FLOWS.md.
 *
 * Flows covered:
 *   1. 2-step submit: new concept + variant (no autocomplete match)
 *   2. 2-step submit: select existing concept via autocomplete
 *   3. "+ I also say this in my region" shortcut pre-fills Step 2
 *   4. My Submissions — pending status badge visible
 *   5. Rejection reason visible to submitter in My Submissions
 *   6. Duplicate concept gloss → 409 inline error, page stays on Step 1
 *   7. Duplicate variant (same Pashto + region) → inline error on /submit
 *   8. Moderator note in Step 2 — visible in queue as "Submitter note", hidden on public page
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth.js');
const {
  getAdminToken,
  getUserToken,
  getModToken,
  createPublishedConcept,
  createPublishedVariant,
  createPendingConcept,
} = require('../helpers/seed.js');

const API = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Retry helper — absorbs transient ECONNRESET when the server is warming up
// ---------------------------------------------------------------------------
async function withRetry(fn, retries = 3, delayMs = 1500) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Flow 1 — 2-step submit: new concept + variant (no autocomplete match)
// ---------------------------------------------------------------------------

test.describe('User — submit new concept + variant (no autocomplete match)', () => {
  // Each run uses a timestamp-unique gloss so parallel runs never collide.
  // The @test.local teardown cleans seeded data by email; concepts/variants
  // created via the UI are linked to the seeded user account which is wiped.
  const gloss = `e2e-submit-new-${Date.now()}`;

  test('types a unique gloss, clicks Create new concept, fills Step 2, and lands on My Submissions with pending badge', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/submit');

    // ---- Step 1: type a gloss that has no existing match ----
    await page.getByLabel('English Meaning').fill(gloss);

    // The autocomplete list should NOT appear (nothing matches the unique gloss).
    // The standalone "Create new concept" button is shown when glossQuery is set
    // and suggestions are empty.
    const createBtn = page.getByRole('button', { name: `+ Create new concept "${gloss}"` });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // ---- Step 2: concept summary panel shows the gloss ----
    await expect(page.getByText(gloss)).toBeVisible();

    // Part of speech selector is required when creating a new concept
    await page.getByLabel('Part of Speech').selectOption('noun');

    // Pashto word
    await page.getByLabel('Pashto Word').fill('ورور');

    // Phonetic (optional but we fill it)
    await page.getByLabel('Phonetic (optional)').fill('wror');

    // Region dropdown
    await page.getByLabel('Region').selectOption('Kohat');

    // Definition
    await page.getByLabel('Definition').fill('brother (e2e new concept)');

    // Submit
    await page.getByRole('button', { name: 'Submit Word' }).click();

    // After a successful submission the app navigates to /my-submissions
    await expect(page).toHaveURL('/my-submissions', { timeout: 12000 });
    await expect(page.getByRole('heading', { name: 'My Submissions' })).toBeVisible();

    // The submitted concept gloss must appear with a "pending" badge
    await expect(page.getByText(gloss)).toBeVisible({ timeout: 10000 });
    const card = page.locator('li').filter({ hasText: gloss });
    await expect(card.getByText('pending')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 2 — 2-step submit: select existing concept via autocomplete
// ---------------------------------------------------------------------------

test.describe('User — submit variant for existing concept via autocomplete', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let existingConcept;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    existingConcept = await createPublishedConcept(
      request,
      adminToken,
      'e2e-submit-existing'
    );
  });

  test('types partial gloss, selects concept from autocomplete, fills Step 2, lands on My Submissions with pending badge', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/submit');

    // ---- Step 1: type a partial gloss to trigger autocomplete ----
    await page.getByLabel('English Meaning').fill('e2e-submit-exist');

    // The autocomplete dropdown must appear with the seeded concept
    const suggestion = page.getByRole('button', { name: existingConcept.englishGloss });
    await expect(suggestion).toBeVisible({ timeout: 10000 });

    // Click the existing concept suggestion to select it and advance to Step 2
    await suggestion.click();

    // ---- Step 2: concept summary panel shows the chosen gloss ----
    await expect(page.getByText(existingConcept.englishGloss)).toBeVisible();

    // There should be NO Part of Speech selector for an existing concept
    await expect(page.getByLabel('Part of Speech')).not.toBeVisible();

    // Fill the variant fields
    await page.getByLabel('Pashto Word').fill('وروره');
    await page.getByLabel('Phonetic (optional)').fill('wrora');
    await page.getByLabel('Region').selectOption('Hangu');
    await page.getByLabel('Definition').fill('brother (e2e existing concept variant)');

    // Submit
    await page.getByRole('button', { name: 'Submit Word' }).click();

    // Redirected to My Submissions
    await expect(page).toHaveURL('/my-submissions', { timeout: 12000 });
    await expect(page.getByRole('heading', { name: 'My Submissions' })).toBeVisible();

    // The variant definition appears with a pending badge (variants section)
    await expect(page.getByText('brother (e2e existing concept variant)')).toBeVisible({ timeout: 10000 });
    const card = page.locator('li').filter({ hasText: 'brother (e2e existing concept variant)' });
    await expect(card.getByText('pending')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 3 — "+ I also say this in my region" pre-fills Step 2
// ---------------------------------------------------------------------------

test.describe('User — "+ I also say this in my region" shortcut pre-fills the Submit form', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let concept;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    concept = await createPublishedConcept(request, adminToken, 'e2e-also-say-concept');
    await createPublishedVariant(request, adminToken, concept._id, {
      pashto: 'لمر',
      phonetic: 'lmar',
      region: 'Kohat',
      definition: 'sun (e2e also-say)',
    });
  });

  test('clicking the button while logged in navigates to /submit with concept pre-selected and pashto pre-filled', async ({ page }) => {
    // Log in first so the button navigates to /submit rather than /login
    await loginAs(page, 'user');
    await page.goto(`/concepts/${concept._id}`);

    // The "+ I also say this in my region" button must be visible on the variant card
    const alsoSayBtn = page.getByRole('button', { name: '+ I also say this in my region' }).first();
    await expect(alsoSayBtn).toBeVisible({ timeout: 10000 });
    await alsoSayBtn.click();

    // Must land on /submit (with query params) — the URL contains the conceptId
    await expect(page).toHaveURL(new RegExp(`/submit\\?.*conceptId=${concept._id}`), { timeout: 10000 });

    // The Submit form should be on Step 2 with the concept summary visible
    await expect(page.getByText(concept.englishGloss)).toBeVisible({ timeout: 10000 });

    // The Pashto word from the variant card must be pre-filled
    const pashtoInput = page.getByLabel('Pashto Word');
    await expect(pashtoInput).toHaveValue('لمر');

    // Step indicator: step 2 marker should be active (gold colour class applied)
    // We verify this indirectly by confirming the Part of Speech field is NOT shown
    // (it only appears in Step 2 when creating a new concept, not for existing ones).
    await expect(page.getByLabel('Part of Speech')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 4 — My Submissions: pending status badge visible
// ---------------------------------------------------------------------------

test.describe('User — My Submissions shows pending badge for submitted concept', () => {
  test.describe.configure({ mode: 'serial' });

  let userToken;
  let pendingConcept;

  test.beforeAll(async ({ request }) => {
    userToken = await withRetry(() => getUserToken(request));
    pendingConcept = await createPendingConcept(
      request,
      userToken,
      `e2e-my-sub-pending-${Date.now()}`
    );
  });

  test('navigating to /my-submissions shows the pending concept with a pending badge', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/my-submissions');

    await expect(page.getByRole('heading', { name: 'My Submissions' })).toBeVisible();

    // The seeded concept gloss must appear
    await expect(page.getByText(pendingConcept.englishGloss)).toBeVisible({ timeout: 10000 });

    // Its status badge must read "pending" (exact match avoids matching the gloss substring)
    const card = page.locator('li').filter({ hasText: pendingConcept.englishGloss });
    await expect(card.getByText('pending', { exact: true })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 5 — Rejection reason visible to submitter in My Submissions
// ---------------------------------------------------------------------------

test.describe('User — rejected concept shows rejection note in My Submissions', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let userToken;
  let pendingConcept;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    userToken  = await withRetry(() => getUserToken(request));

    // Create a pending concept as the user so it appears in their My Submissions
    pendingConcept = await createPendingConcept(
      request,
      userToken,
      `e2e-reject-visible-${Date.now()}`
    );

    // Reject it via the API as an admin — the field name the server expects is "moderatorNote"
    await request.patch(`${API}/api/concepts/${pendingConcept._id}/status`, {
      data: { status: 'rejected', moderatorNote: 'e2e rejection reason' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  });

  test('submitter sees rejected badge and the rejection note text in My Submissions', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/my-submissions');

    // The concept gloss must appear
    await expect(page.getByText(pendingConcept.englishGloss)).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: pendingConcept.englishGloss });

    // Status badge must read "rejected" (exact match to avoid false positives)
    await expect(card.getByText('rejected', { exact: true })).toBeVisible({ timeout: 8000 });

    // The rejection note must be rendered (as "Note: e2e rejection reason")
    await expect(card.getByText('e2e rejection reason', { exact: false })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 6 — Duplicate concept gloss → 409 inline error, stays on Step 1
// ---------------------------------------------------------------------------

test.describe('User — duplicate concept gloss shows inline error and stays on Step 1', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let dupConcept;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    dupConcept = await createPublishedConcept(request, adminToken, 'e2e-dup-concept');
  });

  test('typing the exact duplicate gloss and attempting to proceed shows an "already exists" error on Step 1', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/submit');

    // Type the exact gloss that already exists — autocomplete will surface it as a suggestion,
    // but we skip selection and instead click the "+ Create new concept" option (which
    // triggers the server 409 when createConcept is called during form submission in Step 2).
    //
    // However, per the Submit.jsx flow, clicking an autocomplete suggestion immediately
    // moves to Step 2 using the existing concept — no duplicate. The 409 only fires when
    // the user clicks "+ Create new concept" for a gloss that already exists.
    //
    // We test this by: filling the exact gloss, waiting for autocomplete to appear,
    // then clicking the "+ Create new concept" option at the bottom of the suggestion list.
    await page.getByLabel('English Meaning').fill(dupConcept.englishGloss);

    // Wait for the autocomplete suggestion list to appear
    const existingSuggestion = page.getByRole('button', { name: dupConcept.englishGloss });
    await expect(existingSuggestion).toBeVisible({ timeout: 10000 });

    // Click "+ Create new concept" from the bottom of the suggestion list
    const createNewBtn = page.getByRole('button', { name: `+ Create new concept "${dupConcept.englishGloss}"` });
    await expect(createNewBtn).toBeVisible();
    await createNewBtn.click();

    // Now on Step 2 with the duplicate gloss and "creating new" mode
    await expect(page.getByText(dupConcept.englishGloss)).toBeVisible();

    // Fill required Step 2 fields and submit — this triggers the 409 from the server
    await page.getByLabel('Part of Speech').selectOption('noun');
    await page.getByLabel('Pashto Word').fill('نور');
    await page.getByLabel('Region').selectOption('Tirah');
    await page.getByLabel('Definition').fill('other (e2e dup test)');

    await page.getByRole('button', { name: 'Submit Word' }).click();

    // The 409 error message must appear inline — "already exists" is in the server message
    await expect(
      page.getByText('already exists', { exact: false })
    ).toBeVisible({ timeout: 10000 });

    // Must NOT navigate away — the user stays on /submit
    await expect(page).toHaveURL('/submit');
  });
});

// ---------------------------------------------------------------------------
// Flow 7 — Duplicate variant (same Pashto + region) shows inline error on /submit
//
// USER-FLOWS.md: "As a user I should not be able to submit a variant with the
// same Pashto word and region under the same concept — the server rejects it
// with a clear message. However, the same Pashto word from a different region
// is allowed."
// integrity.spec.js covers the API; this covers the browser-level UI flow.
// ---------------------------------------------------------------------------

test.describe('User — duplicate variant shows inline error on /submit', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let concept;

  // ASCII value avoids Unicode codepoint ambiguity between test runs.
  const DUP_PASHTO = 'e2e-kalay-dup';

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    // Unique gloss prevents collision when the suite is re-run without a clean.
    concept = await createPublishedConcept(
      request, adminToken, `e2e-dup-variant-ui-${Date.now()}`
    );
  });

  test('first submission of a new variant succeeds and navigates to /my-submissions', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/submit');

    await page.getByLabel('English Meaning').fill(concept.englishGloss);
    // exact: true prevents matching the "+ Create new concept" button whose text also contains the gloss
    const suggestion = page.getByRole('button', { name: concept.englishGloss + 'noun', exact: true });
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await suggestion.click();

    await page.getByLabel('Pashto Word').fill(DUP_PASHTO);
    await page.getByLabel('Region').selectOption('Kohat');
    await page.getByLabel('Definition').fill('village (e2e dup first)');

    await page.getByRole('button', { name: 'Submit Word' }).click();

    await expect(page).toHaveURL('/my-submissions', { timeout: 12000 });
  });

  test('submitting the same Pashto word + region shows a server error and stays on /submit', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/submit');

    await page.getByLabel('English Meaning').fill(concept.englishGloss);
    const suggestion = page.getByRole('button', { name: concept.englishGloss, exact: true });
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await suggestion.click();

    // Exact same pashto + region as the first test — server must return 409
    await page.getByLabel('Pashto Word').fill(DUP_PASHTO);
    await page.getByLabel('Region').selectOption('Kohat');
    await page.getByLabel('Definition').fill('village (e2e dup attempt)');

    await page.getByRole('button', { name: 'Submit Word' }).click();

    await expect(
      page.getByText('already exists', { exact: false })
    ).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveURL('/submit');
  });

  test('same Pashto word with a different region succeeds — regional variation is allowed', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/submit');

    await page.getByLabel('English Meaning').fill(concept.englishGloss);
    const suggestion = page.getByRole('button', { name: concept.englishGloss, exact: true });
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await suggestion.click();

    await page.getByLabel('Pashto Word').fill(DUP_PASHTO);
    await page.getByLabel('Region').selectOption('Hangu');
    await page.getByLabel('Definition').fill('village - Hangu (e2e dup different region)');

    await page.getByRole('button', { name: 'Submit Word' }).click();

    await expect(page).toHaveURL('/my-submissions', { timeout: 12000 });
  });
});

// ---------------------------------------------------------------------------
// Flow 8 — Moderator note in Step 2: visible in queue, hidden on public page
//
// USER-FLOWS.md: "As a user, in Step 2 of the Submit form, I can optionally
// add a note to the moderators… This note is visible to moderators and admins
// in the moderation queue but is not shown on the public concept detail page."
//
// The note field label is "Note to moderators (optional)" (id: submissionNote).
// In DashboardQueue the note appears under a "Submitter note" heading on the
// variant card. The submissionNote is attached to the variant, not the concept.
// ---------------------------------------------------------------------------

test.describe('User — moderator note in Step 2 is visible in queue and hidden on public page', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let submittedGloss;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    submittedGloss = `e2e-modnote-${Date.now()}`;
  });

  test('Step 2 of the Submit form has a "Note to moderators (optional)" textarea', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/submit');

    await page.getByLabel('English Meaning').fill(submittedGloss);

    const createBtn = page.getByRole('button', { name: `+ Create new concept "${submittedGloss}"` });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // The note textarea must be visible in Step 2 before any submission
    await expect(
      page.getByLabel('Note to moderators (optional)')
    ).toBeVisible({ timeout: 8000 });
  });

  test('submitted note appears in the moderation queue under "Submitter note"', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/submit');

    await page.getByLabel('English Meaning').fill(submittedGloss);

    const createBtn = page.getByRole('button', { name: `+ Create new concept "${submittedGloss}"` });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Fill required Step 2 fields
    await page.getByLabel('Part of Speech').selectOption('noun');
    await page.getByLabel('Pashto Word').fill('سفر');
    await page.getByLabel('Phonetic (optional)').fill('safar-note');
    await page.getByLabel('Region').selectOption('Kohat');
    await page.getByLabel('Definition').fill('journey (e2e note test)');

    // Fill the moderator note
    await page.getByLabel('Note to moderators (optional)').fill('e2e reference: Ibn Battuta vol.2 p.17');

    await page.getByRole('button', { name: 'Submit Word' }).click();
    await expect(page).toHaveURL('/my-submissions', { timeout: 12000 });

    // Check the queue as moderator — note attaches to the variant, not the concept
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();
    await expect(page.getByText('safar-note')).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'safar-note' });
    await expect(card.getByText('Submitter note')).toBeVisible();
    await expect(card.getByText('Ibn Battuta vol.2 p.17', { exact: false })).toBeVisible();
  });

  test('the note is not visible on the public concept detail page after publishing', async ({ page, request }) => {
    const adminTok = await withRetry(() => getAdminToken(request));
    const gloss = `e2e-note-public-${Date.now()}`;

    const createRes = await request.post(`${API}/api/concepts`, {
      data: { englishGloss: gloss, partOfSpeech: 'noun' },
      headers: { Authorization: `Bearer ${adminTok}` },
    });
    const { data: concept } = await createRes.json();

    const varRes = await request.post(`${API}/api/variants`, {
      data: {
        conceptId: concept._id,
        pashto:    'باران',
        phonetic:  'baran',
        region:    'Kohat',
        definition: 'rain (e2e note public test)',
        submissionNote: 'e2e secret reference — must not appear publicly',
      },
      headers: { Authorization: `Bearer ${adminTok}` },
    });
    const { data: variant } = await varRes.json();

    // Publish concept and variant
    for (const [resource, id] of [['concepts', concept._id], ['variants', variant._id]]) {
      await request.patch(`${API}/api/${resource}/${id}/status`, {
        data: { status: 'approved' },
        headers: { Authorization: `Bearer ${adminTok}` },
      });
      await request.patch(`${API}/api/${resource}/${id}/status`, {
        data: { status: 'published' },
        headers: { Authorization: `Bearer ${adminTok}` },
      });
    }

    // Visit as a guest — the note must not be visible
    await page.goto(`/concepts/${concept._id}`);
    await expect(page.getByText(gloss)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText('e2e secret reference — must not appear publicly')
    ).not.toBeVisible();
  });
});
