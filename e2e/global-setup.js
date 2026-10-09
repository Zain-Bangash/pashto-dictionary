'use strict';

const { execSync } = require('child_process');
const path = require('path');

// Sessions are created per test by helpers/auth.js (refresh cookie in the browser context),
// so global setup only seeds the Cognito + MongoDB users.
module.exports = async function globalSetup() {
  const script = path.resolve(__dirname, '../server/src/scripts/seedE2EAdmin.js');
  execSync(`node "${script}"`, { stdio: 'inherit' });
};
