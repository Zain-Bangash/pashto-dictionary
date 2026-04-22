import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import EntryCard from '../components/EntryCard';
import api from '../services/api';

export default function Home() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/entries?limit=6')
      .then((res) => setEntries(res.data.data))
      .catch(() => setError('Failed to load recent entries.'))
      .finally(() => setLoading(false));
  }, []);

  function handleSearch(q) {
    if (q) navigate(`/entries?q=${encodeURIComponent(q)}`);
    else navigate('/entries');
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-20 flex flex-col items-center gap-8">
        <h1 className="text-4xl font-semibold text-neutral-800">Pashto Dictionary</h1>
        <SearchBar initialValue="" onSubmit={handleSearch} />

        <section className="w-full mt-8">
          <h2 className="text-lg font-medium text-neutral-600 mb-4">Recent Entries</h2>
          {loading && (
            <p className="text-neutral-400 text-sm">Loading…</p>
          )}
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          {!loading && !error && entries.length === 0 && (
            <p className="text-neutral-400 text-sm">No entries yet.</p>
          )}
          {!loading && !error && entries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {entries.map((entry) => (
                <EntryCard key={entry._id} entry={entry} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
