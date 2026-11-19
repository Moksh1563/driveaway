import React, { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { LayoutDashboard, Car, Calendar, Users, MessageSquare, LogOut, PanelLeftClose, PanelLeftOpen, Home, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../../components/ui/ThemeToggle';
import Logo from '../../components/layout/Logo';
import IconSwap from '../../components/layout/IconSwap';
import usePageSettle from '../../components/layout/usePageSettle';
import { PAINTS, PAINT_ORDER } from '../../theme/paints';
import { SPRING } from '../../theme/motion';
import { AdminDashboardSkeleton, TableSkeleton } from '../../components/ui/Skeletons';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/cars', label: 'Fleet', icon: Car },
  { to: '/admin/bookings', label: 'Bookings', icon: Calendar },
  { to: '/admin/users', label: 'Customers', icon: Users },
  { to: '/admin/discounts', label: 'Offers and alerts', icon: Tag },
  { to: '/admin/messages', label: 'Inquiries', icon: MessageSquare },
];

// Collapse/expand: the rail's width snaps (animating it would reflow the whole content column, tables
// included, on every frame) while every icon stays exactly where it is (fixed 15px inset, centred in
// the 72px rail). The labels carry the motion: they fade out fast on collapse and fade back in a
// beat after the rail opens.
const labelFade = (collapsed) =>
  `whitespace-nowrap transition-opacity ${collapsed ? 'opacity-0 duration-150 ease-in' : 'opacity-100 duration-200 ease-out delay-100'}`;

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const contentRef = useRef(null);

  useEffect(() => {
    if (window.innerWidth < 1024) setCollapsed(true);
  }, [location.pathname]);

  // Each admin page settles into the content area; the sidebar stays still
  usePageSettle(contentRef, location.pathname);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-ground text-ink">
      <aside
        className={`${collapsed ? 'w-[72px]' : 'w-64'} sticky top-0 z-30 flex h-screen flex-shrink-0 flex-col overflow-hidden border-r border-line bg-surface`}
        aria-label="Admin navigation"
      >
        <div className="flex h-[72px] items-center justify-between border-b border-line px-4">
          {/* Clipped as the rail narrows; inert while collapsed so the hidden logo link takes no focus */}
          <div
            inert={collapsed ? '' : undefined}
            className={`-my-1.5 -ml-1.5 min-w-0 flex-1 overflow-hidden py-1.5 pl-1.5 ${labelFade(collapsed)}`}
          >
            <Logo to="/admin" sub="Admin" />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hit-area grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-ink/5 hover:text-ink active:scale-[0.96]"
          >
            <IconSwap swapKey={collapsed ? 'open' : 'close'} turn={0}>
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </IconSwap>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-xl px-[15px] py-2.5 text-sm font-semibold transition-colors duration-200 ease-out ${
                  isActive ? 'text-ground' : 'text-muted hover:bg-ink/5 hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* The ink highlight glides to the page you open (same spring as the site's nav underline) */}
                  {isActive && (
                    <m.span layoutId="admin-nav-active" transition={SPRING} className="absolute inset-0 rounded-xl bg-ink" aria-hidden="true" />
                  )}
                  <item.icon className="relative h-[18px] w-[18px] flex-shrink-0" />
                  <span className={`relative ${labelFade(collapsed)}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-line p-3">
          {/* The avatar stays on the rail when collapsed; the name and email fade with the labels */}
          <div title={collapsed ? user?.name : undefined} className="mb-2 flex items-center gap-3 rounded-xl px-[6px] py-2">
            <span className="lacquer grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-xs font-black">{user?.name?.charAt(0)}</span>
            <span className={`min-w-0 ${labelFade(collapsed)}`}>
              <span className="block truncate text-sm font-semibold">{user?.name}</span>
              <span className="block truncate text-xs text-muted">{user?.email}</span>
            </span>
          </div>
          <div className="flex items-center justify-between px-1 py-1">
            <span className={`min-w-0 flex-1 overflow-hidden text-xs text-muted ${labelFade(collapsed)}`}>Theme</span>
            <ThemeToggle />
          </div>
          <Link to="/" title={collapsed ? 'View website' : undefined} className="flex items-center gap-3 rounded-xl px-[15px] py-2.5 text-sm text-muted transition-colors duration-200 ease-out hover:bg-ink/5 hover:text-ink">
            <Home className="h-[18px] w-[18px] flex-shrink-0" />
            <span className={labelFade(collapsed)}>View website</span>
          </Link>
          <button type="button" onClick={handleLogout} title={collapsed ? 'Log out' : undefined} className="flex w-full items-center gap-3 rounded-xl px-[15px] py-2.5 text-sm text-danger transition-colors duration-200 ease-out hover:bg-danger/10">
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
            <span className={labelFade(collapsed)}>Log out</span>
          </button>
        </div>
        <div className="flex h-1.5" aria-hidden="true">
          {PAINT_ORDER.map((t) => <span key={t} className="flex-1" style={{ background: PAINTS[t].hex }} />)}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div ref={contentRef} className="mx-auto max-w-7xl p-5 sm:p-8">
          <Suspense fallback={location.pathname === '/admin' ? <AdminDashboardSkeleton /> : <TableSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
