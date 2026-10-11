import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useLookups from '../../hooks/useLookups';
import useFieldDefinitions from '../../hooks/useFieldDefinitions';
import LogChanges from '../../components/log/LogChanges';
import { audioSlotLabel } from '../../utils/audio';

const ACTION_STYLES = {
  submitted:          'text-slate-400 border-slate-400/25 bg-slate-400/[0.08]',
  approved:           'text-mint border-mint/30 bg-mint/[0.08]',
  rejected:           'text-red-400 border-red-400/30 bg-red-400/[0.08]',
  published:          'text-mint border-mint/30 bg-mint/[0.08]',
  resubmitted:        'text-gold border-gold/30 bg-gold/[0.08]',
  deleted:            'text-orange-400 border-orange-400/30 bg-orange-400/[0.08]',
  edited:             'text-sky-400 border-sky-400/30 bg-sky-400/[0.08]',
  merged:             'text-purple-400 border-purple-400/30 bg-purple-400/[0.08]',
  profile_updated:    'text-slate-400 border-slate-400/25 bg-slate-400/[0.08]',
  lookup_changed:     'text-teal-400 border-teal-400/30 bg-teal-400/[0.08]',
  field_changed:      'text-pink-400 border-pink-400/30 bg-pink-400/[0.08]',
  suggestion_applied: 'text-lime-400 border-lime-400/30 bg-lime-400/[0.08]',
  audio_published:    'text-mint border-mint/30 bg-mint/[0.08]',
  retired:            'text-stone-400 border-stone-400/30 bg-stone-400/[0.08]',
  withdrawn:          'text-stone-400 border-stone-400/30 bg-stone-400/[0.08]',
  role_changed:       'text-violet border-violet/30 bg-violet/[0.08]',
};

const ALL_ACTIONS = [
  'submitted', 'approved', 'rejected', 'published',
  'resubmitted', 'deleted', 'edited', 'merged', 'profile_updated', 'lookup_changed', 'field_changed', 'suggestion_applied',
  'audio_published', 'retired', 'withdrawn', 'role_changed',
];

const MODEL_NAMES = { VariantSuggestion: 'Suggestion', AudioClip: 'Recording' };

const LOOKUP_TYPE_NAMES = { region: 'Region', partOfSpeech: 'Part of speech', semanticDomain: 'Domain' };
const FIELD_OWNER_NAMES = { concept: 'Concept field', variant: 'Variant field' };

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
  const { fieldLabel } = useFieldDefinitions();
  if (!log.target && !log.targetModel) return null;

  const model = log.targetModel;
  const t     = log.target;

  let label = null;
  if (model === 'Concept' && t?.englishGloss) {
    label = (
      <span className="text-warm/80">{t.englishGloss}</span>
    );
  } else if (['Variant', 'VariantSuggestion', 'AudioClip'].includes(model) && t?.pashto) {
    label = (
      <>
        <span dir="rtl" className="font-pashto text-warm/80 text-[17px]">{t.pashto}</span>
        {t.region && <span className="text-muted/60"> · {labelFor('region', t.region)}</span>}
        {t.slot && <span className="text-muted/60"> · {audioSlotLabel(t.slot)}</span>}
      </>
    );
  } else if (model === 'User' && t?.username) {
    label = <span className="text-warm/80">{t.username}</span>;
  } else if (model === 'Lookup' && log.changes?.type) {
    const { type, key } = log.changes;
    label = (
      <>
        <span className="text-muted/60">{LOOKUP_TYPE_NAMES[type] ?? type}</span>
        {key && <span className="text-warm/80"> · {labelFor(type, key)}</span>}
      </>
    );
  } else if (model === 'FieldDefinition' && log.changes?.appliesTo) {
    const { appliesTo, key } = log.changes;
    label = (
      <>
        <span className="text-muted/60">{FIELD_OWNER_NAMES[appliesTo] ?? appliesTo}</span>
        {key && <span className="text-warm/80"> · {fieldLabel(appliesTo, key)}</span>}
      </>
    );
  }

  if (!label) return null;

  return (
    <p className="text-xs font-ui text-muted flex items-center gap-1.5 flex-wrap">
      <span className="text-muted/40 uppercase tracking-wider text-[10px]">{MODEL_NAMES[model] ?? model}</span>
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
            <option value="" className="bg-charcoal text-warm">All actions</option>
            {ALL_ACTIONS.map(a => (
              <option key={a} value={a} className="bg-charcoal text-warm">{a}</option>
            ))}
          </select>
          <select
            className={selectCls}
            value={filterModel}
            onChange={(e) => { setFilterModel(e.target.value); setPage(1); }}
          >
            <option value="" className="bg-charcoal text-warm">All types</option>
            <option value="Concept"   className="bg-charcoal text-warm">Concept</option>
            <option value="Variant"   className="bg-charcoal text-warm">Variant</option>
            <option value="User"      className="bg-charcoal text-warm">User</option>
            <option value="Lookup"    className="bg-charcoal text-warm">List value</option>
            <option value="FieldDefinition" className="bg-charcoal text-warm">Custom field</option>
            <option value="VariantSuggestion" className="bg-charcoal text-warm">Suggestion</option>
            <option value="AudioClip" className="bg-charcoal text-warm">Recording</option>
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
                    <span className={`shrink-0 text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider border ${a}`}>
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
