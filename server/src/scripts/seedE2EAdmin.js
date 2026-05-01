'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const E2E_PASSWORD = 'E2ePassword1!';

const ACCOUNTS = [
  { username: 'e2e-admin',     email: 'e2e-admin@test.local', role: 'admin' },
  { username: 'e2e-mod',       email: 'e2e-mod@test.local',   role: 'moderator' },
  { username: 'e2e-user',      email: 'e2e-user@test.local',  role: 'user' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);

  for (const account of ACCOUNTS) {
    const existing = await User.findOne({ email: account.email });
    if (existing) {
      console.log(`[seedE2EAdmin] ${account.email} already exists — skipping.`);
      continue;
    }
    await new User({ ...account, passwordHash }).save();
    console.log(`[seedE2EAdmin] ${account.email} created.`);
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seedE2EAdmin] Error:', err.message);
  process.exit(1);
});
