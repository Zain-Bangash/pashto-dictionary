'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);

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

  console.log(
    `[cleanE2EData] Removed: ${deletedUsers.deletedCount} users, ` +
    `${deletedConcepts.deletedCount} concepts, ` +
    `${deletedVariants.deletedCount} variants, ` +
    `${deletedLogs.deletedCount} logs.`
  );

  await mongoose.disconnect();
}

clean().catch((err) => {
  console.error('[cleanE2EData] Error:', err.message);
  process.exit(1);
});
