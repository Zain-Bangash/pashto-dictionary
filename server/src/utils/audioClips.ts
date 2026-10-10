import { Request, Response } from 'express';
import { Types } from 'mongoose';
import AudioClip from '../models/AudioClip';
import ModerationLog from '../models/ModerationLog';
import { IAudioClip, IVariant } from '../types/models';
import { removeObject, signedUrl } from './storage';
import { enrichActors } from './enrichActors';
import { audioSlots, isStaleSlot, SlotSource } from './audioSlots';
import logger from './logger';

type Doc = Record<string, unknown>;
type Id = Types.ObjectId;
type ClipLike = Pick<IAudioClip, 'storageKey'> & { _id: Id };

export const MAX_AUDIO_BYTES = 1024 * 1024;

export async function logClip(id: Id, action: string, performedBy: string, note?: string, changes?: Record<string, unknown>) {
  await new ModerationLog({ targetModel: 'AudioClip', targetId: id, action, performedBy, note, changes }).save();
}

// Called only after the database no longer points at the file. A failed delete leaves
// fileDeletedAt unset so scripts/cleanOrphanAudio.ts can retry it.
export async function deleteClipFile(clip: ClipLike): Promise<void> {
  try {
    await removeObject(clip.storageKey);
    await AudioClip.updateOne({ _id: clip._id }, { $set: { fileDeletedAt: new Date() } });
  } catch (err) {
    logger.error(`Audio file delete failed for ${clip.storageKey}: ${(err as Error).message}`);
  }
}

export async function withUrl<T extends Doc>(clip: T): Promise<T & { url?: string }> {
  return clip.fileDeletedAt || !clip.storageKey ? clip : { ...clip, url: await signedUrl(clip.storageKey as string) };
}

// Ends a clip's life without publishing it (rejected, retired, withdrawn); the file goes once the DB write lands
export async function closeClip(
  clip: ClipLike & { status: string },
  status: 'rejected' | 'retired' | 'withdrawn',
  performedBy: string,
  fields: { moderatorNote?: string; retiredReason?: string } = {}
): Promise<boolean> {
  const set: Record<string, unknown> = { status, ...fields };
  if (status === 'rejected') set.reviewedBy = performedBy;
  const closed = await AudioClip.findOneAndUpdate(
    { _id: clip._id, status: clip.status },
    { $set: set, $unset: { lane: 1 } },
    { returnDocument: 'after' }
  );
  if (!closed) return false;
  await logClip(clip._id, status, performedBy, fields.moderatorNote ?? fields.retiredReason);
  await deleteClipFile(closed as unknown as ClipLike);
  return true;
}

// Cascade: when a word leaves the published state its open clips are rejected; live clips stay
// but are never served while the word is off the site
export async function rejectOpenClips(variantIds: (Types.ObjectId | string)[], performedBy: string, note: string): Promise<void> {
  if (!variantIds.length) return;
  const open = await AudioClip.find({ variant: { $in: variantIds }, lane: 'open' });
  for (const clip of open) await closeClip(clip, 'rejected', performedBy, { moderatorNote: note });
}

export async function staleClips(variantId: Id, before: SlotSource, after: SlotSource, partOfSpeechAfter?: string): Promise<IAudioClip[]> {
  const clips = await AudioClip.find({ variant: variantId, lane: { $exists: true } });
  return clips.filter((c) => isStaleSlot(c.slot, before, after, partOfSpeechAfter));
}

export async function retireClips(clips: IAudioClip[], performedBy: string, reason: string): Promise<void> {
  for (const clip of clips) await closeClip(clip, 'retired', performedBy, { retiredReason: reason });
}

// An edit that would retire recordings needs confirmAudioRetire: true; otherwise 409 listing them
export async function needsRetireConfirm(req: Request, res: Response, clips: IAudioClip[]): Promise<boolean> {
  if (!clips.length || req.body?.confirmAudioRetire === true) return false;
  const enriched = await enrichActors(clips.map((c) => c.toObject() as unknown as Doc), 'submittedBy');
  const retiring = enriched.map((c) => ({
    _id: c._id,
    slot: c.slot,
    status: c.status,
    speaker: (c.submittedBy as Doc | undefined)?.username ?? null,
  }));
  res.status(409).json({
    success: false,
    error: {
      message: `This change removes ${clips.length} recording${clips.length === 1 ? '' : 's'}. Confirm to continue.`,
      field: 'confirmAudioRetire',
      retiring,
    },
  });
  return true;
}

type VariantDoc = Doc & { _id: Id } & SlotSource;

// Adds audio (live clips by slot), audioOpen (slots under review) and audioSlots to each published variant
export async function attachAudio(variants: VariantDoc[], partOfSpeech?: string): Promise<Doc[]> {
  if (!variants.length) return variants;
  const clips = await AudioClip.find(
    { variant: { $in: variants.map((v) => v._id) }, lane: { $exists: true } },
    'variant slot lane mimeType durationMs submittedBy storageKey fileDeletedAt'
  ).lean();
  const live = await enrichActors(clips.filter((c) => c.lane === 'live') as unknown as Doc[], 'submittedBy');

  const byVariant = new Map<string, { audio: Record<string, unknown>; audioOpen: string[] }>();
  const entry = (id: Id | unknown) => {
    const key = String(id);
    if (!byVariant.has(key)) byVariant.set(key, { audio: {}, audioOpen: [] });
    return byVariant.get(key)!;
  };
  for (const clip of live) {
    const { storageKey: _k, fileDeletedAt: _f, lane: _l, ...rest } = await withUrl(clip);
    entry(clip.variant).audio[clip.slot as string] = rest;
  }
  for (const clip of clips) if (clip.lane === 'open') entry(clip.variant).audioOpen.push(clip.slot);

  return variants.map((v) => ({
    ...v,
    ...(byVariant.get(String(v._id)) ?? { audio: {}, audioOpen: [] }),
    audioSlots: audioSlots(v, partOfSpeech),
  }));
}

// A plain copy of the text clips are recorded against, taken before an edit mutates the document
export function slotSnapshot(variant: Pick<IVariant, 'pashto' | 'example' | 'forms'>): SlotSource {
  return {
    pashto: variant.pashto,
    example: variant.example,
    forms: (variant.forms ?? []).map(({ kind, gender, number, case: c, verbForm, pashto }) => ({ kind, gender, number, case: c, verbForm, pashto })),
  };
}
