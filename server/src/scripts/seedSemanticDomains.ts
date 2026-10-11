import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import Lookup from '../models/Lookup';
import logger from '../utils/logger';

const dryRun = process.argv.includes('--dry-run');

// A one-off starting point, not a fixed list: rows are ordinary admin-editable values and the script
// does nothing once any domain exists, so it never brings back one an admin renamed or deactivated.
const STARTER_DOMAINS = [
  'People & family',
  'Body & health',
  'Food & cooking',
  'Home, clothing & objects',
  'Farming & livestock',
  'Animals & plants',
  'Land, water & weather',
  'Time & seasons',
  'Movement & travel',
  'Work, tools & making',
  'Speech & communication',
  'Thoughts & feelings',
  'Qualities & descriptions',
  'Numbers & quantity',
  'Customs, faith & society',
];

async function main(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string);
  if (await Lookup.exists({ type: 'semanticDomain' })) {
    logger.info('Domains already exist; nothing to do');
  } else {
    logger.info(`${dryRun ? 'Would insert' : 'Inserting'} ${STARTER_DOMAINS.length} domains`);
    if (!dryRun) {
      await Lookup.insertMany(STARTER_DOMAINS.map((label, order) => ({ type: 'semanticDomain', key: label, label, order })));
    }
  }
  await mongoose.disconnect();
}

main().catch(async (err: Error) => {
  logger.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
