'use strict';

/**
 * E2E tests for the Moderator section of USER-FLOWS.md.
 *
 * Flows covered:
 *   1.  Approve pending concept — card leaves queue; ModerationLog records "approved"
 *   2.  Approve pending variant — card leaves queue; ModerationLog records "approved"
 *   3.  Dashboard navigation — Queue/Concepts tabs visible; Users/Log links absent
 *   4.  Role boundary: /dashboard/users redirects moderator back to /dashboard
 *   5.  Role boundary: /dashboard/log redirects moderator back to /dashboard
 *   6.  Approved-filter toggle is absent for moderator (admin-only UI)
 *   7.  Session persistence — refreshing the page does not log the moderator out
 *   8.  Reject pending concept via modal — reason stored; submitter sees it in My Submissions
 *   9.  Reject pending variant via modal — reason stored; submitter sees it in My Submissions
 *   10. Merge duplicate concept from the queue — source removed; variants land on target
 *   11. Merge concept from the Concepts list page (not the queue)
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
// Flow 1 — Moderator approves a pending concept
// ---------------------------------------------------------------------------

test.describe('Moderator — approve pending concept', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let userToken;
  let pendingConcept;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    userToken  = await withRetry(() => getUserToken(request));

    pendingConcept = await createPendingConcept(
      request,
      userToken,
      'e2e-mod-approve-concept'
    );
  });

  test('pending concept card is visible in the queue', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await expect(
      page.getByText(pendingConcept.englishGloss)
    ).toBeVisible({ timeout: 10000 });
  });

  test('clicking Approve removes the concept card from the queue', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await expect(
      page.getByText(pendingConcept.englishGloss)
    ).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: pendingConcept.englishGloss });
    await card.getByRole('button', { name: 'Approve' }).click();

    await expect(
      page.getByText(pendingConcept.englishGloss)
    ).not.toBeVisible({ timeout: 10000 });
  });

  test('moderation log contains an "approved" entry for the concept', async ({ request }) => {
    const logRes = await request.get(`${API}/api/moderation/log`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await logRes.json();
    const entries = body.data || [];

    const found = entries.some(
      (e) =>
        e.action === 'approved' &&
        String(e.targetId) === String(pendingConcept._id)
    );
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Flow 2 — Moderator approves a pending variant
// ---------------------------------------------------------------------------

test.describe('Moderator — approve pending variant', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let userToken;
  let parentConcept;
  let pendingVariant;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    userToken  = await withRetry(() => getUserToken(request));

    parentConcept = await createPublishedConcept(
      request,
      adminToken,
      'e2e-mod-approve-variant-parent'
    );

    pendingVariant = await createPendingVariant(request, userToken, parentConcept._id, {
      pashto:    'غوږ',
      phonetic:  'ghwag-mod-approve',
      region:    'Kohat',
      definition: 'ear (e2e moderator approve)',
    });
  });

  test('pending variant card is visible on the Variants tab', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();

    await expect(
      page.getByText('ghwag-mod-approve')
    ).toBeVisible({ timeout: 10000 });
  });

  test('clicking Approve removes the variant card from the queue', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();
    await expect(
      page.getByText('ghwag-mod-approve')
    ).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'ghwag-mod-approve' });
    await card.getByRole('button', { name: 'Approve' }).click();

    await expect(
      page.getByText('ghwag-mod-approve')
    ).not.toBeVisible({ timeout: 10000 });
  });

  test('moderation log contains an "approved" entry for the variant', async ({ request }) => {
    const logRes = await request.get(`${API}/api/moderation/log`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await logRes.json();
    const entries = body.data || [];

    const found = entries.some(
      (e) =>
        e.action === 'approved' &&
        String(e.targetId) === String(pendingVariant._id)
    );
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Flow 3 — Dashboard navigation: correct tabs visible, admin-only links absent
// ---------------------------------------------------------------------------

test.describe('Moderator — dashboard navigation tabs', () => {
  test('Queue link is visible in the sidebar', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard');

    await expect(page.getByRole('link', { name: 'Queue' })).toBeVisible({ timeout: 10000 });
  });

  test('Concepts link is visible in the sidebar', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard');

    await expect(page.getByRole('link', { name: 'Concepts' })).toBeVisible({ timeout: 10000 });
  });

  test('Users link is NOT visible in the sidebar for a moderator', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard');

    await expect(page.getByRole('link', { name: 'Users' })).not.toBeVisible();
  });

  test('Log link is NOT visible in the sidebar for a moderator', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard');

    await expect(page.getByRole('link', { name: 'Log' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 4 — Role boundary: /dashboard/users redirects moderator to /dashboard
// ---------------------------------------------------------------------------

test.describe('Moderator — role boundary: Users page', () => {
  test('navigating to /dashboard/users redirects back to /dashboard', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/users');

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Users' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 5 — Role boundary: /dashboard/log redirects moderator to /dashboard
// ---------------------------------------------------------------------------

test.describe('Moderator — role boundary: Log page', () => {
  test('navigating to /dashboard/log redirects back to /dashboard', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/log');

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Audit Log' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 6 — Approved-filter toggle is absent for moderator (admin-only UI)
// ---------------------------------------------------------------------------

test.describe('Moderator — approved-filter toggle absent', () => {
  test('the "approved" status filter button is not rendered for a moderator', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await expect(
      page.getByRole('heading', { name: 'Moderation Queue' })
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole('button', { name: /^approved/i })
    ).not.toBeVisible();

    await expect(
      page.getByRole('button', { name: /^pending/i })
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 7 — Session persistence after full page reload
//
// USER-FLOWS.md: "As a moderator I should be able to log in and access the
// Dashboard. Refreshing the page should not log me out."
// ---------------------------------------------------------------------------

test.describe('Moderator — session persists across page reloads', () => {
  test('moderator remains authenticated after two consecutive reloads', async ({ page }) => {
    await loginAs(page, 'moderator');

    // loginAs already reloads once — do a second reload to be sure
    await page.reload();

    // Guest nav links must be absent after reload (logged-in state preserved)
    await expect(page.getByRole('link', { name: 'Login' })).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Register' })).not.toBeVisible();

    // Must be able to land on the dashboard without being redirected to /login.
    // (The Dashboard link lives inside a dropdown — navigate directly instead.)
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Queue' })).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Flow 8 — Reject pending concept via modal; submitter sees reason
//
// USER-FLOWS.md: "As a moderator I should be able to reject a pending item by
// clicking Reject, which opens a modal requiring me to type a reason before
// confirming. The reason is stored and shown to the submitter in their
// My Submissions page."
// ---------------------------------------------------------------------------

test.describe('Moderator — reject pending concept via modal', () => {
  test.describe.configure({ mode: 'serial' });

  let userToken;
  let pendingConcept;

  test.beforeAll(async ({ request }) => {
    userToken = await withRetry(() => getUserToken(request));

    pendingConcept = await createPendingConcept(
      request,
      userToken,
      'e2e-mod-reject-concept'
    );
  });

  test('clicking Reject opens modal; Confirm is disabled until a reason is typed', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await expect(page.getByText(pendingConcept.englishGloss)).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: pendingConcept.englishGloss });
    await card.getByRole('button', { name: 'Reject' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Rejection Reason')).toBeVisible();

    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: 'Confirm' });
    await expect(confirmBtn).toBeDisabled();

    await page.getByLabel('Reason for rejection').fill('e2e concept rejection — not a real word');
    await expect(confirmBtn).toBeEnabled();
  });

  test('confirming rejection removes concept card from queue', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await expect(page.getByText(pendingConcept.englishGloss)).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: pendingConcept.englishGloss });
    await card.getByRole('button', { name: 'Reject' }).click();

    await page.getByLabel('Reason for rejection').fill('e2e concept rejection — not a real word');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText(pendingConcept.englishGloss)).not.toBeVisible({ timeout: 10000 });
  });

  test('submitter sees rejected badge and rejection reason in My Submissions', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/my-submissions');

    await expect(page.getByText(pendingConcept.englishGloss)).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: pendingConcept.englishGloss });
    await expect(card.getByText('rejected', { exact: true })).toBeVisible();
    await expect(card.getByText('not a real word', { exact: false })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 9 — Reject pending variant via modal; submitter sees reason
//
// USER-FLOWS.md: "As a moderator I should be able to reject a pending variant
// with a note."
// ---------------------------------------------------------------------------

test.describe('Moderator — reject pending variant via modal', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let userToken;
  let parentConcept;
  let pendingVariant;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    userToken  = await withRetry(() => getUserToken(request));

    parentConcept = await createPublishedConcept(
      request,
      adminToken,
      'e2e-mod-reject-variant-parent'
    );

    pendingVariant = await createPendingVariant(request, userToken, parentConcept._id, {
      pashto:    'سترګه',
      phonetic:  'starga-mod-reject',
      region:    'Tirah',
      definition: 'eye (e2e variant rejection)',
    });
  });

  test('pending variant card is visible on the Variants tab', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();

    await expect(page.getByText('starga-mod-reject')).toBeVisible({ timeout: 10000 });
  });

  test('clicking Reject opens modal; Confirm is disabled until a reason is typed', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();
    await expect(page.getByText('starga-mod-reject')).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'starga-mod-reject' });
    await card.getByRole('button', { name: 'Reject' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Rejection Reason')).toBeVisible();

    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: 'Confirm' });
    await expect(confirmBtn).toBeDisabled();

    await page.getByLabel('Reason for rejection').fill('e2e variant rejection — phonetic unclear');
    await expect(confirmBtn).toBeEnabled();
  });

  test('confirming rejection removes variant card from queue', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();
    await expect(page.getByText('starga-mod-reject')).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'starga-mod-reject' });
    await card.getByRole('button', { name: 'Reject' }).click();

    await page.getByLabel('Reason for rejection').fill('e2e variant rejection — phonetic unclear');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText('starga-mod-reject')).not.toBeVisible({ timeout: 10000 });
  });

  test('submitter sees rejected badge and rejection reason for the variant in My Submissions', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto('/my-submissions');

    await expect(page.getByText('eye (e2e variant rejection)')).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'eye (e2e variant rejection)' });
    await expect(card.getByText('rejected', { exact: true })).toBeVisible();
    await expect(card.getByText('phonetic unclear', { exact: false })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 10 — Merge duplicate concept from the queue
//
// USER-FLOWS.md: "As a moderator I should see a 'Similar concepts' panel on
// each concept card in the queue… I can click 'Merge into this' to open a
// confirmation modal, enter a note, and merge the pending concept into the
// existing one."
//
// Seed: pending concept gloss "e2e-merge" is a substring of published concept
// gloss "e2e-merge-main", so the suggest endpoint returns the published one
// as a similar-concept match for the pending one.
// ---------------------------------------------------------------------------

test.describe('Moderator — merge duplicate concept from queue', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let targetConcept;
  let sourceConcept;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    targetConcept = await createPublishedConcept(request, adminToken, 'e2e-merge-main');
    await createPublishedVariant(request, adminToken, targetConcept._id, {
      pashto:    'مور',
      phonetic:  'mor',
      region:    'Kohat',
      definition: 'mother (e2e merge target anchor)',
    });

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

    await expect(page.getByText('e2e-merge', { exact: true })).toBeVisible({ timeout: 10000 });

    // SimilarConceptsPanel fires an async suggest request on mount
    const mergeBtn = page.getByRole('button', { name: 'Merge into this' }).first();
    await expect(mergeBtn).toBeVisible({ timeout: 12000 });
    await mergeBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Confirm Merge')).toBeVisible();

    await page.getByLabel('Note').fill('e2e merge — duplicate gloss detected');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Merge failed')).not.toBeVisible();
    await expect(page.getByText('Action failed')).not.toBeVisible();
  });

  test('source concept is removed from the queue after merge', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    await page.waitForLoadState('networkidle');
    await expect(page.locator('li').filter({ hasText: /^e2e-merge$/ })).toHaveCount(0);
  });

  test('merged variants appear under the receiving concept on the public detail page', async ({ page, request }) => {
    await request.patch(`${API}/api/concepts/${sourceConcept._id}/status`, {
      data: { status: 'approved' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await request.patch(`${API}/api/concepts/${sourceConcept._id}/status`, {
      data: { status: 'published' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    await page.goto(`/concepts/${sourceConcept._id}`);
    await expect(page.getByText('mor')).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Flow 11 — Merge concept from the Concepts list page
//
// USER-FLOWS.md: "As a moderator I should be able to trigger a merge from the
// Concepts list page in the dashboard, not only from the queue."
//
// The DashboardConcepts page renders a "Merge" button on every concept row.
// Clicking it opens a MergeModal where the moderator searches for a target
// concept by gloss, selects it from the suggestion list, adds a note, and
// confirms. No SimilarConceptsPanel is involved — the search is manual.
// ---------------------------------------------------------------------------

test.describe('Moderator — merge concept from Concepts list page', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let targetConcept;
  let sourceConcept;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    // Published target — moderator will merge the source into this
    targetConcept = await createPublishedConcept(
      request,
      adminToken,
      'e2e-list-merge-target'
    );

    // Pending source — will be merged into the target
    const createRes = await request.post(`${API}/api/concepts`, {
      data: { englishGloss: 'e2e-list-merge-source', partOfSpeech: 'noun' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { data } = await createRes.json();
    sourceConcept = data;
  });

  test('each concept row on /dashboard/concepts has a Merge button', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/concepts');

    // At least one Merge button must be visible in the list
    await expect(
      page.getByRole('button', { name: 'Merge' }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('clicking Merge on a concept row opens the MergeModal', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/concepts');

    // Filter to pending then search by gloss to pin the row regardless of page count
    await page.getByLabel('Status').selectOption('pending');
    await page.getByLabel('Search concepts').fill(sourceConcept.englishGloss);

    await expect(page.getByText(sourceConcept.englishGloss)).toBeVisible({ timeout: 10000 });

    const sourceRow = page.locator('li').filter({ hasText: sourceConcept.englishGloss });
    await sourceRow.getByRole('button', { name: 'Merge' }).click();

    // MergeModal appears with the source gloss in the description
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Merge Concept')).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Merge.*${sourceConcept.englishGloss}`, 'i'))
    ).toBeVisible();
  });

  test('searching for the target and confirming removes the source from the list', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/concepts');

    // Filter to pending then search by gloss to pin the row regardless of page count
    await page.getByLabel('Status').selectOption('pending');
    await page.getByLabel('Search concepts').fill(sourceConcept.englishGloss);

    await expect(page.getByText(sourceConcept.englishGloss)).toBeVisible({ timeout: 10000 });

    const sourceRow = page.locator('li').filter({ hasText: sourceConcept.englishGloss });
    await sourceRow.getByRole('button', { name: 'Merge' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Type partial target gloss into the search field — suggestions appear as "{gloss} — ID: {id}"
    await page.getByLabel('Search target concept').fill('e2e-list-merge-target');

    const suggestion = page.getByText(
      new RegExp(`${targetConcept.englishGloss}.*ID:`)
    );
    await expect(suggestion).toBeVisible({ timeout: 8000 });
    await suggestion.click();

    // Confirm is now enabled (target selected)
    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: 'Confirm' });
    await expect(confirmBtn).toBeEnabled();

    await page.getByLabel('Note').fill('e2e list-page merge — duplicate glosses');
    await confirmBtn.click();

    // Modal closes after successful merge
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 });

    // Source concept is no longer in the list
    await expect(page.getByText(sourceConcept.englishGloss)).not.toBeVisible({ timeout: 10000 });
  });

  test('Confirm button is disabled until a target concept is selected from suggestions', async ({ page }) => {
    // Opens the MergeModal on whatever concept is first in the list and verifies
    // the Confirm button is disabled before any target is selected. We don't rely
    // on a specific row to avoid pagination issues across parallel test runs.
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/concepts');

    const firstMergeBtn = page.getByRole('button', { name: 'Merge' }).first();
    await expect(firstMergeBtn).toBeVisible({ timeout: 10000 });
    await firstMergeBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Confirm must be disabled before any target is picked
    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: 'Confirm' });
    await expect(confirmBtn).toBeDisabled();

    // Cancel to clean up
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
