import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardStatsContext } from '../../context/dashboardStatsValue';
import useStatsLoader from '../../hooks/useStatsLoader';
import { waitingTotal } from '../../utils/queueCounts';

const NAV_ITEMS = [
  { to: '/dashboard',          label: 'Overview', roles: ['moderator', 'admin'] },
  { to: '/dashboard/queue',    label: 'Queue',    roles: ['moderator', 'admin'], badge: true },
  { to: '/dashboard/concepts', label: 'Concepts', roles: ['moderator', 'admin'] },
  { to: '/dashboard/users',    label: 'Users',    roles: ['admin'] },
  { to: '/dashboard/log',      label: 'Log',      roles: ['admin'] },
  { to: '/dashboard/lists',    label: 'Lists',    roles: ['admin'] },
  { to: '/dashboard/fields',   label: 'Fields',   roles: ['admin'] },
];

// Stats are loaded once here and shared, so the Queue badge, the Overview and the queue tabs agree and refresh together
export default function DashboardLayout({ children }) {
  const { user, initializing } = useAuth();
  const { pathname } = useLocation();
  const isStaff = user?.role === 'moderator' || user?.role === 'admin';
  const stats = useStatsLoader(!initializing && isStaff);

  if (initializing) return null;
  if (!isStaff) return <Navigate to="/login" replace />;

  const waiting = waitingTotal(stats.stats, user.role === 'admin');
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <DashboardStatsContext.Provider value={stats}>
      <div className="min-h-screen bg-charcoal md:flex">
        {/* A row of tabs on phones, a sidebar from md up */}
        <aside className="md:w-52 shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06] md:pt-6 md:pb-8 md:px-3">
          <p className="hidden md:block text-[10px] font-ui font-semibold text-muted uppercase tracking-widest px-3 mb-3">
            Dashboard
          </p>
          <nav aria-label="Dashboard" className="flex md:flex-col gap-1 overflow-x-auto px-4 py-2 md:p-0">
            {visibleItems.map((item) => {
              const active = item.to === '/dashboard' ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 flex items-center justify-between gap-2 px-3 py-2 rounded-[10px] text-sm font-ui transition-colors ${
                    active ? 'bg-white/[0.06] text-gold' : 'text-muted hover:text-warm hover:bg-white/[0.03]'
                  }`}
                >
                  {item.label}
                  {item.badge && waiting > 0 && (
                    <span className="min-w-[1.25rem] text-center text-[10px] font-semibold text-charcoal bg-gold rounded-full px-1.5 py-0.5" aria-label={`${waiting} waiting`}>
                      {waiting}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 px-4 sm:px-6 md:px-8 py-6 md:py-8">{children}</main>
      </div>
    </DashboardStatsContext.Provider>
  );
}
