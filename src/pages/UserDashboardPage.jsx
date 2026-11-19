import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Star, Download, X, MessageCircle, ArrowRight, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import StarRating from '../components/ui/StarRating';
import { generatePDF, sendWhatsAppInvoice } from '../components/invoice/InvoiceGenerator';
import PayBookingModal from '../components/booking/PayBookingModal';
import ProfileTab from '../components/dashboard/ProfileTab';
import { sizedImage, handleImageError } from '../utils/image';
import { formatDay } from '../utils/dates';
import { PAYMENT_TONE, canCancel, canPayOnline, paymentStatus } from '../utils/payment';
import { paintFor, paintStyle, rupees } from '../theme/paints';
import Reveal from '../components/ui/Reveal';
import { BookingRowsSkeleton, GarageRingSkeleton } from '../components/ui/Skeletons';

const TABS = ['Overview', 'My Bookings', 'Profile'];

export default function UserDashboardPage() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState('');
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [reviewModal, setReviewModal] = useState(null);
  const [payBooking, setPayBooking] = useState(null);
  const [review, setReview] = useState({ rating: 5, reviewText: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [bookingFilter, setBookingFilter] = useState('All');
  const request = useRef(0);

  // Points shown in the header change with bookings, so start from a fresh profile
  useEffect(() => { refreshUser(); }, [refreshUser]);

  const fetchBookings = useCallback(async () => {
    const n = ++request.current;
    setBookingsError('');
    try {
      const { data } = await api.get('/bookings/my');
      if (n !== request.current) return;
      setBookings(data);
    } catch (err) {
      if (n !== request.current) return;
      setBookingsError(err.response?.data?.message || 'Could not load your bookings.');
    } finally {
      if (n === request.current) setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    return () => { request.current += 1; };
  }, [fetchBookings]);

  const retryBookings = () => {
    setLoadingBookings(true);
    fetchBookings();
  };

  const openCancel = (booking) => {
    setCancelError('');
    setCancelReason('');
    setCancelModal(booking);
  };

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      await api.patch(`/bookings/${cancelModal._id}/cancel`, { reason: cancelReason });
      toast.success(cancelModal.paymentCompleted ? 'Booking cancelled. Your payment has been refunded.' : 'Booking cancelled');
      setCancelModal(null);
      setCancelReason('');
      fetchBookings();
      refreshUser(); // loyalty points used on the booking come back
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Failed to cancel');
      fetchBookings();
    } finally {
      setCancelling(false);
    }
  };

  const handleReview = async () => {
    try {
      await api.post('/reviews', { bookingId: reviewModal._id, ...review });
      toast.success('Thanks for your review');
      setReviewModal(null);
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    }
  };

  const handlePaid = () => {
    setPayBooking(null);
    toast.success('Payment received');
    fetchBookings();
    refreshUser();
  };

  const filteredBookings = bookingFilter === 'All' ? bookings : bookings.filter(b => b.status === bookingFilter);
  const stats = {
    total: bookings.length,
    active: bookings.filter(b => b.status === 'Confirmed').length,
    completed: bookings.filter(b => b.status === 'Completed').length
  };

  const firstName = user?.name?.split(' ')[0] || 'Your';
  const points = user?.loyaltyPoints || 0;
  const garage = bookings.filter((b) => b.car && b.status !== 'Cancelled');

  const errorPanel = (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-chip border border-line p-6">
      <div>
        <p className="font-semibold">Could not load your bookings</p>
        <p className="mt-1 text-sm text-muted">{bookingsError}</p>
      </div>
      <button type="button" onClick={retryBookings} className="btn-ink">Try again</button>
    </div>
  );

  return (
    <div className="pt-[72px]">
      {/* Head */}
      <section className="border-b border-line">
        <div className="page-container pt-12 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display text-[clamp(2.6rem,6vw,5rem)]">{firstName}&apos;s garage</h1>
              <p className="mt-3 text-muted">{user?.email}</p>
            </div>
            <p className="max-w-xs text-right text-sm text-muted">
              <span className="block font-wide font-black text-3xl text-ink">{points.toLocaleString('en-IN')} pts</span>
              worth {rupees(Math.floor(points / 10))} off your next booking
            </p>
          </div>

          {/* Garage ring: one paint chip for every car you have booked */}
          <div className="mt-10">
            {loadingBookings ? (
              <GarageRingSkeleton />
            ) : bookingsError ? (
              errorPanel
            ) : garage.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-chip border border-dashed border-line p-6">
                <p className="text-muted">Your garage is empty. Every car you book parks a paint chip here.</p>
                <Link to="/fleet" className="btn-ink">Find a car <ArrowRight className="h-4 w-4" /></Link>
              </div>
            ) : (
              <Reveal as="ul" variant="deal" className="-mx-4 flex items-end gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Cars you have booked">
                {garage.map((b) => {
                  const p = paintFor(b.car.type);
                  const live = ['Pending', 'Confirmed'].includes(b.status);
                  return (
                    <li key={b._id}>
                      <button
                        type="button"
                        onClick={() => { setActiveTab('My Bookings'); setBookingFilter('All'); setTimeout(() => document.getElementById(`b-${b._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}
                        style={paintStyle(b.car.type)}
                        className={`lacquer flex w-44 flex-col justify-between rounded-t-[16px] px-4 pt-3 pb-4 text-left transition-transform hover:-translate-y-1 ${live ? 'h-32' : 'h-24 unlit'}`}
                      >
                        <span className="code-label text-[10px]">{b.status} · Paint {p.no}</span>
                        <span className="font-wide font-black uppercase leading-tight tracking-tight text-[13px]">{b.car.name}</span>
                      </button>
                    </li>
                  );
                })}
              </Reveal>
            )}
          </div>
        </div>
      </section>

      <div className="page-container py-10">
        {/* Tabs */}
        <div role="tablist" aria-label="Garage sections" className="mb-10 flex gap-6 border-b border-line">
          {TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors ${activeTab === tab ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {tab === 'Overview' ? 'Overview' : tab === 'My Bookings' ? `Bookings (${bookings.length})` : 'Profile'}
            </button>
          ))}
        </div>

        {activeTab === 'Overview' && (
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-8">
              <h2 className="font-wide font-black uppercase tracking-tight text-xl">Latest bookings</h2>
              {loadingBookings ? <div className="mt-5"><BookingRowsSkeleton /></div> : bookingsError ? <div className="mt-5">{errorPanel}</div> : bookings.length === 0 ? (
                <p className="mt-5 text-muted">No bookings yet.</p>
              ) : (
                <Reveal wrap className="mt-5 space-y-4">
                  {bookings.slice(0, 3).map((b) => (
                    <BookingRow key={b._id} booking={b} onCancel={openCancel} onReview={setReviewModal} onPay={setPayBooking} />
                  ))}
                </Reveal>
              )}
              {bookings.length > 3 && (
                <button type="button" onClick={() => setActiveTab('My Bookings')} className="btn-line mt-6">
                  All {bookings.length} bookings <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
            <aside className="lg:col-span-4">
              <dl className="divide-y divide-line rounded-chip border border-line">
                <div className="flex items-baseline justify-between p-5"><dt className="text-muted">Bookings</dt><dd className="font-wide font-black text-2xl">{stats.total}</dd></div>
                <div className="flex items-baseline justify-between p-5"><dt className="text-muted">On the road now</dt><dd className="font-wide font-black text-2xl">{stats.active}</dd></div>
                <div className="flex items-baseline justify-between p-5"><dt className="text-muted">Completed</dt><dd className="font-wide font-black text-2xl">{stats.completed}</dd></div>
              </dl>
              <div className="mt-6 rounded-chip border border-line p-5 text-sm">
                <p className="font-semibold">How loyalty points work</p>
                <ul className="mt-3 space-y-1.5 text-muted">
                  <li>Earn 1 point for every ₹100, added when a trip is completed.</li>
                  <li>10 points take ₹1 off at checkout.</li>
                  <li>Use points for up to half of a booking.</li>
                  <li>Cancel a booking and the points you used come back.</li>
                </ul>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'My Bookings' && (
          <div>
            <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter bookings by status">
              {['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'].map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={bookingFilter === f}
                  onClick={() => setBookingFilter(f)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${bookingFilter === f ? 'border-ink bg-ink text-ground' : 'border-line hover:border-ink'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            {loadingBookings ? <BookingRowsSkeleton count={4} /> : bookingsError ? errorPanel : filteredBookings.length === 0 ? (
              <p className="rounded-chip border border-dashed border-line p-12 text-center text-muted">No {bookingFilter === 'All' ? '' : bookingFilter.toLowerCase() + ' '}bookings.</p>
            ) : (
              <Reveal wrap className="space-y-4">
                {filteredBookings.map((b) => (
                  <BookingRow key={b._id} booking={b} onCancel={openCancel} onReview={setReviewModal} onPay={setPayBooking} full />
                ))}
              </Reveal>
            )}
          </div>
        )}

        {activeTab === 'Profile' && <ProfileTab />}
      </div>

      <Modal isOpen={!!cancelModal} onClose={() => !cancelling && setCancelModal(null)} title="Cancel booking">
        <p className="text-sm text-muted">
          Cancel booking <span className="font-semibold text-ink">{cancelModal?.invoiceNumber}</span> for the {cancelModal?.car?.name}? This cannot be undone.
        </p>
        {(cancelModal?.paymentCompleted || cancelModal?.loyaltyPointsUsed > 0) && (
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {cancelModal?.paymentCompleted && <li>Your payment of {rupees(cancelModal.paidAmount ?? cancelModal.totalAmount)} will be refunded.</li>}
            {cancelModal?.loyaltyPointsUsed > 0 && <li>The {cancelModal.loyaltyPointsUsed.toLocaleString('en-IN')} loyalty points you used come back to your account.</li>}
          </ul>
        )}
        <label className="mt-5 block">
          <span className="field-label">Reason (optional)</span>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} maxLength={300} className="field resize-none" />
        </label>
        {cancelError && <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger dark:text-[#F28B82]">{cancelError}</p>}
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => setCancelModal(null)} disabled={cancelling} className="flex-1">Keep booking</Button>
          <Button variant="danger" onClick={handleCancel} loading={cancelling} className="flex-1">Cancel booking</Button>
        </div>
      </Modal>

      <Modal isOpen={!!reviewModal} onClose={() => setReviewModal(null)} title="Review your drive">
        <p className="text-sm text-muted">How was the <span className="font-semibold text-ink">{reviewModal?.car?.name}</span>?</p>
        <div className="mt-5">
          <span className="field-label">Rating</span>
          <StarRating value={review.rating} onChange={(r) => setReview((p) => ({ ...p, rating: r }))} size="lg" />
        </div>
        <label className="mt-5 block">
          <span className="field-label">Your review</span>
          <textarea value={review.reviewText} onChange={(e) => setReview((p) => ({ ...p, reviewText: e.target.value }))} rows={4} maxLength={1000} placeholder="The car's condition, the pickup, how it drove…" className="field resize-none" />
        </label>
        <Button onClick={handleReview} className="mt-6 w-full !py-4">Post review</Button>
      </Modal>

      {/* Leaving the checkout re-reads the list, in case a failed payment means a booking has changed */}
      <PayBookingModal booking={payBooking} onClose={() => { setPayBooking(null); fetchBookings(); }} onPaid={handlePaid} />
    </div>
  );
}

const shortDate = (d) => formatDay(d);

function BookingRow({ booking, onCancel, onReview, onPay, full }) {
  const type = booking.car?.type;
  const p = paintFor(type);
  const live = ['Pending', 'Confirmed'].includes(booking.status);
  const money = paymentStatus(booking);
  const cancelled = booking.status === 'Cancelled';
  return (
    <article id={`b-${booking._id}`} className="scroll-mt-28 overflow-hidden rounded-chip border border-line bg-surface">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="relative h-20 w-full flex-shrink-0 overflow-hidden rounded-xl bg-ink/5 sm:w-32">
          <img
            src={sizedImage(booking.car?.images?.main, 320)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => handleImageError(e, 320)}
            className={`h-full w-full object-cover ${live ? '' : 'unlit'}`}
          />
          {type && <span className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: p.hex }} aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-wide font-black uppercase tracking-tight">{booking.car?.name || 'Car'}</h3>
            <Badge status={booking.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {booking.invoiceNumber}
            {full && ` · ${shortDate(booking.pickupDate)} to ${shortDate(booking.returnDate)}`}
            {full && booking.pickupLocation && ` · ${booking.pickupLocation}`}
          </p>
          <p className="mt-2 text-sm">
            <span className={`font-wide font-black text-base ${cancelled ? 'text-muted line-through decoration-2' : ''}`}>{rupees(booking.totalAmount)}</span>
            <span className={`ml-2 ${PAYMENT_TONE[money.tone]}`}>{money.label}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          {canPayOnline(booking) && onPay && (
            <button type="button" onClick={() => onPay(booking)} className="btn-ink !px-4 !py-2.5">
              <CreditCard className="h-4 w-4" /> Pay now
            </button>
          )}
          <button type="button" onClick={() => generatePDF(booking, booking.car)} className="btn-line !px-4 !py-2.5" aria-label={`Download invoice ${booking.invoiceNumber}`}>
            <Download className="h-4 w-4" /> Invoice
          </button>
          <button type="button" onClick={() => sendWhatsAppInvoice(booking, booking.car)} className="btn-line !px-4 !py-2.5">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
          {booking.status === 'Completed' && (
            <button type="button" onClick={() => onReview(booking)} className="btn-line !px-4 !py-2.5">
              <Star className="h-4 w-4" /> Review
            </button>
          )}
          {canCancel(booking) && (
            <button type="button" onClick={() => onCancel(booking)} className="btn-ghost !px-4 !py-2.5 text-danger hover:!bg-danger/10">
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
      </div>
    </article>
  );
}
