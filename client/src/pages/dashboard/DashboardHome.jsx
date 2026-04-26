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

  if (loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error) return <div className="text-red-400 font-ui text-sm">{error}</div>;

  const statCards = [
    { label: 'Pending',   value: stats?.pending ?? 0,   color: '#e8c547' },
    { label: 'Approved',  value: stats?.approved ?? 0,  color: '#00f5b4' },
    { label: 'Rejected',  value: stats?.rejected ?? 0,  color: '#f87171' },
    { label: 'Published', value: stats?.published ?? 0, color: '#a78bfa' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-8">Overview</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5"
          >
            <p className="meta-label mb-2">{label}</p>
            <p className="text-3xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
