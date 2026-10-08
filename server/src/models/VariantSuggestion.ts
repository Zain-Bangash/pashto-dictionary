import { Schema, model } from 'mongoose';
import { IVariantSuggestion, IProposal, OPEN_SUGGESTION_STATUSES } from '../types/models';
import { variantFormSchema } from './variantFormSchema';

const proposalSchema = new Schema<IProposal>(
  {
    phonetic: { type: String, trim: true },
    example: { type: String, trim: true },
    forms: { type: [variantFormSchema], default: undefined },
    extra: { type: Map, of: String },
  },
  { _id: false }
);

const variantSuggestionSchema = new Schema<IVariantSuggestion>(
  {
    variant: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    proposed: { type: proposalSchema, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'published'],
      default: 'pending',
    },
    submittedBy: { type: String, required: true },
    reviewedBy: { type: String },
    moderatorNote: { type: String },
  },
  { timestamps: true }
);

variantSuggestionSchema.index({ status: 1, createdAt: -1 });
variantSuggestionSchema.index({ submittedBy: 1 });
// At most one open suggestion per variant
variantSuggestionSchema.index(
  { variant: 1 },
  { unique: true, partialFilterExpression: { status: { $in: OPEN_SUGGESTION_STATUSES } } }
);

export = model<IVariantSuggestion>('VariantSuggestion', variantSuggestionSchema);
