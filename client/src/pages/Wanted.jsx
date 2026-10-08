import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useLookups from '../hooks/useLookups';
import useWantedConcepts from '../hooks/useWantedConcepts';
import RegionPills from '../components/RegionPills';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';

function defaultRegion(regions, userRegion) {
  return regions.find((r) => r.key === userRegion)?.key ?? regions[0]?.key ?? '';
}

export default function Wanted() {
  const { user } = useAuth();
  const { active, labelFor } = useLookups();
  const [searchParams, setSearchParams] = useSearchParams();

  const region = searchParams.get('region') || defaultRegion(active('region'), user?.region);
  const q      = searchParams.get('q') ?? '';
  const page   = parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const { concepts, meta, loading, error } = useWantedConcepts({ region, q, page });

  function update(changes) {
    const next = { region, q, page: '1', ...changes };
    if (next.page === '1') delete next.page;
    setSearchParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  }

  const regionLabel = labelFor('region', region);
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-3xl mx-auto px-5 py-10 space-y-6">
        <div className="bento-enter">
          <h1 className="text-2xl font-display text-warm">Wanted Words</h1>
          <p className="text-sm font-ui text-muted mt-1">
            Meanings that still need a word from your region. Pick a region and add the word you use.
          </p>
        </div>

        <RegionPills value={region} onChange={(key) => update({ region: key })} />
        <SearchBar key={q} initialValue={q} onSubmit={(next) => update({ q: next })} placeholder="Search English meanings…" />

        {loading && <p className="text-muted font-ui text-sm text-center py-16 animate-pulse">Loading…</p>}
        {!loading && error && <p className="text-red-400 font-ui text-sm text-center py-16">{error}</p>}
        {!loading && !error && concepts.length === 0 && (
          <p className="text-muted font-ui text-sm text-center py-16">
            Nothing wanted{region && ` for ${regionLabel}`}{q && ` matching “${q}”`}.
          </p>
        )}

        {!loading && !error && concepts.length > 0 && (
          <>
            <p className="meta-label">{meta.total} wanted in {regionLabel}</p>
            <ul className="space-y-2">
              {concepts.map((c) => (
                <li
                  key={c._id}
                  className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[16px] px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-warm font-display text-lg font-semibold">{c.englishGloss}</p>
                    <span className="meta-label">{labelFor('partOfSpeech', c.partOfSpeech)}</span>
                  </div>
                  <Link
                    to={`/submit?${new URLSearchParams({ conceptId: c._id, region }).toString()}`}
                    className="shrink-0 font-ui font-semibold text-warm bg-terracotta rounded-xl text-xs px-4 py-2 hover:opacity-90 transition-opacity"
                  >
                    Add your {regionLabel} word
                  </Link>
                </li>
              ))}
            </ul>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} />}
          </>
        )}
      </div>
    </div>
  );
}
