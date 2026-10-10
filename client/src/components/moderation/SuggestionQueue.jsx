import { useState, useEffect } from 'react';
import { getSuggestionQueue, transitionSuggestion } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Pagination from '../Pagination';
import RejectModal from './RejectModal';
import SuggestionGroup from './SuggestionGroup';

const FILTERS = ['pending', 'approved'];
const EMPTY_META = { total: 0, limit: 20, pendingCount: 0, approvedCount: 0 };

export default function SuggestionQueue() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [status, setStatus]           = useState('pending');
  const [page, setPage]               = useState(1);
  const [refreshKey, setRefreshKey]   = useState(0);
  const [result, setResult]           = useState({ key: null, items: [], meta: EMPTY_META, error: null });
  const [actionError, setActionError] = useState(null);
  const [rejectId, setRejectId]       = useState(null);

  // loading is derived: the stored result belongs to an older request until its key matches
  const key = `${status}|${page}|${refreshKey}`;
  useEffect(() => {
    let cancelled = false;
    getSuggestionQueue({ status, page })
      .then((res) => { if (!cancelled) setResult({ key, items: res.data.data || [], meta: { ...EMPTY_META, ...res.data.meta }, error: null }); })
      .catch(() => { if (!cancelled) setResult((r) => ({ ...r, key, error: 'Failed to load suggestions' })); });
    return () => { cancelled = true; };
  }, [key, status, page]);

  const { items, meta } = result;
  const loading = result.key !== key;
  const error = loading ? null : result.error;

  const refresh = () => setRefreshKey((k) => k + 1);

  const act = async (id, body) => {
    setActionError(null);
    try {
      await transitionSuggestion(id, body);
      refresh();
    } catch (err) {
      setActionError(err?.response?.data?.error?.message || 'Action failed');
    }
  };

  const handleRejectConfirm = (note) => {
    const id = rejectId;
    setRejectId(null);
    act(id, { status: 'rejected', moderatorNote: note });
  };

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)));

  return (
    <div>
      {isAdmin && (
        <div className="flex gap-2 mb-5">
          {FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              aria-pressed={status === s}
              className={`font-ui text-xs px-3 py-1.5 rounded-full capitalize transition-all border ${
                status === s ? 'bg-violet/10 border-violet/35 text-violet' : 'bg-white/[0.04] border-white/[0.08] text-muted'
              }`}
            >
              {s} ({meta[`${s}Count`] ?? 0})
            </button>
          ))}
        </div>
      )}

      {actionError && <div role="alert" className="mb-4 text-red-400 text-sm font-ui">{actionError}</div>}

      {loading ? (
        <p className="text-muted font-ui text-sm animate-pulse">Loading…</p>
      ) : error ? (
        <p className="text-red-400 font-ui text-sm">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-muted font-ui text-sm">No suggestions waiting.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((group) => (
            <SuggestionGroup
              key={group.variant?._id ?? group.suggestions[0]?._id}
              group={group}
              isAdmin={isAdmin}
              onApprove={(id) => act(id, { status: 'approved' })}
              onPublish={(id) => act(id, { status: 'published' })}
              onReject={setRejectId}
              onSaved={refresh}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      {rejectId && <RejectModal onConfirm={handleRejectConfirm} onCancel={() => setRejectId(null)} />}
    </div>
  );
}
