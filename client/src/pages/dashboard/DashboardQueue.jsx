import { useState, useEffect } from 'react';
import api, { checkCrossConceptPashto } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Pagination from '../../components/Pagination';
import RejectModal from '../../components/moderation/RejectModal';
import MergeModal from '../../components/moderation/MergeModal';
import QueueConceptGroup from '../../components/moderation/QueueConceptGroup';

// Use api.get/patch/post directly so vi.fn() mocks on api.* work in tests
const getQueue = (status, page) => api.get(`/api/moderation/queue?status=${status}&page=${page}`);
const mergeConcepts = (sourceId, body) => api.post(`/api/concepts/${sourceId}/merge`, body);

const FILTERS = ['pending', 'approved'];

async function loadConflicts(groups) {
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

export default function DashboardQueue() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [groups, setGroups]           = useState([]);
  const [filter, setFilter]           = useState('pending');
  const [page, setPage]               = useState(1);
  const [meta, setMeta]               = useState({ total: 0, limit: 20, pendingCount: 0, approvedCount: 0 });
  const [refreshKey, setRefreshKey]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loaded, setLoaded]           = useState(false);
  const [error, setError]             = useState(null);
  const [actionError, setActionError] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { prefix, id }
  const [mergeModal, setMergeModal]   = useState(null); // { sourceItem, targetItem }
  const [crossConceptMap, setCrossConceptMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getQueue(filter, page);
        const data = res.data.data || [];
        if (cancelled) return;
        setGroups(data);
        setLoaded(true);
        setMeta({ limit: 20, pendingCount: 0, approvedCount: 0, ...res.data.meta });
        const conflicts = await loadConflicts(data);
        if (!cancelled) setCrossConceptMap(conflicts);
      } catch {
        if (!cancelled) setError('Failed to load queue');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filter, page, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const runAction = async (request, fallback) => {
    setActionError(null);
    try {
      await request();
      refresh();
    } catch (err) {
      setActionError(err?.response?.data?.error?.message || fallback);
    }
  };

  const handleStatus = (prefix, id, status) =>
    runAction(() => api.patch(`/api/${prefix}/${id}/status`, { status }), 'Action failed');

  const handleRejectConfirm = async (note) => {
    const { prefix, id } = rejectModal;
    setRejectModal(null);
    await runAction(() => api.patch(`/api/${prefix}/${id}/status`, { status: 'rejected', moderatorNote: note }), 'Action failed');
  };

  const handleMergeConfirm = async (note) => {
    const { sourceItem, targetItem } = mergeModal;
    setMergeModal(null);
    await runAction(() => mergeConcepts(sourceItem._id, { targetConceptId: targetItem._id, note }), 'Merge failed');
  };

  const handleConceptSave = (updated) =>
    setGroups((prev) => prev.map((g) => (g._id === updated._id ? { ...g, ...updated, variants: g.variants } : g)));

  const handleVariantSave = (groupId, updated) => {
    const movedTo = updated.concept?._id || updated.concept;
    if (movedTo && String(movedTo) !== String(groupId)) return refresh();
    setGroups((prev) => prev.map((g) => (g._id !== groupId ? g : {
      ...g,
      variants: g.variants.map((v) => (v._id === updated._id ? { ...v, ...updated, concept: v.concept } : v)),
    })));
  };

  const changeFilter = (f) => { setFilter(f); setPage(1); };

  if (loading && !loaded) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error)   return <div className="text-red-400 font-ui text-sm">{error}</div>;

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)));

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">Moderation Queue</h1>

      {isAdmin && (
        <div className="flex gap-2 mb-5">
          {FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => changeFilter(s)}
              aria-pressed={filter === s}
              className={`font-ui text-xs px-3 py-1.5 rounded-full capitalize transition-all border ${
                filter === s ? 'bg-violet/10 border-violet/35 text-violet' : 'bg-white/[0.04] border-white/[0.08] text-muted'
              }`}
            >
              {s} ({meta[`${s}Count`] ?? 0})
            </button>
          ))}
        </div>
      )}

      {actionError && <div className="mb-4 text-red-400 text-sm font-ui">{actionError}</div>}

      {groups.length === 0 ? (
        <p className="text-muted font-ui text-sm">Nothing in the queue.</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <QueueConceptGroup
              key={g._id}
              group={g}
              isAdmin={isAdmin}
              crossConceptMap={crossConceptMap}
              showSimilar={!mergeModal}
              onAction={handleStatus}
              onReject={(prefix, id) => setRejectModal({ prefix, id })}
              onConceptSave={handleConceptSave}
              onVariantSave={handleVariantSave}
              onMergeRequest={(targetItem, sourceItem) => setMergeModal({ sourceItem, targetItem })}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}

      {rejectModal && <RejectModal onConfirm={handleRejectConfirm} onCancel={() => setRejectModal(null)} />}

      {mergeModal && (
        <MergeModal
          sourceItem={mergeModal.sourceItem}
          targetItem={mergeModal.targetItem}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeModal(null)}
        />
      )}
    </div>
  );
}
