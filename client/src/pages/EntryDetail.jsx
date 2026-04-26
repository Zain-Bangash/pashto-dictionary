import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function EntryDetail() {
  const { id } = useParams();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/entries/${id}`)
      .then((res) => setEntry(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404) setError('Entry not found.');
        else setError('Failed to load entry.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link to="/entries" className="inline-flex items-center gap-1.5 text-sm font-ui text-muted hover:text-warm transition-colors mb-8">
          ← Back to entries
        </Link>

        {loading && <p className="text-muted font-ui text-sm">Loading…</p>}
        {error && <p className="text-red-400 font-ui text-sm">{error}</p>}

        {!loading && !error && entry && (
          <article className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-8 space-y-6">
            {/* Hero Pashto word */}
            <h1
              dir="rtl"
              className="font-pashto text-warm"
              style={{ fontSize: 72, lineHeight: 1.7 }}
            >
              {entry.pashto}
            </h1>

            {/* Phonetic / romanization */}
            {entry.phonetic && (
              <p
                className="font-display text-xl italic text-gold"
                style={{ textShadow: '0 0 12px rgba(232,197,71,0.7), 0 0 30px rgba(232,197,71,0.35)' }}
              >
                {entry.phonetic}
              </p>
            )}

            {/* Badges */}
            <div className="flex gap-2 flex-wrap">
              {entry.partOfSpeech && (
                <span className="meta-label bg-white/[0.05] border border-white/[0.08] rounded-full px-3 py-1">
                  {entry.partOfSpeech}
                </span>
              )}
              {entry.region && (
                <span className="meta-label bg-white/[0.05] border border-white/[0.08] rounded-full px-3 py-1">
                  {entry.region}
                </span>
              )}
            </div>

            {/* Definitions */}
            {entry.definitions?.length > 0 && (
              <ol className="space-y-4">
                {entry.definitions.map((def, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-gold font-display text-lg shrink-0">{i + 1}.</span>
                    <div>
                      <span className="text-warm font-ui text-sm leading-relaxed">{def.text}</span>
                      {def.example && (
                        <p className="text-muted font-ui text-sm mt-1 italic">{def.example}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
