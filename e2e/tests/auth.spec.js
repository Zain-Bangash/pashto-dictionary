'use strict';

const { test, expect } = require('@playwright/test');
const { loginAs } = require('../helpers/auth.js');

const API = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Retry wrapper matching the pattern used in moderation.spec.js
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

async function getAdminToken(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: 'e2e-admin@test.local', password: 'E2ePassword1!' },
  });
  const body = await res.json();
  return body.data.token;
}

// ---------------------------------------------------------------------------
// Flow 1 — Register: success path
// ---------------------------------------------------------------------------

test.describe('Auth — Register: success', () => {
  // Each test run generates a unique email so parallel runs do not collide.
  // The @test.local suffix ensures global-teardown.js removes it automatically.
  let registeredEmail;

  test.beforeAll(() => {
    registeredEmail = `e2e-reg-${Date.now()}@test.local`;
  });

  test('fills registration form and lands on homepage logged in', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Username').fill('e2e_reg_user');
    await page.getByLabel('Email').fill(registeredEmail);
    await page.getByLabel('Password').fill('E2ePassword1!');

    await page.getByRole('button', { name: 'Register' }).click();

    // After successful registration the app navigates to / and the user is logged in.
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // The logged-in navbar shows the username instead of Login / Register links.
    await expect(page.getByText('e2e_reg_user')).toBeVisible();

    // Guest nav links must be gone.
    await expect(page.getByRole('link', { name: 'Login' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 2 — Register: client-side validation on empty form
// ---------------------------------------------------------------------------

test.describe('Auth — Register: validation — missing required fields', () => {
  test('submitting an empty form shows inline validation errors without navigating', async ({ page }) => {
    await page.goto('/register');

    // Submit without filling anything in.
    await page.getByRole('button', { name: 'Register' }).click();

    // The client-side validate() function fires before any API call.
    await expect(page.getByText('Username is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();

    // No navigation — still on /register.
    await expect(page).toHaveURL('/register');
  });
});

// ---------------------------------------------------------------------------
// Flow 3 — Register: duplicate email
// ---------------------------------------------------------------------------

test.describe('Auth — Register: validation — duplicate email', () => {
  test('attempting to register with an existing email shows an error', async ({ page }) => {
    await page.goto('/register');

    // Use the pre-seeded user account — its email is already in the database.
    await page.getByLabel('Username').fill('some_other_name');
    await page.getByLabel('Email').fill('e2e-user@test.local');
    await page.getByLabel('Password').fill('E2ePassword1!');

    await page.getByRole('button', { name: 'Register' }).click();

    // The server returns 409; the Register component renders apiError.
    // The server message is "email already in use".
    await expect(page.getByText('already in use')).toBeVisible({ timeout: 8000 });

    // No navigation — still on /register.
    await expect(page).toHaveURL('/register');
  });
});

// ---------------------------------------------------------------------------
// Flow 4 — Login: success path
// ---------------------------------------------------------------------------

test.describe('Auth — Login: success', () => {
  test('valid credentials log the user in, store a token, and show the logged-in navbar', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('e2e-user@test.local');
    await page.getByLabel('Password').fill('E2ePassword1!');

    await page.getByRole('button', { name: 'Log In' }).click();

    // Redirects to / after login.
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // JWT must be stored in localStorage.
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // Logged-in nav element (username button) is visible.
    await expect(page.getByText('e2e-user')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 5 — Login: failure (wrong password)
// ---------------------------------------------------------------------------

test.describe('Auth — Login: failure — wrong password', () => {
  test('wrong password does not grant access — no token stored, stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Email').fill('e2e-user@test.local');
    await page.getByLabel('Password').fill('WrongPassword999!');

    // The global Axios 401 interceptor in api.js calls window.location.replace('/login')
    // on any 401 response — including failed login attempts. This means the component's
    // apiError state is never rendered; instead the page reloads to /login.
    // We verify the end-state: user is NOT logged in, still on /login, no token.
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.status() === 401),
      page.getByRole('button', { name: 'Log In' }).click(),
    ]);

    expect(response.status()).toBe(401);

    // After the 401 the interceptor calls window.location.replace('/login'),
    // which navigates back to /login (guest state — no token in localStorage).
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // The login form heading must be present — we are on the login page, not the app.
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();

    // Crucially, no token was stored — the login failed.
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();

    // Guest navbar links are present — the user is not logged in.
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 6 — Session persistence across page reload
// ---------------------------------------------------------------------------

test.describe('Auth — Session persistence on reload', () => {
  test('logged-in user remains authenticated after a full page reload', async ({ page }) => {
    await loginAs(page, 'user');

    // loginAs already calls page.reload(); confirm the navbar still shows the username.
    await expect(page.getByText('e2e-user')).toBeVisible({ timeout: 10000 });

    // Reload once more to verify the AuthContext rehydrates from /api/auth/me.
    await page.reload();

    await expect(page.getByText('e2e-user')).toBeVisible({ timeout: 10000 });

    // Guest links must still be absent.
    await expect(page.getByRole('link', { name: 'Login' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 7 — Logout
// ---------------------------------------------------------------------------

test.describe('Auth — Logout', () => {
  test('clicking Logout clears the token and restores guest navigation', async ({ page }) => {
    await loginAs(page, 'user');

    // Open the user dropdown.
    await page.getByText('e2e-user').click();

    // Click the Logout button inside the dropdown.
    await page.getByRole('button', { name: 'Logout' }).click();

    // Token must be gone from localStorage.
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();

    // Guest navigation links are restored.
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 8 — Protected-route redirect
// ---------------------------------------------------------------------------

test.describe('Auth — Protected route redirect', () => {
  test('navigating to /submit without being logged in redirects to /login', async ({ page }) => {
    // Ensure no token exists in this fresh browser context.
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('token'));

    // Attempt to visit a protected route directly.
    await page.goto('/submit');

    // ProtectedRoute sends the user to /login.
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Flow 9 — Register with optional region and village fields
//
// USER-FLOWS.md: "As a user I should be able to register with a username,
// email, and password. I can optionally add my region (Kohat, Hangu, Tirah,
// Thal, or Parachinar) and village."
// Flow 1 covers the required-fields-only path; this covers the optional path.
// ---------------------------------------------------------------------------

test.describe('Auth — Register with optional region and village', () => {
  let registeredEmail;

  test.beforeAll(() => {
    registeredEmail = `e2e-opt-reg-${Date.now()}@test.local`;
  });

  test('filling optional region and village during registration succeeds and logs the user in', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Username').fill('e2e_opt_reg');
    await page.getByLabel('Email').fill(registeredEmail);
    await page.getByLabel('Password').fill('E2ePassword1!');

    // Optional region dropdown — five allowed regions
    const regionSelect = page.getByLabel(/region/i);
    await expect(regionSelect).toBeVisible();
    await regionSelect.selectOption('Hangu');

    // Optional village field
    const villageInput = page.getByLabel(/village/i);
    await expect(villageInput).toBeVisible();
    await villageInput.fill('Kachi Garhi');

    await page.getByRole('button', { name: 'Register' }).click();

    // Successful registration redirects to / with the logged-in navbar
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await expect(page.getByText('e2e_opt_reg')).toBeVisible();

    // Guest links must be absent
    await expect(page.getByRole('link', { name: 'Login' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).not.toBeVisible();
  });
});
