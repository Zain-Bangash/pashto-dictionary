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
  validateProposal, proposalToPlain, findOpenSuggestion, logSuggestion, PlainProposal, PROPOSAL_KEYS,
} from '../utils/suggestions';

type Doc = Record<string, unknown>;

// rejected → pending happens only through the owner's resubmit route
const VALID_TRANSITIONS: Record<SuggestionStatus, SuggestionStatus[]> = {
  pending:   ['approved', 'rejected'],
  approved:  ['published', 'rejected'],
  rejected:  [],
  published: [],
};

const OPEN_CONFLICT = 'This word already has an open suggestion';

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
  const variant = res.locals.variant as IVariant;
  if (variant.status !== 'published' || variant.isDeleted) {
    res.status(400).json({ success: false, error: { message: 'Only published words can be completed with a suggestion. Use Edit & Resubmit instead.' } });
    return;
  }
  if (await findOpenSuggestion(variant._id as Types.ObjectId)) {
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
  if (await findOpenSuggestion(variant._id as Types.ObjectId)) {
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
  const isAdmin = req.user!.role === 'admin';

  if (!isAdmin && suggestion.submittedBy === req.user!.id) {
    res.status(403).json({ success: false, error: { message: 'Moderators cannot edit their own submissions' } });
    return;
  }
  const editable: SuggestionStatus[] = isAdmin ? ['pending', 'approved'] : ['pending'];
  if (!editable.includes(suggestion.status)) {
    res.status(isAdmin || suggestion.status !== 'approved' ? 400 : 403).json({
      success: false,
      error: { message: `Cannot edit a ${suggestion.status} suggestion` },
    });
    return;
  }

  const variant = await livePublishedVariant(suggestion.variant);
  if (!variant) {
    res.status(400).json({ success: false, error: { message: 'The word is no longer published' } });
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

async function getSuggestionQueue(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const isAdmin = req.user!.role === 'admin';
  const status: SuggestionStatus = isAdmin && req.query.status === 'approved' ? 'approved' : 'pending';

  // ?concept= lists the open suggestions on one concept's variants (admin published-word panel)
  const filter: Record<string, unknown> = { status };
  if (req.query.concept) {
    filter.variant = { $in: await Variant.distinct('_id', { concept: req.query.concept as string }) };
    filter.status = { $in: isAdmin ? OPEN_SUGGESTION_STATUSES : ['pending'] };
  }

  const [rawData, total, pendingCount, approvedCount] = await Promise.all([
    VariantSuggestion.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    VariantSuggestion.countDocuments(filter),
    VariantSuggestion.countDocuments({ status: 'pending' }),
    isAdmin ? VariantSuggestion.countDocuments({ status: 'approved' }) : Promise.resolve(0),
  ]);

  const variants = await Variant.find(
    { _id: { $in: rawData.map((s) => s.variant) } },
    'pashto phonetic region definition example extra forms status concept submittedBy'
  ).populate('concept', 'englishGloss partOfSpeech status').lean();
  const byId = new Map(variants.map((v) => [String(v._id), v]));

  const withVariants = rawData.map((s) => ({ ...s, variant: byId.get(String(s.variant)) ?? null }));
  const data = await enrichActors(withVariants as unknown as Doc[], 'submittedBy');

  res.status(200).json({ success: true, data, meta: { page, limit, total, pendingCount, approvedCount } });
}

export { createSuggestion, resubmitSuggestion, editSuggestion, transitionSuggestion, getSuggestionQueue };
