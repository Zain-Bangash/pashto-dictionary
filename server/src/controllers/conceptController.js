const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');

const VALID_TRANSITIONS = {
  pending:  ['approved', 'rejected'],
  approved: ['published'],
  rejected: ['pending'],
};

function invalidId(res) {
  return res.status(400).json({ success: false, error: { message: 'Invalid concept id' } });
}

function notFound(res) {
  return res.status(404).json({ success: false, error: { message: 'Concept not found' } });
}

async function createConcept(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ success: false, error: { message: first.msg, field: first.path } });
  }

  const { englishGloss, partOfSpeech } = req.body;

  const concept = await new Concept({
    englishGloss,
    partOfSpeech,
    submittedBy: req.user.id,
    status: 'pending',
  }).save();

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: 'submitted',
    performedBy: req.user.id,
  }).save();

  return res.status(201).json({ success: true, data: concept });
}

async function listConcepts(req, res) {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  // Default to published for public; moderator/admin can pass ?status= filter
  const VALID_STATUSES = ['pending', 'approved', 'rejected', 'published'];
  const statusParam = req.query.status;
  const filter = {
    status: statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : 'published',
  };

  const q = (req.query.q || '').trim();
  if (q) {
    filter.$text = { $search: q };
  }

  const [data, total] = await Promise.all([
    Concept.find(filter).skip(skip).limit(limit).lean(),
    Concept.countDocuments(filter),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function getConcept(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const concept = await Concept.findOne({ _id: id, status: 'published' }).lean();
  if (!concept) return notFound(res);

  const variants = await Variant.find({ concept: id, status: 'published' }).lean();

  return res.status(200).json({ success: true, data: { ...concept, variants } });
}

async function suggestConcepts(req, res) {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.status(400).json({ success: false, error: { message: 'Query is required' } });
  }

  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const data = await Concept.find({
    englishGloss: regex,
    status: { $in: ['pending', 'approved', 'published'] },
  })
    .limit(5)
    .lean();

  return res.status(200).json({ success: true, data });
}

async function transitionConceptStatus(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ success: false, error: { message: first.msg, field: first.path } });
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const concept = await Concept.findById(id);
  if (!concept) return notFound(res);

  const { status, moderatorNote } = req.body;
  const allowed = VALID_TRANSITIONS[concept.status] || [];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      error: { message: `Cannot transition concept from '${concept.status}' to '${status}'` },
    });
  }

  if (status === 'rejected' && !moderatorNote) {
    return res.status(400).json({
      success: false,
      error: { message: 'moderatorNote is required when rejecting', field: 'moderatorNote' },
    });
  }

  if (status === 'published' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Only admins can publish' } });
  }

  concept.status       = status;
  concept.reviewedBy   = req.user.id;
  if (moderatorNote) concept.moderatorNote = moderatorNote;
  await concept.save();

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: status,
    performedBy: req.user.id,
    note: moderatorNote,
  }).save();

  return res.status(200).json({ success: true, data: concept });
}

async function getMyConceptSubmissions(req, res) {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  const filter = { submittedBy: req.user.id };

  const [data, total] = await Promise.all([
    Concept.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Concept.countDocuments(filter),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

module.exports = { createConcept, listConcepts, getConcept, suggestConcepts, transitionConceptStatus, getMyConceptSubmissions };
