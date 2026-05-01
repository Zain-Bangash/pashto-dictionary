const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    concept: { type: mongoose.Schema.Types.ObjectId, ref: 'Concept', required: true },
    pashto:   { type: String, required: true, trim: true },
    normalizedPashto:  { type: String },
    phonetic: { type: String, trim: true },
    normalizedPhonetic: { type: String },
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
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

variantSchema.pre('save', function () {
  this.normalizedPashto = this.pashto.trim().normalize('NFC');
  if (this.phonetic) {
    this.normalizedPhonetic = this.phonetic.toLowerCase().trim();
  }
});

variantSchema.index({ status: 1 });
variantSchema.index({ concept: 1 });
variantSchema.index({ phonetic: 1 });
variantSchema.index({ pashto: 'text' });
variantSchema.index(
  { concept: 1, normalizedPashto: 1, region: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

module.exports = mongoose.model('Variant', variantSchema);
