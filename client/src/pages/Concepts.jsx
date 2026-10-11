import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import DomainFilter from '../components/DomainFilter';
import api from '../services/api';
import useLookups from '../hooks/useLookups';

export default function Concepts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q    = searchParams.get('q') ?? '';
  const domain = searchParams.get('domain') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const [concepts, setConcepts] = useState([]);
  const [meta, setMeta]         = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page });
    if (q) params.set('q', q);
    if (domain) params.set('domain', domain);
    const url = q
      ? `/api/concepts/search?${params.toString()}`
      : `/api/concepts?${params.toString()}`;

    api.get(url)
      .then((res) => {
        setConcepts(res.data.data);
        setMeta(res.data.meta);
      })
      .catch(() => setError('Failed to load concepts.'))
      .finally(() => setLoading(false));
  }, [q, domain, page]);

  function go({ q: nextQ = q, domain: nextDomain = domain, page: nextPage } = {}) {
    const params = new URLSearchParams();
    if (nextQ) params.set('q', nextQ);
    if (nextDomain) params.set('domain', nextDomain);
    if (nextPage) params.set('page', String(nextPage));
    const qs = params.toString();
    navigate(qs ? `/concepts?${qs}` : '/concepts');
  }

  const handleSearch = (newQ) => go({ q: newQ });
  const handlePageChange = (newPage) => go({ page: newPage });

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-display text-warm mb-6">Browse Entries</h1>
          <SearchBar initialValue={q} onSubmit={handleSearch} />
          <div className="mt-4">
            <DomainFilter value={domain} onChange={(d) => go({ domain: d })} />
          </div>
        </div>

        {loading && <p className="text-muted font-ui text-sm text-center py-20">Loading…</p>}
        {error && <p className="text-red-400 font-ui text-sm text-center py-20">{error}</p>}
        {!loading && !error && concepts.length === 0 && (
          <p className="text-muted font-ui text-sm text-center py-20">No concepts found.</p>
        )}
        {!loading && !error && concepts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {concepts.map((concept) => (
                <ConceptCard key={concept._id} concept={concept} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  );
}

function ConceptCard({ concept }) {
  const { labelFor } = useLookups();
  const variantCount = concept.variantCount ?? 0;
  return (
    <Link
      to={`/concepts/${concept._id}`}
      className="bento-card block bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5 no-underline"
    >
      <p className="text-warm text-xl font-display font-semibold leading-snug">{concept.englishGloss}</p>
      {concept.partOfSpeech && (
        <span className="meta-label mt-1 inline-block">{labelFor('partOfSpeech', concept.partOfSpeech)}</span>
      )}
      <p className="text-muted text-xs font-ui mt-2">
        {variantCount} regional variant{variantCount !== 1 ? 's' : ''}
      </p>
    </Link>
  );
}
