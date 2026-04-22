const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const ModerationLog = require('../models/ModerationLog');
// Require User so the schema is registered for populate calls
require('../models/User');

function invalidId(res) {
  return res.status(400).json({ success: false, error: { message: 'Invalid entry id' } });
}

function notFound(res) {
  return res.status(404).json({ success: false, error: { message: 'Entry not found' } });
}

function badTransition(res, msg) {
  return res.status(400).json({ success: false, error: { message: msg } });
}

async function getQueue(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { status: 'pending' };

  const [data, total] = await Promise.all([
    Entry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Entry.countDocuments(filter),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function approveEntry(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const entry = await Entry.findById(id);
  if (!entry) return notFound(res);

  if (entry.status !== 'pending') {
    return badTransition(res, `Cannot approve entry with status '${entry.status}'. Entry must be pending.`);
  }

  entry.status = 'approved';
  entry.reviewedBy = req.user.id;
  await entry.save();

  await new ModerationLog({ entry: entry._id, action: 'approved', performedBy: req.user.id }).save();

  return res.status(200).json({ success: true, data: entry });
}

async function rejectEntry(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ success: false, error: { message: first.msg, field: first.path } });
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const entry = await Entry.findById(id);
  if (!entry) return notFound(res);

  if (entry.status !== 'pending') {
    return badTransition(res, `Cannot reject entry with status '${entry.status}'. Entry must be pending.`);
  }

  const { note } = req.body;

  entry.status = 'rejected';
  entry.moderatorNote = note;
  entry.reviewedBy = req.user.id;
  await entry.save();

  await new ModerationLog({ entry: entry._id, action: 'rejected', performedBy: req.user.id, note }).save();

  return res.status(200).json({ success: true, data: entry });
}

async function publishEntry(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const entry = await Entry.findById(id);
  if (!entry) return notFound(res);

  if (entry.status !== 'approved') {
    return badTransition(res, `Cannot publish entry with status '${entry.status}'. Entry must be approved.`);
  }

  entry.status = 'published';
  await entry.save();

  await new ModerationLog({ entry: entry._id, action: 'published', performedBy: req.user.id }).save();

  return res.status(200).json({ success: true, data: entry });
}

async function getLog(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    ModerationLog.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('entry', 'pashto')
      .populate('performedBy', 'username')
      .lean(),
    ModerationLog.countDocuments(),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

module.exports = { getQueue, approveEntry, rejectEntry, publishEntry, getLog };
