import { useParams, useSearchParams, Link } from 'react-router-dom';
import AmbientBackground from '../components/AmbientBackground';
import ConceptPanel from '../components/concept/ConceptPanel';
import VariantCard from '../components/concept/VariantCard';
import useConcept from '../hooks/useConcept';
import useMyOpenSuggestions from '../hooks/useMyOpenSuggestions';
import { useAuth } from '../context/AuthContext';

const STAGGER = ['[animation-delay:0.1s]', '[animation-delay:0.16s]', '[animation-delay:0.22s]', '[animation-delay:0.28s]'];

// Words that share the same Pashto spelling become one card with a region tab per word
function groupByPashto(variants = []) {
  return Object.values(variants.reduce((acc, v) => {
    (acc[v.pashto] ??= []).push(v);
    return acc;
  }, {}));
}

export default function ConceptDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { concept, loading, error } = useConcept(id);
  const { openVariantIds, markOpen } = useMyOpenSuggestions(id, Boolean(user));
  const groups = groupByPashto(concept?.variants);
  const [searchParams] = useSearchParams();
  const recordTarget = searchParams.get('record') ? { variantId: searchParams.get('record'), slot: searchParams.get('slot') } : null;
  const targetsGroup = (group) => Boolean(recordTarget) && group.some((v) => String(v._id) === recordTarget.variantId);

  return (
    <div className="min-h-screen bg-charcoal">
      <AmbientBackground />
      <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8">
        {loading && <p className="text-muted font-ui text-sm animate-pulse">Loading…</p>}
        {error && (
          <div className="space-y-4">
            <BackLink />
            <p role="alert" className="text-red-400 font-ui text-sm">{error}</p>
          </div>
        )}

        {concept && (
          <article className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4 sm:gap-5 items-start">
            <aside className="bento-enter lg:sticky lg:top-20 space-y-4">
              <BackLink />
              <ConceptPanel concept={concept} wordCount={concept.variants?.length ?? 0} />
            </aside>

            <section aria-labelledby="words-heading" className="space-y-3 lg:pt-9">
              <h2 id="words-heading" className="meta-label">Regional Variants</h2>
              {groups.length > 0 ? (
                <ul className="space-y-4">
                  {groups.map((group, i) => (
                    <VariantCard
                      key={group[0].pashto}
                      group={group}
                      conceptId={concept._id}
                      partOfSpeech={concept.partOfSpeech}
                      openVariantIds={openVariantIds}
                      onSuggestionSent={markOpen}
                      recordTarget={targetsGroup(group) ? recordTarget : null}
                      className={`bento-enter ${STAGGER[Math.min(i, STAGGER.length - 1)]}`}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted font-ui text-sm text-center py-8 bg-white/[0.03] border border-white/[0.07] rounded-3xl">
                  No published variants yet.
                </p>
              )}
            </section>
          </article>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/concepts" className="inline-flex items-center gap-1.5 text-sm font-ui text-muted hover:text-warm transition-colors">
      ← Back to concepts
    </Link>
  );
}
