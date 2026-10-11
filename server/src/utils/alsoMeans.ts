import { Types } from 'mongoose';
import Concept from '../models/Concept';
import Variant from '../models/Variant';

export interface AlsoMeans {
  conceptId: string;
  englishGloss: string;
  regions: string[];
}

// Other published meanings of the same written word, keyed by normalizedPashto
export async function alsoMeansFor(conceptId: Types.ObjectId | string, words: string[]): Promise<Map<string, AlsoMeans[]>> {
  const result = new Map<string, AlsoMeans[]>();
  const unique = [...new Set(words.filter(Boolean))];
  if (!unique.length) return result;

  const others = await Variant.find(
    { normalizedPashto: { $in: unique }, concept: { $ne: conceptId }, status: 'published', isDeleted: { $ne: true } },
    'concept normalizedPashto region'
  ).lean();
  if (!others.length) return result;

  const concepts = await Concept.find(
    { _id: { $in: others.map((o) => o.concept) }, status: 'published', isDeleted: { $ne: true } },
    'englishGloss'
  ).lean();
  const glossById = new Map(concepts.map((c) => [String(c._id), c.englishGloss]));

  for (const o of others) {
    const id = String(o.concept);
    const englishGloss = glossById.get(id);
    if (!englishGloss || !o.normalizedPashto) continue;
    const list = result.get(o.normalizedPashto) ?? [];
    const entry = list.find((e) => e.conceptId === id);
    if (entry) {
      if (!entry.regions.includes(o.region)) entry.regions.push(o.region);
    } else {
      list.push({ conceptId: id, englishGloss, regions: [o.region] });
    }
    result.set(o.normalizedPashto, list);
  }
  for (const list of result.values()) list.sort((a, b) => a.englishGloss.localeCompare(b.englishGloss));
  return result;
}
