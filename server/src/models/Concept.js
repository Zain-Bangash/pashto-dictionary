const mongoose = require('mongoose');

const conceptSchema = new mongoose.Schema(
  {
    englishGloss: { type: String, required: true, trim: true },
    partOfSpeech: {
      type: String,
      enum: ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'published'],
      default: 'pending',
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderatorNote: { type: String },
  },
  { timestamps: true }
);

conceptSchema.index({ status: 1 });
conceptSchema.index({ englishGloss: 'text' });

module.exports = mongoose.model('Concept', conceptSchema);
