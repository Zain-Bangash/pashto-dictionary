import { Schema, model } from 'mongoose';
import { IVariant } from '../types/models';

const variantSchema = new Schema<IVariant>(
  {
    concept: { type: Schema.Types.ObjectId, ref: 'Concept', required: true },
    pashto: { type: String, required: true, trim: true },
    normalizedPashto: { type: String },
    phonetic: { type: String, trim: true },
    normalizedPhonetic: { type: String },
    region: {
      type: String,
      enum: ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'],
      required: true,
    },
    definition: { type: String, required: true, trim: true },
    example: { type: String, trim: true },
    submissionNote: { type: String, trim: true, maxlength: 500 },
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

export = model<IVariant>('Variant', variantSchema);
