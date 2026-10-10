import { Schema, model } from 'mongoose';
import { IAudioClip, AUDIO_STATUSES, laneFor } from '../types/models';

const audioClipSchema = new Schema<IAudioClip>(
  {
    variant: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    slot: { type: String, required: true },
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    durationMs: { type: Number, required: true },
    status: { type: String, enum: AUDIO_STATUSES, default: 'pending' },
    lane: { type: String, enum: ['live', 'open'] },
    replaces: { type: Schema.Types.ObjectId, ref: 'AudioClip' },
    submittedBy: { type: String, required: true },
    reviewedBy: { type: String },
    moderatorNote: { type: String },
    retiredReason: { type: String },
    fileDeletedAt: { type: Date },
  },
  { timestamps: true }
);

audioClipSchema.pre('save', function () {
  this.lane = laneFor(this.status);
});

audioClipSchema.index({ variant: 1, slot: 1, lane: 1 }, { unique: true, partialFilterExpression: { lane: { $exists: true } } });
audioClipSchema.index({ status: 1, createdAt: 1 });
audioClipSchema.index({ submittedBy: 1, createdAt: -1 });

export = model<IAudioClip>('AudioClip', audioClipSchema);
