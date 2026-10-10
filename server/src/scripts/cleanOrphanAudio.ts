import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import AudioClip from '../models/AudioClip';
import logger from '../utils/logger';
import { listKeys, removeObject } from '../utils/storage';
import { deleteClipFile } from '../utils/audioClips';

const dryRun = process.argv.includes('--dry-run');

// Deletes files of closed clips whose delete failed, and bucket files with no AudioClip at all
async function main(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const closed = await AudioClip.find({ status: { $in: ['rejected', 'retired', 'withdrawn'] }, fileDeletedAt: { $exists: false } });
  const known = new Set((await AudioClip.find({}, 'storageKey').lean()).map((c) => c.storageKey));
  // Skip files younger than an hour: an upload may be between its put and its insert
  const cutoff = Date.now() - 60 * 60 * 1000;
  const unknown = (await listKeys('audio/')).filter((key) => {
    if (known.has(key)) return false;
    const id = key.split('/').pop()?.split('.')[0] ?? '';
    return !mongoose.Types.ObjectId.isValid(id) || new mongoose.Types.ObjectId(id).getTimestamp().getTime() < cutoff;
  });

  logger.info(`${dryRun ? 'Would delete' : 'Deleting'} ${closed.length} closed-clip files and ${unknown.length} untracked files`);
  if (!dryRun) {
    for (const clip of closed) await deleteClipFile(clip);
    for (const key of unknown) await removeObject(key);
  }
  await mongoose.disconnect();
}

main().catch(async (err: Error) => {
  logger.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
