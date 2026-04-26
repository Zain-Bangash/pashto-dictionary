import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function DashboardQueue() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    api
      .get('/api/moderation/queue')
      .then((res) => {
        setEntries(res.data.data);
      })
      .catch(() => {
        setError('Failed to load queue');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (id, action) => {
    setActionError(null);
    try {
      await api.patch(`/api/moderation/${id}/${action}`, {});
      setEntries((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message || 'Action failed';
      setActionError(msg);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Moderation Queue</h1>
      {actionError && (
        <div className="mb-4 text-red-600">{actionError}</div>
      )}
      {entries.length === 0 ? (
        <p>No entries in the queue.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li key={entry._id} className="bg-white rounded shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{entry.pashto}</p>
                  <p className="text-sm text-gray-500">
                    {entry.definitions?.[0]?.text}
                  </p>
                  <p className="text-xs text-gray-400">
                    Submitted by: {entry.submittedBy?.username}
                  </p>
                </div>
                <div className="flex gap-2">
                  {entry.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(entry._id, 'approve')}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(entry._id, 'reject')}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {entry.status === 'approved' && user?.role === 'admin' && (
                    <button
                      onClick={() => handleAction(entry._id, 'publish')}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
