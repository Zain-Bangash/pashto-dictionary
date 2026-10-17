import { PipelineStage, Types } from 'mongoose';
import Concept from '../models/Concept';
import Variant from '../models/Variant';
import AudioClip from '../models/AudioClip';
import { variantMatch } from './queueFilters';
import { HEADWORD, EXAMPLE } from './audioSlots';

type Doc = Record<string, unknown>;
type Id = Types.ObjectId;

export type WantedWord = { pashto: string; phonetic: string; regions: string[] };
export interface ConceptFilters { partOfSpeech?: string; domain?: string }
export interface WantedAudioQuery extends ConceptFilters { region: string; q?: string; slot?: string; skip: number; limit: number }

const LIVE_WORD = { status: 'published', isDeleted: { $ne: true } };

export function conceptFilter({ partOfSpeech, domain }: ConceptFilters): Doc {
  return {
    status: 'published',
    isDeleted: { $ne: true },
    ...(partOfSpeech && { partOfSpeech }),
    ...(domain && { semanticDomains: domain }),
  };
}

// Published words of each concept, one entry per spelling (vowel marks ignored) with every region that uses it
export async function publishedWords(conceptIds: Id[]): Promise<Map<string, WantedWord[]>> {
  const variants = await Variant.find({ ...LIVE_WORD, concept: { $in: conceptIds } }, 'concept pashto normalizedPashto phonetic region')
    .sort({ _id: 1 }).lean();
  const byConcept = new Map<string, Map<string, WantedWord>>();
  for (const v of variants) {
    const key = String(v.concept);
    if (!byConcept.has(key)) byConcept.set(key, new Map());
    const words = byConcept.get(key)!;
    const spelling = v.normalizedPashto ?? v.pashto;
    const word = words.get(spelling) ?? { pashto: v.pashto, phonetic: '', regions: [] };
    if (!word.phonetic && v.phonetic) word.phonetic = v.phonetic;
    if (!word.regions.includes(v.region)) word.regions.push(v.region);
    words.set(spelling, word);
  }
  return new Map([...byConcept].map(([key, words]) => [key, [...words.values()]]));
}

const notIn = (slot: string) => ({ $not: { $in: [slot, '$covered'] } });

// A slot is wanted when it has no clip in either lane: a live clip covers it, and one under review blocks new recordings
export async function wantedAudio(opts: WantedAudioQuery): Promise<{ data: Doc[]; total: number }> {
  const conceptIds = await Concept.distinct('_id', conceptFilter(opts));
  const textMatch = await variantMatch({ q: opts.q, region: opts.region });

  const pipeline: PipelineStage[] = [
    { $match: { ...LIVE_WORD, ...textMatch, concept: { $in: conceptIds } } },
    { $sort: { _id: 1 } },
    {
      $lookup: {
        from: AudioClip.collection.name,
        let: { id: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$variant', '$$id'] }, lane: { $exists: true } } },
          { $project: { slot: 1 } },
        ],
        as: 'clips',
      },
    },
    { $addFields: { covered: '$clips.slot', hasExample: { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$example', ''] } } } }, 0] } } },
    {
      $addFields: {
        missing: {
          $concatArrays: [
            { $cond: [notIn(HEADWORD), [HEADWORD], []] },
            { $cond: [{ $and: ['$hasExample', notIn(EXAMPLE)] }, [EXAMPLE], []] },
          ],
        },
      },
    },
    { $match: opts.slot ? { missing: opts.slot } : { 'missing.0': { $exists: true } } },
    {
      $group: {
        _id: '$concept',
        words: { $push: { variantId: '$_id', pashto: '$pashto', phonetic: { $ifNull: ['$phonetic', ''] }, example: { $ifNull: ['$example', ''] }, missing: '$missing' } },
      },
    },
    { $lookup: { from: Concept.collection.name, localField: '_id', foreignField: '_id', as: 'concept' } },
    { $unwind: '$concept' },
    { $sort: { 'concept.normalizedGloss': 1, _id: 1 } },
    {
      $facet: {
        data: [
          { $skip: opts.skip },
          { $limit: opts.limit },
          { $project: { _id: 1, englishGloss: '$concept.englishGloss', partOfSpeech: '$concept.partOfSpeech', words: 1 } },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ];

  const [result] = await Variant.aggregate(pipeline);
  return { data: result.data, total: result.total[0]?.n ?? 0 };
}
