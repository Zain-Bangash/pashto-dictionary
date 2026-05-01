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
  return res.status(400).json({ success: false, error: { message: 'Invalid variant id' } });
}

function notFound(res) {
  return res.status(404).json({ success: false, error: { message: 'Variant not found' } });
}

async function createVariant(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ success: false, error: { message: first.msg, field: first.path } });
  }

  const { conceptId, pashto, phonetic, region, definition, example, submissionNote } = req.body;

  if (!mongoose.Types.ObjectId.isValid(conceptId)) {
    return res.status(400).json({ success: false, error: { message: 'Invalid conceptId', field: 'conceptId' } });
  }

  const conceptExists = await Concept.exists({ _id: conceptId });
  if (!conceptExists) {
    return res.status(404).json({ success: false, error: { message: 'Concept not found' } });
  }

  const duplicate = await Variant.findOne({ pashto, concept: conceptId, region });
  if (duplicate) {
    return res.status(409).json({
      success: false,
      error: { message: 'This word already exists for that concept in this region. Try a different region, or check if your word belongs to a different concept.' },
    });
  }

  const variant = await new Variant({
    concept: conceptId,
    pashto,
    phonetic,
    region,
    definition,
    example,
    submissionNote,
    submittedBy: req.user.id,
    status: 'pending',
  }).save();

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: 'submitted',
    performedBy: req.user.id,
  }).save();

  return res.status(201).json({ success: true, data: variant });
}

async function listVariants(req, res) {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  const filter = { isDeleted: { $ne: true } };
  if (req.query.status)    filter.status    = req.query.status;
  if (req.query.region)    filter.region    = req.query.region;
  if (req.query.conceptId && mongoose.Types.ObjectId.isValid(req.query.conceptId)) {
    filter.concept = req.query.conceptId;
  }

  const [data, total] = await Promise.all([
    Variant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('concept', 'englishGloss').lean(),
    Variant.countDocuments(filter),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function getVariant(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const variant = await Variant.findOne({ _id: id, isDeleted: { $ne: true } }).populate('concept', 'englishGloss partOfSpeech').lean();
  if (!variant) return notFound(res);

  if (variant.status !== 'published') {
    if (!req.user || !['moderator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }
  }

  return res.status(200).json({ success: true, data: variant });
}

async function updateVariant(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ success: false, error: { message: first.msg, field: first.path } });
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const variant = await Variant.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!variant) return notFound(res);

  if (variant.submittedBy.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }

  if (variant.status !== 'rejected') {
    return res.status(400).json({
      success: false,
      error: { message: 'Only rejected variants can be edited' },
    });
  }

  const { pashto, phonetic, region, definition, example, submissionNote } = req.body;

  const effectivePashto  = pashto  ?? variant.pashto;
  const effectiveRegion  = region  ?? variant.region;
  if (effectivePashto !== variant.pashto || effectiveRegion !== variant.region) {
    const duplicate = await Variant.findOne({ pashto: effectivePashto, concept: variant.concept, region: effectiveRegion, _id: { $ne: id } });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: { message: 'This word already exists for that concept in this region.' },
      });
    }
  }

  if (pashto !== undefined)          variant.pashto         = pashto;
  if (phonetic !== undefined)        variant.phonetic       = phonetic;
  if (region !== undefined)          variant.region         = region;
  if (definition !== undefined)      variant.definition     = definition;
  if (example !== undefined)         variant.example        = example;
  if (submissionNote !== undefined)  variant.submissionNote = submissionNote;
  variant.status = 'pending';
  variant.moderatorNote = undefined;
  await variant.save();

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: 'resubmitted',
    performedBy: req.user.id,
  }).save();

  return res.status(200).json({ success: true, data: variant });
}

async function transitionVariantStatus(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ success: false, error: { message: first.msg, field: first.path } });
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const variant = await Variant.findById(id);
  if (!variant) return notFound(res);

  const { status, moderatorNote } = req.body;
  const allowed = VALID_TRANSITIONS[variant.status] || [];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      error: { message: `Cannot transition variant from '${variant.status}' to '${status}'` },
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

  variant.status     = status;
  variant.reviewedBy = req.user.id;
  if (moderatorNote) variant.moderatorNote = moderatorNote;
  await variant.save();

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: status,
    performedBy: req.user.id,
    note: moderatorNote,
  }).save();

  return res.status(200).json({ success: true, data: variant });
}

async function searchVariants(req, res) {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.status(400).json({ success: false, error: { message: 'Search query is required' } });
  }

  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  const filter = { status: 'published', isDeleted: { $ne: true }, $text: { $search: q } };
  if (req.query.region) filter.region = req.query.region;

  const [data, total] = await Promise.all([
    Variant.find(filter).skip(skip).limit(limit).populate('concept', 'englishGloss partOfSpeech').lean(),
    Variant.countDocuments(filter),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function getMyVariantSubmissions(req, res) {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  const filter = { submittedBy: req.user.id, isDeleted: { $ne: true } };

  const [data, total] = await Promise.all([
    Variant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('concept', 'englishGloss').lean(),
    Variant.countDocuments(filter),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function deleteVariant(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const variant = await Variant.findById(id);
  if (!variant) return notFound(res);

  variant.isDeleted = true;
  variant.deletedAt = new Date();
  variant.deletedBy = req.user.id;
  await variant.save();

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: 'deleted',
    performedBy: req.user.id,
  }).save();

  return res.status(200).json({ success: true, data: variant });
}

module.exports = { createVariant, listVariants, getVariant, updateVariant, transitionVariantStatus, searchVariants, getMyVariantSubmissions, deleteVariant };
