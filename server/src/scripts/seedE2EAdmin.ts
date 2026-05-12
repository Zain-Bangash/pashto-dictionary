'use strict';

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

const E2E_PASSWORD = 'E2ePassword1!';

const ACCOUNTS: Array<{ username: string; email: string; role: 'admin' | 'moderator' | 'user' }> = [
  { username: 'e2e-admin',     email: 'e2e-admin@test.local', role: 'admin' },
  { username: 'e2e-mod',       email: 'e2e-mod@test.local',   role: 'moderator' },
  { username: 'e2e-user',      email: 'e2e-user@test.local',  role: 'user' },
];

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);

  for (const account of ACCOUNTS) {
    const existing = await User.findOne({ email: account.email });
    if (existing) {
      process.stdout.write(`[seedE2EAdmin] ${account.email} already exists — skipping.\n`);
      continue;
    }
    await new User({ ...account, passwordHash }).save();
    process.stdout.write(`[seedE2EAdmin] ${account.email} created.\n`);
  }

  await mongoose.disconnect();
}

seed().catch((err: Error) => {
  process.stderr.write(`[seedE2EAdmin] Error: ${err.message}\n`);
  process.exit(1);
});
