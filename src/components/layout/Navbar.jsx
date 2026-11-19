import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { Menu, X, LogOut, LayoutDashboard, ChevronDown, Shield, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import Logo from './Logo';
import IconSwap from './IconSwap';
import DiscountSubscribeModal from '../discounts/DiscountSubscribeModal';
import { EASE, menuMotion, SPRING } from '../../theme/motion';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/fleet', label: 'Fleet' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

// Mobile menu: the panel drops in under the bar (panelMotion's clock) and its rows follow in a brief
// cascade; closing takes everything out together, faster.
const mobilePanel = {
  hidden: { opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE.in } },
  shown: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE.out, delayChildren: 0.03, staggerChildren: 0.03 } },
};
const mobileRow = {
  hidden: { opacity: 0, y: -8, transition: { duration: 0.12, ease: EASE.in } },
  shown: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE.out } },
};

// Pill controls in the bar: border answers hover, the pill gives a little under the press (the
// round icon button a touch more)
const pressable = 'transition-[border-color,transform] duration-150 ease-out active:scale-[0.98]';
const iconPressable = 'transition-[border-color,transform] duration-150 ease-out active:scale-[0.96]';

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
    `relative px-1 py-2 text-sm font-semibold transition-colors duration-200 ease-out ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;

  const raised = scrolled || mobileOpen;

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 bg-ground border-b transition-[border-color] duration-300 ease-out ${
          raised ? 'border-line' : 'border-transparent'
        }`}
      >
        {/* The soft shadow lives on its own layer and fades in by opacity, so scrolling never repaints a shadow */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 shadow-soft transition-opacity duration-300 ease-out ${
            raised ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <nav className="page-container h-[72px] flex items-center justify-between gap-6" aria-label="Main">
          <Logo />

          <div className="hidden md:flex items-center gap-7">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={linkClass}>
                {({ isActive }) => (
                  <>
                    {l.label}
                    {isActive && (
                      <m.span
                        layoutId="nav-underline"
                        className="absolute left-1 right-1 -bottom-0.5 h-[3px] rounded-full bg-paint"
                        transition={SPRING}
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
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line text-sm font-semibold hover:border-ink ${pressable}`}
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
                  className={`inline-flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-full border border-line hover:border-ink ${pressable}`}
                >
                  <span className="lacquer w-7 h-7 rounded-full grid place-items-center text-xs font-black">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold">{user.name?.split(' ')[0]}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ease-out ${menuOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <m.div
                      role="menu"
                      {...menuMotion}
                      style={{ transformOrigin: 'top right' }}
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
                    </m.div>
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
              className={`w-10 h-10 grid place-items-center rounded-full border border-line ${iconPressable}`}
            >
              <IconSwap swapKey={mobileOpen ? 'close' : 'open'}>
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </IconSwap>
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {mobileOpen && (
            <m.div
              variants={mobilePanel}
              initial="hidden"
              animate="shown"
              exit="hidden"
              className="md:hidden overflow-hidden border-t border-line bg-ground"
            >
              <div className="page-container py-5 space-y-1">
                {LINKS.map((l) => (
                  <m.div key={l.to} variants={mobileRow}>
                    <NavLink
                      to={l.to}
                      end={l.to === '/'}
                      className={({ isActive }) =>
                        `block py-2.5 font-wide font-black uppercase text-2xl tracking-tight ${isActive ? 'text-ink' : 'text-muted'}`
                      }
                    >
                      {l.label}
                    </NavLink>
                  </m.div>
                ))}
                <m.div variants={mobileRow} className="pt-4 grid gap-2">
                  {/* The menu stays open behind the dialog, so closing it returns focus to this button */}
                  <button type="button" onClick={() => setDiscountOpen(true)} className="btn-line w-full">
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
                </m.div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </header>
      <DiscountSubscribeModal isOpen={discountOpen} onClose={() => setDiscountOpen(false)} />
    </>
  );
}
