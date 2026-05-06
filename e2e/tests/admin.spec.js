'use strict';

/**
 * E2E tests for the Admin section of USER-FLOWS.md.
 *
 * Flows covered:
 *   1. Publish approved concept — card leaves the Approved queue; API confirms published status
 *   2. Publish approved variant — card leaves the Approved queue; API confirms published status
 *   3. Pending / Approved filter toggle — correct items visible per filter
 *   4. Users page — accessible to admin; seeded test accounts are listed
 *   5. Moderation Log page — accessible to admin; action badges are visible
 *   6. Inline edit — admin edits a variant field via the inline form; log shows "edited"
 *   7. Variant reassignment — admin reassigns a variant to a different concept
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth.js');
const {
  getAdminToken,
  createPublishedConcept,
  createPublishedVariant,
  createApprovedConcept,
  createApprovedVariant,
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
// Flow 1 — Admin publishes an approved concept
// ---------------------------------------------------------------------------

test.describe('Admin — publish approved concept', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let approvedConcept;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));
    approvedConcept = await createApprovedConcept(
      request,
      adminToken,
      'e2e-admin-publish-concept'
    );
  });

  test('approved concept card is visible in the Approved filter', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    // Switch to the Approved filter — admin-only toggle
    await page.getByRole('button', { name: /^approved/i }).click();

    await expect(
      page.getByText(approvedConcept.englishGloss)
    ).toBeVisible({ timeout: 10000 });
  });

  test('clicking Publish removes the concept card from the Approved queue', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /^approved/i }).click();

    await expect(
      page.getByText(approvedConcept.englishGloss)
    ).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: approvedConcept.englishGloss });
    await card.getByRole('button', { name: 'Publish' }).click();

    // Card must leave the approved queue after publishing
    await expect(
      page.getByText(approvedConcept.englishGloss)
    ).not.toBeVisible({ timeout: 10000 });
  });

  test('API confirms concept status is published after publishing', async ({ request }) => {
    const res = await request.get(`${API}/api/concepts/${approvedConcept._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await res.json();
    expect(body.data.status).toBe('published');
  });
});

// ---------------------------------------------------------------------------
// Flow 2 — Admin publishes an approved variant
// ---------------------------------------------------------------------------

test.describe('Admin — publish approved variant', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let parentConcept;
  let approvedVariant;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    // A published concept is required as the parent before a variant can reference it
    parentConcept = await createPublishedConcept(
      request,
      adminToken,
      'e2e-admin-publish-variant-parent'
    );

    approvedVariant = await createApprovedVariant(
      request,
      adminToken,
      parentConcept._id,
      {
        pashto: 'مور',
        phonetic: 'mor-admin-pub',
        region: 'Hangu',
        definition: 'mother (e2e admin publish)',
      }
    );
  });

  test('approved variant card is visible on the Variants tab of the Approved filter', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    // Switch to Variants tab first — the status filter (pending/approved) is
    // per-tab state. Clicking Approved while on Variants tab sets the variants
    // filter; clicking it while on Concepts tab would only affect concepts.
    await page.getByRole('button', { name: /variants/i }).click();
    await page.getByRole('button', { name: /^approved/i }).click();

    await expect(
      page.getByText('mor-admin-pub')
    ).toBeVisible({ timeout: 10000 });
  });

  test('clicking Publish removes the variant card from the Approved queue', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    // Variants tab first, then Approved filter (per-tab filter state)
    await page.getByRole('button', { name: /variants/i }).click();
    await page.getByRole('button', { name: /^approved/i }).click();

    await expect(
      page.getByText('mor-admin-pub')
    ).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'mor-admin-pub' });
    await card.getByRole('button', { name: 'Publish' }).click();

    await expect(
      page.getByText('mor-admin-pub')
    ).not.toBeVisible({ timeout: 10000 });
  });

  test('API confirms variant status is published after publishing', async ({ request }) => {
    const res = await request.get(`${API}/api/variants/${approvedVariant._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await res.json();
    expect(body.data.status).toBe('published');
  });
});

// ---------------------------------------------------------------------------
// Flow 3 — Pending / Approved filter toggle shows correct items per filter
// ---------------------------------------------------------------------------

test.describe('Admin — Pending / Approved filter toggle', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let pendingConcept;
  let approvedConcept;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    pendingConcept = await createPendingConcept(
      request,
      adminToken,
      'e2e-admin-filter-pending'
    );

    approvedConcept = await createApprovedConcept(
      request,
      adminToken,
      'e2e-admin-filter-approved'
    );
  });

  test('Pending filter shows the pending concept and hides the approved concept', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    // The queue defaults to the Pending filter — explicitly click it to be sure
    await page.getByRole('button', { name: /^pending/i }).click();

    // Wait for the queue to render
    await expect(
      page.getByRole('heading', { name: 'Moderation Queue' })
    ).toBeVisible({ timeout: 10000 });

    // Pending concept must be visible in the pending filter
    await expect(
      page.getByText(pendingConcept.englishGloss)
    ).toBeVisible({ timeout: 10000 });

    // Approved concept must NOT appear in the pending view
    await expect(
      page.getByText(approvedConcept.englishGloss)
    ).not.toBeVisible();
  });

  test('Approved filter shows the approved concept and hides the pending concept', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    // Switch to Approved filter
    await page.getByRole('button', { name: /^approved/i }).click();

    // Approved concept must be visible
    await expect(
      page.getByText(approvedConcept.englishGloss)
    ).toBeVisible({ timeout: 10000 });

    // Pending concept must NOT appear in the approved view
    await expect(
      page.getByText(pendingConcept.englishGloss)
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 4 — Users page is accessible to admin and lists registered accounts
// ---------------------------------------------------------------------------

test.describe('Admin — Users page', () => {
  test('navigating to /dashboard/users renders the users list', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/users');

    // Must stay on the users page (no redirect)
    await expect(page).toHaveURL(/\/dashboard\/users/, { timeout: 10000 });

    // A heading or table identifying the page must be present
    await expect(
      page.getByRole('heading', { name: /users/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('seeded test accounts appear in the users list', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/users');

    // All three seeded accounts must be visible somewhere on the page
    await expect(page.getByText('e2e-admin@test.local')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('e2e-mod@test.local')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('e2e-user@test.local')).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Flow 5 — Moderation Log page is accessible to admin; action badges visible
// ---------------------------------------------------------------------------

test.describe('Admin — Moderation Log page', () => {
  let adminToken;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    // Ensure at least one log entry exists by creating and approving a concept via API.
    // createApprovedConcept writes a "submitted" entry then an "approved" entry.
    await createApprovedConcept(request, adminToken, 'e2e-admin-log-seed');
  });

  test('navigating to /dashboard/log renders the log page without redirect', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/log');

    // Must stay on the log page (no redirect to /dashboard)
    await expect(page).toHaveURL(/\/dashboard\/log/, { timeout: 10000 });

    // The page must have a heading that identifies the audit log
    await expect(
      page.getByRole('heading', { name: /audit log/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('log entries are visible with recognisable action badges', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/log');

    // At least one of the known action badge texts must appear in the log list.
    // The createApprovedConcept helper triggers "submitted" then "approved".
    const actionBadges = ['submitted', 'approved', 'published', 'rejected', 'edited', 'merged'];

    // Wait for the log list to be populated
    await page.waitForLoadState('networkidle');

    let found = false;
    for (const action of actionBadges) {
      const locator = page.getByText(action, { exact: true }).first();
      const count = await locator.count();
      if (count > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('Users link is visible in the admin sidebar', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard');

    await expect(
      page.getByRole('link', { name: 'Users' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('Log link is visible in the admin sidebar', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard');

    await expect(
      page.getByRole('link', { name: 'Log' })
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Flow 6 — Admin edits a variant field via the inline form; log shows "edited"
//
// USER-FLOWS.md: "As an admin I should be able to edit any submission including
// my own, using the same inline Edit form available to moderators."
// ---------------------------------------------------------------------------

test.describe('Admin — inline edit variant field; log shows "edited" entry', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let parentConcept;
  let pendingVariant;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    parentConcept = await createPublishedConcept(
      request,
      adminToken,
      'e2e-edit-variant-parent'
    );

    pendingVariant = await createPendingVariant(request, adminToken, parentConcept._id, {
      pashto:    'زوی',
      phonetic:  'zoy',
      region:    'Kohat',
      definition: 'son (e2e edit test)',
    });
  });

  test('admin opens Edit form on a pending variant — form is pre-populated', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();
    await expect(page.getByText('zoy')).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'zoy' });
    await card.getByRole('button', { name: 'Edit' }).click();

    await expect(page.getByRole('form', { name: 'Edit variant' })).toBeVisible();

    const pashtoInput = page.getByRole('form', { name: 'Edit variant' }).getByLabel('Pashto');
    await expect(pashtoInput).toHaveValue('زوی');
  });

  test('admin changes pashto field and saves — card updates in place without a full reload', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/queue');

    await page.getByRole('button', { name: /variants/i }).click();
    await expect(page.getByText('zoy')).toBeVisible({ timeout: 10000 });

    const card = page.locator('li').filter({ hasText: 'zoy' });
    await card.getByRole('button', { name: 'Edit' }).click();

    const form = page.getByRole('form', { name: 'Edit variant' });
    const pashtoInput = form.getByLabel('Pashto');
    await pashtoInput.clear();
    await pashtoInput.fill('زامن');

    await form.getByLabel('Note').fill('e2e admin edit — changed pashto');
    await form.getByRole('button', { name: 'Save' }).click();

    // Form closes after a successful save
    await expect(form).not.toBeVisible({ timeout: 8000 });

    // Updated pashto value must appear in the card without a full page reload
    await expect(page.getByText('زامن')).toBeVisible();
  });

  test('admin visits Moderation Log and sees an "edited" entry for the variant', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/dashboard/log');

    await expect(
      page.getByText('edited', { exact: true }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Flow 7 — Admin reassigns a variant to a different concept
//
// USER-FLOWS.md: "As an admin I should be able to reassign a variant to a
// different concept by using the Concept search field inside the variant Edit
// form."
// ---------------------------------------------------------------------------

test.describe('Admin — reassign variant to a different concept', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken;
  let conceptA;
  let conceptB;
  let pendingVariant;

  test.beforeAll(async ({ request }) => {
    adminToken = await withRetry(() => getAdminToken(request));

    conceptA = await createPublishedConcept(request, adminToken, 'e2e-reassign-source-concept');
    conceptB = await createPublishedConcept(request, adminToken, 'e2e-reassign-target-concept');

    // Seed a published variant under conceptB so its detail page exists
    await createPublishedVariant(request, adminToken, conceptB._id, {
      pashto:    'ملګری',
      phonetic:  'malgray',
      region:    'Hangu',
      definition: 'friend (e2e reassign anchor)',
    });

    // Pending variant starts under conceptA — admin will move it to conceptB
    pendingVariant = await createPendingVariant(request, adminToken, conceptA._id, {
      pashto:    'پلار',
      phonetic:  'plar',
      region:    'Kohat',
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

    const conceptSearchInput = form.getByLabel('Concept');
    await conceptSearchInput.fill('e2e-reassign-target');

    const suggestion = page.getByText(new RegExp(`${conceptB.englishGloss}.*ID:`));
    await expect(suggestion).toBeVisible({ timeout: 8000 });
    await suggestion.click();

    await form.getByLabel('Note').fill('e2e reassign to conceptB');
    await form.getByRole('button', { name: 'Save' }).click();

    await expect(form).not.toBeVisible({ timeout: 8000 });
  });

  test('reassigned variant appears under the target concept on the public detail page', async ({ page, request }) => {
    // Publish the variant so it is visible on the public concept detail page
    await request.patch(`${API}/api/variants/${pendingVariant._id}/status`, {
      data: { status: 'approved' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await request.patch(`${API}/api/variants/${pendingVariant._id}/status`, {
      data: { status: 'published' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    await page.goto(`/concepts/${conceptB._id}`);
    await expect(page.getByText('plar')).toBeVisible({ timeout: 10000 });
  });
});
