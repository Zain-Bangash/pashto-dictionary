import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function DashboardLayout({ children }) {
  const { user } = useAuth();

  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex gap-6">
          <span className="font-bold text-gray-800">Dashboard</span>
          <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
            Overview
          </Link>
          <Link to="/dashboard/queue" className="text-gray-600 hover:text-gray-900">
            Queue
          </Link>
          <Link to="/dashboard/entries" className="text-gray-600 hover:text-gray-900">
            Entries
          </Link>
          {isAdmin && (
            <Link to="/dashboard/users" className="text-gray-600 hover:text-gray-900">
              Users
            </Link>
          )}
          {isAdmin && (
            <Link to="/dashboard/log" className="text-gray-600 hover:text-gray-900">
              Log
            </Link>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
