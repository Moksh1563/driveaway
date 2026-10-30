/**
 * ============================================================================
 * CAR BOOKING & RESERVATION PAGE
 * ============================================================================
 * Multi-step car booking workflow:
 *  - Step 1: Trip dates & Ahmedabad pickup hub selection
 *  - Step 2: Driver details & verification credentials
 *  - Step 3: Fare summary, dynamic promo discounts, loyalty points & payment
 * Integrates Razorpay dupe payment gateway modal and Pay-at-Pickup mode.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, ChevronRight, ChevronLeft, Tag, Gift, CreditCard, Info, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageWrapper from '../components/layout/PageWrapper';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import RazorpayModal from '../components/payment/RazorpayModal';

const LOCATIONS = ['SG Highway', 'Vastrapur', 'Bopal', 'Ashram Road', 'Ahmedabad Airport', 'BRTS Bus Stand', 'Navrangpura', 'Satellite'];
const PAYMENT_METHODS = [
  { id: 'Razorpay', label: 'Razorpay', sublabel: 'UPI (GPay, PhonePe), Cards & NetBanking', badge: 'Fastest & Recommended' },
  { id: 'Cash', label: 'Pay at Pickup (Cash)', sublabel: 'Pay at the counter when collecting vehicle', badge: 'Pay Later' },
];

export default function BookingPage() {

  const { carId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountInfo, setDiscountInfo] = useState(null);

  const [form, setForm] = useState({
    pickupDate: '',
    returnDate: '',
    pickupLocation: '',
    paymentMethod: 'Razorpay',
    discountCode: '',
    useLoyaltyPoints: false,
    customerName: user?.name || '',
    customerPhone: user?.phone || '',
    customerEmail: user?.email || '',
    licenseNumber: user?.licenseNumber || '',
    dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
    address: user?.address || '',
    drivingExperience: user?.drivingExperience || '',
    idProofType: user?.idProofType || '',
    idProofNumber: user?.idProofNumber || '',
    emergencyContact: user?.emergencyContact || '',
    emergencyPhone: user?.emergencyPhone || '',
    specialRequirements: '',
  });

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get(`/cars/${carId}`);
        setCar(data.car);
      } catch {
        toast.error('Car not found');
        navigate('/fleet');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [carId, navigate]);

  const totalDays = (() => {
    if (!form.pickupDate || !form.returnDate) return 0;
    const diff = Math.ceil((new Date(form.returnDate) - new Date(form.pickupDate)) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  })();

  const baseAmount = car ? totalDays * car.dailyRate : 0;
  const discountAmount = discountInfo ? Math.min(baseAmount * discountInfo.percentageOff / 100, discountInfo.maxDiscount || Infinity) : 0;
  const loyaltyDiscount = form.useLoyaltyPoints && user ? Math.min(user.loyaltyPoints / 10, (baseAmount - discountAmount) * 0.5) : 0;
  const totalAmount = Math.max(0, baseAmount - discountAmount - loyaltyDiscount);

  const handleApplyDiscount = async () => {
    if (!form.discountCode) return;
    setDiscountLoading(true);
    try {
      const { data } = await api.post('/discount/validate', { code: form.discountCode });
      setDiscountInfo(data);
      toast.success(`Discount applied! ${data.percentageOff}% off`);
    } catch (err) {
      setDiscountInfo(null);
      toast.error(err.response?.data?.message || 'Invalid discount code');
    } finally {
      setDiscountLoading(false);
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (form.paymentMethod === 'Cash') {
      confirmBooking({ paymentCompleted: false, paymentMethod: 'Cash' });
    } else {
      setShowPaymentModal(true);
    }
  };

  const handleRazorpaySuccess = async (paymentData) => {
    setShowPaymentModal(false);
    await confirmBooking({
      paymentCompleted: true,
      paymentId: paymentData.paymentId,
      paymentMethod: paymentData.paymentMethod || 'Razorpay',
    });
  };

  const confirmBooking = async (extraPaymentDetails = {}) => {
    setSubmitting(true);
    try {
      const payload = {
        car: carId,
        ...form,
        useLoyaltyPoints: form.useLoyaltyPoints,
        discountCode: discountInfo ? form.discountCode : undefined,
        ...extraPaymentDetails,
      };
      const { data } = await api.post('/bookings', payload);
      toast.success('Booking confirmed! 🎉');
      navigate(`/booking-success/${data._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
      setShowPaymentModal(false);
    }
  };

  const validateStep1 = () => {
    if (!form.pickupDate || !form.returnDate || !form.pickupLocation) {
      toast.error('Please fill in all trip details');
      return false;
    }
    if (new Date(form.pickupDate) < new Date(new Date().setHours(0,0,0,0))) {
      toast.error('Pickup date cannot be in the past');
      return false;
    }
    if (new Date(form.returnDate) <= new Date(form.pickupDate)) {
      toast.error('Return date must be after pickup date');
      return false;
    }
    if (totalDays < 1) {
      toast.error('Minimum 1 day rental required');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.customerName || !form.customerPhone || !form.licenseNumber) {
      toast.error('Please fill in all required driver details');
      return false;
    }
    return true;
  };

  const inputClass = 'w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none placeholder-gray-400 dark:placeholder-gray-500 shadow-xs transition-all';
  const labelClass = 'block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const STEPS = ['Trip Details', 'Driver Info', 'Confirm'];

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0D0D0D] text-gray-900 dark:text-white pt-20 pb-16 transition-colors">
        <div className="max-w-4xl mx-auto px-4">

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-8 mt-4 flex-wrap">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  step === i + 1
                    ? 'bg-amber-500 text-black shadow-md'
                    : step > i + 1
                    ? 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30'
                    : 'bg-white dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10'
                }`}>
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/20 text-xs">
                    {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
                  </span>
                  {s}
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-gray-400" />}
              </React.Fragment>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-sm">

                {/* STEP 1: Trip Details */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <h2 className="text-gray-900 dark:text-white text-xl font-bold">1. Select Trip Details</h2>
                    <div>
                      <label className={labelClass}>Pickup Location *</label>
                      <select
                        value={form.pickupLocation}
                        onChange={e => setForm(p => ({ ...p, pickupLocation: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="" className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">Select Ahmedabad pickup location</option>
                        {LOCATIONS.map(l => <option key={l} value={l} className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">{l}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Pickup Date *</label>
                        <input
                          type="date"
                          value={form.pickupDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={e => setForm(p => ({ ...p, pickupDate: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Return Date *</label>
                        <input
                          type="date"
                          value={form.returnDate}
                          min={form.pickupDate || new Date().toISOString().split('T')[0]}
                          onChange={e => setForm(p => ({ ...p, returnDate: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Discount Code */}
                    <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                      <label className={labelClass}><Tag className="inline w-3 h-3 mr-1 text-amber-500" />Discount Code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. DRIVEAWAY20"
                          value={form.discountCode}
                          onChange={e => setForm(p => ({ ...p, discountCode: e.target.value.toUpperCase() }))}
                          className={`${inputClass} flex-1`}
                        />
                        <Button variant="secondary" size="md" onClick={handleApplyDiscount} loading={discountLoading} className="flex-shrink-0">
                          Apply
                        </Button>
                      </div>
                      {discountInfo && (
                        <p className="text-green-600 dark:text-green-400 text-xs font-semibold mt-1">
                          ✓ {discountInfo.percentageOff}% off applied (max ₹{discountInfo.maxDiscount?.toLocaleString('en-IN')})
                        </p>
                      )}
                      <p className="text-gray-500 text-xs mt-1">Available codes: DRIVEAWAY20, NEWUSER10, AHMEDABAD15</p>
                    </div>

                    {/* Loyalty Points */}
                    {user && user.loyaltyPoints > 0 && (
                      <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={form.useLoyaltyPoints}
                            onChange={e => setForm(p => ({ ...p, useLoyaltyPoints: e.target.checked }))}
                            className="w-4 h-4 accent-amber-500 rounded"
                          />
                          <div>
                            <div className="flex items-center gap-2 text-gray-900 dark:text-white text-sm font-bold">
                              <Gift className="w-4 h-4 text-amber-500" />
                              Redeem Loyalty Points ({user.loyaltyPoints} pts available)
                            </div>
                            <div className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
                              Save ₹{(user.loyaltyPoints / 10).toFixed(0)} discount (10 pts = ₹1 off)
                            </div>
                          </div>
                        </label>
                      </div>
                    )}

                    {/* Payment Method */}
                    <div className="pt-2 border-t border-gray-100 dark:border-white/5 space-y-2">
                      <label className={labelClass}><CreditCard className="inline w-3 h-3 mr-1 text-amber-500" />Payment Method</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {PAYMENT_METHODS.map(m => (
                          <div
                            key={m.id}
                            onClick={() => setForm(p => ({ ...p, paymentMethod: m.id }))}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              form.paymentMethod === m.id
                                ? 'bg-amber-500/10 border-amber-500 text-gray-900 dark:text-white shadow-sm ring-1 ring-amber-500'
                                : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-xs">{m.label}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                m.id === 'Razorpay'
                                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                  : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                              }`}>
                                {m.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                              {m.sublabel}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button onClick={() => validateStep1() && setStep(2)} className="w-full font-bold mt-2" size="lg">
                      Continue to Driver Info <ChevronRight className="w-4 h-4" />
                    </Button>
                  </motion.div>
                )}

                {/* STEP 2: Driver Details */}
                {step === 2 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <h2 className="text-gray-900 dark:text-white text-xl font-bold">2. Driver & Verification Details</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Full Name *</label>
                        <input value={form.customerName} onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))} className={inputClass} placeholder="Driver name" />
                      </div>
                      <div>
                        <label className={labelClass}>Phone *</label>
                        <input value={form.customerPhone} onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))} className={inputClass} placeholder="9999999999" />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Email Address</label>
                      <input value={form.customerEmail} onChange={e => setForm(p => ({ ...p, customerEmail: e.target.value }))} className={inputClass} placeholder="you@email.com" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Driving License Number *</label>
                        <input value={form.licenseNumber} onChange={e => setForm(p => ({ ...p, licenseNumber: e.target.value }))} className={inputClass} placeholder="GJ01-2020-XXXX" />
                      </div>
                      <div>
                        <label className={labelClass}>Date of Birth</label>
                        <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Address (Ahmedabad / Local)</label>
                      <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputClass} placeholder="Street, Area, City" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>ID Proof Type</label>
                        <select value={form.idProofType} onChange={e => setForm(p => ({ ...p, idProofType: e.target.value }))} className={inputClass}>
                          <option value="" className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">Select ID</option>
                          {['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID'].map(t => <option key={t} value={t} className="bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white">{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>ID Number</label>
                        <input value={form.idProofNumber} onChange={e => setForm(p => ({ ...p, idProofNumber: e.target.value }))} className={inputClass} placeholder="XXXX XXXX XXXX" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Emergency Contact Name</label>
                        <input value={form.emergencyContact} onChange={e => setForm(p => ({ ...p, emergencyContact: e.target.value }))} className={inputClass} placeholder="Contact person" />
                      </div>
                      <div>
                        <label className={labelClass}>Emergency Phone</label>
                        <input value={form.emergencyPhone} onChange={e => setForm(p => ({ ...p, emergencyPhone: e.target.value }))} className={inputClass} placeholder="9876543210" />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Special Requests</label>
                      <textarea value={form.specialRequirements} onChange={e => setForm(p => ({ ...p, specialRequirements: e.target.value }))} className={`${inputClass} h-20 resize-none`} placeholder="e.g. Airport terminal meetup, extra luggage space..." />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">
                        <ChevronLeft className="w-4 h-4" /> Back
                      </Button>
                      <Button onClick={() => validateStep2() && setStep(3)} className="flex-1 font-bold">
                        Review Booking <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: Confirm */}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <h2 className="text-gray-900 dark:text-white text-xl font-bold">3. Review & Confirm Booking</h2>
                    <div className="space-y-2.5 bg-gray-50 dark:bg-white/[0.03] p-4 rounded-xl border border-gray-200 dark:border-white/5">
                      {[
                        ['Car Selected', `${car.name} (${car.company})`],
                        ['Pickup Location', form.pickupLocation],
                        ['Trip Duration', `${new Date(form.pickupDate).toLocaleDateString('en-IN')} → ${new Date(form.returnDate).toLocaleDateString('en-IN')} (${totalDays} Day${totalDays > 1 ? 's' : ''})`],
                        ['Payment Option', form.paymentMethod === 'Cash' ? 'Cash on Pickup' : 'Razorpay (Instant Online)'],
                        ['Driver Name', form.customerName],
                        ['Driver License', form.licenseNumber],
                        ['Contact Phone', form.customerPhone],
                      ].map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">{key}</span>
                          <span className="text-gray-900 dark:text-white font-bold">{val}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-gray-200 dark:border-white/10 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Base Price ({totalDays} days × ₹{car.dailyRate.toLocaleString('en-IN')})</span>
                        <span className="text-gray-900 dark:text-white font-semibold">₹{baseAmount.toLocaleString('en-IN')}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 dark:text-green-400">Discount ({discountInfo?.percentageOff}%)</span>
                          <span className="text-green-600 dark:text-green-400 font-semibold">-₹{Math.round(discountAmount).toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {loyaltyDiscount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 dark:text-green-400">Loyalty Discount</span>
                          <span className="text-green-600 dark:text-green-400 font-semibold">-₹{Math.round(loyaltyDiscount).toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center font-extrabold text-xl pt-3 border-t border-gray-200 dark:border-white/10">
                        <span className="text-gray-900 dark:text-white">Final Amount</span>
                        <span className="text-amber-500">₹{Math.round(totalAmount).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
                      <Info className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed">
                        You'll earn <strong>{Math.floor(totalAmount / 100)} loyalty points</strong> with this trip. Instant confirmation & invoice will be generated.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="ghost" onClick={() => setStep(2)} className="flex-1">
                        <ChevronLeft className="w-4 h-4" /> Back
                      </Button>
                      <Button onClick={handleSubmit} loading={submitting} className="flex-1 font-extrabold shadow-lg shadow-amber-500/25" size="lg">
                        {form.paymentMethod === 'Cash'
                          ? 'Confirm & Reserve (Pay at Pickup) 🚗'
                          : `Pay ₹${Math.round(totalAmount).toLocaleString('en-IN')} with Razorpay ⚡`}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Car Summary Sidebar */}
            <div>
              <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden sticky top-24 shadow-sm">
                <img src={car.images?.main} alt={car.name} className="w-full h-36 object-cover bg-gray-100 dark:bg-gray-800" />
                <div className="p-5 space-y-3">
                  <div>
                    <h3 className="text-gray-900 dark:text-white font-extrabold text-base">{car.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{car.company} • {car.type}</p>
                  </div>
                  <div className="border-t border-gray-100 dark:border-white/5 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Daily Rate</span>
                      <span className="text-gray-900 dark:text-white font-bold">₹{car.dailyRate.toLocaleString('en-IN')}</span>
                    </div>
                    {totalDays > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Duration</span>
                          <span className="text-gray-900 dark:text-white font-bold">{totalDays} Day{totalDays > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex justify-between items-center font-extrabold pt-2 border-t border-gray-100 dark:border-white/5">
                          <span className="text-gray-900 dark:text-white">Est. Total</span>
                          <span className="text-amber-500 text-lg">₹{Math.round(totalAmount).toLocaleString('en-IN')}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RazorpayModal
        isOpen={showPaymentModal}
        onClose={() => !submitting && setShowPaymentModal(false)}
        amount={totalAmount}
        customerName={form.customerName}
        customerEmail={form.customerEmail}
        customerPhone={form.customerPhone}
        onPaymentSuccess={handleRazorpaySuccess}
      />

    </PageWrapper>
  );
}
