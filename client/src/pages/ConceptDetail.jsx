import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function ConceptDetail() {
  const { id } = useParams();
  const [concept, setConcept] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/concepts/${id}`)
      .then((res) => setConcept(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404) setError('Entry not found.');
        else setError('Failed to load entry.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link to="/concepts" className="inline-flex items-center gap-1.5 text-sm font-ui text-muted hover:text-warm transition-colors mb-8">
          ← Back to concepts
        </Link>

        {loading && <p className="text-muted font-ui text-sm">Loading…</p>}
        {error && <p className="text-red-400 font-ui text-sm">{error}</p>}

        {!loading && !error && concept && (
          <article className="space-y-6">
            {/* Concept heading */}
            <div className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-8 space-y-4">
              <h1 className="font-display text-warm text-4xl font-bold">{concept.englishGloss}</h1>

              <div className="flex gap-2 flex-wrap">
                {concept.partOfSpeech && (
                  <span className="meta-label bg-white/[0.05] border border-white/[0.08] rounded-full px-3 py-1">
                    {concept.partOfSpeech}
                  </span>
                )}
              </div>
            </div>

            {/* Regional variants */}
            {concept.variants?.length > 0 && (
              <section>
                <h2 className="font-ui text-muted text-xs uppercase tracking-widest mb-3">Regional Variants</h2>
                <ul className="space-y-4">
                  {concept.variants.map((variant) => (
                    <li
                      key={variant._id}
                      className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-6 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div
                          dir="rtl"
                          className="font-pashto text-warm font-bold"
                          style={{ fontSize: 56, lineHeight: 1.7 }}
                        >
                          {variant.pashto}
                        </div>
                        <span className="meta-label bg-white/[0.05] border border-white/[0.08] rounded-full px-3 py-1 shrink-0 mt-2">
                          {variant.region}
                        </span>
                      </div>

                      {variant.phonetic && (
                        <p className="font-display text-lg italic text-gold">
                          {variant.phonetic}
                        </p>
                      )}

                      <p className="font-ui text-warm/80 text-sm leading-relaxed">{variant.definition}</p>

                      {variant.example && (
                        <p className="font-ui text-muted text-sm italic">{variant.example}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {concept.variants?.length === 0 && (
              <p className="text-muted font-ui text-sm text-center py-8">No published variants yet.</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
