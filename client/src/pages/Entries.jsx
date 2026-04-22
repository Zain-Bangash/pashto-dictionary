import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import EntryCard from '../components/EntryCard';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import api from '../services/api';

export default function Entries() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const url = q
      ? `/api/entries/search?q=${encodeURIComponent(q)}&page=${page}`
      : `/api/entries?page=${page}`;

    api.get(url)
      .then((res) => {
        setEntries(res.data.data);
        setMeta(res.data.meta);
      })
      .catch(() => setError('Failed to load entries.'))
      .finally(() => setLoading(false));
  }, [q, page]);

  function handleSearch(newQ) {
    if (newQ) navigate(`/entries?q=${encodeURIComponent(newQ)}`);
    else navigate('/entries');
  }

  function handlePageChange(newPage) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('page', String(newPage));
    navigate(`/entries?${params.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex justify-center mb-8">
          <SearchBar initialValue={q} onSubmit={handleSearch} />
        </div>

        {loading && <p className="text-neutral-400 text-sm text-center">Loading…</p>}
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="text-neutral-400 text-sm text-center">No entries found.</p>
        )}
        {!loading && !error && entries.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map((entry) => (
                <EntryCard key={entry._id} entry={entry} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  );
}
