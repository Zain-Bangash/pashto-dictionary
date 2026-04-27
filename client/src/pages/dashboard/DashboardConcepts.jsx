import { useState, useEffect } from 'react';
import api from '../../services/api';

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

export default function DashboardConcepts() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [status, setStatus]     = useState('all');

  const fetchConcepts = (statusFilter) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
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
    fetchConcepts(status);
  }, [status]);

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
  };

  if (loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error) return <div className="text-red-400 font-ui text-sm">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">All Concepts</h1>
      <div className="mb-5 flex items-center gap-3">
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
      </div>
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
                <span
                  className="shrink-0 text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
                  style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
                  data-testid="status-badge"
                >
                  {concept.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
