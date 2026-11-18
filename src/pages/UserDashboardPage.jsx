import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Download, X, MessageCircle, ArrowRight, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import StarRating from '../components/ui/StarRating';
import { generatePDF, sendWhatsAppInvoice } from '../components/invoice/InvoiceGenerator';
import RazorpayModal from '../components/payment/RazorpayModal';
import { sizedImage, handleImageError } from '../utils/image';
import { paintFor, paintStyle, rupees } from '../theme/paints';

const TABS = ['Overview', 'My Bookings', 'Profile'];

export default function UserDashboardPage() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [cancelModal, setCancelModal] = useState(null);
  const [reviewModal, setReviewModal] = useState(null);
  const [payBooking, setPayBooking] = useState(null);
  const [review, setReview] = useState({ rating: 5, reviewText: '' });
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    licenseNumber: user?.licenseNumber || '',
    drivingExperience: user?.drivingExperience || '',
    emergencyContact: user?.emergencyContact || '',
    emergencyPhone: user?.emergencyPhone || ''
  });
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [bookingFilter, setBookingFilter] = useState('All');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data } = await api.get('/bookings/my');
      setBookings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleCancel = async () => {
    try {
      await api.patch(`/bookings/${cancelModal._id}/cancel`, { reason: cancelReason });
      toast.success('Booking cancelled');
      setCancelModal(null);
      setCancelReason('');
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
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

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', profileForm);
      updateUser(data);
      toast.success('Details saved');
    } catch {
      toast.error('Could not save your details');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setSaving(true);
    try {
      await api.put('/auth/password', pwForm);
      toast.success('Password changed');
      setPwForm({ oldPassword: '', newPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
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
              <div className="flex gap-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 w-44 rounded-t-[16px] rounded-b-none" />)}</div>
            ) : garage.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-chip border border-dashed border-line p-6">
                <p className="text-muted">Your garage is empty. Every car you book parks a paint chip here.</p>
                <Link to="/fleet" className="btn-ink">Find a car <ArrowRight className="h-4 w-4" /></Link>
              </div>
            ) : (
              <ul className="-mx-4 flex items-end gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Cars you have booked">
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
              </ul>
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
              <div className="mt-5 space-y-4">
                {loadingBookings ? <Spinner /> : bookings.length === 0 ? (
                  <p className="text-muted">No bookings yet.</p>
                ) : bookings.slice(0, 3).map((b) => (
                  <BookingRow key={b._id} booking={b} onCancel={setCancelModal} onReview={setReviewModal} onPay={setPayBooking} />
                ))}
              </div>
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
                  <li>Earn 1 point for every ₹100 you spend.</li>
                  <li>10 points take ₹1 off at checkout.</li>
                  <li>Use points for up to half of a booking.</li>
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
            {loadingBookings ? <Spinner /> : filteredBookings.length === 0 ? (
              <p className="rounded-chip border border-dashed border-line p-12 text-center text-muted">No {bookingFilter === 'All' ? '' : bookingFilter.toLowerCase() + ' '}bookings.</p>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((b) => (
                  <BookingRow key={b._id} booking={b} onCancel={setCancelModal} onReview={setReviewModal} onPay={setPayBooking} full />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Profile' && (
          <div className="grid gap-10 lg:grid-cols-12">
            <form className="lg:col-span-7" onSubmit={(e) => { e.preventDefault(); handleProfileSave(); }}>
              <h2 className="font-wide font-black uppercase tracking-tight text-xl">Driver details</h2>
              <p className="mt-2 text-sm text-muted">Saved details pre-fill your next booking.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {Object.entries({
                  name: 'Full name',
                  phone: 'Phone',
                  licenseNumber: 'Driving licence number',
                  drivingExperience: 'Years of driving',
                  emergencyContact: 'Emergency contact',
                  emergencyPhone: 'Emergency phone',
                  address: 'Address',
                }).map(([key, label]) => (
                  <label key={key} className={`block ${key === 'address' ? 'sm:col-span-2' : ''}`}>
                    <span className="field-label">{label}</span>
                    <input
                      value={profileForm[key] || ''}
                      onChange={(e) => setProfileForm((p) => ({ ...p, [key]: e.target.value }))}
                      inputMode={key === 'drivingExperience' ? 'numeric' : undefined}
                      className="field"
                    />
                  </label>
                ))}
              </div>
              <Button type="submit" loading={saving} className="mt-6">Save details</Button>
            </form>

            <form className="lg:col-span-5" onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}>
              <h2 className="font-wide font-black uppercase tracking-tight text-xl">Password</h2>
              <p className="mt-2 text-sm text-muted">At least 8 characters, with a letter and a number.</p>
              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="field-label">Current password</span>
                  <input type="password" autoComplete="current-password" value={pwForm.oldPassword} onChange={(e) => setPwForm((p) => ({ ...p, oldPassword: e.target.value }))} className="field" />
                </label>
                <label className="block">
                  <span className="field-label">New password</span>
                  <input type="password" autoComplete="new-password" value={pwForm.newPassword} onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))} className="field" />
                </label>
              </div>
              <Button type="submit" variant="secondary" loading={saving} className="mt-6">Change password</Button>
            </form>
          </div>
        )}
      </div>

      <Modal isOpen={!!cancelModal} onClose={() => setCancelModal(null)} title="Cancel booking">
        <p className="text-sm text-muted">
          Cancel booking <span className="font-semibold text-ink">{cancelModal?.invoiceNumber}</span> for the {cancelModal?.car?.name}? This cannot be undone.
        </p>
        <label className="mt-5 block">
          <span className="field-label">Reason (optional)</span>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} maxLength={300} className="field resize-none" />
        </label>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => setCancelModal(null)} className="flex-1">Keep booking</Button>
          <Button variant="danger" onClick={handleCancel} className="flex-1">Cancel booking</Button>
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

      <RazorpayModal
        isOpen={!!payBooking}
        onClose={() => setPayBooking(null)}
        amount={payBooking?.totalAmount || 0}
        customerName={payBooking?.customerName || user?.name}
        customerEmail={payBooking?.customerEmail || user?.email}
        customerPhone={payBooking?.customerPhone || user?.phone}
        onPaymentSuccess={async (paymentData) => {
          try {
            await api.patch(`/bookings/${payBooking._id}/payment`, {
              paymentId: paymentData.paymentId,
              paymentMethod: paymentData.paymentMethod,
            });
            toast.success('Payment received');
            setPayBooking(null);
            fetchBookings();
          } catch {
            toast.error('Payment went through but we could not update the booking. Please contact us.');
          }
        }}
      />
    </div>
  );
}

const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function BookingRow({ booking, onCancel, onReview, onPay, full }) {
  const type = booking.car?.type;
  const p = paintFor(type);
  const live = ['Pending', 'Confirmed'].includes(booking.status);
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
            <span className="font-wide font-black text-base">{rupees(booking.totalAmount)}</span>
            <span className={`ml-2 ${booking.paymentCompleted ? 'text-ok' : 'text-warn'}`}>
              {booking.paymentCompleted ? 'Paid' : 'Pay at pickup'}
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          {!booking.paymentCompleted && booking.status !== 'Cancelled' && onPay && (
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
          {live && (
            <button type="button" onClick={() => onCancel(booking)} className="btn-ghost !px-4 !py-2.5 text-danger hover:!bg-danger/10">
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
      </div>
    </article>
  );
}
