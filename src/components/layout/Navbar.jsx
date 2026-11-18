import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, LogOut, LayoutDashboard, ChevronDown, Shield, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import Logo from './Logo';
import DiscountSubscribeModal from '../discounts/DiscountSubscribeModal';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/fleet', label: 'Fleet' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on navigation and on outside click
  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const linkClass = ({ isActive }) =>
    `relative px-1 py-2 text-sm font-semibold transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 bg-ground border-b transition-[border-color,box-shadow] duration-300 ${
          scrolled || mobileOpen ? 'border-line shadow-soft' : 'border-transparent'
        }`}
      >
        <nav className="page-container h-[72px] flex items-center justify-between gap-6" aria-label="Main">
          <Logo />

          <div className="hidden md:flex items-center gap-7">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={linkClass}>
                {({ isActive }) => (
                  <>
                    {l.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute left-1 right-1 -bottom-0.5 h-[3px] rounded-full bg-paint"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDiscountOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line text-sm font-semibold hover:border-ink transition-colors"
            >
              <Tag className="w-4 h-4" /> Offers
            </button>
            <ThemeToggle />

            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="inline-flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-full border border-line hover:border-ink transition-colors"
                >
                  <span className="lacquer w-7 h-7 rounded-full grid place-items-center text-xs font-black">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold">{user.name?.split(' ')[0]}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-surface shadow-lift p-1.5"
                    >
                      <div className="px-3 py-2.5 border-b border-line mb-1">
                        <p className="font-semibold text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted truncate">{user.email}</p>
                      </div>
                      {user.role === 'admin' && (
                        <Link role="menuitem" to="/admin" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-ink/5">
                          <Shield className="w-4 h-4" /> Admin panel
                        </Link>
                      )}
                      <Link role="menuitem" to="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-ink/5">
                        <LayoutDashboard className="w-4 h-4" /> My garage
                      </Link>
                      <button role="menuitem" type="button" onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-danger hover:bg-danger/10 text-left">
                        <LogOut className="w-4 h-4" /> Log out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-ghost !py-2.5">Log in</Link>
                <Link to="/register" className="btn-ink !py-2.5">Sign up</Link>
              </>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="w-10 h-10 grid place-items-center rounded-full border border-line"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden overflow-hidden border-t border-line bg-ground"
            >
              <div className="page-container py-5 space-y-1">
                {LINKS.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.to === '/'}
                    className={({ isActive }) =>
                      `block py-2.5 font-wide font-black uppercase text-2xl tracking-tight ${isActive ? 'text-ink' : 'text-muted'}`
                    }
                  >
                    {l.label}
                  </NavLink>
                ))}
                <div className="pt-4 grid gap-2">
                  <button type="button" onClick={() => { setMobileOpen(false); setDiscountOpen(true); }} className="btn-line w-full">
                    <Tag className="w-4 h-4" /> Get offers and promo codes
                  </button>
                  {user ? (
                    <>
                      {user.role === 'admin' && <Link to="/admin" className="btn-line w-full"><Shield className="w-4 h-4" /> Admin panel</Link>}
                      <Link to="/dashboard" className="btn-ink w-full"><LayoutDashboard className="w-4 h-4" /> My garage</Link>
                      <button type="button" onClick={handleLogout} className="btn-ghost w-full text-danger">Log out</button>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Link to="/login" className="btn-line">Log in</Link>
                      <Link to="/register" className="btn-ink">Sign up</Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <DiscountSubscribeModal isOpen={discountOpen} onClose={() => setDiscountOpen(false)} />
    </>
  );
}
