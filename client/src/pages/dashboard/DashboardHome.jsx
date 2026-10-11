import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useDashboardStats from '../../hooks/useDashboardStats';

const TASKS = [
  { view: 'entries',     status: 'pending',  label: 'Entries to review',     hint: 'Concepts and words waiting for a first check' },
  { view: 'entries',     status: 'approved', label: 'Entries to publish',    hint: 'Approved and ready to go live', adminOnly: true },
  { view: 'suggestions', status: 'pending',  label: 'Suggestions to review', hint: 'Forms and edits proposed for live words' },
  { view: 'suggestions', status: 'approved', label: 'Suggestions to publish', hint: 'Approved changes to apply', adminOnly: true },
  { view: 'audio',       status: 'pending',  label: 'Recordings to review',  hint: 'New pronunciations to listen to' },
  { view: 'audio',       status: 'approved', label: 'Recordings to publish', hint: 'Approved clips to make live', adminOnly: true },
];

// Gold = waiting, mint = approved or live, red = rejected (DESIGN-SYSTEM › Status colours)
const TOTALS = [
  ['pending', 'Pending', 'text-gold'],
  ['approved', 'Approved', 'text-mint'],
  ['published', 'Published', 'text-mint'],
  ['rejected', 'Rejected', 'text-red-400'],
];

function queueLink(view, status) {
  const params = new URLSearchParams();
  if (view !== 'entries') params.set('view', view);
  if (status !== 'pending') params.set('status', status);
  const qs = params.toString();
  return `/dashboard/queue${qs ? `?${qs}` : ''}`;
}

export default function DashboardHome() {
  const { user } = useAuth() ?? {};
  const isAdmin = user?.role === 'admin';
  const { stats, loading, error } = useDashboardStats();

  if (loading && !stats) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error && !stats) return <div className="text-red-400 font-ui text-sm">{error}</div>;

  const tasks = stats?.queue ? TASKS.filter((t) => isAdmin || !t.adminOnly) : [];
  const countOf = (t) => stats.queue[t.view]?.[t.status] ?? 0;
  const allClear = tasks.length > 0 && tasks.every((t) => countOf(t) === 0);

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-display text-warm">Overview</h1>

      {tasks.length > 0 && (
        <section aria-labelledby="todo-heading" className="space-y-3">
          <h2 id="todo-heading" className="meta-label">Your to-do</h2>
          {allClear && <p className="text-sm font-ui text-muted">All caught up — nothing is waiting for you.</p>}
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tasks.map((t) => {
              const count = countOf(t);
              return (
                <li key={`${t.view}-${t.status}`}>
                  <Link
                    to={queueLink(t.view, t.status)}
                    className={`block h-full bg-white/[0.035] border rounded-[16px] p-4 no-underline transition-all hover:bg-white/[0.05] ${
                      count > 0 ? 'border-gold/30 hover:border-gold/50' : 'border-white/[0.08] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-ui text-sm text-warm">{t.label}</span>
                      <span className={`font-display text-2xl ${count > 0 ? 'text-gold' : 'text-muted'}`}>{count}</span>
                    </span>
                    <span className="block text-[11px] font-ui text-muted mt-1">{t.hint}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="totals-heading" className="space-y-3">
        <h2 id="totals-heading" className="meta-label">Concepts and words by status</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {TOTALS.map(([key, label, color]) => (
            <div key={key} className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[16px] p-4">
              <p className="meta-label mb-2">{label}</p>
              <p className={`text-3xl font-display ${color}`}>{stats?.[key] ?? 0}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
