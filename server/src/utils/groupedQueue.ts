import Concept from '../models/Concept';
import Variant from '../models/Variant';
import { enrichActors } from './enrichActors';

type Doc = Record<string, unknown>;

export type QueueStatus = 'pending' | 'approved';

export async function countQueueItems(status: QueueStatus): Promise<number> {
  const [concepts, variants] = await Promise.all([
    Concept.countDocuments({ status, isDeleted: { $ne: true } }),
    Variant.countDocuments({ status, isDeleted: { $ne: true } }),
  ]);
  return concepts + variants;
}

// A concept belongs to the queue when it has the status itself, or when any live variant does.
// The variant branch skips the isDeleted check so a variant under a rejected concept is still reachable.
export async function getGroupedQueuePage(
  status: QueueStatus,
  skip: number,
  limit: number
): Promise<{ data: Doc[]; total: number }> {
  const variantConceptIds = await Variant.distinct('concept', { status, isDeleted: { $ne: true } });
  const filter = {
    $or: [
      { status, isDeleted: { $ne: true } },
      { _id: { $in: variantConceptIds } },
    ],
  };

  const [rawConcepts, total] = await Promise.all([
    Concept.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Concept.countDocuments(filter),
  ]);

  const pageIds = rawConcepts.map((c) => c._id);
  const rawVariants = pageIds.length
    ? await Variant.find({ concept: { $in: pageIds }, status, isDeleted: { $ne: true } }).sort({ createdAt: 1 }).lean()
    : [];

  const [concepts, variants] = await Promise.all([
    enrichActors(rawConcepts as unknown as Doc[], 'submittedBy'),
    enrichActors(rawVariants as unknown as Doc[], 'submittedBy'),
  ]);

  const byConcept: Record<string, Doc[]> = {};
  for (const v of variants) {
    const key = String(v.concept);
    (byConcept[key] ??= []).push(v);
  }

  const data = concepts.map((c) => ({ ...c, variants: byConcept[String(c._id)] ?? [] }));
  return { data, total };
}
