'use strict';

const { execSync } = require('child_process');
const path = require('path');

module.exports = async function globalSetup() {
  const script = path.resolve(__dirname, '../server/src/scripts/seedE2EAdmin.js');
  execSync(`node "${script}"`, { stdio: 'inherit' });
};
