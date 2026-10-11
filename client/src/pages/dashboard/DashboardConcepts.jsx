import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ConceptListRow from '../../components/moderation/ConceptListRow';
import ConceptMergeModal from '../../components/moderation/ConceptMergeModal';
import ActionError from '../../components/moderation/ActionError';
import Pagination from '../../components/Pagination';
import { StatusChips, SearchBox } from '../../components/submissions/SubmissionFilters';
import useAudioRetireConfirm from '../../hooks/useAudioRetireConfirm';
import useToast from '../../hooks/useToast';

// Use api.post directly so vi.fn() mocks on api.* work in tests
const mergeConcepts = (sourceId, body) => api.post(`/api/concepts/${sourceId}/merge`, body);

const STATUS_OPTIONS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['published', 'Published'],
  ['rejected', 'Rejected'],
];

export default function DashboardConcepts() {
  const [query, setQuery] = useState({ status: 'all', q: '', page: 1 });
  const [result, setResult] = useState({ key: null, concepts: [], meta: { total: 0, limit: 20 }, error: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const [mergeSource, setMergeSource] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const isAdmin = useAuth()?.user?.role === 'admin';
  const { send, dialog } = useAudioRetireConfirm();
  const toast = useToast();

  // The list stays on screen while a new page loads, so the search box never loses focus
  const key = `${query.status}|${query.q}|${query.page}|${refreshKey}`;
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status: query.status, page: query.page });
    if (query.q) params.set('q', query.q);
    api.get(`/api/concepts?${params.toString()}`)
      .then((res) => { if (!cancelled) setResult({ key, concepts: res.data.data, meta: { total: 0, limit: 20, ...res.data.meta }, error: null }); })
      .catch(() => { if (!cancelled) setResult((r) => ({ ...r, key, error: 'Failed to load concepts' })); });
    return () => { cancelled = true; };
  }, [key, query]);

  const loading = result.key !== key;
  const { concepts, meta } = result;
  const reload = () => setRefreshKey((k) => k + 1);
  const change = (changes) => setQuery((q) => ({ ...q, page: 1, ...changes }));

  const handleMergeConfirm = async (targetConceptId, note) => {
    setActionError(null);
    try {
      await send((confirm) => mergeConcepts(mergeSource._id, { targetConceptId, note, ...confirm }));
      toast(`Merged “${mergeSource.englishGloss}”`);
      setMergeSource(null);
      reload();
    } catch (err) {
      setActionError(err?.response?.data?.error?.message || 'Merge failed');
      setMergeSource(null);
    }
  };

  const toggleExpanded = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const handleConceptEdited = (updated) => {
    setResult((r) => ({ ...r, concepts: r.concepts.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)) }));
    toast(`Saved “${updated.englishGloss}”`);
  };

  const handleConceptRejected = () => {
    setExpandedId(null);
    toast('Concept rejected');
    reload();
  };

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)));

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">All Concepts</h1>
      <div className="mb-5 space-y-3">
        <StatusChips options={STATUS_OPTIONS} value={query.status} onChange={(status) => change({ status })} />
        <div className="flex max-w-md">
          <SearchBox label="Search concepts" value={query.q} onChange={(q) => change({ q })} />
        </div>
      </div>

      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      {result.key === null ? (
        <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>
      ) : result.error && !loading ? (
        <div className="text-red-400 font-ui text-sm">{result.error}</div>
      ) : concepts.length === 0 ? (
        <p className="text-muted font-ui text-sm">No concepts found.</p>
      ) : (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {concepts.map((concept) => (
            <ConceptListRow
              key={concept._id}
              concept={concept}
              isAdmin={isAdmin}
              expanded={expandedId === concept._id}
              canMerge={!mergeSource}
              onToggle={() => toggleExpanded(concept._id)}
              onMerge={() => setMergeSource(concept)}
              onConceptEdited={handleConceptEdited}
              onConceptRejected={handleConceptRejected}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && <Pagination page={query.page} totalPages={totalPages} onPageChange={(page) => change({ page })} />}

      {mergeSource && (
        <ConceptMergeModal
          sourceConcept={mergeSource}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeSource(null)}
        />
      )}
      {dialog}
    </div>
  );
}
