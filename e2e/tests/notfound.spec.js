'use strict';

const { test, expect } = require('@playwright/test');

// These tests cover the catch-all <Route path="*" element={<NotFound />} />
// added in Phase 10. No seeding is required — the 404 page is rendered
// entirely client-side for any URL that the router does not recognise.

test.describe('Guest — 404 Not Found page', () => {
  test('shows a 404 heading and a "Back to home" link for an unknown top-level path', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    // The large "404" heading must be visible
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();

    // A supplementary "page not found" message should also be present
    await expect(page.getByText('Page not found')).toBeVisible();

    // The home link must be in the DOM and readable
    const homeLink = page.getByRole('link', { name: 'Back to home' });
    await expect(homeLink).toBeVisible();
  });

  test('"Back to home" link navigates back to "/"', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    await page.getByRole('link', { name: 'Back to home' }).click();

    // After the click the router should land on the homepage
    await expect(page).toHaveURL('/');

    // Confirm the homepage is actually rendered (not another 404)
    await expect(page.getByPlaceholder('Search Pashto words…')).toBeVisible();
  });

  test('shows the 404 page for an unknown nested path', async ({ page }) => {
    await page.goto('/dashboard/nonexistent-sub');

    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
  });
});
