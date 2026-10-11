import Concept from '../models/Concept';
import Variant from '../models/Variant';
import { enrichActors } from './enrichActors';
import { QueueFilters, variantMatch } from './queueFilters';
import { searchRegex } from './mySubmissions';

type Doc = Record<string, unknown>;

export type QueueStatus = 'pending' | 'approved';

// A concept matches on its own only without a region filter, since regions belong to variants
function conceptFilter(status: QueueStatus, filters: QueueFilters): Record<string, unknown> | null {
  if (filters.region) return null;
  return {
    status,
    isDeleted: { $ne: true },
    ...(filters.submitter && { submittedBy: filters.submitter }),
    ...(filters.q && { englishGloss: searchRegex(filters.q) }),
  };
}

async function variantFilter(status: QueueStatus, filters: QueueFilters): Promise<Record<string, unknown>> {
  return {
    status,
    isDeleted: { $ne: true },
    ...(filters.submitter && { submittedBy: filters.submitter }),
    ...(await variantMatch(filters)),
  };
}

export async function countQueueItems(status: QueueStatus, filters: QueueFilters = {}): Promise<number> {
  const own = conceptFilter(status, filters);
  const [concepts, variants] = await Promise.all([
    own ? Concept.countDocuments(own) : Promise.resolve(0),
    variantFilter(status, filters).then((f) => Variant.countDocuments(f)),
  ]);
  return concepts + variants;
}

// A concept belongs to the queue when it has the status itself, or when any live variant does.
// The variant branch skips the isDeleted check so a variant under a rejected concept is still reachable.
// `matched` says whether the concept itself passes the filters, so bulk actions never pick up a concept
// that is only listed for its variants.
export async function getGroupedQueuePage(
  status: QueueStatus,
  skip: number,
  limit: number,
  filters: QueueFilters = {}
): Promise<{ data: Doc[]; total: number }> {
  const own = conceptFilter(status, filters);
  const vFilter = await variantFilter(status, filters);
  const variantConceptIds = await Variant.distinct('concept', vFilter);
  const filter = { $or: [...(own ? [own] : []), { _id: { $in: variantConceptIds } }] };

  const [rawConcepts, total] = await Promise.all([
    Concept.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Concept.countDocuments(filter),
  ]);

  const pageIds = rawConcepts.map((c) => c._id);
  const [rawVariants, matchedIds] = pageIds.length
    ? await Promise.all([
        Variant.find({ ...vFilter, concept: { $in: pageIds } }).sort({ createdAt: 1 }).lean(),
        own ? Concept.distinct('_id', { ...own, _id: { $in: pageIds } }) : Promise.resolve([]),
      ])
    : [[], []];
  const matched = new Set(matchedIds.map(String));

  const [concepts, variants] = await Promise.all([
    enrichActors(rawConcepts as unknown as Doc[], 'submittedBy'),
    enrichActors(rawVariants as unknown as Doc[], 'submittedBy'),
  ]);

  const byConcept: Record<string, Doc[]> = {};
  for (const v of variants) {
    const key = String(v.concept);
    (byConcept[key] ??= []).push(v);
  }

  const data = concepts.map((c) => ({ ...c, matched: matched.has(String(c._id)), variants: byConcept[String(c._id)] ?? [] }));
  return { data, total };
}
