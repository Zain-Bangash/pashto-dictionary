import { useState, useEffect } from 'react';
import { getUsers } from '../services/api';

// page = null skips the request (non-admins are redirected before anything renders).
// loading is derived: the stored result belongs to an older request until its key matches.
export default function useUsers(page, limit = 20) {
  const [result, setResult] = useState({ key: null, users: [], total: 0, error: null });
  const key = `${page}|${limit}`;

  useEffect(() => {
    if (page == null) return undefined;
    let cancelled = false;
    getUsers({ page, limit })
      .then((res) => {
        if (!cancelled) setResult({ key, users: res.data.data, total: res.data.meta?.total ?? 0, error: null });
      })
      .catch(() => { if (!cancelled) setResult((r) => ({ ...r, key, error: 'Failed to load users' })); });
    return () => { cancelled = true; };
  }, [key, page, limit]);

  const replaceUser = (updated) =>
    setResult((r) => ({ ...r, users: r.users.map((u) => (u._id === updated._id ? { ...u, ...updated } : u)) }));

  const loading = result.key !== key;
  return {
    users: result.users,
    totalPages: Math.max(1, Math.ceil(result.total / limit)),
    loading,
    error: loading ? null : result.error,
    replaceUser,
  };
}
