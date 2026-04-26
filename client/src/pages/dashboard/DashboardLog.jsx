import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function DashboardLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = user && user.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/moderation/log');
        if (!cancelled) setLogs(res.data.data);
      } catch {
        if (!cancelled) setError('Failed to load log');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>
      {logs.length === 0 ? (
        <p>No log entries found.</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log._id} className="bg-white rounded shadow p-4">
              <div className="flex justify-between">
                <div>
                  <p className="font-medium">{log.entry?.pashto}</p>
                  <p className="text-sm text-gray-500">
                    By: {log.performedBy?.username}
                  </p>
                  {log.note && (
                    <p className="text-sm text-gray-400">{log.note}</p>
                  )}
                </div>
                <span className="text-sm font-medium px-2 py-1 rounded bg-gray-100">
                  {log.action}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
