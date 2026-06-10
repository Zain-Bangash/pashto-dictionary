import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  cognitoSub: string;
  role: 'user' | 'moderator' | 'admin';
  region?: 'Kohat' | 'Hangu' | 'Tirah' | 'Thal' | 'Parachinar';
  village?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConcept extends Document {
  englishGloss: string;
  normalizedGloss?: string;
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'other';
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
  region: 'Kohat' | 'Hangu' | 'Tirah' | 'Thal' | 'Parachinar';
  definition: string;
  example?: string;
  submissionNote?: string;
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

export interface IModerationLog extends Document {
  targetModel?: 'Concept' | 'Variant' | 'User';
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
    | 'merged';
  performedBy: string;
  note?: string;
  changes?: Record<string, unknown>;
  timestamp: Date;
}
