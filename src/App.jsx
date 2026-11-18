import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/layout/ScrollToTop';
import Spinner from './components/ui/Spinner';
import HomePage from './pages/HomePage';

// Every page except the home page is loaded on demand, so the first visit
// downloads far less JavaScript (admin pages, PDF invoice code, etc. are split out).
const FleetPage = lazy(() => import('./pages/FleetPage'));
const CarDetailPage = lazy(() => import('./pages/CarDetailPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const BookingSuccessPage = lazy(() => import('./pages/BookingSuccessPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const UserDashboardPage = lazy(() => import('./pages/UserDashboardPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminCarsPage = lazy(() => import('./pages/admin/AdminCarsPage'));
const AdminBookingsPage = lazy(() => import('./pages/admin/AdminBookingsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminMessagesPage = lazy(() => import('./pages/admin/AdminMessagesPage'));
const AdminDiscountsPage = lazy(() => import('./pages/admin/AdminDiscountsPage'));

const PageLoader = () => (
  <div className="min-h-[70vh] flex items-center justify-center" role="status" aria-live="polite">
    <Spinner size="lg" />
    <span className="sr-only">Loading…</span>
  </div>
);

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

  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink dark:bg-ground ">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-ink focus:text-ground focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold"
      >
        Skip to content
      </a>
      <ScrollToTop />
      {!isAdminRoute && <Navbar />}
      <main id="main" className="flex-grow">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/fleet" element={<FleetPage />} />
            <Route path="/cars/:id" element={<CarDetailPage />} />
            <Route path="/booking/:carId" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
            <Route path="/booking-success/:id" element={<ProtectedRoute><BookingSuccessPage /></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><UserDashboardPage /></ProtectedRoute>} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />

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
