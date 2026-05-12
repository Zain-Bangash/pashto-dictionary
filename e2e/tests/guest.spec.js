'use strict';

const { test, expect } = require('@playwright/test');
const { getAdminToken, createPublishedConcept, createPublishedVariant } = require('../helpers/seed.js');

// All tests use a shared admin token and a shared published concept so seeding
// is done once per describe block. Each test that needs a fresh concept creates
// its own via the helpers so tests stay independent.

test.describe('Guest — homepage', () => {
  let adminToken;
  let concept;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminToken(request);
    // Seed one published concept so the homepage has content to show
    concept = await createPublishedConcept(request, adminToken, `e2e-homepage-gloss-${Date.now()}`);
    await createPublishedVariant(request, adminToken, concept._id, {
      pashto: 'کور',
      phonetic: 'kor',
      region: 'Kohat',
      definition: 'house (e2e)',
    });
  });

  test('shows search bar, Word of the Day section, and community stats', async ({ page }) => {
    await page.goto('/');

    // Search bar
    await expect(page.getByPlaceholder('Search Pashto words…')).toBeVisible();

    // Word of the Day heading (the LIVE badge and label are inside the hero card)
    await expect(page.getByText('Word of the Day')).toBeVisible();

    // Community stats labels — all three counters are always rendered
    await expect(page.getByText('Words published')).toBeVisible();
    await expect(page.getByText('Contributors')).toBeVisible();
    await expect(page.getByText('Added this month')).toBeVisible();
  });

  test('clicking the "Expore Word" button in WOTD card on the homepage navigates to its detail page', async ({ page }) => {
    await page.goto('/');

    const wotd = await page.getByTestId('wotd-gloss').innerText();   
    const button = page.getByText('Explore Word →');
    await button.click();

    await expect(page).toHaveURL(/\/concepts\//);
    await expect(page.getByText(wotd)).toBeVisible();
  });

  test('clicking a concept card on the homepage navigates to its detail page', async ({ page }) => {
    await page.goto('/');

    const pashto = await page.getByTestId('card-pashto').first().innerText();

    // The seeded concept's english gloss appears in the recent-words grid as a link
    const card = page.getByTestId('card').first();
    await expect(card).toBeVisible();
    await card.click();

    //await expect(page).toHaveURL(new RegExp(`/concepts/${concept._id}`));
    await expect(page.getByText(pashto)).toBeVisible();
  });

  test('submitting the homepage search navigates to /concepts?q=...', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder('Search Pashto words…');
    await searchInput.fill('sister');
    await searchInput.press('Enter');

    await expect(page).toHaveURL(/\/concepts\?q=sister/);
  });
});

test.describe('Guest — navbar navigation', () => {
  test('clicking Browse in the navbar navigates to /concepts', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Browse' }).click();

    await expect(page).toHaveURL(/\/concepts/);
    await expect(page.getByRole('heading', { name: 'Browse Entries' })).toBeVisible();
  });

  test('clicking Register in the navbar navigates to /register', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Register' }).click();

    await expect(page).toHaveURL('/register');
  });

  test('clicking Login in the navbar navigates to /login', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Login' }).click();

    await expect(page).toHaveURL('/login');
  });
});

test.describe('Guest — /concepts browse page', () => {
  let adminToken;
  let concept;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminToken(request);
    concept = await createPublishedConcept(request, adminToken, `e2e-browse-gloss-${Date.now()}`);
    await createPublishedVariant(request, adminToken, concept._id, {
      pashto: 'لور',
      phonetic: 'lor',
      region: 'Hangu',
      definition: 'daughter (e2e)',
    });
  });

  test('shows published concept cards with the English gloss visible', async ({ page }) => {
    await page.goto('/concepts');

    // The heading is always present
    await expect(page.getByRole('heading', { name: 'Browse Entries' })).toBeVisible();

    // The seeded concept's English gloss appears as a card link
    await expect(page.getByText(concept.englishGloss)).toBeVisible();
  });

  test('clicking a concept card on /concepts navigates to detail page showing "Regional Variants"', async ({ page }) => {
    await page.goto('/concepts');

    await page.getByText(concept.englishGloss).click();

    await expect(page).toHaveURL(new RegExp(`/concepts/${concept._id}`));
    // The detail page always renders the "Regional Variants" heading when variants exist
    await expect(page.getByText('Regional Variants')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Guest — concept detail region tab strip', () => {
  let adminToken;
  let concept;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminToken(request);
    // Create a concept with TWO variants that share the same Pashto word but differ
    // by region, phonetic, and definition so clicking between tabs changes visible text.
    concept = await createPublishedConcept(request, adminToken, `e2e-tab-gloss-${Date.now()}`);

    await createPublishedVariant(request, adminToken, concept._id, {
      pashto: 'میرمن',
      phonetic: 'merman-kohat',
      region: 'Kohat',
      definition: 'woman - Kohat dialect (e2e)',
    });

    await createPublishedVariant(request, adminToken, concept._id, {
      pashto: 'میرمن',
      phonetic: 'merman-hangu',
      region: 'Hangu',
      definition: 'woman - Hangu dialect (e2e)',
    });
  });

  test('clicking a region tab switches the displayed phonetic and definition', async ({ page }) => {
    await page.goto(`/concepts/${concept._id}`);

    // Both region tab buttons should be present
    const kohatTab = page.getByRole('button', { name: 'Kohat' });
    const hanguTab = page.getByRole('button', { name: 'Hangu' });
    await expect(kohatTab).toBeVisible();
    await expect(hanguTab).toBeVisible();

    // Initially the first tab (Kohat) is active — its content is shown
    await expect(page.getByText('merman-kohat')).toBeVisible();
    await expect(page.getByText('woman - Kohat dialect (e2e)')).toBeVisible();

    // Click the Hangu tab
    await hanguTab.click();

    // Now the Hangu variant's content should be visible
    await expect(page.getByText('merman-hangu')).toBeVisible();
    await expect(page.getByText('woman - Hangu dialect (e2e)')).toBeVisible();

    // And the Kohat content should be gone
    await expect(page.getByText('merman-kohat')).not.toBeVisible();
  });

  test('clicking "+ I also say this in my region" when unauthenticated navigates to /login', async ({ page }) => {
    await page.goto(`/concepts/${concept._id}`);

    // The button text exactly matches the UI
    const alsoSayBtn = page.getByRole('button', { name: '+ I also say this in my region' }).first();
    await expect(alsoSayBtn).toBeVisible();
    await alsoSayBtn.click();

    await expect(page).toHaveURL('/login');
  });
});
