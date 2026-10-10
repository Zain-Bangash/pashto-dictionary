import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { changeUserRole } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useUsers from '../../hooks/useUsers';
import Pagination from '../../components/Pagination';
import RoleChangeDialog from '../../components/users/RoleChangeDialog';

const ROLE_COLORS = {
  admin:     { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)' },
  moderator: { color: '#00f5b4', bg: 'rgba(0,245,180,0.08)',   border: 'rgba(0,245,180,0.3)' },
  user:      { color: '#555555', bg: 'rgba(85,85,85,0.08)',     border: 'rgba(85,85,85,0.3)' },
};

const ROLE_BTN = 'px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] hover:text-warm transition-colors';

export default function DashboardUsers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [page, setPage] = useState(1);
  const { users, totalPages, loading, error, replaceUser } = useUsers(isAdmin ? page : null);
  const [pending, setPending]     = useState(null); // { target, nextRole }
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const openDialog = (target, nextRole) => {
    setSaveError(null);
    setPending({ target, nextRole });
  };

  const confirmChange = async (note) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await changeUserRole(pending.target._id, { role: pending.nextRole, ...(note && { note }) });
      replaceUser(res.data.data);
      setPending(null);
    } catch (err) {
      setSaveError(err.response?.data?.error?.message || 'Failed to change role');
    } finally {
      setSaving(false);
    }
  };

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
            const changeable = u.role !== 'admin' && String(u._id) !== String(user.id);
            return (
              <li key={u._id} className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-ui font-medium text-warm">{u.username}</p>
                  <p className="text-xs font-ui text-muted truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {changeable && u.role === 'user' && (
                    <button onClick={() => openDialog(u, 'moderator')} className={ROLE_BTN}>Make moderator</button>
                  )}
                  {changeable && u.role === 'moderator' && (
                    <button onClick={() => openDialog(u, 'user')} className={ROLE_BTN}>Remove moderator</button>
                  )}
                  <span
                    className="text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
                    style={{ color: r.color, background: r.bg, border: `1px solid ${r.border}` }}
                  >
                    {u.role}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      {pending && (
        <RoleChangeDialog
          target={pending.target}
          nextRole={pending.nextRole}
          saving={saving}
          error={saveError}
          onConfirm={confirmChange}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
