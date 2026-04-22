const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema({
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },
  action: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'published'],
    required: true,
  },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ModerationLog', moderationLogSchema);
