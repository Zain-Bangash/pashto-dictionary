const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const ModerationLog = require('../models/ModerationLog');

async function listEntries(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { status: 'published' };

  const [data, total] = await Promise.all([
    Entry.find(filter).skip(skip).limit(limit).lean(),
    Entry.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data,
    meta: { page, limit, total },
  });
}

async function searchEntries(req, res) {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.status(400).json({
      success: false,
      error: { message: 'Search query is required' },
    });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { status: 'published', $text: { $search: q } };

  const [data, total] = await Promise.all([
    Entry.find(filter).skip(skip).limit(limit).lean(),
    Entry.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data,
    meta: { page, limit, total },
  });
}

async function getEntry(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid entry id' },
    });
  }

  const entry = await Entry.findOne({ _id: id, status: 'published' }).lean();

  if (!entry) {
    return res.status(404).json({
      success: false,
      error: { message: 'Entry not found' },
    });
  }

  return res.status(200).json({
    success: true,
    data: entry,
  });
}

async function createEntry(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: { message: first.msg, field: first.path },
    });
  }

  const { pashto, phonetic, region, partOfSpeech, definitions } = req.body;

  const entry = await new Entry({
    pashto,
    phonetic,
    region,
    partOfSpeech,
    definitions,
    submittedBy: req.user.id,
    status: 'pending',
  }).save();

  await new ModerationLog({
    entry: entry._id,
    action: 'submitted',
    performedBy: req.user.id,
  }).save();

  return res.status(201).json({
    success: true,
    data: entry,
  });
}

module.exports = { listEntries, searchEntries, getEntry, createEntry };
