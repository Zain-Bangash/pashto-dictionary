const mongoose = require('mongoose');

const conceptSchema = new mongoose.Schema(
  {
    englishGloss: { type: String, required: true, trim: true },
    normalizedGloss: { type: String },
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
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

conceptSchema.pre('save', function () {
  this.normalizedGloss = this.englishGloss.toLowerCase().trim();
});

conceptSchema.index({ status: 1 });
conceptSchema.index(
  { normalizedGloss: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

module.exports = mongoose.model('Concept', conceptSchema);
