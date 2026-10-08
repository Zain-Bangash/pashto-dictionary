import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useLookups from '../../hooks/useLookups';
import LogChanges from '../../components/log/LogChanges';

const ACTION_STYLES = {
  submitted:       { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)' },
  approved:        { color: '#00f5b4', bg: 'rgba(0,245,180,0.08)',   border: 'rgba(0,245,180,0.3)'   },
  rejected:        { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)' },
  published:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)' },
  resubmitted:     { color: '#e8c547', bg: 'rgba(232,197,71,0.08)',  border: 'rgba(232,197,71,0.3)'  },
  deleted:         { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.3)'  },
  edited:          { color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.3)'  },
  merged:          { color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.3)' },
  profile_updated: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)' },
  lookup_changed:  { color: '#2dd4bf', bg: 'rgba(45,212,191,0.08)',  border: 'rgba(45,212,191,0.3)'  },
};

const ALL_ACTIONS = [
  'submitted', 'approved', 'rejected', 'published',
  'resubmitted', 'deleted', 'edited', 'merged', 'profile_updated', 'lookup_changed',
];

const LOOKUP_TYPE_NAMES = { region: 'Region', partOfSpeech: 'Part of speech' };

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function TargetLabel({ log }) {
  const { labelFor } = useLookups();
  if (!log.target && !log.targetModel) return null;

  const model = log.targetModel;
  const t     = log.target;

  let label = null;
  if (model === 'Concept' && t?.englishGloss) {
    label = (
      <span className="text-warm/80">{t.englishGloss}</span>
    );
  } else if (model === 'Variant' && t?.pashto) {
    label = (
      <>
        <span dir="rtl" className="font-pashto text-warm/80" style={{ fontSize: 17, lineHeight: 1.5 }}>{t.pashto}</span>
        {t.region && <span className="text-muted/60"> · {labelFor('region', t.region)}</span>}
      </>
    );
  } else if (model === 'Lookup' && log.changes?.type) {
    const { type, key } = log.changes;
    label = (
      <>
        <span className="text-muted/60">{LOOKUP_TYPE_NAMES[type] ?? type}</span>
        {key && <span className="text-warm/80"> · {labelFor(type, key)}</span>}
      </>
    );
  }

  if (!label) return null;

  return (
    <p className="text-xs font-ui text-muted flex items-center gap-1.5 flex-wrap">
      <span className="text-muted/40 uppercase tracking-wider text-[10px]">{model}</span>
      {label}
    </p>
  );
}

export default function DashboardLog() {
  const { user } = useAuth();

  const [logs,    setLogs]    = useState([]);
  const [meta,    setMeta]    = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const [filterAction, setFilterAction] = useState('');
  const [filterModel,  setFilterModel]  = useState('');
  const [page, setPage] = useState(1);

  const isAdmin = user && user.role === 'admin';

  const fetchLog = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filterAction) params.set('action', filterAction);
      if (filterModel)  params.set('targetModel', filterModel);
      const res = await api.get(`/api/moderation/log?${params.toString()}`);
      setLogs(res.data.data);
      setMeta(res.data.meta);
    } catch {
      setError('Failed to load log');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filterAction, filterModel, page]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const totalPages = Math.ceil(meta.total / meta.limit);

  const selectCls = 'bg-[#1c1c15] border border-white/[0.15] rounded-[8px] px-3 py-1.5 text-xs font-ui text-warm focus:outline-none focus:border-terracotta/50 cursor-pointer';

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-display text-warm">Audit Log</h1>
        <div className="flex gap-2 flex-wrap">
          <select
            className={selectCls}
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          >
            <option value=""        style={{ background: '#1c1c15', color: '#fffef8' }}>All actions</option>
            {ALL_ACTIONS.map(a => (
              <option key={a} value={a} style={{ background: '#1c1c15', color: '#fffef8' }}>{a}</option>
            ))}
          </select>
          <select
            className={selectCls}
            value={filterModel}
            onChange={(e) => { setFilterModel(e.target.value); setPage(1); }}
          >
            <option value=""          style={{ background: '#1c1c15', color: '#fffef8' }}>All types</option>
            <option value="Concept"   style={{ background: '#1c1c15', color: '#fffef8' }}>Concept</option>
            <option value="Variant"   style={{ background: '#1c1c15', color: '#fffef8' }}>Variant</option>
            <option value="User"      style={{ background: '#1c1c15', color: '#fffef8' }}>User</option>
            <option value="Lookup"    style={{ background: '#1c1c15', color: '#fffef8' }}>List value</option>
          </select>
        </div>
      </div>

      {loading && <p className="text-muted font-ui text-sm animate-pulse">Loading…</p>}
      {error   && <p className="text-red-400 font-ui text-sm">{error}</p>}

      {!loading && !error && logs.length === 0 && (
        <p className="text-muted font-ui text-sm">No log entries found.</p>
      )}

      {!loading && !error && logs.length > 0 && (
        <>
          <ul className="space-y-2">
            {logs.map((log) => {
              const a = ACTION_STYLES[log.action] ?? ACTION_STYLES.submitted;
              return (
                <li key={log._id} className="bg-white/[0.035] border border-white/[0.08] rounded-[16px] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                      <TargetLabel log={log} />
                      <p className="text-xs font-ui text-muted/60">
                        by {log.performedBy?.username ?? <span className="italic text-muted/40">unknown</span>}
                        <span className="mx-1.5 text-muted/30">·</span>
                        {formatDate(log.timestamp)}
                      </p>
                      <LogChanges log={log} />
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-[8px] text-xs font-ui text-muted hover:text-warm disabled:opacity-30 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs font-ui text-muted">
                Page {page} of {totalPages} · {meta.total} entries
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-[8px] text-xs font-ui text-muted hover:text-warm disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
