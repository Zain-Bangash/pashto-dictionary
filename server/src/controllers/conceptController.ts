import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import Concept from '../models/Concept';
import { IConcept } from '../types/models';
import Variant from '../models/Variant';
import ModerationLog from '../models/ModerationLog';
import { enrichActors } from '../utils/enrichActors';
import { isAllowedLookup, invalidLookupMessage } from '../utils/lookups';
import { validateExtra, applyExtra, initialExtra } from '../utils/extraFields';
import { isDuplicateKey } from '../utils/duplicateKey';
import { rejectOpenSuggestions } from '../utils/suggestions';
import { attachAudio, rejectOpenClips, staleClips, retireClips, needsRetireConfirm, slotSnapshot } from '../utils/audioClips';
import { IAudioClip } from '../types/models';

type Doc = Record<string, unknown>;

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:  ['approved', 'rejected'],
  approved:  ['published', 'rejected'],
  rejected:  ['pending'],
  published: ['rejected'],
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

  const extra = await validateExtra('concept', req.body.extra, 'create');
  if (extra.error) {
    res.status(400).json({ success: false, error: extra.error });
    return;
  }

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
      extra: initialExtra(extra.values),
      submittedBy: req.user!.id,
      status: 'pending',
    }).save();
  } catch (err: unknown) {
    if (isDuplicateKey(err)) {
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

  const rawVariants = await Variant.find({ concept: id, status: 'published', isDeleted: { $ne: true } }, { 'forms.normalizedPashto': 0 }).lean();

  const [enrichedConcept] = await enrichActors([found as unknown as Doc], 'submittedBy');
  const enrichedVariants = await enrichActors(rawVariants as unknown as Doc[], 'submittedBy');
  const variants = await attachAudio(enrichedVariants as Parameters<typeof attachAudio>[0], found.partOfSpeech);

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
  const pashtoQ     = q.normalize('NFC');
  const pashtoRegex = new RegExp(escapeRegex(pashtoQ));

  function scoreText(text: string | undefined, query = ql): number {
    const t = (text || '').toLowerCase();
    if (t === query)          return 3;
    if (t.startsWith(query)) return 2;
    return 1;
  }

  // A form scores half a tier below the same match on the headword, so exact > prefix > contains still holds
  function scorePashto(v: { normalizedPashto?: string; forms?: { normalizedPashto?: string }[] }): number {
    const scores = (v.forms ?? [])
      .filter((f) => pashtoRegex.test(f.normalizedPashto ?? ''))
      .map((f) => scoreText(f.normalizedPashto, pashtoQ) - 0.5);
    if (pashtoRegex.test(v.normalizedPashto ?? '')) scores.push(scoreText(v.normalizedPashto, pashtoQ));
    return Math.max(0, ...scores);
  }

  const [glossMatches, phoneticVariants, pashtoVariants] = await Promise.all([
    Concept.find({ englishGloss: regex, status: 'published', isDeleted: { $ne: true } }, '_id englishGloss').lean(),
    Variant.find({ phonetic: regex, status: 'published', isDeleted: { $ne: true } }, 'concept phonetic').lean(),
    Variant.find(
      { $or: [{ normalizedPashto: pashtoRegex }, { 'forms.normalizedPashto': pashtoRegex }], status: 'published', isDeleted: { $ne: true } },
      'concept normalizedPashto forms.normalizedPashto'
    ).lean(),
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

  for (const v of pashtoVariants) {
    const id = (v.concept as mongoose.Types.ObjectId).toString();
    scoreMap.set(id, Math.max(scoreMap.get(id) ?? 0, scorePashto(v)));
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

  if (['published', 'approved'].includes(concept.status) && status === 'rejected' && req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: { message: `Only admins can reject ${concept.status} entries` } });
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
      status: { $in: ['pending', 'approved', 'published'] },
      isDeleted: { $ne: true },
    });
    const cascadeNote = `Concept "${concept.englishGloss}" was rejected: ${moderatorNote}`;
    await Promise.all(
      variantsToDelete.map(async (v) => {
        v.status = 'rejected';
        v.reviewedBy = req.user!.id;
        v.moderatorNote = cascadeNote;
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
    await rejectOpenSuggestions(variantsToDelete.map((v) => v._id as mongoose.Types.ObjectId), req.user!.id, cascadeNote);
    await rejectOpenClips(variantsToDelete.map((v) => v._id as mongoose.Types.ObjectId), req.user!.id, cascadeNote);
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

// Published concepts with no variant in the region. A variant in any status hides the gap; rejected
// variants are soft-deleted at rejection, so they are matched by status rather than isDeleted.
async function getWanted(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;
  const region = req.query.region as string;
  const q = ((req.query.q as string) || '').trim();

  const taken = await Variant.distinct('concept', { region, $or: [{ isDeleted: { $ne: true } }, { status: 'rejected' }] });
  const filter: Record<string, unknown> = { status: 'published', isDeleted: { $ne: true }, _id: { $nin: taken } };
  if (q) filter.englishGloss = new RegExp(escapeRegex(q), 'i');

  const [data, total] = await Promise.all([
    Concept.find(filter, 'englishGloss partOfSpeech').sort({ normalizedGloss: 1 }).skip(skip).limit(limit).lean(),
    Concept.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
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

  const variantIds = await Variant.distinct('_id', { concept: concept._id });
  await rejectOpenSuggestions(variantIds, req.user!.id, `Concept "${concept.englishGloss}" was removed`);
  await rejectOpenClips(variantIds, req.user!.id, `Concept "${concept.englishGloss}" was removed`);

  res.status(200).json({ success: true, data: concept });
}

async function editConcept(req: Request, res: Response): Promise<void> {
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

  const concept = await Concept.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!concept) {
    notFound(res);
    return;
  }

  if (req.user!.role === 'moderator' && concept.submittedBy && concept.submittedBy.toString() === req.user!.id) {
    res.status(403).json({ success: false, error: { message: 'Moderators cannot edit their own submissions' } });
    return;
  }

  if (req.user!.role === 'moderator' && concept.status === 'published') {
    res.status(403).json({ success: false, error: { message: 'Only admins can edit published entries' } });
    return;
  }

  if (!req.body.note) {
    res.status(400).json({ success: false, error: { message: 'note is required', field: 'note' } });
    return;
  }

  if (req.body.partOfSpeech !== undefined && !(await isAllowedLookup('partOfSpeech', req.body.partOfSpeech, concept.partOfSpeech))) {
    res.status(400).json({ success: false, error: { message: invalidLookupMessage('partOfSpeech'), field: 'partOfSpeech' } });
    return;
  }

  const extra = await validateExtra('concept', req.body.extra, 'edit', concept.extra);
  if (extra.error) {
    res.status(400).json({ success: false, error: extra.error });
    return;
  }

  const editableFields: (keyof IConcept)[] = ['englishGloss', 'partOfSpeech'];
  const before: Record<string, unknown> = {};
  for (const field of editableFields) {
    before[field as string] = concept[field];
  }

  const stale = await clipsStaleAfterPosChange(concept._id as mongoose.Types.ObjectId, concept.partOfSpeech, req.body.partOfSpeech as string | undefined);
  if (await needsRetireConfirm(req, res, stale)) return;

  if (req.body.englishGloss !== undefined) concept.englishGloss = req.body.englishGloss as string;
  if (req.body.partOfSpeech !== undefined) concept.partOfSpeech = req.body.partOfSpeech as string;
  const extraChanges = applyExtra(concept, extra.values);

  await concept.save();
  await retireClips(stale, req.user!.id, 'The part of speech changed');

  const changes: Record<string, unknown> = { ...extraChanges };
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

// Form-slot clips on the concept's variants that a part-of-speech change would orphan
async function clipsStaleAfterPosChange(conceptId: mongoose.Types.ObjectId, current: string, next: string | undefined): Promise<IAudioClip[]> {
  if (next === undefined || next === current) return [];
  const variants = await Variant.find({ concept: conceptId }, 'pashto example forms');
  const stale: IAudioClip[] = [];
  for (const variant of variants) {
    const text = slotSnapshot(variant);
    stale.push(...(await staleClips(variant._id as mongoose.Types.ObjectId, text, text, next)));
  }
  return stale;
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

  const stale: IAudioClip[] = [];
  if (targetConcept.partOfSpeech !== sourceConcept.partOfSpeech) {
    for (const variant of sourceVariants.filter((v) => movedIds.some((id) => id.equals(v._id as mongoose.Types.ObjectId)))) {
      const text = slotSnapshot(variant);
      stale.push(...(await staleClips(variant._id as mongoose.Types.ObjectId, text, text, targetConcept.partOfSpeech)));
    }
  }
  if (await needsRetireConfirm(req, res, stale)) return;

  if (movedIds.length > 0) {
    await Variant.updateMany({ _id: { $in: movedIds } }, { concept: targetConceptId });
  }
  await retireClips(stale, req.user!.id, 'The word moved to a concept with a different part of speech');

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

  const { englishGloss, partOfSpeech } = req.body as { englishGloss?: string; partOfSpeech?: string };

  if (partOfSpeech !== undefined && !(await isAllowedLookup('partOfSpeech', partOfSpeech, concept.partOfSpeech))) {
    res.status(400).json({ success: false, error: { message: invalidLookupMessage('partOfSpeech'), field: 'partOfSpeech' } });
    return;
  }

  const extra = await validateExtra('concept', req.body.extra, 'edit', concept.extra);
  if (extra.error) {
    res.status(400).json({ success: false, error: extra.error });
    return;
  }

  const stale = await clipsStaleAfterPosChange(concept._id as mongoose.Types.ObjectId, concept.partOfSpeech, partOfSpeech);
  if (await needsRetireConfirm(req, res, stale)) return;

  if (englishGloss !== undefined) concept.englishGloss = englishGloss;
  if (partOfSpeech !== undefined) concept.partOfSpeech = partOfSpeech;
  applyExtra(concept, extra.values);
  concept.status = 'pending';
  concept.moderatorNote = undefined;
  await concept.save();
  await retireClips(stale, req.user!.id, 'The part of speech changed');

  await new ModerationLog({
    targetModel: 'Concept',
    targetId: concept._id,
    action: 'resubmitted',
    performedBy: req.user!.id,
  }).save();

  res.status(200).json({ success: true, data: concept });
}

export { getWanted, createConcept, listConcepts, getConcept, suggestConcepts, searchConcepts, transitionConceptStatus, getMyConceptSubmissions, getWotd, deleteConcept, editConcept, mergeConcepts, updateConcept };
