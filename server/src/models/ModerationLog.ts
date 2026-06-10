import { Schema, model } from 'mongoose';
import { IModerationLog } from '../types/models';

const moderationLogSchema = new Schema<IModerationLog>({
  // Legacy field kept for existing Entry log records
  entry: { type: Schema.Types.ObjectId, ref: 'Entry' },
  // New polymorphic target fields
  targetModel: { type: String, enum: ['Concept', 'Variant', 'User'] },
  targetId: { type: Schema.Types.ObjectId },
  action: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'published', 'resubmitted', 'profile_updated', 'deleted', 'edited', 'merged'],
    required: true,
  },
  performedBy: { type: String, required: true },
  note: { type: String },
  changes: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

export = model<IModerationLog>('ModerationLog', moderationLogSchema);
