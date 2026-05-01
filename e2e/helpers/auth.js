'use strict';

const CREDENTIALS = {
  admin:     { email: 'e2e-admin@test.local', password: 'E2ePassword1!' },
  moderator: { email: 'e2e-mod@test.local',   password: 'E2ePassword1!' },
  user:      { email: 'e2e-user@test.local',  password: 'E2ePassword1!' },
};

/**
 * Logs in as the given role by injecting the JWT into localStorage and reloading
 * so AuthContext rehydrates the user object from /api/auth/me.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'admin'|'moderator'|'user'} role
 */
async function loginAs(page, role) {
  const { email, password } = CREDENTIALS[role];

  const res = await page.request.post('http://localhost:5000/api/auth/login', {
    data: { email, password },
  });
  const body = await res.json();
  const token = body.data.token;

  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.reload();
}

module.exports = { loginAs };
