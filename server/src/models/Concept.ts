import { Schema, model } from 'mongoose';
import { IConcept } from '../types/models';

const conceptSchema = new Schema<IConcept>(
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
    submittedBy: { type: String },
    reviewedBy: { type: String },
    moderatorNote: { type: String },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
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

export = model<IConcept>('Concept', conceptSchema);
