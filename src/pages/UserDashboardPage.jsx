import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, Star, Download, X, ChevronRight, Gift, Eye, CheckCircle2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageWrapper from '../components/layout/PageWrapper';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import StarRating from '../components/ui/StarRating';
import { generatePDF, sendWhatsAppInvoice } from '../components/invoice/InvoiceGenerator';
import RazorpayModal from '../components/payment/RazorpayModal';

const inputClass = 'w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-400 dark:placeholder-gray-500 shadow-xs transition-all';

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
      toast.success('Review submitted! Thank you 🌟');
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
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setSaving(true);
    try {
      await api.put('/auth/password', pwForm);
      toast.success('Password changed!');
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

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] text-gray-900 dark:text-white pt-20 pb-16 transition-colors">
        <div className="max-w-5xl mx-auto px-4">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-gray-900 dark:text-white text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{user?.email}</p>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-1.5 bg-gray-200 dark:bg-white/5 rounded-2xl p-1.5 mb-8 w-fit shadow-xs">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {activeTab === 'Overview' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                  { label: 'Total Bookings', value: stats.total, icon: Calendar, color: 'text-blue-500' },
                  { label: 'Active Rentals', value: stats.active, icon: ChevronRight, color: 'text-green-500' },
                  { label: 'Loyalty Points', value: user?.loyaltyPoints || 0, icon: Gift, color: 'text-amber-500' },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm">
                    <div className={`${s.color} mb-3`}><s.icon className="w-6 h-6" /></div>
                    <div className="text-gray-900 dark:text-white text-3xl font-black">{s.value.toLocaleString('en-IN')}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mt-1">{s.label}</div>
                    {s.label === 'Loyalty Points' && (
                      <div className="text-amber-600 dark:text-amber-400 text-xs font-bold mt-2">
                        = ₹{((user?.loyaltyPoints || 0) / 10).toFixed(0)} discount value
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <h2 className="text-gray-900 dark:text-white font-extrabold text-xl mb-4">Recent Bookings</h2>
                <div className="space-y-4">
                  {bookings.slice(0, 3).map(b => (
                    <BookingRow key={b._id} booking={b} onCancel={setCancelModal} onReview={setReviewModal} onPay={setPayBooking} />
                  ))}
                </div>
                {bookings.length > 3 && (
                  <button onClick={() => setActiveTab('My Bookings')} className="text-amber-500 font-bold text-sm mt-4 hover:text-amber-400">
                    View all bookings →
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* MY BOOKINGS */}
          {activeTab === 'My Bookings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="flex flex-wrap gap-2 mb-4">
                {['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'].map(f => (
                  <button
                    key={f}
                    onClick={() => setBookingFilter(f)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      bookingFilter === f
                        ? 'bg-amber-500 border-amber-500 text-black shadow-sm'
                        : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-amber-500'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {loadingBookings ? (
                <Spinner />
              ) : filteredBookings.length === 0 ? (
                <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-12 text-center text-gray-500 shadow-sm">
                  No bookings found in this category.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBookings.map(b => (
                    <BookingRow key={b._id} booking={b} onCancel={setCancelModal} onReview={setReviewModal} onPay={setPayBooking} full />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* PROFILE */}
          {activeTab === 'Profile' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
                <h2 className="text-gray-900 dark:text-white font-extrabold text-lg">Edit Personal Profile</h2>
                {Object.entries({
                  name: 'Full Name',
                  phone: 'Phone Number',
                  address: 'Current Address',
                  licenseNumber: 'Driving License Number',
                  drivingExperience: 'Driving Experience (Years)',
                  emergencyContact: 'Emergency Contact Person',
                  emergencyPhone: 'Emergency Phone'
                }).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">{label}</label>
                    <input
                      value={profileForm[key] || ''}
                      onChange={e => setProfileForm(p => ({ ...p, [key]: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                ))}
                <Button onClick={handleProfileSave} loading={saving} className="w-full font-bold" size="lg">
                  Save Changes
                </Button>
              </div>

              <div className="space-y-6">
                <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
                  <h2 className="text-gray-900 dark:text-white font-extrabold text-lg">Change Password</h2>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Current Password</label>
                    <input
                      type="password"
                      value={pwForm.oldPassword}
                      onChange={e => setPwForm(p => ({ ...p, oldPassword: e.target.value }))}
                      className={inputClass}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">New Password</label>
                    <input
                      type="password"
                      value={pwForm.newPassword}
                      onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                      className={inputClass}
                      placeholder="••••••••"
                    />
                  </div>
                  <Button onClick={handlePasswordChange} loading={saving} variant="secondary" className="w-full font-bold" size="lg">
                    Update Password
                  </Button>
                </div>

                <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Gift className="w-8 h-8 text-amber-500" />
                    <div>
                      <div className="text-gray-900 dark:text-white font-black text-2xl">{user?.loyaltyPoints || 0}</div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Loyalty Points Available</div>
                    </div>
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 text-xs space-y-1.5 font-medium">
                    <p>• Earn 1 point per ₹100 spent on any booking</p>
                    <p>• 10 points = ₹1 instant discount at checkout</p>
                    <p>• Redeem up to 50% of your total rental cost</p>
                    <p className="text-amber-600 dark:text-amber-400 font-bold">• Total cash value: ₹{((user?.loyaltyPoints || 0) / 10).toFixed(0)}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal isOpen={!!cancelModal} onClose={() => setCancelModal(null)} title="Cancel Booking">
        <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
          Are you sure you want to cancel booking <span className="text-amber-500 font-mono font-bold">{cancelModal?.invoiceNumber}</span>?
        </p>
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Reason for Cancellation (optional)</label>
          <textarea
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white text-sm h-24 resize-none outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Why are you cancelling?"
          />
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setCancelModal(null)} className="flex-1">Keep Booking</Button>
          <Button variant="danger" onClick={handleCancel} className="flex-1">Yes, Cancel</Button>
        </div>
      </Modal>

      {/* Review Modal */}
      <Modal isOpen={!!reviewModal} onClose={() => setReviewModal(null)} title="Rate & Review Your Trip">
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          How was your driving experience with <span className="text-gray-900 dark:text-white font-bold">{reviewModal?.car?.name}</span>?
        </p>
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Overall Rating</label>
          <StarRating value={review.rating} onChange={r => setReview(p => ({ ...p, rating: r }))} size="lg" />
        </div>
        <div className="mb-5">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Your Feedback</label>
          <textarea
            value={review.reviewText}
            onChange={e => setReview(p => ({ ...p, reviewText: e.target.value }))}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white text-sm h-24 resize-none outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Share details about car condition, pickup process, driving feel..."
          />
        </div>
        <Button onClick={handleReview} className="w-full font-bold" size="lg">Submit Review ⭐</Button>
      </Modal>

      {/* Razorpay Online Payment Gateway Modal */}
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
            toast.success('Payment completed via Razorpay! 🎉');
            setPayBooking(null);
            fetchBookings();
          } catch (e) {
            toast.error('Failed to update payment status');
          }
        }}
      />
    </PageWrapper>
  );
}

function BookingRow({ booking, onCancel, onReview, onPay, full }) {
  return (
    <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <img
          src={booking.car?.images?.main}
          alt={booking.car?.name}
          className="w-24 h-16 object-cover rounded-xl flex-shrink-0 bg-gray-100 dark:bg-gray-800"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-gray-900 dark:text-white font-bold text-base leading-tight">{booking.car?.name || 'Vehicle'}</p>
              <p className="text-amber-500 text-xs font-mono font-bold mt-0.5">{booking.invoiceNumber}</p>
            </div>
            <Badge status={booking.status} />
          </div>
          {full && (
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>📅 {new Date(booking.pickupDate).toLocaleDateString('en-IN')} → {new Date(booking.returnDate).toLocaleDateString('en-IN')}</span>
              {booking.pickupLocation && <span>📍 {booking.pickupLocation}</span>}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2.5">
            <span className="text-amber-500 font-extrabold text-base">₹{booking.totalAmount?.toLocaleString('en-IN')}</span>
            {booking.paymentCompleted ? (
              <span className="text-green-600 dark:text-green-400 text-xs font-bold">✓ Paid</span>
            ) : (
              <span className="text-yellow-600 dark:text-yellow-400 text-xs font-bold">⏳ Pay at Pickup</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0 pt-2 sm:pt-0">
          {!booking.paymentCompleted && booking.status !== 'Cancelled' && onPay && (
            <button
              onClick={() => onPay(booking)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors shadow-xs"
              title="Pay online with Razorpay"
            >
              ⚡ Pay with Razorpay
            </button>
          )}
          <button
            onClick={() => generatePDF(booking, booking.car)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 text-xs font-bold hover:border-amber-500 hover:text-amber-500 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Invoice PDF
          </button>
          <button
            onClick={() => sendWhatsAppInvoice(booking, booking.car)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
            title="Share Invoice on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </button>
          {['Pending', 'Confirmed'].includes(booking.status) && (
            <button
              onClick={() => onCancel(booking)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
          {booking.status === 'Completed' && (
            <button
              onClick={() => onReview(booking)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
            >
              <Star className="w-3.5 h-3.5" /> Rate & Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
