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
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import RazorpayModal from '../components/payment/RazorpayModal';
import { sizedImage, handleImageError } from '../utils/image';
import { carTitle, paintFor, paintStyle, rupees } from '../theme/paints';
import { HUBS } from '../theme/hubs';

const LOCATIONS = HUBS;
const PAYMENT_METHODS = [
  { id: 'Razorpay', label: 'Pay online now', sublabel: 'UPI, cards, net banking or wallets. Confirmed instantly.' },
  { id: 'Cash', label: 'Pay at pickup', sublabel: 'Pay in cash at the hub when you collect the car.' },
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

  const trip = (() => {
    try { return JSON.parse(sessionStorage.getItem('driveaway_trip') || '{}'); } catch { return {}; }
  })();
  const [form, setForm] = useState({
    pickupDate: trip.from || '',
    returnDate: trip.to || '',
    pickupLocation: HUBS.includes(trip.location) ? trip.location : '',
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
      toast.success(`${data.percentageOff}% off applied`);
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
      toast.success('Booking confirmed');
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
      toast.error('Choose a pickup hub and both dates');
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
      toast.error('Add the driver name, phone and licence number');
      return false;
    }
    return true;
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center pt-[72px]"><Spinner size="lg" /></div>;
  }

  const STEPS = ['Trip', 'Driver', 'Confirm'];
  const paint = paintFor(car.type);
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const today = new Date().toISOString().split('T')[0];
  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="pt-[72px]" style={paintStyle(car.type)}>
      {/* Head: the car in its paint, with the step rail */}
      <section className="lacquer on-paint">
        <div className="page-container py-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display text-[clamp(2.2rem,5vw,4rem)]">Book the {car.name}</h1>
              <p className="mt-3 code-label text-[13px]">{car.company} · Paint {paint.no} {paint.name} · {rupees(car.dailyRate)} a day</p>
            </div>
            <ol className="flex items-center gap-2" aria-label="Booking steps">
              {STEPS.map((s, i) => {
                const n = i + 1;
                const state = step === n ? 'current' : step > n ? 'done' : 'todo';
                return (
                  <li key={s} aria-current={state === 'current' ? 'step' : undefined}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                      state === 'current' ? 'bg-on-paint text-paint' : state === 'done' ? 'bg-on-paint/20' : 'border border-on-paint/30 opacity-75'
                    }`}>
                    {state === 'done' ? <Check className="h-4 w-4" /> : <span className="font-wide font-black">{n}</span>}
                    {s}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <div className="page-container grid gap-10 py-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          {step === 1 && (
            <div className="space-y-10">
              <fieldset>
                <legend className="font-wide font-black uppercase tracking-tight text-xl">Where and when</legend>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <label className="block sm:col-span-3">
                    <span className="field-label">Pickup hub *</span>
                    <select value={form.pickupLocation} onChange={set('pickupLocation')} className="field">
                      <option value="">Choose a hub</option>
                      {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Pickup date *</span>
                    <input type="date" min={today} value={form.pickupDate} onChange={set('pickupDate')} className="field" />
                  </label>
                  <label className="block">
                    <span className="field-label">Return date *</span>
                    <input type="date" min={form.pickupDate || today} value={form.returnDate} onChange={set('returnDate')} className="field" />
                  </label>
                  <div className="flex flex-col justify-end">
                    <p className="rounded-xl bg-ink/[0.05] px-4 py-3 text-sm">
                      {totalDays > 0 ? <><strong>{totalDays}</strong> {totalDays === 1 ? 'day' : 'days'} · {rupees(baseAmount)}</> : <span className="text-muted">Pick your dates</span>}
                    </p>
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="font-wide font-black uppercase tracking-tight text-xl">How you will pay</legend>
                <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                  {PAYMENT_METHODS.map((m) => {
                    const on = form.paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setForm((p) => ({ ...p, paymentMethod: m.id }))}
                        className={`rounded-chip border p-5 text-left transition-colors ${on ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink'}`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{m.label}</span>
                          <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${on ? 'border-ink' : 'border-line'}`}>
                            {on && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                          </span>
                        </span>
                        <span className="mt-1.5 block text-sm text-muted">{m.sublabel}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="font-wide font-black uppercase tracking-tight text-xl">Savings</legend>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="promo" className="field-label">Promo code</label>
                    <div className="flex gap-2">
                      <input
                        id="promo"
                        type="text"
                        placeholder="DRIVEAWAY20"
                        value={form.discountCode}
                        onChange={(e) => { setForm((p) => ({ ...p, discountCode: e.target.value.toUpperCase() })); setDiscountInfo(null); }}
                        className="field uppercase"
                      />
                      <Button variant="secondary" onClick={handleApplyDiscount} loading={discountLoading} disabled={!form.discountCode} className="flex-shrink-0">
                        Apply
                      </Button>
                    </div>
                    {discountInfo ? (
                      <p className="mt-2 text-sm text-ok">
                        {discountInfo.percentageOff}% off applied{discountInfo.maxDiscount ? `, up to ${rupees(discountInfo.maxDiscount)}` : ''}.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-muted">Try DRIVEAWAY20, NEWUSER10 or AHMEDABAD15.</p>
                    )}
                  </div>
                  {user && user.loyaltyPoints > 0 && (
                    <label className={`flex cursor-pointer items-start gap-3 rounded-chip border p-4 ${form.useLoyaltyPoints ? 'border-ink' : 'border-line'}`}>
                      <input
                        type="checkbox"
                        checked={form.useLoyaltyPoints}
                        onChange={(e) => setForm((p) => ({ ...p, useLoyaltyPoints: e.target.checked }))}
                        className="mt-0.5 h-5 w-5 rounded border-line bg-raised text-ink focus:ring-ink/30"
                      />
                      <span>
                        <span className="block font-semibold">Use {user.loyaltyPoints.toLocaleString('en-IN')} loyalty points</span>
                        <span className="block text-sm text-muted">Worth up to {rupees(Math.floor(user.loyaltyPoints / 10))}, capped at half the booking.</span>
                      </span>
                    </label>
                  )}
                </div>
              </fieldset>

              <Button onClick={() => validateStep1() && setStep(2)} className="w-full !py-4 text-base sm:w-auto sm:!px-10">
                Continue to driver details <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <fieldset className="space-y-5">
              <legend className="font-wide font-black uppercase tracking-tight text-xl">Who is driving</legend>
              <p className="!mt-2 text-sm text-muted">Bring the same licence and ID when you collect the car. Fields marked * are required.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="field-label">Full name *</span><input value={form.customerName} onChange={set('customerName')} autoComplete="name" className="field" /></label>
                <label className="block"><span className="field-label">Phone *</span><input type="tel" value={form.customerPhone} onChange={set('customerPhone')} autoComplete="tel" className="field" /></label>
                <label className="block sm:col-span-2"><span className="field-label">Email</span><input type="email" value={form.customerEmail} onChange={set('customerEmail')} autoComplete="email" className="field" /></label>
                <label className="block"><span className="field-label">Driving licence number *</span><input value={form.licenseNumber} onChange={set('licenseNumber')} placeholder="GJ01 2020 0001234" className="field" /></label>
                <label className="block"><span className="field-label">Date of birth</span><input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} className="field" /></label>
                <label className="block sm:col-span-2"><span className="field-label">Address</span><input value={form.address} onChange={set('address')} autoComplete="street-address" className="field" /></label>
                <label className="block">
                  <span className="field-label">ID proof</span>
                  <select value={form.idProofType} onChange={set('idProofType')} className="field">
                    <option value="">Choose an ID</option>
                    {['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block"><span className="field-label">ID number</span><input value={form.idProofNumber} onChange={set('idProofNumber')} className="field" /></label>
                <label className="block"><span className="field-label">Emergency contact</span><input value={form.emergencyContact} onChange={set('emergencyContact')} className="field" /></label>
                <label className="block"><span className="field-label">Emergency phone</span><input type="tel" value={form.emergencyPhone} onChange={set('emergencyPhone')} className="field" /></label>
                <label className="block sm:col-span-2"><span className="field-label">Requests</span><textarea rows={3} value={form.specialRequirements} onChange={set('specialRequirements')} placeholder="Airport terminal meet-up, child seat, extra luggage space…" className="field resize-none" /></label>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="secondary" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={() => validateStep2() && setStep(3)} className="!px-8">Review booking <ChevronRight className="h-4 w-4" /></Button>
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <h2 className="font-wide font-black uppercase tracking-tight text-xl">Check and confirm</h2>
              <dl className="divide-y divide-line rounded-chip border border-line text-sm">
                {[
                  ['Car', carTitle(car)],
                  ['Pickup hub', form.pickupLocation],
                  ['Dates', `${fmt(form.pickupDate)} to ${fmt(form.returnDate)} (${totalDays} ${totalDays === 1 ? 'day' : 'days'})`],
                  ['Payment', form.paymentMethod === 'Cash' ? 'Cash at pickup' : 'Online now (test payment gateway)'],
                  ['Driver', form.customerName],
                  ['Licence', form.licenseNumber],
                  ['Phone', form.customerPhone],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 px-5 py-3.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-muted">
                You will earn <strong className="text-ink">{Math.floor(totalAmount / 100).toLocaleString('en-IN')} loyalty points</strong>. Your invoice is ready as soon as you confirm.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4" /> Back</Button>
                <Button variant="paint" onClick={handleSubmit} loading={submitting} className="!px-8 !py-4 text-base">
                  {form.paymentMethod === 'Cash' ? 'Reserve, pay at pickup' : `Pay ${rupees(Math.round(totalAmount))}`}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Fare sheet */}
        <aside className="lg:col-span-4">
          <div className="sticky top-[96px] overflow-hidden rounded-chip border border-line bg-surface">
            <div className="relative aspect-[16/9] bg-ink/5">
              <img src={sizedImage(car.images?.main, 640)} alt="" decoding="async" onError={(e) => handleImageError(e, 640)} className="h-full w-full object-cover" />
              <span className="lacquer absolute left-3 top-3 rounded-lg px-2.5 py-1.5 code-label text-[11px]">Paint {paint.no} · {car.type}</span>
            </div>
            <dl className="space-y-2.5 p-5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Daily rate</dt><dd className="font-semibold">{rupees(car.dailyRate)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Days</dt><dd className="font-semibold">{totalDays || '–'}</dd></div>
              {totalDays > 0 && <div className="flex justify-between"><dt className="text-muted">Rental</dt><dd className="font-semibold">{rupees(baseAmount)}</dd></div>}
              {discountAmount > 0 && <div className="flex justify-between text-ok"><dt>Promo {discountInfo?.percentageOff}%</dt><dd>-{rupees(Math.round(discountAmount))}</dd></div>}
              {loyaltyDiscount > 0 && <div className="flex justify-between text-ok"><dt>Loyalty points</dt><dd>-{rupees(Math.round(loyaltyDiscount))}</dd></div>}
              <div className="flex items-end justify-between border-t border-line pt-4">
                <dt className="font-semibold">Total</dt>
                <dd className="font-wide font-black text-3xl">{totalDays > 0 ? rupees(Math.round(totalAmount)) : '–'}</dd>
              </div>
              <p className="text-xs text-muted">Taxes included. Free cancellation.</p>
            </dl>
          </div>
        </aside>
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
    </div>
  );
}
