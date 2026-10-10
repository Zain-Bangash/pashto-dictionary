import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import useLookups from '../hooks/useLookups';
import ExtraFieldsDisplay from '../components/fields/ExtraFieldsDisplay';
import VariantCard from '../components/concept/VariantCard';
import useMyOpenSuggestions from '../hooks/useMyOpenSuggestions';
import { useAuth } from '../context/AuthContext';

export default function ConceptDetail() {
  const { id } = useParams();
  const { labelFor } = useLookups();
  const [concept, setConcept] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { openVariantIds, markOpen } = useMyOpenSuggestions(id, Boolean(user));

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
                    {labelFor('partOfSpeech', concept.partOfSpeech)}
                  </span>
                )}
              </div>
              <ExtraFieldsDisplay appliesTo="concept" values={concept.extra} />
              {concept.submittedBy?.username && (
                <p className="text-[11px] font-ui text-muted/50">
                  Submitted by {concept.submittedBy.username}
                  {(concept.submittedBy.village || concept.submittedBy.region) && (
                    <span className="ml-1">
                      ({[concept.submittedBy.village, labelFor('region', concept.submittedBy.region)].filter(Boolean).join(', ')})
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
                  {variantGroups.map((group) => (
                    <VariantCard
                      key={group[0].pashto}
                      group={group}
                      conceptId={concept._id}
                      partOfSpeech={concept.partOfSpeech}
                      openVariantIds={openVariantIds}
                      onSuggestionSent={markOpen}
                    />
                  ))}
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
