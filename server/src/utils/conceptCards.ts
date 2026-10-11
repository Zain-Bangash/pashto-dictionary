import { Types } from 'mongoose';
import Variant from '../models/Variant';
import AudioClip from '../models/AudioClip';
import { enrichActors } from './enrichActors';
import { withUrl } from './audioClips';

type Doc = Record<string, unknown>;
type Id = Types.ObjectId | string;

const LIVE_WORD = { status: 'published', isDeleted: { $ne: true } };
const CARD_FIELDS = 'concept pashto phonetic region definition example';

// Concepts with at least one published word from the region
export function conceptsInRegion(region: string): Promise<Id[]> {
  return Variant.distinct('concept', { ...LIVE_WORD, region });
}

// Adds firstVariant (the region's word when one is given), variantCount and firstVariant.audio (live headword clip or null)
export async function withCardFields<T extends { _id: unknown }>(concepts: T[], region?: string): Promise<(T & Doc)[]> {
  if (!concepts.length) return [];
  const ids = concepts.map((c) => c._id as Id);
  const variants = await Variant.find({ ...LIVE_WORD, concept: { $in: ids } }, CARD_FIELDS).sort({ _id: 1 }).lean();

  const byConcept = new Map<string, Doc[]>();
  for (const v of variants as unknown as Doc[]) {
    const key = String(v.concept);
    if (!byConcept.has(key)) byConcept.set(key, []);
    byConcept.get(key)!.push(v);
  }
  const first = new Map<string, Doc>();
  for (const [key, list] of byConcept) {
    first.set(key, (region && list.find((v) => v.region === region)) || list[0]);
  }

  const clips = await AudioClip.find(
    { variant: { $in: [...first.values()].map((v) => v._id as Id) }, slot: 'headword', lane: 'live' },
    'variant mimeType durationMs submittedBy storageKey fileDeletedAt'
  ).lean();
  const audioByVariant = new Map<string, Doc>();
  for (const clip of await enrichActors(clips as unknown as Doc[], 'submittedBy')) {
    const { storageKey: _k, fileDeletedAt: _f, variant, ...rest } = await withUrl(clip);
    if (rest.url) audioByVariant.set(String(variant), rest);
  }

  return concepts.map((c) => {
    const key = String(c._id);
    const firstVariant = first.get(key);
    return {
      ...c,
      firstVariant: firstVariant ? { ...firstVariant, audio: audioByVariant.get(String(firstVariant._id)) ?? null } : null,
      variantCount: byConcept.get(key)?.length ?? 0,
    };
  });
}
