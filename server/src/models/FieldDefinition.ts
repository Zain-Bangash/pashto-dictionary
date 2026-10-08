import { Schema, model } from 'mongoose';
import { IFieldDefinition } from '../types/models';

const optionSchema = new Schema({
  key: { type: String, required: true, trim: true, maxlength: 50, immutable: true },
  label: { type: String, required: true, trim: true, maxlength: 50 },
  active: { type: Boolean, default: true },
});

const fieldDefinitionSchema = new Schema<IFieldDefinition>(
  {
    appliesTo: { type: String, enum: ['concept', 'variant'], required: true, immutable: true },
    key: { type: String, required: true, match: /^[a-z][a-z0-9_]{0,39}$/, immutable: true },
    label: { type: String, required: true, trim: true, maxlength: 50 },
    type: { type: String, enum: ['text', 'textarea', 'select'], required: true, immutable: true },
    options: { type: [optionSchema], default: [] },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

fieldDefinitionSchema.index({ appliesTo: 1, key: 1 }, { unique: true });
fieldDefinitionSchema.index({ appliesTo: 1, order: 1 });

export = model<IFieldDefinition>('FieldDefinition', fieldDefinitionSchema);
