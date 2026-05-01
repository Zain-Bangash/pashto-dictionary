# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: guest.spec.js >> Guest — homepage >> clicking a concept card on the homepage navigates to its detail page
- Location: tests/guest.spec.js:41:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('e2e-homepage-gloss').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('e2e-homepage-gloss').first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - generic [ref=e5]:
      - link "پ Pashto Dictionary د پښتو قاموس" [ref=e6] [cursor=pointer]:
        - /url: /
        - generic [ref=e8]: پ
        - generic [ref=e9]:
          - generic [ref=e10]:
            - generic [ref=e11]: Pashto
            - generic [ref=e12]: Dictionary
          - generic [ref=e13]: د پښتو قاموس
      - generic [ref=e14]:
        - link "Browse" [ref=e15] [cursor=pointer]:
          - /url: /concepts
        - link "Community" [ref=e16] [cursor=pointer]:
          - /url: /concepts
        - link "About" [ref=e17] [cursor=pointer]:
          - /url: /concepts
      - generic [ref=e18]:
        - link "Login" [ref=e19] [cursor=pointer]:
          - /url: /login
        - link "Register" [ref=e20] [cursor=pointer]:
          - /url: /register
  - generic [ref=e22]:
    - generic [ref=e24]:
      - img
      - textbox "Search Pashto words…" [ref=e25]
      - button "Search" [ref=e26]
    - generic [ref=e27]:
      - generic [ref=e28]:
        - generic [ref=e29]:
          - generic [ref=e30]: Word of the Day
          - generic [ref=e33]: LIVE
        - generic [ref=e34]: MAY 1, 2026
      - generic [ref=e36]:
        - generic [ref=e38]: لمر
        - generic [ref=e43]:
          - generic [ref=e44]:
            - generic [ref=e45]: noun
            - button "Listen" [ref=e46]:
              - img [ref=e47]
              - generic [ref=e55]: Listen
          - generic [ref=e56]:
            - paragraph [ref=e57]: Sun
            - link "Explore Word →" [ref=e59] [cursor=pointer]:
              - /url: /concepts/662d5a1b1f1a2b3c4d5e0002
    - generic [ref=e60]:
      - generic [ref=e61]:
        - generic [ref=e62]: Recent Words
        - link "View all →" [ref=e63] [cursor=pointer]:
          - /url: /concepts
      - generic [ref=e64]:
        - link "مینه N. Love / Affection Mor meena be-hada de Listen" [ref=e65] [cursor=pointer]:
          - /url: /concepts/662d5a1b1f1a2b3c4d5e0001
          - generic [ref=e66]:
            - generic [ref=e67]:
              - generic [ref=e68]:
                - generic [ref=e69]: مینه
                - generic [ref=e70]: N.
              - paragraph [ref=e72]: Love / Affection
              - paragraph [ref=e73]: Mor meena be-hada de
            - button "Listen" [ref=e75]:
              - img [ref=e76]
              - generic [ref=e84]: Listen
        - link "لمر N. Sun Listen" [ref=e85] [cursor=pointer]:
          - /url: /concepts/662d5a1b1f1a2b3c4d5e0002
          - generic [ref=e86]:
            - generic [ref=e87]:
              - generic [ref=e88]:
                - generic [ref=e89]: لمر
                - generic [ref=e90]: N.
              - paragraph [ref=e92]: Sun
            - button "Listen" [ref=e94]:
              - img [ref=e95]
              - generic [ref=e103]: Listen
        - link "کار کول V. To Work Listen" [ref=e104] [cursor=pointer]:
          - /url: /concepts/662d5a1b1f1a2b3c4d5e0003
          - generic [ref=e105]:
            - generic [ref=e106]:
              - generic [ref=e107]:
                - generic [ref=e108]: کار کول
                - generic [ref=e109]: V.
              - paragraph [ref=e111]: To Work
            - button "Listen" [ref=e113]:
              - img [ref=e114]
              - generic [ref=e122]: Listen
    - generic [ref=e123]:
      - generic [ref=e124]:
        - heading "Community" [level=2] [ref=e125]
        - generic [ref=e126]:
          - generic [ref=e127]:
            - generic [ref=e129]: ⚡
            - generic [ref=e130]:
              - generic [ref=e131]: "13"
              - generic [ref=e132]: Words published
          - generic [ref=e133]:
            - generic [ref=e135]: ◎
            - generic [ref=e136]:
              - generic [ref=e137]: "8"
              - generic [ref=e138]: Contributors
          - generic [ref=e139]:
            - generic [ref=e141]: +
            - generic [ref=e142]:
              - generic [ref=e143]: "1"
              - generic [ref=e144]: Added this month
      - generic [ref=e145]:
        - generic [ref=e146]:
          - heading "Know a Pashto word?" [level=3] [ref=e147]
          - paragraph [ref=e148]: Help grow the dictionary. Every contribution makes Pashto more accessible online.
          - generic [ref=e151]: Others are contributing right now
        - link "+ Contribute a Word" [ref=e152] [cursor=pointer]:
          - /url: /register
```

# Test source

```ts
  1   | 'use strict';
  2   | 
  3   | const { test, expect } = require('@playwright/test');
  4   | const { getAdminToken, createPublishedConcept, createPublishedVariant } = require('../helpers/seed.js');
  5   | 
  6   | // All tests use a shared admin token and a shared published concept so seeding
  7   | // is done once per describe block. Each test that needs a fresh concept creates
  8   | // its own via the helpers so tests stay independent.
  9   | 
  10  | test.describe('Guest — homepage', () => {
  11  |   let adminToken;
  12  |   let concept;
  13  | 
  14  |   test.beforeAll(async ({ request }) => {
  15  |     adminToken = await getAdminToken(request);
  16  |     // Seed one published concept so the homepage has content to show
  17  |     concept = await createPublishedConcept(request, adminToken, 'e2e-homepage-gloss');
  18  |     await createPublishedVariant(request, adminToken, concept._id, {
  19  |       pashto: 'کور',
  20  |       phonetic: 'kor',
  21  |       region: 'Kohat',
  22  |       definition: 'house (e2e)',
  23  |     });
  24  |   });
  25  | 
  26  |   test('shows search bar, Word of the Day section, and community stats', async ({ page }) => {
  27  |     await page.goto('/');
  28  | 
  29  |     // Search bar
  30  |     await expect(page.getByPlaceholder('Search Pashto words…')).toBeVisible();
  31  | 
  32  |     // Word of the Day heading (the LIVE badge and label are inside the hero card)
  33  |     await expect(page.getByText('Word of the Day')).toBeVisible();
  34  | 
  35  |     // Community stats labels — all three counters are always rendered
  36  |     await expect(page.getByText('Words published')).toBeVisible();
  37  |     await expect(page.getByText('Contributors')).toBeVisible();
  38  |     await expect(page.getByText('Added this month')).toBeVisible();
  39  |   });
  40  | 
  41  |   test('clicking a concept card on the homepage navigates to its detail page', async ({ page }) => {
  42  |     await page.goto('/');
  43  | 
  44  |     // The seeded concept's english gloss appears in the recent-words grid as a link
  45  |     const card = page.getByText(concept.englishGloss).first();
> 46  |     await expect(card).toBeVisible();
      |                        ^ Error: expect(locator).toBeVisible() failed
  47  |     await card.click();
  48  | 
  49  |     await expect(page).toHaveURL(new RegExp(`/concepts/${concept._id}`));
  50  |     await expect(page.getByText(concept.englishGloss)).toBeVisible();
  51  |   });
  52  | 
  53  |   test('submitting the homepage search navigates to /concepts?q=...', async ({ page }) => {
  54  |     await page.goto('/');
  55  | 
  56  |     const searchInput = page.getByPlaceholder('Search Pashto words…');
  57  |     await searchInput.fill('sister');
  58  |     await searchInput.press('Enter');
  59  | 
  60  |     await expect(page).toHaveURL(/\/concepts\?q=sister/);
  61  |   });
  62  | });
  63  | 
  64  | test.describe('Guest — navbar navigation', () => {
  65  |   test('clicking Browse in the navbar navigates to /concepts', async ({ page }) => {
  66  |     await page.goto('/');
  67  | 
  68  |     await page.getByRole('link', { name: 'Browse' }).click();
  69  | 
  70  |     await expect(page).toHaveURL(/\/concepts/);
  71  |     await expect(page.getByRole('heading', { name: 'Browse Entries' })).toBeVisible();
  72  |   });
  73  | 
  74  |   test('clicking Register in the navbar navigates to /register', async ({ page }) => {
  75  |     await page.goto('/');
  76  | 
  77  |     await page.getByRole('link', { name: 'Register' }).click();
  78  | 
  79  |     await expect(page).toHaveURL('/register');
  80  |   });
  81  | 
  82  |   test('clicking Login in the navbar navigates to /login', async ({ page }) => {
  83  |     await page.goto('/');
  84  | 
  85  |     await page.getByRole('link', { name: 'Login' }).click();
  86  | 
  87  |     await expect(page).toHaveURL('/login');
  88  |   });
  89  | });
  90  | 
  91  | test.describe('Guest — /concepts browse page', () => {
  92  |   let adminToken;
  93  |   let concept;
  94  | 
  95  |   test.beforeAll(async ({ request }) => {
  96  |     adminToken = await getAdminToken(request);
  97  |     concept = await createPublishedConcept(request, adminToken, 'e2e-browse-gloss');
  98  |     await createPublishedVariant(request, adminToken, concept._id, {
  99  |       pashto: 'لور',
  100 |       phonetic: 'lor',
  101 |       region: 'Hangu',
  102 |       definition: 'daughter (e2e)',
  103 |     });
  104 |   });
  105 | 
  106 |   test('shows published concept cards with the English gloss visible', async ({ page }) => {
  107 |     await page.goto('/concepts');
  108 | 
  109 |     // The heading is always present
  110 |     await expect(page.getByRole('heading', { name: 'Browse Entries' })).toBeVisible();
  111 | 
  112 |     // The seeded concept's English gloss appears as a card link
  113 |     await expect(page.getByText(concept.englishGloss)).toBeVisible();
  114 |   });
  115 | 
  116 |   test('clicking a concept card on /concepts navigates to detail page showing "Regional Variants"', async ({ page }) => {
  117 |     await page.goto('/concepts');
  118 | 
  119 |     await page.getByText(concept.englishGloss).click();
  120 | 
  121 |     await expect(page).toHaveURL(new RegExp(`/concepts/${concept._id}`));
  122 |     // The detail page always renders the "Regional Variants" heading when variants exist
  123 |     await expect(page.getByText('Regional Variants')).toBeVisible();
  124 |   });
  125 | });
  126 | 
  127 | test.describe('Guest — concept detail region tab strip', () => {
  128 |   let adminToken;
  129 |   let concept;
  130 | 
  131 |   test.beforeAll(async ({ request }) => {
  132 |     adminToken = await getAdminToken(request);
  133 |     // Create a concept with TWO variants that share the same Pashto word but differ
  134 |     // by region, phonetic, and definition so clicking between tabs changes visible text.
  135 |     concept = await createPublishedConcept(request, adminToken, 'e2e-tab-gloss');
  136 | 
  137 |     await createPublishedVariant(request, adminToken, concept._id, {
  138 |       pashto: 'میرمن',
  139 |       phonetic: 'merman-kohat',
  140 |       region: 'Kohat',
  141 |       definition: 'woman - Kohat dialect (e2e)',
  142 |     });
  143 | 
  144 |     await createPublishedVariant(request, adminToken, concept._id, {
  145 |       pashto: 'میرمن',
  146 |       phonetic: 'merman-hangu',
```