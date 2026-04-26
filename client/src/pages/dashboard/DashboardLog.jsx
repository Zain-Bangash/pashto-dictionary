import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ACTION_COLORS = {
  approve:  { color: '#00f5b4', bg: 'rgba(0,245,180,0.08)',   border: 'rgba(0,245,180,0.3)' },
  reject:   { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)' },
  publish:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)' },
  resubmit: { color: '#e8c547', bg: 'rgba(232,197,71,0.08)',  border: 'rgba(232,197,71,0.3)' },
};

export default function DashboardLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = user && user.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/moderation/log');
        if (!cancelled) setLogs(res.data.data);
      } catch {
        if (!cancelled) setError('Failed to load log');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error) return <div className="text-red-400 font-ui text-sm">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">Audit Log</h1>
      {logs.length === 0 ? (
        <p className="text-muted font-ui text-sm">No log entries found.</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => {
            const a = ACTION_COLORS[log.action] ?? ACTION_COLORS.resubmit;
            return (
              <li key={log._id} className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <div dir="rtl" className="font-pashto text-warm text-xl" style={{ lineHeight: 1.7 }}>
                      {log.entry?.pashto}
                    </div>
                    <p className="text-xs font-ui text-muted">by {log.performedBy?.username}</p>
                    {log.note && (
                      <p className="text-xs font-ui text-muted/60 italic mt-0.5">{log.note}</p>
                    )}
                  </div>
                  <span
                    className="shrink-0 text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
                    style={{ color: a.color, background: a.bg, border: `1px solid ${a.border}` }}
                  >
                    {log.action}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
