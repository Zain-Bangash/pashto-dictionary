import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const TABS = ['concepts', 'variants'];

export default function DashboardQueue() {
  const { user } = useAuth();
  const [tab, setTab]               = useState('concepts');
  const [concepts, setConcepts]     = useState([]);
  const [variants, setVariants]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/api/moderation/concepts/queue'),
      api.get('/api/moderation/variants/queue'),
    ])
      .then(([cRes, vRes]) => {
        setConcepts(cRes.data.data || []);
        setVariants(vRes.data.data || []);
      })
      .catch(() => setError('Failed to load queue'))
      .finally(() => setLoading(false));
  }, []);

  const items = tab === 'concepts' ? concepts : variants;
  const setItems = tab === 'concepts' ? setConcepts : setVariants;
  const modelPrefix = tab === 'concepts' ? 'concepts' : 'variants';

  const handleAction = async (id, action, note) => {
    setActionError(null);
    try {
      await api.patch(`/api/${modelPrefix}/${id}/status`, { status: action === 'approve' ? 'approved' : action === 'publish' ? 'published' : 'rejected', ...(note && { moderatorNote: note }) });
      setItems((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Action failed';
      setActionError(msg);
    }
  };

  if (loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error) return <div className="text-red-400 font-ui text-sm">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">Moderation Queue</h1>

      {/* Tab toggle */}
      <div className="flex gap-2 mb-5">
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
            {t} ({t === 'concepts' ? concepts.length : variants.length})
          </button>
        ))}
      </div>

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
                      <div dir="rtl" className="font-pashto text-warm text-2xl" style={{ lineHeight: 1.7 }}>
                        {item.pashto}
                      </div>
                      <p className="text-sm font-ui text-muted">{item.definition}</p>
                    </>
                  )}
                  <p className="text-xs font-ui text-muted/60">by {item.submittedBy?.username}</p>
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
                  {item.status === 'approved' && user?.role === 'admin' && (
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
