import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Users</h1>
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u._id} className="bg-white rounded shadow p-4 flex justify-between">
              <div>
                <p className="font-medium">{u.username}</p>
                <p className="text-sm text-gray-500">{u.email}</p>
              </div>
              <span className="text-sm font-medium px-2 py-1 rounded bg-gray-100">
                {u.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
