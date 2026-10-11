import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import Variant from '../models/Variant';
import logger from '../utils/logger';
import { normalizePashto } from '../utils/normalize';

const dryRun = process.argv.includes('--dry-run');

// Recomputes normalizedPashto on every variant and form after normalizePashto changes. Records that would
// collide on the unique concept + word + region index are skipped and listed for an admin to merge.
// Safe to run more than once.
async function main(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const variants = await Variant.find({}, 'concept region pashto normalizedPashto forms isDeleted').lean();

  const next = variants.map((v) => ({
    v,
    word: normalizePashto(v.pashto),
    forms: (v.forms ?? []).map((f) => ({ ...f, normalizedPashto: normalizePashto(f.pashto) })),
  }));

  const groups = new Map<string, typeof next>();
  for (const n of next) {
    if (n.v.isDeleted) continue;
    const key = `${n.v.concept}|${n.word}|${n.v.region}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const clashing = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.forEach((n) => clashing.add(String(n.v._id)));
    logger.info(`Same word after normalizing, merge by hand: ${group.map((n) => `${n.v._id} (${n.v.pashto})`).join(', ')}`);
  }

  const changed = next.filter(
    (n) =>
      !clashing.has(String(n.v._id)) &&
      (n.word !== n.v.normalizedPashto || n.forms.some((f, i) => f.normalizedPashto !== n.v.forms?.[i]?.normalizedPashto))
  );

  if (!dryRun && changed.length) {
    await Variant.bulkWrite(
      changed.map((n) => ({
        updateOne: {
          filter: { _id: n.v._id },
          update: { $set: { normalizedPashto: n.word, ...(n.v.forms && { forms: n.forms }) } },
          timestamps: false,
        },
      }))
    );
  }

  logger.info(`${dryRun ? 'Would update' : 'Updated'} ${changed.length} of ${variants.length} variants; ${clashing.size} skipped as clashes`);
  await mongoose.disconnect();
}

main().catch(async (err: Error) => {
  logger.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
