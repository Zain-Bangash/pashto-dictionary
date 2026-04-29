const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    concept: { type: mongoose.Schema.Types.ObjectId, ref: 'Concept', required: true },
    pashto:   { type: String, required: true, trim: true },
    phonetic: { type: String, trim: true },
    region: {
      type: String,
      enum: ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'],
      required: true,
    },
    definition: { type: String, required: true, trim: true },
    example:        { type: String, trim: true },
    submissionNote: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'published'],
      default: 'pending',
    },
    submittedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderatorNote: { type: String },
  },
  { timestamps: true }
);

variantSchema.index({ status: 1 });
variantSchema.index({ concept: 1 });
variantSchema.index({ phonetic: 1 });
variantSchema.index({ pashto: 'text' });

module.exports = mongoose.model('Variant', variantSchema);
