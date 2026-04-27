import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard',         label: 'Overview', roles: ['moderator', 'admin'] },
  { to: '/dashboard/queue',   label: 'Queue',    roles: ['moderator', 'admin'] },
  { to: '/dashboard/concepts', label: 'Concepts', roles: ['moderator', 'admin'] },
  { to: '/dashboard/users',   label: 'Users',    roles: ['admin'] },
  { to: '/dashboard/log',     label: 'Log',      roles: ['admin'] },
];

export default function DashboardLayout({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
    return <Navigate to="/login" replace />;
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-charcoal flex">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-white/[0.06] flex flex-col pt-6 pb-8 px-3 gap-1">
        <p className="text-[10px] font-ui font-semibold text-muted uppercase tracking-widest px-3 mb-3">
          Dashboard
        </p>
        {visibleItems.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`px-3 py-2 rounded-[10px] text-sm font-ui transition-colors ${
                active
                  ? 'bg-white/[0.06] text-gold'
                  : 'text-muted hover:text-warm hover:bg-white/[0.03]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </aside>

      {/* Main content */}
      <main className="flex-1 px-8 py-8 overflow-y-auto">{children}</main>
    </div>
  );
}
