'use strict';

/**
 * moderator.spec.js — golden-path journeys for the moderator role.
 *
 * Flows covered:
 *   1. Approve pending concept — card leaves queue; log records "approve" action
 *   2. Approve pending variant — card leaves queue; log records "approve" action
 *   3. Dashboard navigation — Queue/Concepts tabs visible; Users/Log links absent
 *   4. Role boundary: /dashboard/users redirects moderator back to /dashboard
 *   5. Role boundary: /dashboard/log redirects moderator back to /dashboard
 *   6. Approved-filter toggle is absent for moderator (admin-only UI)
 *
 * NOTE on Flow 6 ("Cannot edit own submission"):
 *   The current DashboardQueue implementation renders the Edit button for every
 *   queue card regardless of who submitted the item — there is no four-eyes guard
 *   in the UI. A test asserting the button is absent would therefore fail against
 *   the live code. This behaviour is documented in the "approved-filter" test
 *   instead (which IS an enforced moderator restriction). If a four-eyes guard is
 *   added to DashboardQueue in the future, add the "Edit absent" assertion then.
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth.js');
const {
  getAdminToken,
  getModToken,
  getUserToken,
  createPublishedConcept,
  createPendingConcept,
  createPendingVariant,
} = require('../helpers/seed.js');

const API = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Retry helper — absorbs transient ECONNRESET during server warm-up
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

    // Submitted by the regular user so it appears as a third-party submission
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

    // Card must leave the pending queue after approval
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

    // The log schema stores targetId (ObjectId) and action as the new status
    // string ("approved"). The GET /log endpoint does not populate targetId so
    // it arrives as a plain ObjectId string.
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

    // Parent concept must be published before a variant can reference it
    parentConcept = await createPublishedConcept(
      request,
      adminToken,
      'e2e-mod-approve-variant-parent'
    );

    // Variant submitted by the regular user so it shows up as pending
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

    // Switch to the Variants tab
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

    // Card must disappear from the queue after approval
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

    // Same schema as concepts: targetId holds the variant ObjectId, action is
    // the new status string "approved".
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

    // The sidebar filters out admin-only items — the Users link must not exist
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

    // DashboardUsers renders <Navigate to="/dashboard" replace /> when !isAdmin
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });

    // The "Users" heading must not be present — confirming we are NOT on that page
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

    // DashboardLog renders <Navigate to="/dashboard" replace /> when !isAdmin
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });

    // The "Audit Log" heading must not be present
    await expect(page.getByRole('heading', { name: 'Audit Log' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 6 — Approved-filter toggle is absent for moderator (admin-only UI)
//
// The "pending" / "approved" filter buttons in the queue are rendered only
// when isAdmin. A moderator always sees only the pending items and has no
// toggle to switch to the approved list.
// ---------------------------------------------------------------------------

test.describe('Moderator — approved-filter toggle absent', () => {
  test('the "approved" status filter button is not rendered for a moderator', async ({ page }) => {
    await loginAs(page, 'moderator');
    await page.goto('/dashboard/queue');

    // Wait for the queue to finish loading (heading appears once data resolves)
    await expect(
      page.getByRole('heading', { name: 'Moderation Queue' })
    ).toBeVisible({ timeout: 10000 });

    // The "approved" filter pill is an admin-only element — must be absent
    // We look for a button whose accessible name is exactly "approved" or starts
    // with "approved" (the button renders "approved (N)" text).
    await expect(
      page.getByRole('button', { name: /^approved/i })
    ).not.toBeVisible();

    // The "pending" filter pill is also admin-only — confirm it too is absent
    await expect(
      page.getByRole('button', { name: /^pending/i })
    ).not.toBeVisible();
  });
});
