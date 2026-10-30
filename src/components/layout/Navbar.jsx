/**
 * ============================================================================
 * MAIN APPLICATION NAVIGATION BAR
 * ============================================================================
 * Features:
 *  - Responsive desktop & mobile menus with blur backdrop
 *  - Dark / Light mode toggle
 *  - "Discount Alerts" shortcut modal launcher
 *  - Authenticated user dropdown (Dashboard, Admin Panel, Logout)
 *  - Login & Signup modal/navigation triggers
 */

import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Menu, X, User, LogOut, LayoutDashboard, ChevronDown, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ui/ThemeToggle';
import DiscountSubscribeModal from '../discounts/DiscountSubscribeModal';

export default function Navbar() {

  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);


  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/');
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/fleet', label: 'Fleet' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  const navLinkClass = ({ isActive }) =>
    `text-sm font-semibold transition-colors duration-200 relative group ${
      isActive
        ? 'text-amber-500'
        : 'text-gray-700 dark:text-gray-300 hover:text-amber-500 dark:hover:text-white'
    }`;

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 dark:bg-black/90 backdrop-blur-md shadow-sm dark:shadow-2xl border-b border-gray-200/80 dark:border-white/10'
          : 'bg-white/60 dark:bg-black/40 backdrop-blur-sm border-b border-gray-200/40 dark:border-white/5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center group-hover:bg-amber-400 transition-colors shadow-sm">
              <Car className="w-5 h-5 text-black" />
            </div>
            <div className="leading-none">
              <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">Drive</span>
              <span className="text-amber-500 font-bold text-lg tracking-tight">away</span>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-none -mt-0.5">Ahmedabad</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass} end={link.to === '/'}>
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-amber-500 transition-all duration-200 group-hover:w-full rounded-full" />
              </NavLink>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setDiscountModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-full transition-all shadow-xs"
              title="Get Discount Notifications"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discount Alerts</span>
            </button>
            <ThemeToggle />

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 border border-gray-200 dark:border-white/10 rounded-full px-3.5 py-1.5 text-gray-900 dark:text-white text-sm font-medium transition-all"
                >
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-black text-xs font-bold">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block">{user.name?.split(' ')[0]}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden py-1"
                    >
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-white/10">
                        <p className="text-gray-900 dark:text-white text-sm font-semibold truncate">{user.name}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs truncate">{user.email}</p>
                      </div>
                      {user.role === 'admin' && (
                        <Link
                          to="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-amber-600 dark:text-amber-400 hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium transition-colors"
                        >
                          <Shield className="w-4 h-4" /> Admin Panel
                        </Link>
                      )}
                      <Link
                        to="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-amber-500 text-sm transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-4 py-1.5 transition-colors shadow-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-gray-800 dark:text-white p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-gray-200 dark:border-white/10"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive ? 'bg-amber-500/10 text-amber-500' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <button
                onClick={() => { setMobileOpen(false); setDiscountModalOpen(true); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 my-2 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Get Discount Alerts & Promo Codes</span>
              </button>

              <div className="border-t border-gray-200 dark:border-white/10 pt-3 mt-3">
                {user ? (
                  <>
                    <div className="px-3 py-1 text-sm font-medium text-gray-500 dark:text-gray-400">{user.email}</div>
                    {user.role === 'admin' && (
                      <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-amber-500 text-sm font-semibold">
                        Admin Panel
                      </Link>
                    )}
                    <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-gray-700 dark:text-gray-300 text-sm">
                      Dashboard
                    </Link>
                    <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-red-500 text-sm font-medium">
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center py-2 border border-gray-300 dark:border-white/20 rounded-lg text-gray-800 dark:text-white text-sm font-semibold">Login</Link>
                    <Link to="/register" onClick={() => setMobileOpen(false)} className="flex-1 text-center py-2 bg-amber-500 rounded-lg text-black font-bold text-sm">Sign Up</Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      </nav>
      {/* Discount Subscribe Modal */}
      <DiscountSubscribeModal
        isOpen={discountModalOpen}
        onClose={() => setDiscountModalOpen(false)}
      />
    </>
  );
}

