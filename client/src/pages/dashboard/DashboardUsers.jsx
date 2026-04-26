import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ROLE_COLORS = {
  admin:     { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)' },
  moderator: { color: '#00f5b4', bg: 'rgba(0,245,180,0.08)',   border: 'rgba(0,245,180,0.3)' },
  user:      { color: '#555555', bg: 'rgba(85,85,85,0.08)',     border: 'rgba(85,85,85,0.3)' },
};

export default function DashboardUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = user && user.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get('/api/users')
      .then((res) => {
        setUsers(res.data.data);
      })
      .catch(() => {
        setError('Failed to load users');
      })
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error) return <div className="text-red-400 font-ui text-sm">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">Users</h1>
      {users.length === 0 ? (
        <p className="text-muted font-ui text-sm">No users found.</p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => {
            const r = ROLE_COLORS[u.role] ?? ROLE_COLORS.user;
            return (
              <li key={u._id} className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-4 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-ui font-medium text-warm">{u.username}</p>
                  <p className="text-xs font-ui text-muted">{u.email}</p>
                </div>
                <span
                  className="shrink-0 text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
                  style={{ color: r.color, background: r.bg, border: `1px solid ${r.border}` }}
                >
                  {u.role}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
