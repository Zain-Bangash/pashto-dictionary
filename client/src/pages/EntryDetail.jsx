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
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link to="/entries" className="text-neutral-500 hover:text-neutral-700 text-sm mb-6 inline-block">
          ← Back to entries
        </Link>

        {loading && <p className="text-neutral-400 text-sm">Loading…</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!loading && !error && entry && (
          <article>
            <h1 className="text-4xl font-bold text-neutral-900">{entry.pashto}</h1>
            {entry.phonetic && (
              <p className="text-neutral-500 text-lg mt-1">{entry.phonetic}</p>
            )}
            <div className="flex gap-3 mt-3 flex-wrap">
              {entry.partOfSpeech && (
                <span className="text-xs bg-neutral-200 text-neutral-700 px-2 py-1 rounded">
                  {entry.partOfSpeech}
                </span>
              )}
              {entry.region && (
                <span className="text-xs bg-neutral-200 text-neutral-700 px-2 py-1 rounded">
                  {entry.region}
                </span>
              )}
            </div>

            {entry.definitions?.length > 0 && (
              <ol className="mt-6 space-y-4 list-decimal list-inside">
                {entry.definitions.map((def, i) => (
                  <li key={i} className="text-neutral-800">
                    <span>{def.text}</span>
                    {def.example && (
                      <p className="text-neutral-500 text-sm mt-1 ml-4 italic">{def.example}</p>
                    )}
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
