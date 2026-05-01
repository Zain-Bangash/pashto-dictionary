'use strict';

const { execSync } = require('child_process');
const path = require('path');

module.exports = async function globalTeardown() {
  const script = path.resolve(__dirname, '../server/src/scripts/cleanE2EData.js');
  execSync(`node "${script}"`, { stdio: 'inherit' });
};
