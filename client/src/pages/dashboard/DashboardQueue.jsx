import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const TABS = ['concepts', 'variants'];

export default function DashboardQueue() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab]                     = useState('concepts');
  const [concepts, setConcepts]           = useState([]);
  const [variants, setVariants]           = useState([]);
  const [conceptsFilter, setConceptsFilter] = useState('pending');
  const [variantsFilter, setVariantsFilter] = useState('pending');
  const [conceptsCounts, setConceptsCounts] = useState({ pending: 0, approved: 0 });
  const [variantsCounts, setVariantsCounts] = useState({ pending: 0, approved: 0 });
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [actionError, setActionError]       = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get(`/api/moderation/concepts/queue?status=${conceptsFilter}`),
      api.get(`/api/moderation/variants/queue?status=${variantsFilter}`),
    ])
      .then(([cRes, vRes]) => {
        setConcepts(cRes.data.data || []);
        setVariants(vRes.data.data || []);
        const cm = cRes.data.meta || {};
        const vm = vRes.data.meta || {};
        setConceptsCounts({ pending: cm.pendingCount ?? 0, approved: cm.approvedCount ?? 0 });
        setVariantsCounts({ pending: vm.pendingCount ?? 0, approved: vm.approvedCount ?? 0 });
      })
      .catch(() => setError('Failed to load queue'))
      .finally(() => setLoading(false));
  }, [conceptsFilter, variantsFilter]);

  const items    = tab === 'concepts' ? concepts : variants;
  const setItems = tab === 'concepts' ? setConcepts : setVariants;
  const modelPrefix    = tab === 'concepts' ? 'concepts' : 'variants';
  const activeFilter   = tab === 'concepts' ? conceptsFilter : variantsFilter;
  const setActiveFilter = tab === 'concepts' ? setConceptsFilter : setVariantsFilter;
  const activeCounts   = tab === 'concepts' ? conceptsCounts : variantsCounts;

  const handleAction = async (id, action, note) => {
    setActionError(null);
    try {
      await api.patch(`/api/${modelPrefix}/${id}/status`, {
        status: action === 'approve' ? 'approved' : action === 'publish' ? 'published' : 'rejected',
        ...(note && { moderatorNote: note }),
      });
      setItems((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Action failed';
      setActionError(msg);
    }
  };

  if (loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error)   return <div className="text-red-400 font-ui text-sm">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">Moderation Queue</h1>

      {/* Tab toggle */}
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="font-ui text-xs px-4 py-2 rounded-full capitalize transition-all"
            style={{
              background: tab === t ? 'rgba(0,245,180,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === t ? 'rgba(0,245,180,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: tab === t ? '#00f5b4' : '#666',
            }}
          >
            {t} ({t === 'concepts'
              ? (isAdmin ? conceptsCounts.pending + conceptsCounts.approved : conceptsCounts.pending)
              : (isAdmin ? variantsCounts.pending + variantsCounts.approved : variantsCounts.pending)})
          </button>
        ))}
      </div>

      {/* Status filter — admin only */}
      {isAdmin && (
        <div className="flex gap-2 mb-5">
          {['pending', 'approved'].map((s) => (
            <button
              key={s}
              onClick={() => setActiveFilter(s)}
              className="font-ui text-xs px-3 py-1.5 rounded-full capitalize transition-all"
              style={{
                background: activeFilter === s ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${activeFilter === s ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: activeFilter === s ? '#a78bfa' : '#666',
              }}
            >
              {s} ({activeCounts[s]})
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <div className="mb-4 text-red-400 text-sm font-ui">{actionError}</div>
      )}

      {items.length === 0 ? (
        <p className="text-muted font-ui text-sm">Nothing in the queue.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item._id} className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  {tab === 'concepts' ? (
                    <>
                      <p className="text-warm font-display text-lg font-semibold">{item.englishGloss}</p>
                      <p className="text-sm font-ui text-muted">{item.partOfSpeech}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div dir="rtl" className="font-pashto text-warm text-2xl" style={{ lineHeight: 1.7 }}>
                          {item.pashto}
                        </div>
                        {item.phonetic && (
                          <span className="font-ui text-sm text-muted">/{item.phonetic}/</span>
                        )}
                        <span className="font-ui text-xs px-2 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-muted/70">
                          {item.region}
                        </span>
                      </div>
                      <p className="text-sm font-ui text-muted">{item.definition}</p>
                      {item.example && (
                        <p className="text-xs font-ui text-muted/60 italic">{item.example}</p>
                      )}
                      {item.concept && (
                        <p className="text-xs font-ui text-muted/50">
                          Concept: <span className="text-muted/80">{item.concept.englishGloss}</span>
                          <span className="ml-1.5 px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-[10px]">
                            {item.concept.status}
                          </span>
                        </p>
                      )}
                      {item.submissionNote && (
                        <div className="mt-1 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-[10px]">
                          <p className="text-[10px] font-ui font-semibold text-muted uppercase tracking-wider mb-1">Submitter note</p>
                          <p className="text-xs font-ui text-muted/80 break-words">{item.submissionNote}</p>
                        </div>
                      )}
                    </>
                  )}
                  <p className="text-xs font-ui text-muted/60">
                    by {item.submittedBy?.username}
                    {(item.submittedBy?.village || item.submittedBy?.region) && (
                      <span className="ml-1">
                        ({[item.submittedBy.village, item.submittedBy.region].filter(Boolean).join(', ')})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {item.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(item._id, 'approve')}
                        className="px-3 py-1.5 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(item._id, 'reject')}
                        className="px-3 py-1.5 bg-red-400/10 border border-red-400/30 text-red-400 text-xs font-ui font-semibold rounded-[8px] hover:bg-red-400/20 transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {item.status === 'approved' && isAdmin && (
                    <button
                      onClick={() => handleAction(item._id, 'publish')}
                      className="px-3 py-1.5 bg-violet/10 border border-violet/30 text-violet text-xs font-ui font-semibold rounded-[8px] hover:bg-violet/20 transition-colors"
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
