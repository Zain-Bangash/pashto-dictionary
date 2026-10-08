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

export interface IModerationLog extends Document {
  targetModel?: 'Concept' | 'Variant' | 'User' | 'Lookup' | 'FieldDefinition';
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
    | 'field_changed';
  performedBy: string;
  note?: string;
  changes?: Record<string, unknown>;
  timestamp: Date;
}
