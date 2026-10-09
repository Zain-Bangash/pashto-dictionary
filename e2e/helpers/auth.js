'use strict';

const CREDENTIALS = {
  admin:     { email: 'e2e-admin@test.local', password: 'E2ePassword1!' },
  moderator: { email: 'e2e-mod@test.local',   password: 'E2ePassword1!' },
  user:      { email: 'e2e-user@test.local',  password: 'E2ePassword1!' },
};

/**
 * Logs in through the API. page.request shares the browser context's cookie jar, so the
 * httpOnly refresh cookie lands in the browser and AuthContext restores the session on load.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'admin'|'moderator'|'user'} role
 */
async function loginAs(page, role) {
  const { email, password } = CREDENTIALS[role];

  await page.request.post('http://localhost:5000/api/auth/login', {
    data: { email, password },
  });

  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/refresh')),
    page.goto('/'),
  ]);
}

module.exports = { loginAs };
