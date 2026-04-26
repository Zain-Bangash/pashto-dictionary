import { useState, useEffect } from 'react';
import api from '../../services/api';

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected', 'published'];

const STATUS_LABELS = {
  all: 'All',
  pending: 'Awaiting Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

export default function DashboardEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('all');

  const fetchEntries = (statusFilter) => {
    setLoading(true);
    setError(null);
    const url =
      statusFilter && statusFilter !== 'all'
        ? `/api/entries?status=${statusFilter}`
        : '/api/entries';
    api
      .get(url)
      .then((res) => {
        setEntries(res.data.data);
      })
      .catch(() => {
        setError('Failed to load entries');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEntries(status);
  }, [status]);

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">All Entries</h1>
      <div className="mb-4">
        <label htmlFor="status-filter" className="mr-2 text-sm font-medium">
          Filter by status:
        </label>
        <select
          id="status-filter"
          name="status"
          aria-label="Status"
          value={status}
          onChange={handleStatusChange}
          className="border rounded px-2 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {entries.length === 0 ? (
        <p>No entries found.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry._id} className="bg-white rounded shadow p-4 flex justify-between">
              <div>
                <p className="text-lg font-bold">{entry.pashto}</p>
                <p className="text-sm text-gray-500">
                  {entry.definitions?.[0]?.text}
                </p>
              </div>
              <span className="text-sm font-medium px-2 py-1 rounded bg-gray-100" data-testid="status-badge">
                {entry.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
