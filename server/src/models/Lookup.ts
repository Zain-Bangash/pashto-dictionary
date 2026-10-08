import { Schema, model } from 'mongoose';
import { ILookup } from '../types/models';

const lookupSchema = new Schema<ILookup>(
  {
    type: { type: String, enum: ['region', 'partOfSpeech'], required: true, immutable: true },
    key: { type: String, required: true, trim: true, maxlength: 50, immutable: true },
    label: { type: String, required: true, trim: true, maxlength: 50 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false, immutable: true },
  },
  { timestamps: true }
);

lookupSchema.index({ type: 1, key: 1 }, { unique: true });
lookupSchema.index({ type: 1, order: 1 });

export = model<ILookup>('Lookup', lookupSchema);
