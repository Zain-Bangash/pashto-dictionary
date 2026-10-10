import { validationResult } from 'express-validator';
import mongoose, { Types } from 'mongoose';
import { Request, Response } from 'express';
import Concept from '../models/Concept';
import Variant from '../models/Variant';
import { IVariant } from '../types/models';
import ModerationLog from '../models/ModerationLog';
import { isAllowedLookup, invalidLookupMessage } from '../utils/lookups';
import { validateExtra, applyExtra, initialExtra } from '../utils/extraFields';
import { validateForms, applyForms } from '../utils/variantForms';
import VariantSuggestion from '../models/VariantSuggestion';
import { isDuplicateKey } from '../utils/duplicateKey';
import { completionStages, missingMatch, optionalExtraKeys } from '../utils/blankFields';
import { lockedFields, lockClash, rejectOpenSuggestions } from '../utils/suggestions';
import { rejectOpenClips, staleClips, retireClips, needsRetireConfirm, slotSnapshot } from '../utils/audioClips';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:  ['approved', 'rejected'],
  approved:  ['published', 'rejected'],
  rejected:  ['pending'],
  published: ['rejected'],
};

const RESUBMIT_DUPLICATE = 'This word already exists for that concept in this region. Someone may have added it while yours was rejected; change the word or region.';
const EDIT_DUPLICATE = 'A variant with the same Pashto and region already exists for this concept';

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

  const extra = await validateExtra('variant', req.body.extra, 'create');
  if (extra.error) {
    res.status(400).json({ success: false, error: extra.error });
    return;
  }

  const concept = await Concept.findById(conceptId, 'partOfSpeech').lean();
  if (!concept) {
    res.status(404).json({ success: false, error: { message: 'Concept not found' } });
    return;
  }

  const forms = validateForms(req.body.forms, concept.partOfSpeech);
  if (forms.error) {
    res.status(400).json({ success: false, error: forms.error });
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
      extra: initialExtra(extra.values),
      forms: forms.forms?.length ? forms.forms : undefined,
      submittedBy: req.user!.id,
      status: 'pending',
    }).save();
  } catch (err: unknown) {
    if (isDuplicateKey(err)) {
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

  if (region !== undefined && !(await isAllowedLookup('region', region, variant.region))) {
    res.status(400).json({ success: false, error: { message: invalidLookupMessage('region'), field: 'region' } });
    return;
  }

  const extra = await validateExtra('variant', req.body.extra, 'edit', variant.extra);
  if (extra.error) {
    res.status(400).json({ success: false, error: extra.error });
    return;
  }

  const concept = await Concept.findById(variant.concept, 'partOfSpeech').lean();
  const forms = validateForms(req.body.forms, concept?.partOfSpeech, variant.forms);
  if (forms.error) {
    res.status(400).json({ success: false, error: forms.error });
    return;
  }

  // Always checked: resubmitting restores a soft-deleted record, and someone may have added the same word meanwhile
  const effectivePashto  = pashto  ?? variant.pashto;
  const effectiveRegion  = region  ?? variant.region;
  const duplicate = await Variant.findOne({
    normalizedPashto: effectivePashto.trim().normalize('NFC'),
    concept: variant.concept,
    region: effectiveRegion,
    isDeleted: { $ne: true },
    _id: { $ne: variant._id },
  });
  if (duplicate) {
    res.status(409).json({ success: false, error: { message: RESUBMIT_DUPLICATE } });
    return;
  }

  const textBefore = slotSnapshot(variant);
  if (pashto !== undefined)          variant.pashto         = pashto;
  if (phonetic !== undefined)        variant.phonetic       = phonetic;
  if (region !== undefined)          variant.region         = region;
  if (definition !== undefined)      variant.definition     = definition;
  if (example !== undefined)         variant.example        = example;
  if (submissionNote !== undefined)  variant.submissionNote = submissionNote;
  applyExtra(variant, extra.values);
  applyForms(variant, forms.forms);
  variant.status = 'pending';
  variant.moderatorNote = undefined;
  variant.isDeleted = false;
  variant.deletedAt = undefined;
  const stale = await staleClips(variant._id as Types.ObjectId, textBefore, slotSnapshot(variant), concept?.partOfSpeech);
  if (await needsRetireConfirm(req, res, stale)) return;
  try {
    await variant.save();
  } catch (err) {
    if (isDuplicateKey(err)) {
      res.status(409).json({ success: false, error: { message: RESUBMIT_DUPLICATE } });
      return;
    }
    throw err;
  }
  await retireClips(stale, req.user!.id, "The word's text changed");

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

  if (['published', 'approved'].includes(variant.status) && status === 'rejected' && req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: { message: `Only admins can reject ${variant.status} entries` } });
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

  if (status === 'approved') {
    const parentConcept = await Concept.findById(variant.concept, 'status');
    if (!parentConcept || !['approved', 'published'].includes(parentConcept.status)) {
      res.status(400).json({
        success: false,
        error: { message: 'Cannot approve a variant whose concept has not been approved yet.' },
      });
      return;
    }
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

  if (status === 'rejected') {
    await rejectOpenSuggestions([variant._id as Types.ObjectId], req.user!.id, `The word was rejected: ${moderatorNote}`);
    await rejectOpenClips([variant._id as Types.ObjectId], req.user!.id, `The word was rejected: ${moderatorNote}`);
  }

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

type Doc = Record<string, unknown>;

// The owner's own latest suggestion per word; other people's suggestions on the word are not theirs to manage
async function attachLatestSuggestions(variants: Doc[], owner: string): Promise<Doc[]> {
  const ids = variants.filter((v) => v.status === 'published').map((v) => v._id as Types.ObjectId);
  if (!ids.length) return variants.map((v) => ({ ...v, latestSuggestion: null }));
  const suggestions = await VariantSuggestion.find({ variant: { $in: ids }, submittedBy: owner }, 'variant status moderatorNote proposed updatedAt')
    .sort({ updatedAt: -1 }).lean();
  const latest = new Map<string, unknown>();
  for (const s of suggestions) if (!latest.has(String(s.variant))) latest.set(String(s.variant), s);
  return variants.map((v) => ({ ...v, latestSuggestion: latest.get(String(v._id)) ?? null }));
}

// ?needs=completion lists published words with blank optional fields; ?missing narrows it; ?region filters either list
async function getMyVariantSubmissions(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const own: Record<string, unknown> = { submittedBy: req.user!.id };
  if (req.query.region) own.region = req.query.region as string;
  const live = { ...own, status: 'published', isDeleted: { $ne: true } };
  const completion = req.query.needs === 'completion';

  // Include soft-deleted rejected variants so submitters can still read the rejection note.
  const listMatch = completion ? live : { ...own, $or: [{ isDeleted: { $ne: true } }, { status: 'rejected' }] };
  const stages = completionStages(await optionalExtraKeys());

  const [[list], [count]] = await Promise.all([
    Variant.aggregate([
      { $match: listMatch },
      ...stages,
      ...(completion ? [{ $match: missingMatch((req.query.missing as string) || 'any') }] : []),
      { $sort: { createdAt: -1, _id: -1 } },
      { $facet: { data: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
    ]),
    Variant.aggregate([{ $match: live }, ...stages, { $match: missingMatch('any') }, { $count: 'n' }]),
  ]);

  const data = await attachLatestSuggestions(list.data as Doc[], req.user!.id);
  const total = (list.total[0]?.n as number) ?? 0;
  res.status(200).json({ success: true, data, meta: { page, limit, total, needsCompletionCount: count?.n ?? 0 } });
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

  await rejectOpenSuggestions([variant._id as Types.ObjectId], req.user!.id, 'The word was removed');
  await rejectOpenClips([variant._id as Types.ObjectId], req.user!.id, 'The word was removed');

  res.status(200).json({ success: true, data: variant });
}

async function editVariant(req: Request, res: Response): Promise<void> {
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

  const variant = await Variant.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!variant) {
    notFound(res);
    return;
  }

  if (variant.status === 'rejected') {
    res.status(400).json({ success: false, error: { message: "Rejected entries can't be edited — the submitter resubmits them" } });
    return;
  }

  if (!req.body.note) {
    res.status(400).json({ success: false, error: { message: 'note is required', field: 'note' } });
    return;
  }

  if (req.body.region !== undefined && !(await isAllowedLookup('region', req.body.region, variant.region))) {
    res.status(400).json({ success: false, error: { message: invalidLookupMessage('region'), field: 'region' } });
    return;
  }

  const extra = await validateExtra('variant', req.body.extra, 'edit', variant.extra);
  if (extra.error) {
    res.status(400).json({ success: false, error: extra.error });
    return;
  }

  const simpleFields: (keyof IVariant)[] = ['pashto', 'phonetic', 'region', 'definition', 'example'];
  const before: Record<string, unknown> = {};
  for (const field of simpleFields) {
    before[field as string] = variant[field];
  }
  const beforeConceptId = variant.concept.toString();
  const textBefore = slotSnapshot(variant);

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

  const formsConcept = await Concept.findById(variant.concept, 'partOfSpeech').lean();
  const forms = validateForms(req.body.forms, formsConcept?.partOfSpeech, variant.forms);
  if (forms.error) {
    res.status(400).json({ success: false, error: forms.error });
    return;
  }

  const clash = lockClash(await lockedFields(variant._id as Types.ObjectId), req.body, variant, extra.values, forms.forms);
  if (clash) {
    res.status(409).json({ success: false, error: clash });
    return;
  }

  // Apply simple field updates
  for (const field of simpleFields) {
    if (req.body[field as string] !== undefined) {
      (variant[field] as unknown) = req.body[field as string];
    }
  }
  Object.assign(changes, applyExtra(variant, extra.values), applyForms(variant, forms.forms));

  const stale = await staleClips(variant._id as Types.ObjectId, textBefore, slotSnapshot(variant), formsConcept?.partOfSpeech);
  if (await needsRetireConfirm(req, res, stale)) return;

  try {
    await variant.save();
  } catch (err) {
    if (isDuplicateKey(err)) {
      res.status(409).json({ success: false, error: { message: EDIT_DUPLICATE } });
      return;
    }
    throw err;
  }
  await retireClips(stale, req.user!.id, "The word's text changed");

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
