import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  cognitoSub: string;
  role: 'user' | 'moderator' | 'admin';
  region?: string;
  village?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConcept extends Document {
  englishGloss: string;
  normalizedGloss?: string;
  partOfSpeech: string;
  extra?: Map<string, string>;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  submittedBy?: string;
  reviewedBy?: string;
  moderatorNote?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FormKind = 'noun' | 'verb';
export type FormGender = 'masculine' | 'feminine';
export type FormNumber = 'singular' | 'plural';
export type FormCase = 'direct' | 'oblique';
export type VerbForm = 'infinitive' | 'past' | 'present' | 'imperative';

export interface IVariantForm {
  kind: FormKind;
  gender?: FormGender;
  number?: FormNumber;
  case?: FormCase;
  verbForm?: VerbForm;
  pashto: string;
  normalizedPashto?: string;
  phonetic?: string;
  example?: string;
  addedBy?: string;
}

export interface IVariant extends Document {
  concept: Types.ObjectId;
  pashto: string;
  normalizedPashto?: string;
  phonetic?: string;
  normalizedPhonetic?: string;
  region: string;
  definition: string;
  example?: string;
  submissionNote?: string;
  extra?: Map<string, string>;
  forms?: IVariantForm[];
  status: 'pending' | 'approved' | 'rejected' | 'published';
  submittedBy?: string;
  reviewedBy?: string;
  moderatorNote?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type LookupType = 'region' | 'partOfSpeech';

export interface ILookup extends Document {
  type: LookupType;
  key: string;
  label: string;
  order: number;
  active: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type FieldAppliesTo = 'concept' | 'variant';
export type FieldType = 'text' | 'textarea' | 'select';

export interface IFieldOption {
  _id: Types.ObjectId;
  key: string;
  label: string;
  active: boolean;
}

export interface IFieldDefinition extends Document {
  appliesTo: FieldAppliesTo;
  key: string;
  label: string;
  type: FieldType;
  options: Types.DocumentArray<IFieldOption & Types.Subdocument>;
  required: boolean;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'published';
export const OPEN_SUGGESTION_STATUSES: SuggestionStatus[] = ['pending', 'approved'];

export interface IProposal {
  phonetic?: string;
  example?: string;
  forms?: IVariantForm[];
  extra?: Map<string, string>;
}

export interface IVariantSuggestion extends Document {
  variant: Types.ObjectId;
  proposed: IProposal;
  status: SuggestionStatus;
  submittedBy: string;
  reviewedBy?: string;
  moderatorNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AudioClipStatus = 'pending' | 'approved' | 'rejected' | 'published' | 'retired' | 'withdrawn';
export const AUDIO_STATUSES: AudioClipStatus[] = ['pending', 'approved', 'rejected', 'published', 'retired', 'withdrawn'];

// 'live' = the published clip of a slot, 'open' = one under review; a unique index allows one of each
export function laneFor(status: AudioClipStatus): 'live' | 'open' | undefined {
  if (status === 'published') return 'live';
  if (status === 'pending' || status === 'approved') return 'open';
  return undefined;
}

export interface IAudioClip extends Document {
  variant: Types.ObjectId;
  slot: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  status: AudioClipStatus;
  lane?: 'live' | 'open';
  replaces?: Types.ObjectId;
  submittedBy: string;
  reviewedBy?: string;
  moderatorNote?: string;
  retiredReason?: string;
  fileDeletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IModerationLog extends Document {
  targetModel?: 'Concept' | 'Variant' | 'User' | 'Lookup' | 'FieldDefinition' | 'VariantSuggestion' | 'AudioClip';
  targetId?: Types.ObjectId;
  action:
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'published'
    | 'resubmitted'
    | 'profile_updated'
    | 'deleted'
    | 'edited'
    | 'merged'
    | 'lookup_changed'
    | 'field_changed'
    | 'suggestion_applied'
    | 'retired'
    | 'withdrawn'
    | 'audio_published'
    | 'role_changed';
  performedBy: string;
  note?: string;
  changes?: Record<string, unknown>;
  timestamp: Date;
}
