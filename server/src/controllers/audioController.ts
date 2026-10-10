import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import AudioClip from '../models/AudioClip';
import Variant from '../models/Variant';
import Concept from '../models/Concept';
import ModerationLog from '../models/ModerationLog';
import { IAudioClip, AudioClipStatus } from '../types/models';
import { probeAudio, AudioFormat } from '../utils/audioProbe';
import { findSlot, MIN_DURATION_MS, DURATION_TOLERANCE_MS } from '../utils/audioSlots';
import { putObject, removeObject } from '../utils/storage';
import { logClip, closeClip, deleteClipFile, withUrl } from '../utils/audioClips';
import { enrichActors } from '../utils/enrichActors';
import { isDuplicateKey } from '../utils/duplicateKey';
import logger from '../utils/logger';

type Doc = Record<string, unknown>;

const OPEN_CONFLICT = 'A recording for this is already under review';
const NOT_LIVE = 'Only published words can have recordings';

// Declared types each detected container may arrive with; a generic type is accepted for any
const DECLARED: Record<AudioFormat, string[]> = {
  webm: ['audio/webm', 'video/webm'],
  mp4:  ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'video/mp4'],
  ogg:  ['audio/ogg', 'audio/opus', 'application/ogg'],
  mp3:  ['audio/mpeg', 'audio/mp3', 'audio/mpeg3'],
};
const GENERIC = ['', 'application/octet-stream'];

// pending → approved → published; withdrawn, retired and rejected are final
const VALID_TRANSITIONS: Record<AudioClipStatus, AudioClipStatus[]> = {
  pending:   ['approved', 'rejected'],
  approved:  ['published', 'rejected'],
  published: ['rejected'],
  rejected:  [],
  retired:   [],
  withdrawn: [],
};

const fail = (res: Response, status: number, message: string, field?: string) =>
  res.status(status).json({ success: false, error: { message, ...(field && { field }) } });

async function liveVariant(id: Types.ObjectId | string) {
  const variant = await Variant.findById(id);
  if (!variant || variant.isDeleted || variant.status !== 'published') return null;
  const concept = await Concept.findById(variant.concept, 'englishGloss partOfSpeech status isDeleted').lean();
  if (!concept || concept.isDeleted || concept.status !== 'published') return null;
  return { variant, concept };
}

function clipFields(clip: Doc): Doc {
  const { storageKey: _k, lane: _l, __v: _v, ...rest } = clip;
  return rest;
}

async function uploadClip(req: Request, res: Response): Promise<void> {
  const live = await liveVariant(req.params.id as string);
  if (!live) {
    fail(res, 400, NOT_LIVE);
    return;
  }
  const { variant, concept } = live;

  const slot = findSlot(variant, concept.partOfSpeech, req.query.slot as string);
  if (!slot) {
    fail(res, 400, 'This word has no such recording slot', 'slot');
    return;
  }

  const body = req.body as unknown;
  if (!Buffer.isBuffer(body) || !body.length) {
    fail(res, 400, 'Attach an audio recording', 'audio');
    return;
  }
  const probe = probeAudio(body);
  if (probe.error !== undefined) {
    fail(res, 400, probe.error, 'audio');
    return;
  }
  const declared = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (!GENERIC.includes(declared) && !DECLARED[probe.format].includes(declared)) {
    fail(res, 400, 'The file type does not match its contents', 'audio');
    return;
  }
  if (probe.durationMs < MIN_DURATION_MS) {
    fail(res, 400, 'The recording is too short', 'audio');
    return;
  }
  if (probe.durationMs > slot.maxSeconds * 1000 + DURATION_TOLERANCE_MS) {
    fail(res, 400, `The recording is too long: this one allows up to ${slot.maxSeconds} seconds`, 'audio');
    return;
  }

  if (await AudioClip.exists({ variant: variant._id, slot: slot.slot, lane: 'open' })) {
    fail(res, 409, OPEN_CONFLICT);
    return;
  }
  const current = await AudioClip.findOne({ variant: variant._id, slot: slot.slot, lane: 'live' }, '_id').lean();

  const _id = new mongoose.Types.ObjectId();
  const storageKey = `audio/${variant._id}/${_id}.${probe.ext}`;
  await putObject(storageKey, body, probe.mimeType);

  let clip: IAudioClip;
  try {
    clip = await new AudioClip({
      _id,
      variant: variant._id,
      slot: slot.slot,
      storageKey,
      mimeType: probe.mimeType,
      sizeBytes: body.length,
      durationMs: probe.durationMs,
      replaces: current?._id,
      submittedBy: req.user!.id,
    }).save();
  } catch (err) {
    await removeObject(storageKey).catch((e: Error) => logger.error(`Audio cleanup failed for ${storageKey}: ${e.message}`));
    if (isDuplicateKey(err)) {
      fail(res, 409, OPEN_CONFLICT);
      return;
    }
    throw err;
  }

  await logClip(clip._id, 'submitted', req.user!.id, undefined, { slot: slot.slot, variant: variant._id });
  res.status(201).json({ success: true, data: clipFields(await withUrl(clip.toObject() as unknown as Doc)) });
}

async function withdrawClip(req: Request, res: Response): Promise<void> {
  const clip = res.locals.clip as IAudioClip;
  if (clip.status !== 'pending') {
    fail(res, 400, 'Only recordings still waiting for review can be withdrawn');
    return;
  }
  if (!(await closeClip(clip, 'withdrawn', req.user!.id))) {
    fail(res, 409, 'This recording was just reviewed. Reload to see its status.');
    return;
  }
  res.status(200).json({ success: true, data: { _id: clip._id, status: 'withdrawn' } });
}

async function restoreLive(id: Types.ObjectId): Promise<void> {
  await AudioClip.updateOne(
    { _id: id, status: 'retired' },
    { $set: { status: 'published', lane: 'live' }, $unset: { retiredReason: 1 } }
  );
}

// Retire the current clip, then publish the new one; the old file is deleted only after both writes land
async function publishClip(clip: IAudioClip, adminId: string, res: Response): Promise<void> {
  const current = await AudioClip.findOne({ variant: clip.variant, slot: clip.slot, lane: 'live' });
  const reason = 'Replaced by a newer recording';
  if (current) {
    await AudioClip.updateOne(
      { _id: current._id, status: 'published' },
      { $set: { status: 'retired', retiredReason: reason }, $unset: { lane: 1 } }
    );
  }

  let published: IAudioClip | null;
  try {
    published = await AudioClip.findOneAndUpdate(
      { _id: clip._id, status: 'approved' },
      { $set: { status: 'published', lane: 'live', reviewedBy: adminId } },
      { returnDocument: 'after' }
    );
  } catch (err) {
    if (current) await restoreLive(current._id);
    if (isDuplicateKey(err)) {
      fail(res, 409, 'Another recording was published for this at the same time. Reload and try again.');
      return;
    }
    throw err;
  }
  if (!published) {
    if (current) await restoreLive(current._id);
    fail(res, 400, 'Only approved recordings can be published');
    return;
  }

  await logClip(clip._id, 'published', adminId);
  if (current) await logClip(current._id, 'retired', adminId, reason);
  await new ModerationLog({
    targetModel: 'Variant',
    targetId: clip.variant,
    action: 'audio_published',
    performedBy: adminId,
    changes: { slot: clip.slot, clipId: clip._id, ...(current && { replaced: current._id }) },
  }).save();
  if (current) await deleteClipFile(current);

  res.status(200).json({ success: true, data: clipFields(published.toObject() as unknown as Doc) });
}

async function transitionClip(req: Request, res: Response): Promise<void> {
  const clip = await AudioClip.findById(req.params.id);
  if (!clip) {
    fail(res, 404, 'Recording not found');
    return;
  }
  const { status, moderatorNote } = req.body as { status: AudioClipStatus; moderatorNote?: string };
  const isAdmin = req.user!.role === 'admin';

  if (!isAdmin && clip.submittedBy === req.user!.id) {
    fail(res, 403, 'Moderators cannot approve or reject their own submissions');
    return;
  }
  if (['approved', 'published'].includes(clip.status) && status === 'rejected' && !isAdmin) {
    fail(res, 403, `Only admins can reject ${clip.status} recordings`);
    return;
  }
  if (!VALID_TRANSITIONS[clip.status].includes(status)) {
    fail(res, 400, `Cannot transition recording from '${clip.status}' to '${status}'`);
    return;
  }
  if (status === 'rejected') {
    if (!moderatorNote) {
      fail(res, 400, 'moderatorNote is required when rejecting', 'moderatorNote');
      return;
    }
    if (!(await closeClip(clip, 'rejected', req.user!.id, { moderatorNote }))) {
      fail(res, 409, 'This recording was just changed. Reload and try again.');
      return;
    }
    res.status(200).json({ success: true, data: { _id: clip._id, status: 'rejected', moderatorNote } });
    return;
  }

  const live = await liveVariant(clip.variant);
  if (!live) {
    fail(res, 400, 'The word is no longer published');
    return;
  }
  if (!findSlot(live.variant, live.concept.partOfSpeech, clip.slot)) {
    fail(res, 400, 'This recording no longer matches a slot on the word. Reject it instead.');
    return;
  }

  if (status === 'published') {
    await publishClip(clip, req.user!.id, res);
    return;
  }

  const approved = await AudioClip.findOneAndUpdate(
    { _id: clip._id, status: 'pending' },
    { $set: { status: 'approved', reviewedBy: req.user!.id } },
    { returnDocument: 'after' }
  );
  if (!approved) {
    fail(res, 409, 'This recording was just changed. Reload and try again.');
    return;
  }
  await logClip(clip._id, 'approved', req.user!.id);
  res.status(200).json({ success: true, data: clipFields(approved.toObject() as unknown as Doc) });
}

function pageOf(req: Request) {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function variantsById(ids: Types.ObjectId[]) {
  const variants = await Variant.find({ _id: { $in: ids } }, 'pashto region example forms status isDeleted concept')
    .populate('concept', 'englishGloss partOfSpeech').lean();
  return new Map(variants.map((v) => [String(v._id), v]));
}

function slotInfo(variant: Doc | undefined, slot: string) {
  if (!variant) return null;
  const concept = variant.concept as Doc | undefined;
  return findSlot(variant as never, concept?.partOfSpeech as string | undefined, slot) ?? null;
}

async function getMyClips(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = pageOf(req);
  const filter = { submittedBy: req.user!.id };
  const [clips, total] = await Promise.all([
    AudioClip.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AudioClip.countDocuments(filter),
  ]);
  const variants = await variantsById(clips.map((c) => c.variant));

  const data = await Promise.all(clips.map(async (c) => {
    const variant = variants.get(String(c.variant)) as Doc | undefined;
    return {
      ...clipFields(c.lane ? await withUrl(c as unknown as Doc) : (c as unknown as Doc)),
      variant: variant ? { _id: variant._id, pashto: variant.pashto, region: variant.region, concept: variant.concept } : null,
      slotText: slotInfo(variant, c.slot)?.text ?? '',
    };
  }));
  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function getAudioQueue(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = pageOf(req);
  const isAdmin = req.user!.role === 'admin';
  const status = isAdmin && req.query.status === 'approved' ? 'approved' : 'pending';

  const [clips, total, pendingCount, approvedCount] = await Promise.all([
    AudioClip.find({ status }).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    AudioClip.countDocuments({ status }),
    AudioClip.countDocuments({ status: 'pending' }),
    isAdmin ? AudioClip.countDocuments({ status: 'approved' }) : Promise.resolve(0),
  ]);

  const [variants, currents] = await Promise.all([
    variantsById(clips.map((c) => c.variant)),
    clips.length
      ? AudioClip.find({ lane: 'live', $or: clips.map((c) => ({ variant: c.variant, slot: c.slot })) }).lean()
      : Promise.resolve([]),
  ]);
  const enrichedCurrents = await enrichActors(currents as unknown as Doc[], 'submittedBy');
  const currentBySlot = new Map(enrichedCurrents.map((c) => [`${c.variant}|${c.slot}`, c]));
  const enriched = await enrichActors(clips as unknown as Doc[], 'submittedBy');

  const data = await Promise.all(enriched.map(async (c) => {
    const variant = variants.get(String(c.variant)) as Doc | undefined;
    const current = currentBySlot.get(`${c.variant}|${c.slot}`);
    return {
      ...clipFields(await withUrl(c)),
      variant: variant ?? null,
      slotInfo: slotInfo(variant, c.slot as string),
      current: current ? clipFields(await withUrl(current)) : null,
    };
  }));

  res.status(200).json({ success: true, data, meta: { page, limit, total, pendingCount, approvedCount } });
}

export { uploadClip, withdrawClip, transitionClip, getMyClips, getAudioQueue };
