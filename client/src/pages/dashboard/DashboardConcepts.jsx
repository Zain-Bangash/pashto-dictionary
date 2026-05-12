import { useState, useEffect } from 'react';
import api from '../../services/api';

// Use api.get/post directly so vi.fn() mocks on api.* work in tests
const suggestConcepts = (q) => api.get(`/api/concepts/suggest?q=${encodeURIComponent(q)}`);
const mergeConcepts = (sourceId, body) => api.post(`/api/concepts/${sourceId}/merge`, body);

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected', 'published'];

const STATUS_LABELS = {
  all: 'All',
  pending: 'Awaiting Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

const STATUS_COLORS = {
  pending:   { color: '#e8c547', bg: 'rgba(232,197,71,0.08)',  border: 'rgba(232,197,71,0.3)' },
  approved:  { color: '#00f5b4', bg: 'rgba(0,245,180,0.08)',   border: 'rgba(0,245,180,0.3)' },
  published: { color: '#00f5b4', bg: 'rgba(0,245,180,0.08)',   border: 'rgba(0,245,180,0.3)' },
  rejected:  { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)' },
};

// ---------------------------------------------------------------------------
// Merge modal
// ---------------------------------------------------------------------------
function MergeModal({ sourceConcept, onConfirm, onCancel }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [targetConcept, setTargetConcept] = useState(null);
  const [note, setNote] = useState('');

  const handleSearch = (e) => {
    const q = e.target.value;
    setQuery(q);
    setTargetConcept(null);
    if (!q.trim()) { setSuggestions([]); return; }
    const req = suggestConcepts(q);
    if (!req) return;
    req.then((res) => {
      setSuggestions((res.data.data || []).filter((s) => s._id !== sourceConcept._id));
    }).catch(() => setSuggestions([]));
  };

  const handleSelect = (s) => {
    setTargetConcept(s);
    setQuery(s.englishGloss);
    setSuggestions([]);
  };

  const handleConfirm = () => {
    if (!targetConcept) return;
    onConfirm(targetConcept._id, note);
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-charcoal border border-white/[0.12] rounded-[20px] p-6 w-full max-w-md mx-4">
        <h2 className="text-warm font-display text-lg font-semibold mb-2">Merge Concept</h2>
        <p className="text-sm font-ui text-muted mb-4">
          Merge &ldquo;{sourceConcept.englishGloss}&rdquo; into another concept.
        </p>

        <div className="relative mb-3">
          <label htmlFor="merge-search" className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">
            Search target concept
          </label>
          <input
            id="merge-search"
            aria-label="Search target concept"
            placeholder="Search concept"
            value={query}
            onChange={handleSearch}
            className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-20 w-full bg-charcoal border border-white/[0.12] rounded-[10px] mt-1 max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <li
                  key={s._id}
                  onClick={() => handleSelect(s)}
                  className="px-3 py-2 text-sm font-ui text-warm hover:bg-white/[0.06] cursor-pointer"
                >
                  {s.englishGloss} — ID: {s._id}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="merge-note" className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">
            Note
          </label>
          <input
            id="merge-note"
            aria-label="Note"
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!targetConcept}
            className="px-4 py-2 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function DashboardConcepts() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [status, setStatus]     = useState('all');
  const [search, setSearch]     = useState('');
  const [mergeSource, setMergeSource] = useState(null);
  const [actionError, setActionError] = useState(null);

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
      await mergeConcepts(mergeSource._id, { targetConceptId, note });
      setMergeSource(null);
      fetchConcepts(status, search);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Merge failed';
      setActionError(msg);
      setMergeSource(null);
    }
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
          {concepts.map((concept) => {
            const s = STATUS_COLORS[concept.status] ?? STATUS_COLORS.pending;
            return (
              <li key={concept._id} className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-4 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <p className="text-warm font-display font-semibold text-lg">{concept.englishGloss}</p>
                  {concept.partOfSpeech && (
                    <p className="text-sm font-ui text-muted truncate">{concept.partOfSpeech}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!mergeSource && (
                    <button
                      onClick={() => setMergeSource(concept)}
                      className="px-3 py-1.5 bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-ui font-semibold rounded-[8px] hover:bg-amber-400/20 transition-colors"
                    >
                      Merge
                    </button>
                  )}
                  <span
                    className="text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
                    style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
                    data-testid="status-badge"
                  >
                    {concept.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mergeSource && (
        <MergeModal
          sourceConcept={mergeSource}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeSource(null)}
        />
      )}
    </div>
  );
}
