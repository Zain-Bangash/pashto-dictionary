import { Types } from 'mongoose';
import Variant from '../models/Variant';
import AudioClip from '../models/AudioClip';
import { enrichActors } from './enrichActors';
import { withUrl } from './audioClips';

type Doc = Record<string, unknown>;
type Id = Types.ObjectId | string;

const LIVE_WORD = { status: 'published', isDeleted: { $ne: true } };
const CARD_FIELDS = 'concept pashto normalizedPashto phonetic region definition example';

const spelling = (v: Doc) => String(v.normalizedPashto ?? v.pashto);

// Distinct written words besides the one shown; the same word from several regions counts once
function otherWordCount(list: Doc[], shown: Doc, region?: string): number {
  const words = new Set((region ? list.filter((v) => v.region === region) : list).map(spelling));
  words.delete(spelling(shown));
  return words.size;
}

// Concepts with at least one published word from the region
export function conceptsInRegion(region: string): Promise<Id[]> {
  return Variant.distinct('concept', { ...LIVE_WORD, region });
}

// Adds firstVariant (the region's word when one is given) with audio and exampleAudio (live clips or null), variantCount
// (published regional rows) and moreWordCount (other distinct words, within the region when one is given)
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
    { variant: { $in: [...first.values()].map((v) => v._id as Id) }, slot: { $in: ['headword', 'example'] }, lane: 'live' },
    'variant slot mimeType durationMs submittedBy storageKey fileDeletedAt'
  ).lean();
  const audioBySlot = new Map<string, Doc>();
  for (const clip of await enrichActors(clips as unknown as Doc[], 'submittedBy')) {
    const { storageKey: _k, fileDeletedAt: _f, variant, slot, ...rest } = await withUrl(clip);
    if (rest.url) audioBySlot.set(`${variant}|${slot}`, rest);
  }

  return concepts.map((c) => {
    const key = String(c._id);
    const list = byConcept.get(key) ?? [];
    const shown = first.get(key);
    if (!shown) return { ...c, firstVariant: null, variantCount: 0, moreWordCount: 0 };
    const { normalizedPashto: _n, ...firstVariant } = shown;
    return {
      ...c,
      firstVariant: {
        ...firstVariant,
        audio: audioBySlot.get(`${shown._id}|headword`) ?? null,
        exampleAudio: audioBySlot.get(`${shown._id}|example`) ?? null,
      },
      variantCount: list.length,
      moreWordCount: otherWordCount(list, shown, region),
    };
  });
}
