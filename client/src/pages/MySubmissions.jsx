import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const STATUS_STYLES = {
  pending:   { color: '#e8c547', border: 'rgba(232,197,71,0.3)',  bg: 'rgba(232,197,71,0.08)' },
  approved:  { color: '#00f5b4', border: 'rgba(0,245,180,0.3)',   bg: 'rgba(0,245,180,0.08)' },
  published: { color: '#00f5b4', border: 'rgba(0,245,180,0.3)',   bg: 'rgba(0,245,180,0.08)' },
  rejected:  { color: '#f87171', border: 'rgba(248,113,113,0.3)', bg: 'rgba(248,113,113,0.08)' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className="shrink-0 text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {status}
    </span>
  );
}

function Section({ title, items, renderItem }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="text-xs font-ui font-semibold text-muted uppercase tracking-widest mb-3">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => renderItem(item))}
      </ul>
    </div>
  );
}

export default function MySubmissions() {
  const [concepts, setConcepts]   = useState([]);
  const [variants, setVariants]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/concepts/my-submissions'),
      api.get('/api/variants/my-submissions'),
    ])
      .then(([cRes, vRes]) => {
        setConcepts(cRes.data.data || []);
        setVariants(vRes.data.data || []);
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

  const isEmpty = concepts.length === 0 && variants.length === 0;

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-display text-warm">My Submissions</h1>
          <Link
            to="/submit"
            className="px-4 py-2 bg-terracotta text-warm text-sm font-ui font-semibold rounded-[10px] hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 20px rgba(196,119,90,0.35)' }}
          >
            + Submit New
          </Link>
        </div>

        {isEmpty ? (
          <p className="text-muted font-ui text-sm text-center py-20">No submissions yet.</p>
        ) : (
          <div className="space-y-8">
            <Section
              title="Concepts you submitted"
              items={concepts}
              renderItem={(concept) => {
                const s = STATUS_STYLES[concept.status] ?? STATUS_STYLES.pending;
                return (
                  <li
                    key={concept._id}
                    className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 overflow-hidden">
                        <p className="text-warm font-display text-lg font-semibold">{concept.englishGloss}</p>
                        {concept.partOfSpeech && (
                          <span className="meta-label inline-block">{concept.partOfSpeech}</span>
                        )}
                        {concept.status === 'rejected' && concept.moderatorNote && (
                          <p className="text-xs font-ui text-red-400 mt-1">Note: {concept.moderatorNote}</p>
                        )}
                      </div>
                      <StatusBadge status={concept.status} />
                    </div>
                  </li>
                );
              }}
            />

            <Section
              title="Variants you submitted"
              items={variants}
              renderItem={(variant) => (
                <li
                  key={variant._id}
                  className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div dir="rtl" className="font-pashto text-warm text-xl" style={{ lineHeight: 1.7 }}>
                        {variant.pashto}
                      </div>
                      <p className="text-sm font-ui text-muted leading-snug">{variant.definition}</p>
                      {variant.region && (
                        <span className="meta-label inline-block">{variant.region}</span>
                      )}
                      {variant.status === 'rejected' && variant.moderatorNote && (
                        <p className="text-xs font-ui text-red-400 mt-1">Note: {variant.moderatorNote}</p>
                      )}
                    </div>
                    <StatusBadge status={variant.status} />
                  </div>
                </li>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
