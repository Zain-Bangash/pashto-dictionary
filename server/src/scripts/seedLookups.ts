import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import logger from '../utils/logger';
import { ensureSystemLookups } from '../utils/lookups';

const dryRun = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const missing = await ensureSystemLookups({ dryRun });
  const verb = dryRun ? 'Would insert' : 'Inserted';
  logger.info(missing.length ? `${verb}: ${missing.join(', ')}` : 'All system lookups already present');
  await mongoose.disconnect();
}

main().catch(async (err: Error) => {
  logger.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
