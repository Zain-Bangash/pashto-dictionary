'use strict';

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import User from '../models/User';
import Concept from '../models/Concept';
import Variant from '../models/Variant';
import ModerationLog from '../models/ModerationLog';

async function clean(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string);

  // Find all test accounts
  const testUsers = await User.find({ email: /@test\.local$/ }).lean();
  const testUserIds = testUsers.map((u) => u._id);

  // Find concepts submitted by test users
  const testConcepts = await Concept.find({ submittedBy: { $in: testUserIds } }).lean();
  const testConceptIds = testConcepts.map((c) => c._id);

  // Delete variants for those concepts OR submitted by test users
  const deletedVariants = await Variant.deleteMany({
    $or: [
      { concept: { $in: testConceptIds } },
      { submittedBy: { $in: testUserIds } },
    ],
  });

  // Delete moderation logs referencing test users or test concepts/variants
  const deletedLogs = await ModerationLog.deleteMany({
    $or: [
      { performedBy: { $in: testUserIds } },
      { targetId: { $in: [...testUserIds, ...testConceptIds] } },
    ],
  });

  // Delete concepts
  const deletedConcepts = await Concept.deleteMany({ _id: { $in: testConceptIds } });

  // Delete users
  const deletedUsers = await User.deleteMany({ email: /@test\.local$/ });

  process.stdout.write(
    `[cleanE2EData] Removed: ${deletedUsers.deletedCount} users, ` +
    `${deletedConcepts.deletedCount} concepts, ` +
    `${deletedVariants.deletedCount} variants, ` +
    `${deletedLogs.deletedCount} logs.\n`
  );

  await mongoose.disconnect();
}

clean().catch((err: Error) => {
  process.stderr.write(`[cleanE2EData] Error: ${err.message}\n`);
  process.exit(1);
});
