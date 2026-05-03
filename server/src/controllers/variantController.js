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

  const normalizedPashto = pashto.trim().normalize('NFC');
  const duplicate = await Variant.findOne({
    normalizedPashto,
    concept: conceptId,
    region,
    isDeleted: { $ne: true },
  });
  if (duplicate) {
    return res.status(409).json({
      success: false,
      error: { message: 'This Pashto word already exists for this concept and region' },
    });
  }

  let variant;
  try {
    variant = await new Variant({
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
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: { message: 'This Pashto word already exists for this concept and region' },
      });
    }
    throw err;
  }

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
    const normalizedPashto = effectivePashto.trim().normalize('NFC');
    const duplicate = await Variant.findOne({
      normalizedPashto,
      concept: variant.concept,
      region: effectiveRegion,
      isDeleted: { $ne: true },
      _id: { $ne: variant._id },
    });
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

  if (
    req.user.role === 'moderator' &&
    (status === 'approved' || status === 'rejected') &&
    variant.submittedBy &&
    variant.submittedBy.equals(req.user.id)
  ) {
    return res.status(403).json({
      success: false,
      error: { message: 'Moderators cannot approve or reject their own submissions' },
    });
  }

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

async function editVariant(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const variant = await Variant.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!variant) return notFound(res);

  if (req.user.role === 'moderator' && variant.submittedBy && variant.submittedBy.toString() === req.user.id) {
    return res.status(403).json({ success: false, error: { message: 'Moderators cannot edit their own submissions' } });
  }

  if (!req.body.note) {
    return res.status(400).json({ success: false, error: { message: 'note is required', field: 'note' } });
  }

  const simpleFields = ['pashto', 'phonetic', 'region', 'definition', 'example'];
  const before = {};
  for (const field of simpleFields) {
    before[field] = variant[field];
  }
  const beforeConceptId = variant.concept.toString();

  const changes = {};

  // Handle concept reassignment
  if (req.body.concept !== undefined && req.body.concept !== beforeConceptId) {
    const newConceptId = req.body.concept;
    if (!mongoose.Types.ObjectId.isValid(newConceptId)) {
      return res.status(404).json({ success: false, error: { message: 'Target concept not found' } });
    }
    const targetConcept = await Concept.findOne({ _id: newConceptId, isDeleted: { $ne: true } });
    if (!targetConcept) {
      return res.status(404).json({ success: false, error: { message: 'Target concept not found' } });
    }

    // Compute the normalizedPashto that will be used after save
    const effectivePashto = req.body.pashto !== undefined ? req.body.pashto : variant.pashto;
    const effectiveRegion = req.body.region !== undefined ? req.body.region : variant.region;
    const normalizedPashto = effectivePashto.trim().normalize('NFC');

    const duplicate = await Variant.findOne({
      concept: newConceptId,
      normalizedPashto,
      region: effectiveRegion,
      isDeleted: { $ne: true },
      _id: { $ne: variant._id },
    });
    if (duplicate) {
      return res.status(409).json({ success: false, error: { message: 'A variant with the same Pashto and region already exists on the target concept' } });
    }

    const oldConcept = await Concept.findById(beforeConceptId).lean();
    changes.concept = {
      from: { id: oldConcept._id, englishGloss: oldConcept.englishGloss },
      to:   { id: targetConcept._id, englishGloss: targetConcept.englishGloss },
    };
    variant.concept = newConceptId;
  }

  // Apply simple field updates
  for (const field of simpleFields) {
    if (req.body[field] !== undefined) {
      variant[field] = req.body[field];
    }
  }

  await variant.save();

  // Compute diff for simple fields
  for (const field of simpleFields) {
    if (variant[field] !== before[field]) {
      changes[field] = { from: before[field], to: variant[field] };
    }
  }

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: 'edited',
    performedBy: req.user.id,
    note: req.body.note,
    changes,
  }).save();

  return res.status(200).json({ success: true, data: variant });
}

module.exports = { createVariant, listVariants, getVariant, updateVariant, transitionVariantStatus, searchVariants, getMyVariantSubmissions, deleteVariant, editVariant };
