import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/layout/ScrollToTop';
import ServerWakeBanner from './components/layout/ServerWakeBanner';
import usePageSettle from './components/layout/usePageSettle';
import HomePage from './pages/HomePage';
import { RouteSkeleton } from './components/ui/Skeletons';
import { pageTitle } from './hooks/usePageTitle';

// Every page except the home page is loaded on demand, so the first visit
// downloads far less JavaScript (admin pages, PDF invoice code, etc. are split out).
const FleetPage = lazy(() => import('./pages/FleetPage'));
const CarDetailPage = lazy(() => import('./pages/CarDetailPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const BookingSuccessPage = lazy(() => import('./pages/BookingSuccessPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const UserDashboardPage = lazy(() => import('./pages/UserDashboardPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminCarsPage = lazy(() => import('./pages/admin/AdminCarsPage'));
const AdminBookingsPage = lazy(() => import('./pages/admin/AdminBookingsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminMessagesPage = lazy(() => import('./pages/admin/AdminMessagesPage'));
const AdminDiscountsPage = lazy(() => import('./pages/admin/AdminDiscountsPage'));

// While a page's code or the signed-in user is loading, show a skeleton shaped like that page
const PageLoader = RouteSkeleton;

// Per-route tab titles. Pages that know something better (a car's name) set it with usePageTitle.
const HOME_TITLE = typeof document !== 'undefined' ? document.title : 'Driveaway';
const ROUTE_TITLES = [
  [/^\/fleet\/?$/, 'Fleet'],
  [/^\/cars\/[^/]+\/?$/, 'Car'],
  [/^\/booking\/[^/]+\/?$/, 'Book a car'],
  [/^\/booking-success\/[^/]+\/?$/, 'Your booking'],
  [/^\/login\/?$/, 'Sign in'],
  [/^\/register\/?$/, 'Create an account'],
  [/^\/forgot-password\/?$/, 'Forgot password'],
  [/^\/reset-password\/[^/]+\/?$/, 'Choose a new password'],
  [/^\/dashboard\/?$/, 'My garage'],
  [/^\/about\/?$/, 'About'],
  [/^\/contact\/?$/, 'Contact'],
  [/^\/terms\/?$/, 'Rental terms'],
  [/^\/privacy\/?$/, 'Privacy'],
  [/^\/admin\/?$/, 'Admin overview'],
  [/^\/admin\/cars\/?$/, 'Admin fleet'],
  [/^\/admin\/bookings\/?$/, 'Admin bookings'],
  [/^\/admin\/users\/?$/, 'Admin customers'],
  [/^\/admin\/discounts\/?$/, 'Admin offers and alerts'],
  [/^\/admin\/messages\/?$/, 'Admin inquiries'],
];

const titleFor = (pathname) => {
  if (pathname === '/') return HOME_TITLE;
  const match = ROUTE_TITLES.find(([re]) => re.test(pathname));
  return pageTitle(match ? match[1] : 'Page not found');
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  // A layout effect runs before the pages' own (passive) usePageTitle effects, so theirs win
  useLayoutEffect(() => {
    document.title = titleFor(location.pathname);
  }, [location.pathname]);

  // Screen readers don't notice a client-side route change, so read the new page's title out.
  // Not on the first load (the browser announces that itself), and after a moment, so a page's own
  // title (a car's name) is in place first.
  const [routeAnnouncement, setRouteAnnouncement] = useState('');
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return undefined;
    }
    const t = setTimeout(() => setRouteAnnouncement(document.title), 600);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Each new page settles in. Keyed on the path only, so fleet filters (search params) don't replay
  // it; the admin panel keeps its sidebar still and settles its own content (AdminLayout).
  const mainRef = useRef(null);
  usePageSettle(mainRef, isAdminRoute ? '/admin' : location.pathname);

  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink dark:bg-ground ">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-ink focus:text-ground focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold"
      >
        Skip to content
      </a>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{routeAnnouncement}</p>
      <ScrollToTop />
      <ServerWakeBanner />
      {!isAdminRoute && <Navbar />}
      <main id="main" ref={mainRef} className="flex-grow">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/fleet" element={<FleetPage />} />
            <Route path="/cars/:id" element={<CarDetailPage />} />
            <Route path="/booking/:carId" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
            <Route path="/booking-success/:id" element={<ProtectedRoute><BookingSuccessPage /></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><UserDashboardPage /></ProtectedRoute>} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="cars" element={<AdminCarsPage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="discounts" element={<AdminDiscountsPage />} />
              <Route path="messages" element={<AdminMessagesPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  );
}
