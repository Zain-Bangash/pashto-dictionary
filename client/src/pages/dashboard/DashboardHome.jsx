import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function DashboardHome() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/api/moderation/stats')
      .then((res) => {
        setStats(res.data.data);
      })
      .catch(() => {
        setError('Failed to load stats');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="bg-white rounded shadow p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-3xl font-bold">{stats?.pending ?? 0}</p>
        </div>
        <div className="bg-white rounded shadow p-4">
          <p className="text-sm text-gray-500">Approved</p>
          <p className="text-3xl font-bold">{stats?.approved ?? 0}</p>
        </div>
        <div className="bg-white rounded shadow p-4">
          <p className="text-sm text-gray-500">Rejected</p>
          <p className="text-3xl font-bold">{stats?.rejected ?? 0}</p>
        </div>
        <div className="bg-white rounded shadow p-4">
          <p className="text-sm text-gray-500">Published</p>
          <p className="text-3xl font-bold">{stats?.published ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
