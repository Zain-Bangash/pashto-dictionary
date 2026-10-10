import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import VariantSuggestion from '../models/VariantSuggestion';
import logger from '../utils/logger';

const dryRun = process.argv.includes('--dry-run');
const OLD_INDEX = 'variant_1';

// Replaces the one-open-suggestion-per-word index with one-per-person-per-word. Mongoose creates
// new indexes but never drops old ones, and the old unique index would still block a second person.
// Safe to run more than once.
async function main(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const collection = VariantSuggestion.collection;
  const names = (await collection.indexes()).map((i) => i.name);

  if (names.includes(OLD_INDEX)) {
    logger.info(`${dryRun ? 'Would drop' : 'Dropping'} index ${OLD_INDEX}`);
    if (!dryRun) await collection.dropIndex(OLD_INDEX);
  } else {
    logger.info(`Index ${OLD_INDEX} not present`);
  }

  if (names.includes('one_open_per_user')) {
    logger.info('Index one_open_per_user already present');
  } else {
    logger.info(`${dryRun ? 'Would create' : 'Creating'} index one_open_per_user`);
    if (!dryRun) await VariantSuggestion.createIndexes();
  }
  await mongoose.disconnect();
}

main().catch(async (err: Error) => {
  logger.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
