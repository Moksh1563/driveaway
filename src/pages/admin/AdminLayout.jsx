import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Car, Calendar, Users, MessageSquare, LogOut, Menu, X, Home, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../../components/ui/ThemeToggle';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/cars', label: 'Cars Fleet', icon: Car },
  { to: '/admin/bookings', label: 'Bookings', icon: Calendar },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/discounts', label: 'Discounts & Alerts', icon: Tag },
  { to: '/admin/messages', label: 'Inquiries', icon: MessageSquare },
];


export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] text-gray-900 dark:text-white flex transition-colors">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-18' : 'w-60'} flex-shrink-0 bg-white dark:bg-[#0A0A0A] border-r border-gray-200 dark:border-white/[0.06] flex flex-col transition-all duration-300 sticky top-0 h-screen z-30`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-100 dark:border-white/[0.06] flex items-center justify-between">
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
                <Car className="w-4 h-4 text-black" />
              </div>
              <div>
                <span className="text-gray-900 dark:text-white font-bold text-base">Drive<span className="text-amber-500">away</span></span>
                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded ml-1.5">ADMIN</span>
              </div>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User & Actions */}
        <div className="p-3 border-t border-gray-100 dark:border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between px-2">
            {!collapsed && <span className="text-xs text-gray-500 font-medium">Theme</span>}
            <ThemeToggle />
          </div>

          {!collapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
              <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-black text-xs font-black flex-shrink-0">
                {user?.name?.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-xs font-bold truncate">{user?.name}</p>
                <p className="text-gray-500 text-[10px] truncate">{user?.email}</p>
              </div>
            </div>
          )}

          <Link
            to="/"
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-amber-500 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>View Main Website</span>}
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-[#0D0D0D]">
        <div className="p-6 sm:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
