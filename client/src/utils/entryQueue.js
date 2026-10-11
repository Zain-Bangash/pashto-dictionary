import api, { checkCrossConceptPashto } from '../services/api';
import { activeFilters } from '../hooks/useQueueParams';

// Use api.get/patch/post directly so vi.fn() mocks on api.* work in tests
export const getQueue = (status, page, filters) => {
  const qs = new URLSearchParams({ status, page, ...activeFilters(filters) });
  return api.get(`/api/moderation/queue?${qs.toString()}`);
};
export const setStatus = (prefix, id, body) => api.patch(`/api/${prefix}/${id}/status`, body);
export const mergeConcepts = (sourceId, body) => api.post(`/api/concepts/${sourceId}/merge`, body);

export async function loadConflicts(groups) {
  const variants = groups.flatMap((g) => (g.variants || []).map((v) => ({ ...v, conceptId: g._id })));
  const checks = await Promise.all(
    variants.map((v) =>
      checkCrossConceptPashto(v.pashto, v.conceptId)
        .then((r) => [v._id, r.data.data.conflicts])
        .catch(() => [v._id, []])
    )
  );
  return Object.fromEntries(checks);
}

// Concepts go before their variants; a variant whose concept is rejected in the same run is already cascaded
export function orderEntries(items, status) {
  const concepts = items.filter((i) => i.prefix === 'concepts');
  const rejectedConcepts = new Set(status === 'rejected' ? concepts.map((c) => c.id) : []);
  const variants = items.filter((i) => i.prefix === 'variants' && !rejectedConcepts.has(i.conceptId));
  return [...concepts, ...variants];
}

export function selectableItems(groups, status) {
  return groups.flatMap((g) => [
    ...(g.matched !== false && g.status === status ? [{ id: g._id, prefix: 'concepts', label: g.englishGloss }] : []),
    ...(g.variants || []).map((v) => ({ id: v._id, prefix: 'variants', conceptId: g._id, label: `${v.pashto} (${g.englishGloss})` })),
  ]);
}

export function labelOf(groups, prefix, id) {
  if (prefix === 'concepts') return groups.find((g) => g._id === id)?.englishGloss;
  for (const g of groups) {
    const v = (g.variants || []).find((x) => x._id === id);
    if (v) return v.pashto;
  }
  return undefined;
}
