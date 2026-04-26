import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function DashboardQueue() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    api
      .get('/api/moderation/queue')
      .then((res) => {
        setEntries(res.data.data);
      })
      .catch(() => {
        setError('Failed to load queue');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (id, action) => {
    setActionError(null);
    try {
      await api.patch(`/api/moderation/${id}/${action}`, {});
      setEntries((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message || 'Action failed';
      setActionError(msg);
    }
  };

  if (loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error) return <div className="text-red-400 font-ui text-sm">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">Moderation Queue</h1>
      {actionError && (
        <div className="mb-4 text-red-400 text-sm font-ui">{actionError}</div>
      )}
      {entries.length === 0 ? (
        <p className="text-muted font-ui text-sm">No entries in the queue.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry._id} className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div dir="rtl" className="font-pashto text-warm text-2xl" style={{ lineHeight: 1.7 }}>
                    {entry.pashto}
                  </div>
                  <p className="text-sm font-ui text-muted">{entry.definitions?.[0]?.text}</p>
                  <p className="text-xs font-ui text-muted/60">by {entry.submittedBy?.username}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {entry.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(entry._id, 'approve')}
                        className="px-3 py-1.5 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(entry._id, 'reject')}
                        className="px-3 py-1.5 bg-red-400/10 border border-red-400/30 text-red-400 text-xs font-ui font-semibold rounded-[8px] hover:bg-red-400/20 transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {entry.status === 'approved' && user?.role === 'admin' && (
                    <button
                      onClick={() => handleAction(entry._id, 'publish')}
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
