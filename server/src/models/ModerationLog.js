const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema({
  // Legacy field kept for existing Entry log records
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry' },
  // New polymorphic target fields
  targetModel: { type: String, enum: ['Concept', 'Variant', 'User'] },
  targetId:    { type: mongoose.Schema.Types.ObjectId },
  action: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'published', 'resubmitted', 'profile_updated'],
    required: true,
  },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ModerationLog', moderationLogSchema);
