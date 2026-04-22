const mongoose = require('mongoose');

const definitionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    example: { type: String },
  },
  { _id: false }
);

const entrySchema = new mongoose.Schema(
  {
    pashto: { type: String, required: true },
    phonetic: { type: String },
    region: { type: String },
    partOfSpeech: {
      type: String,
      enum: ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'],
    },
    definitions: [definitionSchema],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'published'],
      default: 'pending',
    },
    moderatorNote: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

entrySchema.index({ pashto: 'text' });
entrySchema.index({ status: 1 });

module.exports = mongoose.model('Entry', entrySchema);
