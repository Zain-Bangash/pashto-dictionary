import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ConceptDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [concept, setConcept] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRegionIdx, setSelectedRegionIdx] = useState({});

  useEffect(() => {
    api.get(`/api/concepts/${id}`)
      .then((res) => setConcept(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404) setError('Entry not found.');
        else setError('Failed to load entry.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Group variants by pashto word — same word from different regions becomes one card
  const variantGroups = concept?.variants
    ? Object.values(
        concept.variants.reduce((acc, v) => {
          if (!acc[v.pashto]) acc[v.pashto] = [];
          acc[v.pashto].push(v);
          return acc;
        }, {})
      )
    : [];

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
              {concept.submittedBy?.username && (
                <p className="text-[11px] font-ui text-muted/50">
                  Submitted by {concept.submittedBy.username}
                  {(concept.submittedBy.village || concept.submittedBy.region) && (
                    <span className="ml-1">
                      ({[concept.submittedBy.village, concept.submittedBy.region].filter(Boolean).join(', ')})
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Regional variants */}
            {variantGroups.length > 0 && (
              <section>
                <h2 className="font-ui text-muted text-xs uppercase tracking-widest mb-3">Regional Variants</h2>
                <ul className="space-y-4">
                  {variantGroups.map((group) => {
                    const pashtoWord = group[0].pashto;
                    const activeIdx  = selectedRegionIdx[pashtoWord] ?? 0;
                    const selected   = group[activeIdx];

                    return (
                      <li
                        key={pashtoWord}
                        className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-6 space-y-3"
                      >
                        {/* Pashto word */}
                        <div
                          dir="rtl"
                          className="font-pashto text-warm font-bold"
                          style={{ fontSize: 56, lineHeight: 1.7 }}
                        >
                          {pashtoWord}
                        </div>

                        {/* Region tab strip */}
                        <div className="flex gap-2 flex-wrap">
                          {group.map((v, idx) => (
                            <button
                              key={v._id}
                              type="button"
                              onClick={() => setSelectedRegionIdx((prev) => ({ ...prev, [pashtoWord]: idx }))}
                              className="text-xs font-ui px-3 py-1 rounded-full transition-all"
                              style={{
                                background: activeIdx === idx ? 'rgba(0,245,180,0.12)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${activeIdx === idx ? 'rgba(0,245,180,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                color: activeIdx === idx ? '#00f5b4' : '#888',
                              }}
                            >
                              {v.region}
                            </button>
                          ))}
                        </div>

                        {/* Per-region: phonetic, definition, example */}
                        {selected.phonetic && (
                          <p className="font-display text-lg italic text-gold">{selected.phonetic}</p>
                        )}
                        <p className="font-ui text-warm/80 text-sm leading-relaxed">{selected.definition}</p>
                        {selected.example && (
                          <p className="font-ui text-muted text-sm italic">{selected.example}</p>
                        )}

                        {selected.submittedBy?.username && (
                          <p className="text-[11px] font-ui text-muted/40">
                            Added by {selected.submittedBy.username}
                            {(selected.submittedBy.village || selected.submittedBy.region) && (
                              <span className="ml-1">
                                ({[selected.submittedBy.village, selected.submittedBy.region].filter(Boolean).join(', ')})
                              </span>
                            )}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (!user) { navigate('/login'); return; }
                            const params = new URLSearchParams({
                              conceptId: concept._id,
                              pashto: pashtoWord,
                              ...(selected.phonetic && { phonetic: selected.phonetic }),
                            });
                            navigate(`/submit?${params.toString()}`);
                          }}
                          className="mt-1 text-xs font-ui text-gold/70 hover:text-gold transition-colors"
                        >
                          + I also say this in my region
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {variantGroups.length === 0 && (
              <p className="text-muted font-ui text-sm text-center py-8">No published variants yet.</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
