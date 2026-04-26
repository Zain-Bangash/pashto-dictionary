import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const STATUS_STYLES = {
  pending:   { color: '#e8c547', border: 'rgba(232,197,71,0.3)',  bg: 'rgba(232,197,71,0.08)' },
  approved:  { color: '#00f5b4', border: 'rgba(0,245,180,0.3)',   bg: 'rgba(0,245,180,0.08)' },
  published: { color: '#00f5b4', border: 'rgba(0,245,180,0.3)',   bg: 'rgba(0,245,180,0.08)' },
  rejected:  { color: '#f87171', border: 'rgba(248,113,113,0.3)', bg: 'rgba(248,113,113,0.08)' },
};

export default function MySubmissions() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/entries/my-submissions')
      .then((res) => {
        setEntries(res.data.data);
      })
      .catch(() => {
        setError('Failed to load submissions');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <p className="text-muted font-ui text-sm animate-pulse">Loading…</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <p className="text-red-400 font-ui text-sm">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-display text-warm">My Submissions</h1>
          <Link
            to="/submit"
            className="px-4 py-2 bg-mint text-charcoal text-sm font-ui font-semibold rounded-[10px] hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 20px rgba(0,245,180,0.3)' }}
          >
            + Submit New
          </Link>
        </div>

        {entries.length === 0 ? (
          <p className="text-muted font-ui text-sm text-center py-20">No submissions yet.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const s = STATUS_STYLES[entry.status] ?? STATUS_STYLES.pending;
              return (
                <li
                  key={entry._id}
                  className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div dir="rtl" className="font-pashto text-warm text-xl" style={{ lineHeight: 1.7 }}>
                        {entry.pashto}
                      </div>
                      <p className="text-sm font-ui text-muted leading-snug">
                        {entry.definitions?.[0]?.text}
                      </p>
                      {entry.status === 'rejected' && entry.moderatorNote && (
                        <p className="text-xs font-ui text-red-400 mt-1">Note: {entry.moderatorNote}</p>
                      )}
                    </div>
                    <span
                      className="shrink-0 text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
                      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
                    >
                      {entry.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
