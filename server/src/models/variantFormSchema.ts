import { Schema } from 'mongoose';
import { IVariantForm } from '../types/models';
import { FORM_KINDS, GENDERS, NUMBERS, CASES, VERB_FORMS, FORM_MAX } from '../utils/variantForms';

// Shared by Variant.forms and VariantSuggestion.proposed.forms
export const variantFormSchema = new Schema<IVariantForm>(
  {
    kind: { type: String, enum: FORM_KINDS, required: true },
    gender: { type: String, enum: GENDERS },
    number: { type: String, enum: NUMBERS },
    case: { type: String, enum: CASES },
    verbForm: { type: String, enum: VERB_FORMS },
    pashto: { type: String, required: true, trim: true, maxlength: FORM_MAX.pashto },
    normalizedPashto: { type: String },
    phonetic: { type: String, trim: true, maxlength: FORM_MAX.phonetic },
    example: { type: String, trim: true, maxlength: FORM_MAX.example },
    // Cognito sub of whoever's suggestion added this form; set server-side only, absent means the word's submitter
    addedBy: { type: String },
  },
  { _id: false }
);
