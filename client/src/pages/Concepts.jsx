import { useSearchParams, useNavigate } from 'react-router-dom';
import AmbientBackground from '../components/AmbientBackground';
import ConceptCard from '../components/ConceptCard';
import Pagination from '../components/Pagination';
import BrowseFilters from '../components/concepts/BrowseFilters';
import useConceptList from '../hooks/useConceptList';
import useLookups from '../hooks/useLookups';

// Tailwind needs literal class names, so the card stagger is a fixed list
const STAGGER = ['[animation-delay:0.12s]', '[animation-delay:0.17s]', '[animation-delay:0.22s]', '[animation-delay:0.27s]', '[animation-delay:0.32s]', '[animation-delay:0.37s]'];

export default function Concepts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { labelFor } = useLookups();
  const q      = searchParams.get('q') ?? '';
  const domain = searchParams.get('domain') ?? '';
  const region = searchParams.get('region') ?? '';
  const page   = parseInt(searchParams.get('page') ?? '1', 10);
  const { concepts, meta, loading, loaded, error } = useConceptList({ q, domain, region, page });

  // Changing any filter returns to page 1
  function go(changes) {
    const next = { q, domain, region, page: undefined, ...changes };
    const params = new URLSearchParams();
    for (const key of ['q', 'domain', 'region', 'page']) if (next[key]) params.set(key, String(next[key]));
    const qs = params.toString();
    navigate(qs ? `/concepts?${qs}` : '/concepts');
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const filtered = Boolean(q || domain || region);
  const summary = [
    `${meta.total} concept${meta.total !== 1 ? 's' : ''}`,
    q && `for “${q}”`,
    region && `in ${labelFor('region', region)}`,
  ].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen bg-charcoal">
      <AmbientBackground />
      <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 flex flex-col gap-4 sm:gap-5">
        <header className="bento-enter">
          <p className="meta-label mb-2">Dictionary</p>
          <h1 className="text-3xl font-display text-warm">Browse Entries</h1>
        </header>

        <div className="bento-enter [animation-delay:0.06s]">
          <BrowseFilters q={q} domain={domain} region={region} onChange={go} />
        </div>

        {!loaded && loading && <p className="text-muted font-ui text-sm text-center py-20 animate-pulse">Loading…</p>}
        {error && <p role="alert" className="text-red-400 font-ui text-sm text-center py-20">{error}</p>}

        {loaded && !error && (
          <section aria-label="Results" aria-busy={loading} className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="font-ui text-warm/70 text-[10px] uppercase tracking-[0.14em]">{summary}</p>
              {filtered && (
                <button type="button" onClick={() => navigate('/concepts')} className="font-ui text-xs text-muted hover:text-warm transition-colors">
                  Clear filters
                </button>
              )}
            </div>

            {concepts.length === 0 ? (
              <p className="text-muted font-ui text-sm text-center py-20">No concepts found.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                  {concepts.map((concept, i) => (
                    <div key={concept._id} className={`bento-enter ${STAGGER[Math.min(i, STAGGER.length - 1)]}`}>
                      <ConceptCard concept={concept} />
                    </div>
                  ))}
                </div>
                {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={(p) => go({ page: p })} />}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
