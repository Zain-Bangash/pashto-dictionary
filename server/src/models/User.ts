import { Schema, model } from 'mongoose';
import { IUser } from '../types/models';

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    cognitoSub: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    region: { type: String, trim: true, maxlength: 50 },
    village: { type: String, trim: true },
  },
  { timestamps: true }
);

export = model<IUser>('User', userSchema);
