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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

  const normalizedGloss = englishGloss.toLowerCase().trim();
  const existing = await Concept.findOne({ normalizedGloss, isDeleted: { $ne: true } });
  if (existing) {
    return res.status(409).json({
      success: false,
      error: { message: 'A concept with this English gloss already exists' },
    });
  }

  let concept;
  try {
    concept = await new Concept({
      englishGloss,
      partOfSpeech,
      submittedBy: req.user.id,
      status: 'pending',
    }).save();
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: { message: 'A concept with this English gloss already exists' },
      });
    }
    throw err;
  }

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

  filter.isDeleted = { $ne: true };

  const [concepts, total] = await Promise.all([
    Concept.find(filter).skip(skip).limit(limit).lean(),
    Concept.countDocuments(filter),
  ]);

  const data = await Promise.all(
    concepts.map(async (c) => {
      const [firstVariant, variantCount] = await Promise.all([
        Variant.findOne(
          { concept: c._id, status: 'published' },
          'pashto phonetic region definition example'
        ).lean(),
        Variant.countDocuments({ concept: c._id, status: 'published' }),
      ]);
      return { ...c, firstVariant: firstVariant || null, variantCount };
    })
  );

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function getConcept(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const concept = await Concept.findOne({ _id: id, status: 'published', isDeleted: { $ne: true } }).lean();
  if (!concept) return notFound(res);

  const variants = await Variant.find({ concept: id, status: 'published', isDeleted: { $ne: true } }).lean();

  return res.status(200).json({ success: true, data: { ...concept, variants } });
}

async function suggestConcepts(req, res) {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.status(400).json({ success: false, error: { message: 'Query is required' } });
  }

  const regex = new RegExp(escapeRegex(q), 'i');

  const data = await Concept.find({
    englishGloss: regex,
    status: { $in: ['pending', 'approved', 'published'] },
    isDeleted: { $ne: true },
  })
    .limit(5)
    .lean();

  return res.status(200).json({ success: true, data });
}

async function searchConcepts(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ success: false, error: { message: 'Query is required' } });
  }

  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const ql    = q.toLowerCase();
  const regex = new RegExp(escapeRegex(q), 'i');

  function scoreText(text) {
    const t = (text || '').toLowerCase();
    if (t === ql)          return 3;
    if (t.startsWith(ql)) return 2;
    return 1;
  }

  const [glossMatches, phoneticVariants] = await Promise.all([
    Concept.find({ englishGloss: regex, status: 'published', isDeleted: { $ne: true } }, '_id englishGloss').lean(),
    Variant.find({ phonetic: regex, status: 'published', isDeleted: { $ne: true } }, 'concept phonetic').lean(),
  ]);

  const scoreMap = new Map();

  for (const c of glossMatches) {
    const id = c._id.toString();
    scoreMap.set(id, Math.max(scoreMap.get(id) ?? 0, scoreText(c.englishGloss)));
  }

  for (const v of phoneticVariants) {
    const id = v.concept.toString();
    scoreMap.set(id, Math.max(scoreMap.get(id) ?? 0, scoreText(v.phonetic)));
  }

  if (scoreMap.size === 0) {
    return res.status(200).json({ success: true, data: [], meta: { page, limit, total: 0 } });
  }

  const unionIds = Array.from(scoreMap.keys());
  const concepts = await Concept.find({ _id: { $in: unionIds }, status: 'published', isDeleted: { $ne: true } }).lean();

  const enriched = await Promise.all(
    concepts.map(async (c) => {
      const id = c._id.toString();
      const [firstVariant, variantCount] = await Promise.all([
        Variant.findOne(
          { concept: c._id, status: 'published' },
          'pashto phonetic region definition example'
        ).lean(),
        Variant.countDocuments({ concept: c._id, status: 'published' }),
      ]);
      return { ...c, firstVariant: firstVariant || null, variantCount, _score: scoreMap.get(id) };
    })
  );

  enriched.sort((a, b) => b._score - a._score);

  const total    = enriched.length;
  const pageData = enriched.slice((page - 1) * limit, page * limit).map(({ _score, ...rest }) => rest);

  return res.status(200).json({ success: true, data: pageData, meta: { page, limit, total } });
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

  if (
    req.user.role === 'moderator' &&
    (status === 'approved' || status === 'rejected') &&
    concept.submittedBy &&
    concept.submittedBy.equals(req.user.id)
  ) {
    return res.status(403).json({
      success: false,
      error: { message: 'Moderators cannot approve or reject their own submissions' },
    });
  }

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

  if (status === 'rejected') {
    const variantsToDelete = await Variant.find({
      concept: concept._id,
      status: { $in: ['pending', 'approved'] },
      isDeleted: { $ne: true },
    });
    await Promise.all(
      variantsToDelete.map(async (v) => {
        v.isDeleted = true;
        v.deletedAt = new Date();
        v.deletedBy = req.user.id;
        await v.save();
        await new ModerationLog({
          targetModel: 'Variant',
          targetId: v._id,
          action: 'rejected',
          performedBy: req.user.id,
          note: 'Cascaded from concept rejection',
        }).save();
      })
    );
  }

  return res.status(200).json({ success: true, data: concept });
}

async function getWotd(req, res) {
  const today = new Date();
  const seed  = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const total = await Concept.countDocuments({ status: 'published', isDeleted: { $ne: true } });
  if (total === 0) return res.status(200).json({ success: true, data: null });
  const index   = seed % total;
  const concept = await Concept.findOne({ status: 'published', isDeleted: { $ne: true } }).skip(index).lean();
  const firstVariant = await Variant.findOne(
    { concept: concept._id, status: 'published' },
    'pashto phonetic region definition example'
  ).lean();
  return res.status(200).json({ success: true, data: { ...concept, firstVariant: firstVariant || null } });
}

async function getMyConceptSubmissions(req, res) {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  const filter = { submittedBy: req.user.id, isDeleted: { $ne: true } };

  const [data, total] = await Promise.all([
    Concept.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Concept.countDocuments(filter),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function deleteConcept(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const concept = await Concept.findById(id);
  if (!concept) return notFound(res);

  concept.isDeleted  = true;
  concept.deletedAt  = new Date();
  concept.deletedBy  = req.user.id;
  await concept.save();

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: 'deleted',
    performedBy: req.user.id,
  }).save();

  return res.status(200).json({ success: true, data: concept });
}

async function editConcept(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const concept = await Concept.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!concept) return notFound(res);

  if (req.user.role === 'moderator' && concept.submittedBy && concept.submittedBy.toString() === req.user.id) {
    return res.status(403).json({ success: false, error: { message: 'Moderators cannot edit their own submissions' } });
  }

  if (!req.body.note) {
    return res.status(400).json({ success: false, error: { message: 'note is required', field: 'note' } });
  }

  const editableFields = ['englishGloss', 'partOfSpeech'];
  const before = {};
  for (const field of editableFields) {
    before[field] = concept[field];
  }

  if (req.body.englishGloss !== undefined) concept.englishGloss = req.body.englishGloss;
  if (req.body.partOfSpeech !== undefined) concept.partOfSpeech = req.body.partOfSpeech;

  await concept.save();

  const changes = {};
  for (const field of editableFields) {
    if (concept[field] !== before[field]) {
      changes[field] = { from: before[field], to: concept[field] };
    }
  }

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: 'edited',
    performedBy: req.user.id,
    note: req.body.note,
    changes,
  }).save();

  return res.status(200).json({ success: true, data: concept });
}

async function mergeConcepts(req, res) {
  const { sourceId } = req.params;
  const { targetConceptId, note } = req.body;

  if (!note) {
    return res.status(400).json({ success: false, error: { message: 'note is required', field: 'note' } });
  }

  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    return res.status(404).json({ success: false, error: { message: 'Source concept not found' } });
  }
  if (!mongoose.Types.ObjectId.isValid(targetConceptId)) {
    return res.status(404).json({ success: false, error: { message: 'Target concept not found' } });
  }

  if (sourceId === targetConceptId.toString()) {
    return res.status(400).json({ success: false, error: { message: 'Cannot merge a concept into itself' } });
  }

  const [sourceConcept, targetConcept] = await Promise.all([
    Concept.findOne({ _id: sourceId, isDeleted: { $ne: true } }),
    Concept.findOne({ _id: targetConceptId, isDeleted: { $ne: true } }),
  ]);

  if (!sourceConcept) return res.status(404).json({ success: false, error: { message: 'Source concept not found' } });
  if (!targetConcept) return res.status(404).json({ success: false, error: { message: 'Target concept not found' } });

  if (sourceConcept._id.toString() === targetConcept._id.toString()) {
    return res.status(400).json({ success: false, error: { message: 'Cannot merge a concept into itself' } });
  }

  const sourceVariants = await Variant.find({ concept: sourceId, isDeleted: { $ne: true } });

  const movedIds = [];
  const skippedItems = [];

  for (const variant of sourceVariants) {
    const duplicate = await Variant.findOne({
      concept: targetConceptId,
      normalizedPashto: variant.normalizedPashto,
      region: variant.region,
      isDeleted: { $ne: true },
    });
    if (duplicate) {
      skippedItems.push({ id: variant._id, reason: 'Duplicate exists on target concept' });
    } else {
      movedIds.push(variant._id);
    }
  }

  if (movedIds.length > 0) {
    await Variant.updateMany({ _id: { $in: movedIds } }, { concept: targetConceptId });
  }

  sourceConcept.isDeleted = true;
  sourceConcept.deletedAt = new Date();
  sourceConcept.deletedBy = req.user.id;
  await sourceConcept.save();

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: sourceId,
    action: 'merged',
    performedBy: req.user.id,
    note,
    changes: {
      mergedInto: targetConceptId,
      variantsMoved: movedIds,
      variantsSkipped: skippedItems.map((s) => s.id),
    },
  }).save();

  return res.status(200).json({ success: true, data: { moved: movedIds.length, skipped: skippedItems } });
}

async function updateConcept(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ success: false, error: { message: first.msg, field: first.path } });
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

  const concept = await Concept.findById(id);
  if (!concept) return notFound(res);

  if (concept.submittedBy.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }

  if (concept.status !== 'rejected') {
    return res.status(400).json({
      success: false,
      error: { message: 'Only rejected concepts can be edited' },
    });
  }

  const { englishGloss, partOfSpeech } = req.body;

  if (englishGloss !== undefined) concept.englishGloss = englishGloss;
  if (partOfSpeech !== undefined) concept.partOfSpeech = partOfSpeech;
  concept.status = 'pending';
  concept.moderatorNote = undefined;
  await concept.save();

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: 'resubmitted',
    performedBy: req.user.id,
  }).save();

  return res.status(200).json({ success: true, data: concept });
}

module.exports = { createConcept, listConcepts, getConcept, suggestConcepts, searchConcepts, transitionConceptStatus, getMyConceptSubmissions, getWotd, deleteConcept, editConcept, mergeConcepts, updateConcept };
