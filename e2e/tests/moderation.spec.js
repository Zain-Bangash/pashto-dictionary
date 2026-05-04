'use strict';

/**
 * Phase 9.5 — E2E tests for four new moderation flows:
 *   1. Rejection note — moderator rejects, submitter sees the reason in My Submissions
 *   2. Admin edits a variant field (pashto) via the inline form; log shows "edited"
 *   3. Admin reassigns a variant to a different concept; public detail page updates
 *   4. Mod merges a duplicate concept; source disappears, variants land on target
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth.js');
const {
  getAdminToken,
  getModToken,
  getUserToken,
  createPublishedConcept,
  createPublishedVariant,
  createPendingConcept,
  createPendingVariant,
} = require('../helpers/seed.js');

const API = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Retry helper — wraps a token-fetch in a simple retry loop so a transient
// ECONNRESET at the start of a test run does not immediately fail beforeAll.
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
// Flow 1 — Rejection note: mod rejects, submitter sees reason
// ---------------------------------------------------------------------------

test.describe('Phase 9.5 — Rejection note visible to submitter', () => {
  test.describe.configure({ mode: 'serial' });

  let userToken;
  let pendingConcept;

  test.beforeAll(async ({ request }) => {
    // Wrap in retry to absorb transient ECONNRESET when the server is warming up.
    userToken = await withRetry(() => getUserToken(request));

    // The regular user submits the concept so they are its submittedBy owner.
    pendingConcept = await createPendingConcept(
      request,
      userToken,
      'e2e-reject-note-concept'
    );
  });

  test('mod opens Reject modal, types a reason, and confirms', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    // Wait for the queue to load — the pending concept gloss should appear.
    await expect(page.getByText(pendingConcept.englishGloss)).toBeVisible({ timeout: 10000 });

    // Click Reject on that concept's card.
    const card = page.locator('li').filter({ hasText: pendingConcept.englishGloss });
    await card.getByRole('button', { name: 'Reject' }).click();

    // The rejection modal must appear.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Rejection Reason')).toBeVisible();

    // The Confirm button must be disabled while the textarea is empty.
    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: 'Confirm' });
    await expect(confirmBtn).toBeDisabled();

    // Type a rejection reason.
    await page.getByLabel('Reason for rejection').fill('e2e rejection reason — not a real word');

    // Confirm is now enabled.
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // The modal should close.
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // The rejected concept card must vanish from the pending queue.
    await expect(page.getByText(pendingConcept.englishGloss)).not.toBeVisible();
  });

  test('submitter sees the rejection reason in My Submissions', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/my-submissions');

    // The concept gloss must appear.
    await expect(page.getByText(pendingConcept.englishGloss)).toBeVisible({ timeout: 10000 });

    // The rejection note must be rendered beneath the card.
    await expect(page.getByText('e2e rejection reason — not a real word')).toBeVisible();

    // The status badge must show "rejected".
    const card = page.locator('li').filter({ hasText: pendingConcept.englishGloss });
    await expect(card.getByText('rejected')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 2 — Admin edits a variant's pashto field; log shows "edited" entry
// ---------------------------------------------------------------------------

test.describe('Phase 9.5 — Admin edits variant field; log shows edited entry', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let parentConcept;
  let pendingVariant;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    // A published concept is needed as the parent so the variant can reference it.
    parentConcept = await createPublishedConcept(
      request,
      adminToken,
      'e2e-edit-variant-parent'
    );

    // Submit a pending variant under the published concept.
    pendingVariant = await createPendingVariant(request, adminToken, parentConcept._id, {
      pashto: 'زوی',
      phonetic: 'zoy',
      region: 'Kohat',
      definition: 'son (e2e edit test)',
    });
  });

  test('admin opens Edit form on a pending variant — form is pre-populated', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    // Switch to the Variants tab.
    await page.getByRole('button', { name: /variants/i }).click();

    // Wait for the variant to appear (shown by its phonetic).
    await expect(page.getByText('zoy')).toBeVisible({ timeout: 10000 });

    // Click Edit on that variant's card.
    const card = page.locator('li').filter({ hasText: 'zoy' });
    await card.getByRole('button', { name: 'Edit' }).click();

    // The inline edit form must be visible.
    await expect(page.getByRole('form', { name: 'Edit variant' })).toBeVisible();

    // The Pashto field must be pre-populated with the original value.
    const pashtoInput = page.getByRole('form', { name: 'Edit variant' }).getByLabel('Pashto');
    await expect(pashtoInput).toHaveValue('زوی');
  });

  test('admin changes pashto field and saves — card updates in place without full reload', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();
    await expect(page.getByText('zoy')).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'zoy' });
    await card.getByRole('button', { name: 'Edit' }).click();

    const form = page.getByRole('form', { name: 'Edit variant' });

    // Clear the Pashto field and type a new value.
    const pashtoInput = form.getByLabel('Pashto');
    await pashtoInput.clear();
    await pashtoInput.fill('زامن');

    // Fill in the required note.
    await form.getByLabel('Note').fill('e2e admin edit — changed pashto');

    // Click Save.
    await form.getByRole('button', { name: 'Save' }).click();

    // The form should close after a successful save.
    await expect(form).not.toBeVisible({ timeout: 8000 });

    // The updated pashto value must now appear in the queue card (no full page reload).
    await expect(page.getByText('زامن')).toBeVisible();
  });

  test('admin visits Moderation Log and sees an "edited" entry for the variant', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/log');

    // The log renders action badges as text; "edited" must appear in the audit trail.
    await expect(page.getByText('edited', { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Flow 3 — Admin reassigns a variant to a different concept
// ---------------------------------------------------------------------------

test.describe('Phase 9.5 — Admin reassigns variant to a different concept', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let conceptA;
  let conceptB;
  let pendingVariant;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    // Two published concepts — variant starts under A, gets moved to B.
    conceptA = await createPublishedConcept(request, adminToken, 'e2e-reassign-source-concept');
    conceptB = await createPublishedConcept(request, adminToken, 'e2e-reassign-target-concept');

    // Seed a published variant under conceptB so its detail page exists.
    await createPublishedVariant(request, adminToken, conceptB._id, {
      pashto: 'ملګری',
      phonetic: 'malgray',
      region: 'Hangu',
      definition: 'friend (e2e reassign anchor)',
    });

    // Pending variant starts under conceptA.
    pendingVariant = await createPendingVariant(request, adminToken, conceptA._id, {
      pashto: 'پلار',
      phonetic: 'plar',
      region: 'Kohat',
      definition: 'father (e2e reassign)',
    });
  });

  test('admin reassigns variant to conceptB via Concept search and saves', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();
    await expect(page.getByText('plar')).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'plar' });
    await card.getByRole('button', { name: 'Edit' }).click();

    const form = page.getByRole('form', { name: 'Edit variant' });

    // Type the target concept's gloss into the Concept search field.
    const conceptSearchInput = form.getByLabel('Concept');
    await conceptSearchInput.fill('e2e-reassign-target');

    // Wait for the suggestion dropdown — the item renders as "gloss — ID: xxx"
    const suggestion = page.getByText(new RegExp(`${conceptB.englishGloss}.*ID:`));
    await expect(suggestion).toBeVisible({ timeout: 8000 });
    await suggestion.click();

    // Fill the required note and save.
    await form.getByLabel('Note').fill('e2e reassign to conceptB');
    await form.getByRole('button', { name: 'Save' }).click();

    // Form closes after save.
    await expect(form).not.toBeVisible({ timeout: 8000 });
  });

  test('reassigned variant now appears under the target concept on the public detail page', async ({ page, request }) => {
    // Publish the variant so it is visible on the public concept detail page.
    await request.patch(`${API}/api/variants/${pendingVariant._id}/status`, {
      data: { status: 'approved' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await request.patch(`${API}/api/variants/${pendingVariant._id}/status`, {
      data: { status: 'published' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Navigate to conceptB's public detail page.
    await page.goto(`/concepts/${conceptB._id}`);

    // The reassigned variant's phonetic must now appear on conceptB's detail page.
    await expect(page.getByText('plar')).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Flow 4 — Mod merges a duplicate concept from the queue
//
// Seed strategy:
//   - Published concept: gloss "e2e-merge-main" (the merge target)
//   - Pending concept in queue: gloss "e2e-merge" (shorter — is a substring of "e2e-merge-main")
//
// When SimilarConceptsPanel fires suggest?q=e2e-merge for the pending concept,
// the regex /e2e-merge/i matches BOTH "e2e-merge" (the item itself, filtered out)
// AND "e2e-merge-main" (returned as the suggestion). The "Merge into this" button
// then appears for the published concept.
// ---------------------------------------------------------------------------

test.describe('Phase 9.5 — Mod merges duplicate concept from queue', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let targetConcept;   // published — will absorb variants from the source
  let sourceConcept;   // pending in queue — the shorter-gloss "duplicate"

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    // Published target — gloss contains the pending concept's gloss as a substring
    // so suggest returns it when queried with the shorter gloss.
    targetConcept = await createPublishedConcept(
      request,
      adminToken,
      'e2e-merge-main'
    );
    await createPublishedVariant(request, adminToken, targetConcept._id, {
      pashto: 'مور',
      phonetic: 'mor',
      region: 'Kohat',
      definition: 'mother (e2e merge target anchor)',
    });

    // Pending concept — gloss "e2e-merge" is a strict substring of "e2e-merge-main",
    // so suggest?q=e2e-merge returns both, and the panel surfaces the published one.
    const createRes = await request.post(`${API}/api/concepts`, {
      data: { englishGloss: 'e2e-merge', partOfSpeech: 'noun' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { data } = await createRes.json();
    sourceConcept = data;
  });

  test('similar concept panel appears; mod clicks Merge into this and confirms', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    // The pending "e2e-merge" concept must be in the queue.
    await expect(page.getByText('e2e-merge', { exact: true })).toBeVisible({ timeout: 10000 });

    // SimilarConceptsPanel fires an async suggest request on mount; wait for the
    // "Merge into this" button to appear alongside the published similar concept.
    const mergeBtn = page.getByRole('button', { name: 'Merge into this' }).first();
    await expect(mergeBtn).toBeVisible({ timeout: 12000 });

    // Click "Merge into this".
    await mergeBtn.click();

    // The merge confirmation modal appears.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Confirm Merge')).toBeVisible();

    // Add a note and confirm.
    await page.getByLabel('Note').fill('e2e merge — duplicate gloss detected');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();

    // Modal closes after confirmation.
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 });

    // No error banner should appear after a successful merge.
    await expect(page.getByText('Merge failed')).not.toBeVisible();
    await expect(page.getByText('Action failed')).not.toBeVisible();
  });

  test('source concept is removed from the queue after merge', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    // The source concept (e2e-merge) was deleted by the merge operation.
    // The Concepts tab — its card must no longer appear.
    // We look only within the concepts list (default tab).
    await page.waitForLoadState('networkidle');
    await expect(page.locator('li').filter({ hasText: /^e2e-merge$/ })).toHaveCount(0);
  });

  test('merged variants appear under the receiving concept on the public detail page', async ({ page, request }) => {
    // After the merge, sourceConcept (e2e-merge, the queue item) now owns the
    // variants that were moved from targetConcept (e2e-merge-main). Publish
    // sourceConcept so its public detail page is accessible, then verify the
    // moved variant's phonetic "mor" is visible.
    await request.patch(`${API}/api/concepts/${sourceConcept._id}/status`, {
      data: { status: 'approved' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await request.patch(`${API}/api/concepts/${sourceConcept._id}/status`, {
      data: { status: 'published' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    await page.goto(`/concepts/${sourceConcept._id}`);

    // The variant that was moved from e2e-merge-main must now appear here.
    await expect(page.getByText('mor')).toBeVisible({ timeout: 10000 });
  });
});
