import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import Concept from '../models/Concept';
import { IConcept } from '../types/models';
import Variant from '../models/Variant';
import ModerationLog from '../models/ModerationLog';
import { enrichActors } from '../utils/enrichActors';

type Doc = Record<string, unknown>;

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:  ['approved', 'rejected'],
  approved: ['published'],
  rejected: ['pending'],
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function invalidId(res: Response) {
  return res.status(400).json({ success: false, error: { message: 'Invalid concept id' } });
}

function notFound(res: Response) {
  return res.status(404).json({ success: false, error: { message: 'Concept not found' } });
}

async function createConcept(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json({ success: false, error: { message: first.msg, field: (first as { path?: string }).path } });
    return;
  }

  const { englishGloss, partOfSpeech } = req.body as { englishGloss: string; partOfSpeech: string };

  const normalizedGloss = englishGloss.toLowerCase().trim();
  const existing = await Concept.findOne({ normalizedGloss, isDeleted: { $ne: true } });
  if (existing) {
    res.status(409).json({
      success: false,
      error: { message: 'A concept with this English gloss already exists' },
    });
    return;
  }

  let concept: IConcept;
  try {
    concept = await new Concept({
      englishGloss,
      partOfSpeech,
      submittedBy: req.user!.id,
      status: 'pending',
    }).save();
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({
        success: false,
        error: { message: 'A concept with this English gloss already exists' },
      });
      return;
    }
    throw err;
  }

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: 'submitted',
    performedBy: req.user!.id,
  }).save();

  res.status(201).json({ success: true, data: concept });
}

async function listConcepts(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const VALID_STATUSES = ['pending', 'approved', 'rejected', 'published'];
  const statusParam = req.query.status as string | undefined;
  const canFilterByStatus = req.user && ['moderator', 'admin'].includes(req.user.role);
  const filter: Record<string, unknown> = {
    status: canFilterByStatus && statusParam && VALID_STATUSES.includes(statusParam)
      ? statusParam
      : 'published',
  };

  const q = ((req.query.q as string) || '').trim();
  if (q) {
    filter.englishGloss = new RegExp(escapeRegex(q), 'i');
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

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function getConcept(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    invalidId(res);
    return;
  }

  const found = await Concept.findOne({ _id: id, status: 'published', isDeleted: { $ne: true } }).lean();
  if (!found) {
    notFound(res);
    return;
  }

  const rawVariants = await Variant.find({ concept: id, status: 'published', isDeleted: { $ne: true } }).lean();

  const [enrichedConcept] = await enrichActors([found as unknown as Doc], 'submittedBy');
  const variants = await enrichActors(rawVariants as unknown as Doc[], 'submittedBy');

  res.status(200).json({ success: true, data: { ...enrichedConcept, variants } });
}

async function suggestConcepts(req: Request, res: Response): Promise<void> {
  const q = ((req.query.q as string) || '').trim();

  if (!q) {
    res.status(400).json({ success: false, error: { message: 'Query is required' } });
    return;
  }

  const regex = new RegExp(escapeRegex(q), 'i');

  const data = await Concept.find({
    englishGloss: regex,
    status: { $in: ['pending', 'approved', 'published'] },
    isDeleted: { $ne: true },
  })
    .limit(5)
    .lean();

  res.status(200).json({ success: true, data });
}

async function searchConcepts(req: Request, res: Response): Promise<void> {
  const q = ((req.query.q as string) || '').trim();
  if (!q) {
    res.status(400).json({ success: false, error: { message: 'Query is required' } });
    return;
  }

  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

  const ql    = q.toLowerCase();
  const regex = new RegExp(escapeRegex(q), 'i');

  function scoreText(text: string | undefined): number {
    const t = (text || '').toLowerCase();
    if (t === ql)          return 3;
    if (t.startsWith(ql)) return 2;
    return 1;
  }

  const [glossMatches, phoneticVariants] = await Promise.all([
    Concept.find({ englishGloss: regex, status: 'published', isDeleted: { $ne: true } }, '_id englishGloss').lean(),
    Variant.find({ phonetic: regex, status: 'published', isDeleted: { $ne: true } }, 'concept phonetic').lean(),
  ]);

  const scoreMap = new Map<string, number>();

  for (const c of glossMatches) {
    const id = (c._id as mongoose.Types.ObjectId).toString();
    scoreMap.set(id, Math.max(scoreMap.get(id) ?? 0, scoreText(c.englishGloss)));
  }

  for (const v of phoneticVariants) {
    const id = (v.concept as mongoose.Types.ObjectId).toString();
    scoreMap.set(id, Math.max(scoreMap.get(id) ?? 0, scoreText(v.phonetic as string | undefined)));
  }

  if (scoreMap.size === 0) {
    res.status(200).json({ success: true, data: [], meta: { page, limit, total: 0 } });
    return;
  }

  const unionIds = Array.from(scoreMap.keys());
  const concepts = await Concept.find({ _id: { $in: unionIds }, status: 'published', isDeleted: { $ne: true } }).lean();

  const enriched = await Promise.all(
    concepts.map(async (c) => {
      const id = (c._id as mongoose.Types.ObjectId).toString();
      const [firstVariant, variantCount] = await Promise.all([
        Variant.findOne(
          { concept: c._id, status: 'published' },
          'pashto phonetic region definition example'
        ).lean(),
        Variant.countDocuments({ concept: c._id, status: 'published' }),
      ]);
      return { ...c, firstVariant: firstVariant || null, variantCount, _score: scoreMap.get(id) ?? 0 };
    })
  );

  enriched.sort((a, b) => b._score - a._score);

  const total    = enriched.length;
  const pageData = enriched.slice((page - 1) * limit, page * limit).map(({ _score, ...rest }) => rest);

  res.status(200).json({ success: true, data: pageData, meta: { page, limit, total } });
}

async function transitionConceptStatus(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json({ success: false, error: { message: first.msg, field: (first as { path?: string }).path } });
    return;
  }

  const id = req.params.id as string;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    invalidId(res);
    return;
  }

  const concept = await Concept.findById(id);
  if (!concept) {
    notFound(res);
    return;
  }

  const { status, moderatorNote } = req.body as { status: string; moderatorNote?: string };

  if (
    req.user!.role === 'moderator' &&
    (status === 'approved' || status === 'rejected') &&
    concept.submittedBy &&
    concept.submittedBy === req.user!.id
  ) {
    res.status(403).json({
      success: false,
      error: { message: 'Moderators cannot approve or reject their own submissions' },
    });
    return;
  }

  const allowed = VALID_TRANSITIONS[concept.status] || [];

  if (!allowed.includes(status)) {
    res.status(400).json({
      success: false,
      error: { message: `Cannot transition concept from '${concept.status}' to '${status}'` },
    });
    return;
  }

  if (status === 'rejected' && !moderatorNote) {
    res.status(400).json({
      success: false,
      error: { message: 'moderatorNote is required when rejecting', field: 'moderatorNote' },
    });
    return;
  }

  if (status === 'published' && req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: { message: 'Only admins can publish' } });
    return;
  }

  concept.status       = status as IConcept['status'];
  concept.reviewedBy   = req.user!.id;
  if (moderatorNote) concept.moderatorNote = moderatorNote;
  await concept.save();

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: status,
    performedBy: req.user!.id,
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
        v.deletedBy = req.user!.id;
        await v.save();
        await new ModerationLog({
          targetModel: 'Variant',
          targetId: v._id,
          action: 'rejected',
          performedBy: req.user!.id,
          note: 'Cascaded from concept rejection',
        }).save();
      })
    );
  }

  res.status(200).json({ success: true, data: concept });
}

async function getWotd(req: Request, res: Response): Promise<void> {
  const today = new Date();
  const seed  = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const total = await Concept.countDocuments({ status: 'published', isDeleted: { $ne: true } });
  if (total === 0) {
    res.status(200).json({ success: true, data: null });
    return;
  }
  const index   = seed % total;
  const concept = await Concept.findOne({ status: 'published', isDeleted: { $ne: true } }).skip(index).lean();
  const firstVariant = await Variant.findOne(
    { concept: concept!._id, status: 'published' },
    'pashto phonetic region definition example'
  ).lean();
  res.status(200).json({ success: true, data: { ...concept, firstVariant: firstVariant || null } });
}

async function getMyConceptSubmissions(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const filter = { submittedBy: req.user!.id, isDeleted: { $ne: true } };

  const [data, total] = await Promise.all([
    Concept.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Concept.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function deleteConcept(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    invalidId(res);
    return;
  }

  const concept = await Concept.findById(id);
  if (!concept) {
    notFound(res);
    return;
  }

  concept.isDeleted  = true;
  concept.deletedAt  = new Date();
  concept.deletedBy  = req.user!.id;
  await concept.save();

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: 'deleted',
    performedBy: req.user!.id,
  }).save();

  res.status(200).json({ success: true, data: concept });
}

async function editConcept(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    invalidId(res);
    return;
  }

  const concept = await Concept.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!concept) {
    notFound(res);
    return;
  }

  if (req.user!.role === 'moderator' && concept.submittedBy && concept.submittedBy.toString() === req.user!.id) {
    res.status(403).json({ success: false, error: { message: 'Moderators cannot edit their own submissions' } });
    return;
  }

  if (!req.body.note) {
    res.status(400).json({ success: false, error: { message: 'note is required', field: 'note' } });
    return;
  }

  const editableFields: (keyof IConcept)[] = ['englishGloss', 'partOfSpeech'];
  const before: Record<string, unknown> = {};
  for (const field of editableFields) {
    before[field as string] = concept[field];
  }

  if (req.body.englishGloss !== undefined) concept.englishGloss = req.body.englishGloss as string;
  if (req.body.partOfSpeech !== undefined) concept.partOfSpeech = req.body.partOfSpeech as IConcept['partOfSpeech'];

  await concept.save();

  const changes: Record<string, unknown> = {};
  for (const field of editableFields) {
    if (concept[field] !== before[field as string]) {
      changes[field as string] = { from: before[field as string], to: concept[field] };
    }
  }

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: 'edited',
    performedBy: req.user!.id,
    note: req.body.note as string,
    changes,
  }).save();

  res.status(200).json({ success: true, data: concept });
}

async function mergeConcepts(req: Request, res: Response): Promise<void> {
  const sourceId = req.params.sourceId as string;
  const { targetConceptId, note } = req.body as { targetConceptId: string; note: string };

  if (!note) {
    res.status(400).json({ success: false, error: { message: 'note is required', field: 'note' } });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    res.status(404).json({ success: false, error: { message: 'Source concept not found' } });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(targetConceptId)) {
    res.status(404).json({ success: false, error: { message: 'Target concept not found' } });
    return;
  }

  if (sourceId === targetConceptId.toString()) {
    res.status(400).json({ success: false, error: { message: 'Cannot merge a concept into itself' } });
    return;
  }

  const [sourceConcept, targetConcept] = await Promise.all([
    Concept.findOne({ _id: sourceId, isDeleted: { $ne: true } }),
    Concept.findOne({ _id: targetConceptId, isDeleted: { $ne: true } }),
  ]);

  if (!sourceConcept) {
    res.status(404).json({ success: false, error: { message: 'Source concept not found' } });
    return;
  }
  if (!targetConcept) {
    res.status(404).json({ success: false, error: { message: 'Target concept not found' } });
    return;
  }

  if (sourceConcept._id.toString() === targetConcept._id.toString()) {
    res.status(400).json({ success: false, error: { message: 'Cannot merge a concept into itself' } });
    return;
  }

  const sourceVariants = await Variant.find({ concept: sourceId, isDeleted: { $ne: true } });

  const movedIds: mongoose.Types.ObjectId[] = [];
  const skippedItems: Array<{ id: mongoose.Types.ObjectId; reason: string }> = [];

  for (const variant of sourceVariants) {
    const duplicate = await Variant.findOne({
      concept: targetConceptId,
      normalizedPashto: variant.normalizedPashto,
      region: variant.region,
      isDeleted: { $ne: true },
    });
    if (duplicate) {
      skippedItems.push({ id: variant._id as mongoose.Types.ObjectId, reason: 'Duplicate exists on target concept' });
    } else {
      movedIds.push(variant._id as mongoose.Types.ObjectId);
    }
  }

  if (movedIds.length > 0) {
    await Variant.updateMany({ _id: { $in: movedIds } }, { concept: targetConceptId });
  }

  sourceConcept.isDeleted = true;
  sourceConcept.deletedAt = new Date();
  sourceConcept.deletedBy = req.user!.id;
  await sourceConcept.save();

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: sourceId,
    action: 'merged',
    performedBy: req.user!.id,
    note,
    changes: {
      mergedInto: targetConceptId,
      variantsMoved: movedIds,
      variantsSkipped: skippedItems.map((s) => s.id),
    },
  }).save();

  res.status(200).json({ success: true, data: { moved: movedIds.length, skipped: skippedItems } });
}

async function updateConcept(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json({ success: false, error: { message: first.msg, field: (first as { path?: string }).path } });
    return;
  }

  const id = req.params.id as string;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    invalidId(res);
    return;
  }

  const concept = await Concept.findById(id);
  if (!concept) {
    notFound(res);
    return;
  }

  if (concept.submittedBy!.toString() !== req.user!.id) {
    res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    return;
  }

  if (concept.status !== 'rejected') {
    res.status(400).json({
      success: false,
      error: { message: 'Only rejected concepts can be edited' },
    });
    return;
  }

  const { englishGloss, partOfSpeech } = req.body as { englishGloss?: string; partOfSpeech?: IConcept['partOfSpeech'] };

  if (englishGloss !== undefined) concept.englishGloss = englishGloss;
  if (partOfSpeech !== undefined) concept.partOfSpeech = partOfSpeech;
  concept.status = 'pending';
  concept.moderatorNote = undefined;
  await concept.save();

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: 'resubmitted',
    performedBy: req.user!.id,
  }).save();

  res.status(200).json({ success: true, data: concept });
}

export { createConcept, listConcepts, getConcept, suggestConcepts, searchConcepts, transitionConceptStatus, getMyConceptSubmissions, getWotd, deleteConcept, editConcept, mergeConcepts, updateConcept };
