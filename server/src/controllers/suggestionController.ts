import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import Concept from '../models/Concept';
import Variant from '../models/Variant';
import VariantSuggestion from '../models/VariantSuggestion';
import { IVariant, IVariantSuggestion, SuggestionStatus, OPEN_SUGGESTION_STATUSES } from '../types/models';
import { enrichActors } from '../utils/enrichActors';
import { applyForms } from '../utils/variantForms';
import { applySuggestion } from '../utils/applySuggestion';
import { isDuplicateKey } from '../utils/duplicateKey';
import {
  validateProposal, proposalToPlain, findOpenSuggestion, formsOnlyError, logSuggestion, PlainProposal, PROPOSAL_KEYS,
} from '../utils/suggestions';

type Doc = Record<string, unknown>;

// rejected → pending happens only through the owner's resubmit route
const VALID_TRANSITIONS: Record<SuggestionStatus, SuggestionStatus[]> = {
  pending:   ['approved', 'rejected'],
  approved:  ['published', 'rejected'],
  rejected:  [],
  published: [],
};

const OPEN_CONFLICT = 'You already have an open suggestion for this word';

function proposalInput(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(PROPOSAL_KEYS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
}

async function livePublishedVariant(variantId: Types.ObjectId | string) {
  const variant = await Variant.findById(variantId);
  return variant && variant.status === 'published' && !variant.isDeleted ? variant : null;
}

async function partOfSpeechOf(variant: IVariant): Promise<string | undefined> {
  return (await Concept.findById(variant.concept, 'partOfSpeech').lean())?.partOfSpeech;
}

function setProposal(suggestion: IVariantSuggestion, proposed: PlainProposal): void {
  suggestion.set('proposed', {
    phonetic: proposed.phonetic,
    example: proposed.example,
    forms: proposed.forms,
    extra: proposed.extra,
  });
}

function proposalDiff(before: PlainProposal, after: PlainProposal): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const key of ['phonetic', 'example'] as const) {
    if ((before[key] ?? '') !== (after[key] ?? '')) changes[key] = { from: before[key] ?? '', to: after[key] ?? '' };
  }
  const keys = new Set([...Object.keys(before.extra ?? {}), ...Object.keys(after.extra ?? {})]);
  for (const key of keys) {
    const from = before.extra?.[key] ?? '';
    const to = after.extra?.[key] ?? '';
    if (from !== to) changes[`extra.${key}`] = { from, to };
  }
  Object.assign(changes, applyForms({ forms: before.forms }, after.forms ?? []));
  return changes;
}

async function createSuggestion(req: Request, res: Response): Promise<void> {
  const variant = await Variant.findById(req.params.id);
  if (!variant || variant.isDeleted) {
    res.status(404).json({ success: false, error: { message: 'Variant not found' } });
    return;
  }
  if (variant.status !== 'published') {
    res.status(400).json({ success: false, error: { message: 'Only published words can be completed with a suggestion. Use Edit & Resubmit instead.' } });
    return;
  }
  const formsOnly = formsOnlyError(req.body, req.user!.id, variant.submittedBy);
  if (formsOnly) {
    res.status(400).json({ success: false, error: formsOnly });
    return;
  }
  if (await findOpenSuggestion(variant._id as Types.ObjectId, req.user!.id)) {
    res.status(409).json({ success: false, error: { message: OPEN_CONFLICT } });
    return;
  }

  const result = await validateProposal(proposalInput(req.body), variant, await partOfSpeechOf(variant));
  if (result.error) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  let suggestion: IVariantSuggestion;
  try {
    suggestion = await new VariantSuggestion({
      variant: variant._id,
      proposed: result.proposed,
      submittedBy: req.user!.id,
      status: 'pending',
    }).save();
  } catch (err) {
    if (isDuplicateKey(err)) {
      res.status(409).json({ success: false, error: { message: OPEN_CONFLICT } });
      return;
    }
    throw err;
  }

  await logSuggestion(suggestion._id as Types.ObjectId, 'submitted', req.user!.id);
  res.status(201).json({ success: true, data: suggestion });
}

async function resubmitSuggestion(req: Request, res: Response): Promise<void> {
  const suggestion = res.locals.suggestion as IVariantSuggestion;
  if (suggestion.status !== 'rejected') {
    res.status(400).json({ success: false, error: { message: 'Only rejected suggestions can be resubmitted' } });
    return;
  }
  const variant = await livePublishedVariant(suggestion.variant);
  if (!variant) {
    res.status(400).json({ success: false, error: { message: 'The word is no longer published' } });
    return;
  }
  const formsOnly = formsOnlyError(req.body, suggestion.submittedBy, variant.submittedBy);
  if (formsOnly) {
    res.status(400).json({ success: false, error: formsOnly });
    return;
  }
  if (await findOpenSuggestion(variant._id as Types.ObjectId, suggestion.submittedBy)) {
    res.status(409).json({ success: false, error: { message: OPEN_CONFLICT } });
    return;
  }

  const result = await validateProposal(proposalInput(req.body), variant, await partOfSpeechOf(variant));
  if (result.error) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  setProposal(suggestion, result.proposed);
  suggestion.status = 'pending';
  suggestion.moderatorNote = undefined;
  suggestion.reviewedBy = undefined;
  try {
    await suggestion.save();
  } catch (err) {
    if (isDuplicateKey(err)) {
      res.status(409).json({ success: false, error: { message: OPEN_CONFLICT } });
      return;
    }
    throw err;
  }

  await logSuggestion(suggestion._id as Types.ObjectId, 'resubmitted', req.user!.id);
  res.status(200).json({ success: true, data: suggestion });
}

async function loadSuggestion(req: Request, res: Response): Promise<IVariantSuggestion | null> {
  const id = req.params.id as string;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, error: { message: 'Invalid suggestion id' } });
    return null;
  }
  const suggestion = await VariantSuggestion.findById(id);
  if (!suggestion) res.status(404).json({ success: false, error: { message: 'Suggestion not found' } });
  return suggestion;
}

async function editSuggestion(req: Request, res: Response): Promise<void> {
  const suggestion = await loadSuggestion(req, res);
  if (!suggestion) return;
  if (!OPEN_SUGGESTION_STATUSES.includes(suggestion.status)) {
    res.status(400).json({ success: false, error: { message: `Cannot edit a ${suggestion.status} suggestion` } });
    return;
  }

  const variant = await livePublishedVariant(suggestion.variant);
  if (!variant) {
    res.status(400).json({ success: false, error: { message: 'The word is no longer published' } });
    return;
  }
  const formsOnly = formsOnlyError(req.body, suggestion.submittedBy, variant.submittedBy);
  if (formsOnly) {
    res.status(400).json({ success: false, error: formsOnly });
    return;
  }
  const result = await validateProposal(proposalInput(req.body), variant, await partOfSpeechOf(variant));
  if (result.error) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  const changes = proposalDiff(proposalToPlain(suggestion.proposed), result.proposed);
  setProposal(suggestion, result.proposed);
  await suggestion.save();
  await logSuggestion(suggestion._id as Types.ObjectId, 'edited', req.user!.id, req.body.note as string, changes);
  res.status(200).json({ success: true, data: suggestion });
}

async function transitionSuggestion(req: Request, res: Response): Promise<void> {
  const suggestion = await loadSuggestion(req, res);
  if (!suggestion) return;
  const { status, moderatorNote } = req.body as { status: SuggestionStatus; moderatorNote?: string };
  const isAdmin = req.user!.role === 'admin';

  if (!isAdmin && (status === 'approved' || status === 'rejected') && suggestion.submittedBy === req.user!.id) {
    res.status(403).json({ success: false, error: { message: 'Moderators cannot approve or reject their own submissions' } });
    return;
  }
  if (suggestion.status === 'approved' && status === 'rejected' && !isAdmin) {
    res.status(403).json({ success: false, error: { message: 'Only admins can reject approved entries' } });
    return;
  }
  if (!VALID_TRANSITIONS[suggestion.status].includes(status)) {
    res.status(400).json({ success: false, error: { message: `Cannot transition suggestion from '${suggestion.status}' to '${status}'` } });
    return;
  }
  if (status === 'rejected' && !moderatorNote) {
    res.status(400).json({ success: false, error: { message: 'moderatorNote is required when rejecting', field: 'moderatorNote' } });
    return;
  }

  if (status === 'published') {
    const result = await applySuggestion(suggestion._id as unknown as string, req.user!.id);
    if (result.error) {
      res.status(result.status).json({ success: false, error: result.error });
      return;
    }
    res.status(200).json({ success: true, data: { suggestion: result.suggestion, variant: result.variant } });
    return;
  }

  if (status === 'approved') {
    const variant = await livePublishedVariant(suggestion.variant);
    if (!variant) {
      res.status(400).json({ success: false, error: { message: 'The word is no longer published' } });
      return;
    }
    const check = await validateProposal(proposalToPlain(suggestion.proposed), variant, await partOfSpeechOf(variant));
    if (check.error) {
      res.status(400).json({ success: false, error: check.error });
      return;
    }
  }

  suggestion.status = status;
  suggestion.reviewedBy = req.user!.id;
  if (moderatorNote) suggestion.moderatorNote = moderatorNote;
  await suggestion.save();
  await logSuggestion(suggestion._id as Types.ObjectId, status, req.user!.id, moderatorNote);
  res.status(200).json({ success: true, data: { suggestion } });
}

const VARIANT_FIELDS = 'pashto phonetic region definition example extra forms status concept submittedBy';

type Group = { _id: Types.ObjectId; suggestions: Doc[] };

// Groups open suggestions by word so competing proposals for the same form slot are reviewed together.
// Pages count words, oldest waiting suggestion first.
async function getSuggestionQueue(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const isAdmin = req.user!.role === 'admin';
  const status: SuggestionStatus = isAdmin && req.query.status === 'approved' ? 'approved' : 'pending';

  // ?concept= lists the open suggestions on one concept's variants (admin Concepts panel)
  const match: Record<string, unknown> = { status };
  if (req.query.concept) {
    match.variant = { $in: await Variant.distinct('_id', { concept: req.query.concept as string }) };
    match.status = { $in: isAdmin ? OPEN_SUGGESTION_STATUSES : ['pending'] };
  }

  const [[facet], pendingCount, approvedCount] = await Promise.all([
    VariantSuggestion.aggregate([
      { $match: match },
      { $sort: { createdAt: 1 } },
      { $group: { _id: '$variant', suggestions: { $push: '$$ROOT' }, oldest: { $min: '$createdAt' } } },
      { $sort: { oldest: 1, _id: 1 } },
      { $facet: { total: [{ $count: 'n' }], groups: [{ $skip: skip }, { $limit: limit }] } },
    ]),
    VariantSuggestion.countDocuments({ status: 'pending' }),
    isAdmin ? VariantSuggestion.countDocuments({ status: 'approved' }) : Promise.resolve(0),
  ]);
  const groups = facet.groups as Group[];

  const variants = await Variant.find({ _id: { $in: groups.map((g) => g._id) } }, VARIANT_FIELDS)
    .populate('concept', 'englishGloss partOfSpeech status').lean();
  const enrichedVariants = await enrichActors(variants as unknown as Doc[], 'submittedBy');
  const byId = new Map(enrichedVariants.map((v) => [String(v._id), v]));

  const flat = await enrichActors(groups.flatMap((g) => g.suggestions), 'submittedBy');
  let at = 0;
  const data = groups.map((g) => {
    const suggestions = flat.slice(at, at + g.suggestions.length);
    at += g.suggestions.length;
    return { variant: byId.get(String(g._id)) ?? null, suggestions };
  });

  res.status(200).json({
    success: true,
    data,
    meta: { page, limit, total: facet.total[0]?.n ?? 0, pendingCount, approvedCount },
  });
}

// The caller's own suggestions. scope=others leaves out suggestions on their own words (those show on the word's row);
// status=open and concept= narrow it for the concept page.
async function getMySuggestions(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const me = req.user!.id;

  const match: Record<string, unknown> = { submittedBy: me };
  if (req.query.status === 'open') match.status = { $in: OPEN_SUGGESTION_STATUSES };
  const after: Record<string, unknown> = {};
  if (req.query.scope === 'others') after['variant.submittedBy'] = { $ne: me };
  if (req.query.concept) after['variant.concept._id'] = new Types.ObjectId(req.query.concept as string);

  const [facet] = await VariantSuggestion.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'variants', localField: 'variant', foreignField: '_id', as: 'variant',
        pipeline: [
          { $project: { pashto: 1, region: 1, status: 1, forms: 1, submittedBy: 1, concept: 1, isDeleted: 1 } },
          { $lookup: { from: 'concepts', localField: 'concept', foreignField: '_id', as: 'concept', pipeline: [{ $project: { englishGloss: 1, partOfSpeech: 1 } }] } },
          { $unwind: { path: '$concept', preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: '$variant' },
    { $match: after },
    { $sort: { createdAt: -1 } },
    { $facet: { total: [{ $count: 'n' }], data: [{ $skip: (page - 1) * limit }, { $limit: limit }] } },
  ]);

  res.status(200).json({ success: true, data: facet.data, meta: { page, limit, total: facet.total[0]?.n ?? 0 } });
}

export { createSuggestion, resubmitSuggestion, editSuggestion, transitionSuggestion, getSuggestionQueue, getMySuggestions };
