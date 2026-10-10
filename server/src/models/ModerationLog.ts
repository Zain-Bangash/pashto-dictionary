import { Schema, model } from 'mongoose';
import { IModerationLog } from '../types/models';

const moderationLogSchema = new Schema<IModerationLog>({
  targetModel: { type: String, enum: ['Concept', 'Variant', 'User', 'Lookup', 'FieldDefinition', 'VariantSuggestion', 'AudioClip'] },
  targetId: { type: Schema.Types.ObjectId },
  action: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'published', 'resubmitted', 'profile_updated', 'deleted', 'edited', 'merged', 'lookup_changed', 'field_changed', 'suggestion_applied', 'retired', 'withdrawn', 'audio_published'],
    required: true,
  },
  performedBy: { type: String, required: true },
  note: { type: String },
  changes: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

export = model<IModerationLog>('ModerationLog', moderationLogSchema);
