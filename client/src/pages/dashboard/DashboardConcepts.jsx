import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ConceptListRow from '../../components/moderation/ConceptListRow';
import ConceptMergeModal from '../../components/moderation/ConceptMergeModal';
import useAudioRetireConfirm from '../../hooks/useAudioRetireConfirm';

// Use api.post directly so vi.fn() mocks on api.* work in tests
const mergeConcepts = (sourceId, body) => api.post(`/api/concepts/${sourceId}/merge`, body);

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected', 'published'];

const STATUS_LABELS = {
  all: 'All',
  pending: 'Awaiting Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

export default function DashboardConcepts() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [status, setStatus]     = useState('all');
  const [search, setSearch]     = useState('');
  const [mergeSource, setMergeSource] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const isAdmin = useAuth()?.user?.role === 'admin';
  const { send, dialog } = useAudioRetireConfirm();

  const fetchConcepts = (statusFilter, searchQuery) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery && searchQuery.trim()) params.set('q', searchQuery.trim());
    const url = `/api/concepts?${params.toString()}`;
    api
      .get(url)
      .then((res) => {
        setConcepts(res.data.data);
      })
      .catch(() => {
        setError('Failed to load concepts');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConcepts(status, search);
  }, [status, search]);

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  const handleMergeConfirm = async (targetConceptId, note) => {
    setActionError(null);
    try {
      await send((confirm) => mergeConcepts(mergeSource._id, { targetConceptId, note, ...confirm }));
      setMergeSource(null);
      fetchConcepts(status, search);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Merge failed';
      setActionError(msg);
      setMergeSource(null);
    }
  };

  const toggleExpanded = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const handleConceptEdited = (updated) => {
    setConcepts((cs) => cs.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)));
  };

  const handleConceptRejected = () => {
    setExpandedId(null);
    fetchConcepts(status, search);
  };

  if (loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error) return <div className="text-red-400 font-ui text-sm">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">All Concepts</h1>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label htmlFor="status-filter" className="text-xs font-ui text-muted uppercase tracking-wider">
          Filter:
        </label>
        <select
          id="status-filter"
          name="status"
          aria-label="Status"
          value={status}
          onChange={handleStatusChange}
          className="bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50 transition-all"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="bg-charcoal">
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          id="concept-search"
          aria-label="Search concepts"
          type="text"
          placeholder="Search by gloss…"
          value={search}
          onChange={handleSearchChange}
          className="bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50 transition-all w-48"
        />
      </div>

      {actionError && (
        <div className="mb-4 text-red-400 text-sm font-ui">{actionError}</div>
      )}

      {concepts.length === 0 ? (
        <p className="text-muted font-ui text-sm">No concepts found.</p>
      ) : (
        <ul className="space-y-3">
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
