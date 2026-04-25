import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const STATUS_CLASSES = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  published: 'bg-blue-100 text-blue-800',
};

export default function MySubmissions() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/entries/my-submissions')
      .then((res) => {
        setEntries(res.data.data);
      })
      .catch(() => {
        setError('Failed to load submissions');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4">Loading...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Submissions</h1>
        <Link to="/submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Submit New Entry
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500">No submissions yet.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li key={entry._id} className="border rounded p-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{entry.pashto}</span>
                <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_CLASSES[entry.status] ?? ''}`}>
                  {entry.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {entry.definitions?.[0]?.text}
              </p>
              {entry.status === 'rejected' && entry.moderatorNote && (
                <p className="text-sm text-red-600 mt-2">Note: {entry.moderatorNote}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
