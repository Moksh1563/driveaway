import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Car, Calendar, Users, MessageSquare, LogOut, PanelLeftClose, PanelLeftOpen, Home, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../../components/ui/ThemeToggle';
import Logo from '../../components/layout/Logo';
import { PAINTS, PAINT_ORDER } from '../../theme/paints';
import { AdminDashboardSkeleton, TableSkeleton } from '../../components/ui/Skeletons';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/cars', label: 'Fleet', icon: Car },
  { to: '/admin/bookings', label: 'Bookings', icon: Calendar },
  { to: '/admin/users', label: 'Customers', icon: Users },
  { to: '/admin/discounts', label: 'Offers and alerts', icon: Tag },
  { to: '/admin/messages', label: 'Inquiries', icon: MessageSquare },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);

  useEffect(() => {
    if (window.innerWidth < 1024) setCollapsed(true);
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-ground text-ink">
      <aside
        className={`${collapsed ? 'w-[72px]' : 'w-64'} sticky top-0 z-30 flex h-screen flex-shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-300 ease-out`}
        aria-label="Admin navigation"
      >
        <div className={`flex h-[72px] items-center border-b border-line ${collapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!collapsed && <Logo to="/admin" sub="Admin" />}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hit-area grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-colors ${collapsed ? 'justify-center px-0' : 'px-3.5'} ${
                  isActive ? 'bg-ink text-ground' : 'text-muted hover:bg-ink/5 hover:text-ink'
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-line p-3">
          {!collapsed && (
            <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="lacquer grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-xs font-black">{user?.name?.charAt(0)}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user?.name}</span>
                <span className="block truncate text-xs text-muted">{user?.email}</span>
              </span>
            </div>
          )}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between px-2'} py-1`}>
            {!collapsed && <span className="text-xs text-muted">Theme</span>}
            <ThemeToggle />
          </div>
          <Link to="/" title={collapsed ? 'View website' : undefined} className={`flex items-center gap-3 rounded-xl py-2.5 text-sm text-muted hover:bg-ink/5 hover:text-ink ${collapsed ? 'justify-center' : 'px-3.5'}`}>
            <Home className="h-[18px] w-[18px] flex-shrink-0" />
            {!collapsed && <span>View website</span>}
          </Link>
          <button type="button" onClick={handleLogout} title={collapsed ? 'Log out' : undefined} className={`flex w-full items-center gap-3 rounded-xl py-2.5 text-sm text-danger hover:bg-danger/10 ${collapsed ? 'justify-center' : 'px-3.5'}`}>
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
        <div className="flex h-1.5" aria-hidden="true">
          {PAINT_ORDER.map((t) => <span key={t} className="flex-1" style={{ background: PAINTS[t].hex }} />)}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl p-5 sm:p-8">
          <Suspense fallback={location.pathname === '/admin' ? <AdminDashboardSkeleton /> : <TableSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
