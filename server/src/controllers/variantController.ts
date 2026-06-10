import { validationResult } from 'express-validator';
import mongoose, { Types } from 'mongoose';
import { Request, Response } from 'express';
import Concept from '../models/Concept';
import Variant from '../models/Variant';
import { IVariant } from '../types/models';
import ModerationLog from '../models/ModerationLog';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:  ['approved', 'rejected'],
  approved: ['published'],
  rejected: ['pending'],
};

function invalidId(res: Response) {
  return res.status(400).json({ success: false, error: { message: 'Invalid variant id' } });
}

function notFound(res: Response) {
  return res.status(404).json({ success: false, error: { message: 'Variant not found' } });
}

async function createVariant(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json({ success: false, error: { message: first.msg, field: (first as { path?: string }).path } });
    return;
  }

  const { conceptId, pashto, phonetic, region, definition, example, submissionNote } = req.body as {
    conceptId: string;
    pashto: string;
    phonetic?: string;
    region: string;
    definition: string;
    example?: string;
    submissionNote?: string;
  };

  if (!mongoose.Types.ObjectId.isValid(conceptId)) {
    res.status(400).json({ success: false, error: { message: 'Invalid conceptId', field: 'conceptId' } });
    return;
  }

  const conceptExists = await Concept.exists({ _id: conceptId });
  if (!conceptExists) {
    res.status(404).json({ success: false, error: { message: 'Concept not found' } });
    return;
  }

  const normalizedPashto = pashto.trim().normalize('NFC');
  const duplicate = await Variant.findOne({
    normalizedPashto,
    concept: conceptId,
    region,
    isDeleted: { $ne: true },
  });
  if (duplicate) {
    res.status(409).json({
      success: false,
      error: { message: 'This Pashto word already exists for this concept and region' },
    });
    return;
  }

  let variant: IVariant;
  try {
    variant = await new Variant({
      concept: conceptId,
      pashto,
      phonetic,
      region,
      definition,
      example,
      submissionNote,
      submittedBy: req.user!.id,
      status: 'pending',
    }).save();
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({
        success: false,
        error: { message: 'This Pashto word already exists for this concept and region' },
      });
      return;
    }
    throw err;
  }

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: 'submitted',
    performedBy: req.user!.id,
  }).save();

  res.status(201).json({ success: true, data: variant });
}

async function listVariants(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
  if (req.query.status)    filter.status    = req.query.status;
  if (req.query.region)    filter.region    = req.query.region;
  if (req.query.conceptId && mongoose.Types.ObjectId.isValid(req.query.conceptId as string)) {
    filter.concept = req.query.conceptId;
  }

  const [data, total] = await Promise.all([
    Variant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('concept', 'englishGloss').lean(),
    Variant.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function getVariant(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    invalidId(res);
    return;
  }

  const variant = await Variant.findOne({ _id: id, isDeleted: { $ne: true } }).populate('concept', 'englishGloss partOfSpeech').lean();
  if (!variant) {
    notFound(res);
    return;
  }

  if (variant.status !== 'published') {
    if (!req.user || !['moderator', 'admin'].includes(req.user.role)) {
      res.status(403).json({ success: false, error: { message: 'Forbidden' } });
      return;
    }
  }

  res.status(200).json({ success: true, data: variant });
}

async function updateVariant(req: Request, res: Response): Promise<void> {
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

  // Rejected variants are soft-deleted at rejection time — include them here
  // so the submitter can still edit and resubmit their rejected submission.
  const variant = await Variant.findOne({
    _id: id,
    $or: [{ isDeleted: { $ne: true } }, { status: 'rejected' }],
  });
  if (!variant) {
    notFound(res);
    return;
  }

  if (variant.submittedBy!.toString() !== req.user!.id) {
    res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    return;
  }

  if (variant.status !== 'rejected') {
    res.status(400).json({
      success: false,
      error: { message: 'Only rejected variants can be edited' },
    });
    return;
  }

  const { pashto, phonetic, region, definition, example, submissionNote } = req.body as {
    pashto?: string;
    phonetic?: string;
    region?: string;
    definition?: string;
    example?: string;
    submissionNote?: string;
  };

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
      res.status(409).json({
        success: false,
        error: { message: 'This word already exists for that concept in this region.' },
      });
      return;
    }
  }

  if (pashto !== undefined)          variant.pashto         = pashto;
  if (phonetic !== undefined)        variant.phonetic       = phonetic;
  if (region !== undefined)          variant.region         = region as IVariant['region'];
  if (definition !== undefined)      variant.definition     = definition;
  if (example !== undefined)         variant.example        = example;
  if (submissionNote !== undefined)  variant.submissionNote = submissionNote;
  variant.status = 'pending';
  variant.moderatorNote = undefined;
  variant.isDeleted = false;
  variant.deletedAt = undefined;
  await variant.save();

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: 'resubmitted',
    performedBy: req.user!.id,
  }).save();

  res.status(200).json({ success: true, data: variant });
}

async function transitionVariantStatus(req: Request, res: Response): Promise<void> {
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

  const variant = await Variant.findById(id);
  if (!variant) {
    notFound(res);
    return;
  }

  const { status, moderatorNote } = req.body as { status: string; moderatorNote?: string };

  if (
    req.user!.role === 'moderator' &&
    (status === 'approved' || status === 'rejected') &&
    variant.submittedBy &&
    variant.submittedBy === req.user!.id
  ) {
    res.status(403).json({
      success: false,
      error: { message: 'Moderators cannot approve or reject their own submissions' },
    });
    return;
  }

  const allowed = VALID_TRANSITIONS[variant.status] || [];

  if (!allowed.includes(status)) {
    res.status(400).json({
      success: false,
      error: { message: `Cannot transition variant from '${variant.status}' to '${status}'` },
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

  if (status === 'published') {
    const parentConcept = await Concept.findById(variant.concept, 'status');
    if (!parentConcept || parentConcept.status !== 'published') {
      res.status(400).json({
        success: false,
        error: { message: 'Cannot publish a variant whose concept is not yet published.' },
      });
      return;
    }
  }

  variant.status     = status as IVariant['status'];
  variant.reviewedBy = req.user!.id;
  if (moderatorNote) variant.moderatorNote = moderatorNote;
  if (status === 'rejected') {
    variant.isDeleted = true;
    variant.deletedAt = new Date();
  }
  await variant.save();

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: status,
    performedBy: req.user!.id,
    note: moderatorNote,
  }).save();

  res.status(200).json({ success: true, data: variant });
}

async function searchVariants(req: Request, res: Response): Promise<void> {
  const q = ((req.query.q as string) || '').trim();

  if (!q) {
    res.status(400).json({ success: false, error: { message: 'Search query is required' } });
    return;
  }

  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const filter: Record<string, unknown> = { status: 'published', isDeleted: { $ne: true }, $text: { $search: q } };
  if (req.query.region) filter.region = req.query.region;

  const [data, total] = await Promise.all([
    Variant.find(filter).skip(skip).limit(limit).populate('concept', 'englishGloss partOfSpeech').lean(),
    Variant.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function getMyVariantSubmissions(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  // Include soft-deleted rejected variants so submitters can still read the rejection note.
  const filter = {
    submittedBy: req.user!.id,
    $or: [{ isDeleted: { $ne: true } }, { status: 'rejected' }],
  };

  const [data, total] = await Promise.all([
    Variant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('concept', 'englishGloss').lean(),
    Variant.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function deleteVariant(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    invalidId(res);
    return;
  }

  const variant = await Variant.findById(id);
  if (!variant) {
    notFound(res);
    return;
  }

  variant.isDeleted = true;
  variant.deletedAt = new Date();
  variant.deletedBy = req.user!.id;
  await variant.save();

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: 'deleted',
    performedBy: req.user!.id,
  }).save();

  res.status(200).json({ success: true, data: variant });
}

async function editVariant(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    invalidId(res);
    return;
  }

  const variant = await Variant.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!variant) {
    notFound(res);
    return;
  }

  if (req.user!.role === 'moderator' && variant.submittedBy && variant.submittedBy.toString() === req.user!.id) {
    res.status(403).json({ success: false, error: { message: 'Moderators cannot edit their own submissions' } });
    return;
  }

  if (!req.body.note) {
    res.status(400).json({ success: false, error: { message: 'note is required', field: 'note' } });
    return;
  }

  const simpleFields: (keyof IVariant)[] = ['pashto', 'phonetic', 'region', 'definition', 'example'];
  const before: Record<string, unknown> = {};
  for (const field of simpleFields) {
    before[field as string] = variant[field];
  }
  const beforeConceptId = variant.concept.toString();

  const changes: Record<string, unknown> = {};

  // Handle concept reassignment
  if (req.body.concept !== undefined && req.body.concept !== beforeConceptId) {
    const newConceptId = req.body.concept as string;
    if (!mongoose.Types.ObjectId.isValid(newConceptId)) {
      res.status(404).json({ success: false, error: { message: 'Target concept not found' } });
      return;
    }
    const targetConcept = await Concept.findOne({ _id: newConceptId, isDeleted: { $ne: true } });
    if (!targetConcept) {
      res.status(404).json({ success: false, error: { message: 'Target concept not found' } });
      return;
    }

    // Compute the normalizedPashto that will be used after save
    const effectivePashto = req.body.pashto !== undefined ? req.body.pashto as string : variant.pashto;
    const effectiveRegion = req.body.region !== undefined ? req.body.region as string : variant.region;
    const normalizedPashto = effectivePashto.trim().normalize('NFC');

    const duplicate = await Variant.findOne({
      concept: newConceptId,
      normalizedPashto,
      region: effectiveRegion,
      isDeleted: { $ne: true },
      _id: { $ne: variant._id },
    });
    if (duplicate) {
      res.status(409).json({ success: false, error: { message: 'A variant with the same Pashto and region already exists on the target concept' } });
      return;
    }

    const oldConcept = await Concept.findById(beforeConceptId).lean();
    changes.concept = {
      from: { id: oldConcept!._id, englishGloss: oldConcept!.englishGloss },
      to:   { id: targetConcept._id, englishGloss: targetConcept.englishGloss },
    };
    variant.concept = new mongoose.Types.ObjectId(newConceptId);
  }

  // Apply simple field updates
  for (const field of simpleFields) {
    if (req.body[field as string] !== undefined) {
      (variant[field] as unknown) = req.body[field as string];
    }
  }

  await variant.save();

  // Compute diff for simple fields
  for (const field of simpleFields) {
    if (variant[field] !== before[field as string]) {
      changes[field as string] = { from: before[field as string], to: variant[field] };
    }
  }

  await new ModerationLog({
    targetModel: 'Variant',
    targetId: variant._id,
    action: 'edited',
    performedBy: req.user!.id,
    note: req.body.note as string,
    changes,
  }).save();

  res.status(200).json({ success: true, data: variant });
}

async function crossConceptCheck(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json({ success: false, error: { message: first.msg } });
    return;
  }

  const pashto = req.query.pashto as string;
  const conceptId = req.query.conceptId as string;

  const normalizedPashto = pashto.trim().normalize('NFC');

  const matches = await Variant.find({
    normalizedPashto,
    concept: { $ne: conceptId },
    isDeleted: { $ne: true },
  })
    .populate<{ concept: { _id: Types.ObjectId; englishGloss: string; status: string } }>('concept', 'englishGloss status')
    .lean();

  const seen = new Set<string>();
  const conflicts = matches
    .filter(v => {
      const id = (v.concept as any)._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(v => ({
      conceptId: (v.concept as any)._id,
      englishGloss: (v.concept as any).englishGloss,
      status: (v.concept as any).status,
    }));

  res.json({ success: true, data: { conflicts } });
}

export { createVariant, listVariants, getVariant, updateVariant, transitionVariantStatus, searchVariants, getMyVariantSubmissions, deleteVariant, editVariant, crossConceptCheck };
