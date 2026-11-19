/**
 * ============================================================================
 * CAR BOOKING & RESERVATION PAGE
 * ============================================================================
 * Multi-step car booking workflow:
 *  - Step 1: Trip dates & Ahmedabad pickup hub selection
 *  - Step 2: Driver details & verification credentials
 *  - Step 3: Fare estimate, promo discounts, loyalty points & payment
 * The server prices and saves every booking unpaid. Paying online then opens the Driveaway test
 * checkout (a simulated payment) for the saved booking; paying at pickup needs nothing more.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { ChevronRight, ChevronLeft, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import PayBookingModal from '../components/booking/PayBookingModal';
import DriverStep from '../components/booking/DriverStep';
import { FIELD_CLASS, REQUIRED_DRIVER_FIELDS, OPTIONAL_DRIVER_FIELDS } from '../components/booking/driverFields';
import FieldError, { ERROR_IN as NOTE_IN } from '../components/booking/FieldError';
import GlideNumber from '../components/booking/GlideNumber';
import DrawnCheck from '../components/booking/DrawnCheck';
import { EASE, LAYOUT, SPRING, viewSwap } from '../theme/motion';
import useFieldErrors, { isEmail, isIndianMobile, isLicence } from '../hooks/useFieldErrors';
import usePageTitle from '../hooks/usePageTitle';
import { sizedImage, handleImageError } from '../utils/image';
import { carTitle, paintFor, paintStyle, rupees } from '../theme/paints';
import { HUBS } from '../theme/hubs';
import { BookingSkeleton } from '../components/ui/Skeletons';
import { MAX_DAYS_AHEAD, MAX_TRIP_DAYS, addDays, formatDay, isDay, istDay, overlaps, todayIST, tripDays, yearsBefore } from '../utils/dates';

const LOCATIONS = HUBS;
const PAYMENT_METHODS = [
  { id: 'Online test', label: 'Pay online now', sublabel: 'UPI, card, net banking or wallet. Confirmed instantly.' },
  { id: 'Cash', label: 'Pay at pickup', sublabel: 'Pay in cash at the hub when you collect the car.' },
];
const STEPS = ['Trip', 'Driver', 'Confirm'];
const SHORT_DAY = { day: 'numeric', month: 'short' };

// Steps slide in the direction of travel (Continue: from the right, Back: from the left). The step
// that is leaving stops taking clicks at once, and one that comes back takes them again.
const stepSwap = {
  initial: viewSwap.initial,
  animate: { ...viewSwap.animate, pointerEvents: 'auto' },
  exit: (dir) => ({ ...viewSwap.exit(dir), pointerEvents: 'none' }),
};
// A new fare line (rental, promo, points) fades down into place while the lines under it glide
// down to make room; a line that goes fades out and the rest glide up.
const fareLine = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE.out } },
  exit: { opacity: 0, transition: { duration: 0.14, ease: EASE.in } },
};
const FARE_GLIDE = { layout: LAYOUT };

// Booking fields pre-filled from the signed-in customer's profile
const PROFILE_FIELDS = {
  customerName: 'name', customerPhone: 'phone', customerEmail: 'email', licenseNumber: 'licenseNumber',
  address: 'address', drivingExperience: 'drivingExperience', idProofType: 'idProofType', idProofNumber: 'idProofNumber',
  emergencyContact: 'emergencyContact', emergencyPhone: 'emergencyPhone',
};
const profileValues = (user) => {
  const values = {};
  if (!user) return values;
  Object.entries(PROFILE_FIELDS).forEach(([key, src]) => {
    if (user[src] === undefined || user[src] === null || user[src] === '') return;
    values[key] = src === 'drivingExperience' ? user[src] : String(user[src]);
  });
  if (user.dateOfBirth) values.dateOfBirth = istDay(user.dateOfBirth);
  return values;
};

const readTrip = () => {
  try { return JSON.parse(sessionStorage.getItem('driveaway_trip') || '{}'); } catch { return {}; }
};

export default function BookingPage() {

  const { carId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1); // direction of the last step change: 1 forward, -1 back
  const [car, setCar] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | notfound | error
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null); // { status, message } from POST /bookings
  const [created, setCreated] = useState(null); // saved booking waiting for its test payment
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountInfo, setDiscountInfo] = useState(null);
  const { errors, field, errorId, clear, check, setErrors } = useFieldErrors('booking');
  const stepTop = useRef(null);
  // Errors for a step that is still waiting to slide in: focused once it is on the page
  const pendingFocus = useRef(null);

  const goToStep = (n) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  // The new step mounts only after the old one has slid out, so a field on it can take focus now
  const afterStepSwap = () => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    check(pending, Object.keys(pending));
  };

  const [form, setForm] = useState(() => {
    const trip = readTrip();
    return {
      pickupDate: isDay(trip.from) ? trip.from : '',
      returnDate: isDay(trip.to) ? trip.to : '',
      pickupLocation: HUBS.includes(trip.location) ? trip.location : '',
      paymentMethod: 'Online test',
      discountCode: '',
      useLoyaltyPoints: false,
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      licenseNumber: '',
      dateOfBirth: '',
      address: '',
      drivingExperience: '',
      idProofType: '',
      idProofNumber: '',
      emergencyContact: '',
      emergencyPhone: '',
      specialRequirements: '',
      ...profileValues(user),
    };
  });

  usePageTitle(car ? `Book the ${car.name}` : null);

  // Loyalty points change with every booking: price the estimate from a fresh profile
  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Once the full profile is in (the saved session only keeps name and email), fill any empty fields
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !user || !('loyaltyPoints' in user)) return;
    prefilled.current = true;
    const values = profileValues(user);
    setForm((p) => {
      const next = { ...p };
      Object.entries(values).forEach(([k, v]) => { if (next[k] === '' || next[k] === undefined) next[k] = v; });
      return next;
    });
  }, [user]);

  // quiet: refresh the car (booked dates, status) in place without the loading or error screens
  const carRequest = useRef(0);
  const loadCar = useCallback(async (quiet = false) => {
    const n = ++carRequest.current;
    if (!quiet) setLoadState('loading');
    try {
      const { data } = await api.get(`/cars/${carId}`);
      if (n !== carRequest.current) return;
      setCar(data.car);
      setLoadState('ready');
    } catch (err) {
      if (n !== carRequest.current || quiet) return;
      const status = err.response?.status;
      setLoadError(err.response?.data?.message || 'Could not load this car.');
      setLoadState(status === 404 || status === 400 ? 'notfound' : 'error');
    }
  }, [carId]);

  useEffect(() => {
    loadCar();
    return () => { carRequest.current += 1; };
  }, [loadCar]);

  // A new step starts at its top, not wherever the last one was scrolled to, and without an old error
  useEffect(() => {
    setSubmitError(null);
    const el = stepTop.current;
    if (el && el.getBoundingClientRect().top < 72) el.scrollIntoView({ block: 'start' });
  }, [step]);

  // ---- Estimate (the server prices the booking; this mirrors its rules) ----
  const totalDays = tripDays(form.pickupDate, form.returnDate);
  const baseAmount = car ? totalDays * car.dailyRate : 0;
  const promoMin = discountInfo?.minAmount || 0;
  const promoActive = Boolean(discountInfo) && baseAmount > 0 && baseAmount >= promoMin;
  // Same rounding as the server: promo in whole rupees, loyalty rounded down to whole rupees
  const discountAmount = promoActive
    ? Math.max(0, Math.min(baseAmount, Math.round(Math.min((baseAmount * discountInfo.percentageOff) / 100, discountInfo.maxDiscount || Infinity))))
    : 0;
  const points = user?.loyaltyPoints || 0;
  const loyaltyDiscount = form.useLoyaltyPoints && points > 0 ? Math.floor(Math.min(points / 10, (baseAmount - discountAmount) * 0.5)) : 0;
  const totalAmount = Math.max(0, Math.round(baseAmount - discountAmount - loyaltyDiscount));
  // Once the booking is saved, show the server's figures: spending the points refreshes the balance, which
  // would otherwise shrink the estimate behind the open checkout.
  const fare = created
    ? { discountAmount: created.discountAmount || 0, loyaltyDiscount: created.loyaltyDiscount || 0, totalAmount: created.totalAmount }
    : { discountAmount, loyaltyDiscount, totalAmount };

  // ---- Dates already taken (half-open: free again on the return day) ----
  const booked = useMemo(
    () => (car?.bookedRanges || [])
      .map((r) => ({ from: istDay(r.pickupDate), to: istDay(r.returnDate) }))
      .filter((r) => r.from && r.to),
    [car]
  );
  const clash = totalDays > 0 ? booked.find((r) => overlaps(r.from, r.to, form.pickupDate, form.returnDate)) : null;

  const today = todayIST();
  const lastPickup = addDays(today, MAX_DAYS_AHEAD);
  const dobMax = yearsBefore(today, 18);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((p) => ({ ...p, [key]: value }));
    clear(key);
    // The overlap message sits on the pickup date but depends on both dates
    if (key === 'returnDate') clear('pickupDate');
    if (key === 'pickupDate') clear('returnDate');
  };

  const handleApplyDiscount = async () => {
    const code = form.discountCode.trim();
    if (!code) return;
    setDiscountLoading(true);
    clear('discountCode');
    try {
      const { data } = await api.post('/discount/validate', { code, subtotal: baseAmount || undefined });
      setDiscountInfo(data);
      toast.success(`${data.percentageOff}% off applied`);
    } catch (err) {
      setDiscountInfo(null);
      setErrors((p) => ({ ...p, discountCode: err.response?.data?.message || 'This code is not valid' }));
    } finally {
      setDiscountLoading(false);
    }
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.pickupLocation) e.pickupLocation = 'Choose a pickup hub';
    if (!isDay(form.pickupDate)) e.pickupDate = 'Choose a pickup date';
    else if (form.pickupDate < today) e.pickupDate = 'Pickup cannot be before today (India time)';
    else if (form.pickupDate > lastPickup) e.pickupDate = `Pickup can be at most ${MAX_DAYS_AHEAD} days ahead`;
    if (!isDay(form.returnDate)) e.returnDate = 'Choose a return date';
    else if (isDay(form.pickupDate) && form.returnDate <= form.pickupDate) e.returnDate = 'Return must be after the pickup date';
    else if (totalDays > MAX_TRIP_DAYS) e.returnDate = `A trip can last at most ${MAX_TRIP_DAYS} days`;
    if (!e.pickupDate && !e.returnDate && clash) {
      e.pickupDate = `Already booked from ${formatDay(clash.from)} to ${formatDay(clash.to)}. Choose dates outside that range.`;
    }
    if (form.discountCode.trim() && !discountInfo) {
      e.discountCode = errors.discountCode || 'Apply this code, or clear it to continue';
    } else if (discountInfo && promoMin && baseAmount < promoMin) {
      e.discountCode = `This code needs a rental of at least ${rupees(promoMin)}. Change the dates or clear the code.`;
    }
    return check(e, ['pickupLocation', 'pickupDate', 'returnDate', 'discountCode']);
  };

  const validateStep2 = () => {
    const e = {};
    if (form.customerName.trim().length < 2) e.customerName = "Enter the driver's full name";
    if (!form.customerPhone.trim()) e.customerPhone = 'Enter a mobile number the hub can reach you on';
    else if (!isIndianMobile(form.customerPhone)) e.customerPhone = 'Enter a 10-digit Indian mobile number, like 98765 43210';
    if (!form.licenseNumber.trim()) e.licenseNumber = 'Enter the driving licence number';
    else if (!isLicence(form.licenseNumber)) e.licenseNumber = 'Enter the licence number as printed, like GJ01 2020 0001234';
    if (form.customerEmail.trim() && !isEmail(form.customerEmail)) e.customerEmail = 'Enter a valid email, like you@example.com';
    if (form.dateOfBirth) {
      if (!isDay(form.dateOfBirth) || form.dateOfBirth > today) e.dateOfBirth = 'Enter a real date of birth';
      else if (form.dateOfBirth > dobMax) e.dateOfBirth = 'The driver must be at least 18';
    }
    if (form.emergencyPhone.trim() && !isIndianMobile(form.emergencyPhone)) e.emergencyPhone = 'Enter a 10-digit Indian mobile number';
    return check(e, [...REQUIRED_DRIVER_FIELDS, ...OPTIONAL_DRIVER_FIELDS]);
  };

  const handleSubmit = async () => {
    if (submitting || created) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data } = await api.post('/bookings', {
        car: carId,
        ...form,
        discountCode: discountInfo ? form.discountCode.trim() : undefined,
        useLoyaltyPoints: form.useLoyaltyPoints && points > 0,
      });
      refreshUser(); // points spent on this booking
      if (form.paymentMethod === 'Cash') {
        toast.success('Booking reserved');
        navigate(`/booking-success/${data._id}`);
        return;
      }
      if (Math.round(data.totalAmount) !== totalAmount) toast(`Your final total is ${rupees(data.totalAmount)}.`);
      setCreated(data);
    } catch (err) {
      const status = err.response?.status;
      const code = err.response?.data?.code;
      const message = err.response?.data?.message || 'Booking failed. Please try again.';
      if (status === 409 && code === 'DATES_TAKEN') {
        // Someone booked these dates first: back to the dates, with the latest booked ranges
        loadCar(true);
        goToStep(1);
        const dateError = { pickupDate: message };
        pendingFocus.current = dateError;
        check(dateError, ['pickupDate']);
      } else {
        // The points balance changed: fetch it again so the fare shown is the one that will be charged
        if (status === 409 && code === 'POINTS_CHANGED') refreshUser();
        // Other conflicts (the car or the account is busy for a moment) keep the dates: retry from here
        if (status === 400) loadCar(true);
        setSubmitError({ status, message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // The booking is saved before the checkout opens, so leaving it keeps an unpaid reservation
  const handleCheckoutClosed = () => {
    toast('Reserved: you can pay from My bookings');
    navigate(`/booking-success/${created._id}`);
  };

  const handlePaid = () => {
    refreshUser();
    toast.success('Payment received');
    navigate(`/booking-success/${created._id}`);
  };

  if (loadState === 'loading' && !car) {
    return <BookingSkeleton />;
  }

  if (!car) {
    const notFound = loadState === 'notfound';
    return (
      <div className="page-container grid min-h-screen place-items-center pt-[72px] text-center">
        <div role={notFound ? undefined : 'alert'}>
          <h1 className="display text-5xl">{notFound ? 'Car not found' : 'Could not load this car'}</h1>
          <p className="mt-4 text-muted">{notFound ? 'It may have left the fleet.' : loadError}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!notFound && <button type="button" onClick={() => loadCar()} className="btn-ink">Try again</button>}
            <Link to="/fleet" className={notFound ? 'btn-ink' : 'btn-line'}>Back to the fleet</Link>
          </div>
        </div>
      </div>
    );
  }

  const paint = paintFor(car.type);
  const inMaintenance = car.status === 'Maintenance' || car.adminStatus === 'Maintenance';

  if (inMaintenance) {
    return (
      <div className="pt-[72px]" style={paintStyle(car.type)}>
        <section className="lacquer on-paint">
          <div className="page-container py-10">
            <h1 className="display text-[clamp(2.2rem,5vw,4rem)]">Book the {car.name}</h1>
            <p className="mt-3 code-label text-[13px]">{car.company} · Paint {paint.no} {paint.name}</p>
          </div>
        </section>
        <div className="page-container py-16">
          <div className="max-w-xl rounded-chip border border-line p-8">
            <Wrench className="h-6 w-6 text-warn" aria-hidden="true" />
            <h2 className="mt-4 font-wide font-black uppercase tracking-tight text-xl">In maintenance right now</h2>
            <p className="mt-2 text-muted">This car cannot be booked until it is back in service. On its page you can ask us to email you the moment it is free.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={`/cars/${car._id}`} className="btn-ink">See the car</Link>
              <Link to="/fleet" className="btn-line">Back to the fleet</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const confirmLabel = form.paymentMethod === 'Cash' ? 'Reserve, pay at pickup' : `Reserve and pay ${rupees(fare.totalAmount)}`;

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
                    className={`relative isolate flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-[color,background-color,opacity] duration-300 ease-out ${
                      state === 'current' ? 'text-paint' : state === 'done' ? 'bg-on-paint/20' : 'border border-on-paint/30 opacity-75'
                    }`}>
                    {/* One on-paint marker that glides from step to step */}
                    {state === 'current' && (
                      <m.span
                        layoutId="booking-step-marker"
                        transition={SPRING}
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 bg-on-paint"
                        style={{ borderRadius: 999 }}
                      />
                    )}
                    {state === 'done' ? <DrawnCheck className="h-4 w-4" delay={0.12} /> : <span className="font-wide font-black">{n}</span>}
                    {s}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <div className="page-container grid gap-10 py-10 lg:grid-cols-12">
        <div ref={stepTop} className="min-w-0 scroll-mt-24 lg:col-span-8">
          <AnimatePresence custom={dir} mode="wait" initial={false} onExitComplete={afterStepSwap}>
          <m.div key={step} custom={dir} variants={stepSwap} initial="initial" animate="animate" exit="exit">
          {step === 1 && (
            <div className="space-y-10">
              <fieldset>
                <legend className="font-wide font-black uppercase tracking-tight text-xl">Where and when</legend>
                {car.bookedNow && car.nextFreeDate && (
                  <p className="mt-3 text-sm text-muted">Out with another driver until {formatDay(car.nextFreeDate)}. You can book it from that day on.</p>
                )}
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <label className="block sm:col-span-3">
                    <span className="field-label">Pickup hub *</span>
                    <select value={form.pickupLocation} onChange={set('pickupLocation')} required {...field('pickupLocation')} className={FIELD_CLASS}>
                      <option value="">Choose a hub</option>
                      {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <FieldError id={errorId('pickupLocation')}>{errors.pickupLocation}</FieldError>
                  </label>
                  <label className="block">
                    <span className="field-label">Pickup date *</span>
                    <input type="date" min={today} max={lastPickup} value={form.pickupDate} onChange={set('pickupDate')} required {...field('pickupDate')} className={FIELD_CLASS} />
                    <FieldError id={errorId('pickupDate')}>{errors.pickupDate}</FieldError>
                  </label>
                  <label className="block">
                    <span className="field-label">Return date *</span>
                    <input
                      type="date"
                      min={isDay(form.pickupDate) ? addDays(form.pickupDate, 1) : addDays(today, 1)}
                      max={isDay(form.pickupDate) ? addDays(form.pickupDate, MAX_TRIP_DAYS) : undefined}
                      value={form.returnDate}
                      onChange={set('returnDate')}
                      required
                      {...field('returnDate')}
                      className={FIELD_CLASS}
                    />
                    <FieldError id={errorId('returnDate')}>{errors.returnDate}</FieldError>
                  </label>
                  <div className="flex flex-col justify-start sm:pt-[26px]">
                    <p className="rounded-xl bg-ink/[0.05] px-4 py-3 text-sm">
                      {totalDays > 0 ? <><strong>{totalDays}</strong> {totalDays === 1 ? 'day' : 'days'} · <GlideNumber value={baseAmount} format={rupees} /></> : <span className="text-muted">Pick your dates</span>}
                    </p>
                  </div>
                  <div aria-live="polite" className="sm:col-span-3">
                    {clash && !errors.pickupDate && (
                      <p className={`text-sm font-semibold text-warn ${NOTE_IN}`}>
                        These dates overlap a booking from {formatDay(clash.from, SHORT_DAY)} to {formatDay(clash.to, SHORT_DAY)}.
                      </p>
                    )}
                  </div>
                  {booked.length > 0 && (
                    <div className="rounded-xl border border-line px-4 py-3 text-sm sm:col-span-3">
                      <p className="font-semibold">Already booked</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {booked.map((r) => (
                          <li key={`${r.from}-${r.to}`} className="rounded-full bg-ink/[0.06] px-3 py-1 text-xs font-semibold">
                            {formatDay(r.from, SHORT_DAY)} to {formatDay(r.to, SHORT_DAY)}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted">The car is free again on each return day, so a new trip can start that day.</p>
                    </div>
                  )}
                </div>
              </fieldset>

              <fieldset>
                <legend className="font-wide font-black uppercase tracking-tight text-xl">How you will pay</legend>
                <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                  {PAYMENT_METHODS.map((pm) => {
                    const on = form.paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setForm((p) => ({ ...p, paymentMethod: pm.id }))}
                        className={`rounded-chip border p-5 text-left transition-[border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] ${on ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink'}`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{pm.label}</span>
                          <span className={`grid h-5 w-5 place-items-center rounded-full border-2 transition-colors duration-200 ${on ? 'border-ink' : 'border-line'}`}>
                            {on && <span className="h-2.5 w-2.5 rounded-full bg-ink animate-[dot-in_220ms_var(--ease-out)_backwards]" />}
                          </span>
                        </span>
                        <span className="mt-1.5 block text-sm text-muted">{pm.sublabel}</span>
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
                        onChange={(e) => { setForm((p) => ({ ...p, discountCode: e.target.value.toUpperCase() })); setDiscountInfo(null); clear('discountCode'); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyDiscount(); } }}
                        {...field('discountCode')}
                        className={`${FIELD_CLASS} uppercase`}
                      />
                      <Button variant="secondary" onClick={handleApplyDiscount} loading={discountLoading} disabled={!form.discountCode.trim()} className="flex-shrink-0">
                        Apply
                      </Button>
                    </div>
                    {errors.discountCode ? (
                      <FieldError id={errorId('discountCode')}>{errors.discountCode}</FieldError>
                    ) : discountInfo ? (
                      <p key="promo-applied" className={`mt-2 text-sm text-ok ${NOTE_IN}`}>
                        {discountInfo.percentageOff}% off applied{discountInfo.maxDiscount ? `, up to ${rupees(discountInfo.maxDiscount)}` : ''}.
                        {discountInfo.expiresAt && ` Valid until ${formatDay(discountInfo.expiresAt)}.`}
                        {promoMin > 0 && !promoActive && <span className="block text-warn">Needs a rental of at least {rupees(promoMin)}.</span>}
                      </p>
                    ) : (
                      <p key="promo-hint" className="mt-2 text-xs text-muted">Try DRIVEAWAY20, NEWUSER10 or AHMEDABAD15.</p>
                    )}
                  </div>
                  {points > 0 && (
                    <label className={`flex cursor-pointer items-start gap-3 rounded-chip border p-4 transition-colors duration-200 ${form.useLoyaltyPoints ? 'border-ink' : 'border-line'}`}>
                      <input
                        type="checkbox"
                        checked={form.useLoyaltyPoints}
                        onChange={(e) => setForm((p) => ({ ...p, useLoyaltyPoints: e.target.checked }))}
                        className="mt-0.5 h-5 w-5 rounded border-line bg-raised text-ink focus:ring-ink/30"
                      />
                      <span>
                        <span className="block font-semibold">Use {points.toLocaleString('en-IN')} loyalty points</span>
                        <span className="block text-sm text-muted">Worth up to {rupees(Math.floor(points / 10))}, capped at half the booking.</span>
                      </span>
                    </label>
                  )}
                </div>
              </fieldset>

              <Button onClick={() => validateStep1() && goToStep(2)} className="w-full !py-4 text-base sm:w-auto sm:!px-10">
                Continue to driver details <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <DriverStep
              form={form}
              set={set}
              errors={errors}
              field={field}
              errorId={errorId}
              accountEmail={user?.email}
              dobMax={dobMax}
              onBack={() => goToStep(1)}
              onNext={() => validateStep2() && goToStep(3)}
            />
          )}

          {step === 3 && (
            <div className="space-y-8">
              <h2 className="font-wide font-black uppercase tracking-tight text-xl">Check and confirm</h2>
              <dl className="divide-y divide-line rounded-chip border border-line text-sm">
                {[
                  ['Car', carTitle(car)],
                  ['Pickup hub', form.pickupLocation],
                  ['Dates', `${formatDay(form.pickupDate)} to ${formatDay(form.returnDate)} (${totalDays} ${totalDays === 1 ? 'day' : 'days'})`],
                  ['Payment', form.paymentMethod === 'Cash' ? 'Cash at pickup' : 'Online now (UPI, card, net banking or wallet)'],
                  ['Driver', form.customerName],
                  ['Licence', form.licenseNumber],
                  ['Phone', form.customerPhone],
                  ['Confirmation to', user?.email],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 px-5 py-3.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-muted">
                Loyalty points are added when the trip is completed: about <strong className="text-ink">{Math.floor(fare.totalAmount / 100).toLocaleString('en-IN')} points</strong> for this booking. Your invoice is ready as soon as you confirm.
              </p>
              {submitError && (
                <div role="alert" key={submitError.message} className={`rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger dark:text-[#F28B82] ${NOTE_IN}`}>
                  <p className="font-semibold">{submitError.message}</p>
                  {submitError.status === 429 && <Link to="/dashboard" className="mt-1 inline-block underline">Open My bookings</Link>}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => goToStep(2)} disabled={submitting || Boolean(created)}><ChevronLeft className="h-4 w-4" /> Back</Button>
                <Button variant="paint" onClick={handleSubmit} loading={submitting} disabled={Boolean(created)} className="!px-8 !py-4 text-base">
                  {confirmLabel}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          </m.div>
          </AnimatePresence>
        </div>

        {/* Fare sheet */}
        <aside className="lg:col-span-4">
          <div className="sticky top-[96px] overflow-hidden rounded-chip border border-line bg-surface">
            <div className="relative aspect-[16/9] bg-ink/5">
              <img src={sizedImage(car.images?.main, 640)} alt="" decoding="async" onError={(e) => handleImageError(e, 640)} className="h-full w-full object-cover" />
              <span className="lacquer absolute left-3 top-3 rounded-lg px-2.5 py-1.5 code-label text-[11px]">Paint {paint.no} · {car.type}</span>
            </div>
            {/* layoutRoot: the lines glide relative to this list, so when the whole sheet moves (on
                phones it sits under the step, which grows when an error appears) nothing slides inside it.
                A flex gap rather than space-y: a line leaving is lifted out of the flow (popLayout),
                and a margin would knock it out of place while it fades. */}
            <m.dl layoutRoot className="relative flex flex-col gap-2.5 p-5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Daily rate</dt><dd className="font-semibold">{rupees(car.dailyRate)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Days</dt><dd className="font-semibold">{totalDays ? <GlideNumber value={totalDays} /> : '–'}</dd></div>
              <AnimatePresence initial={false} mode="popLayout">
                {totalDays > 0 && (
                  <m.div key="rental" layout="position" transition={FARE_GLIDE} variants={fareLine} initial="initial" animate="animate" exit="exit" className="flex justify-between">
                    <dt className="text-muted">Rental</dt><dd className="font-semibold"><GlideNumber value={baseAmount} format={rupees} /></dd>
                  </m.div>
                )}
                {fare.discountAmount > 0 && (
                  <m.div key="promo" layout="position" transition={FARE_GLIDE} variants={fareLine} initial="initial" animate="animate" exit="exit" className="flex justify-between text-ok">
                    <dt>Promo {discountInfo?.percentageOff}%</dt><dd>-<GlideNumber value={Math.round(fare.discountAmount)} format={rupees} /></dd>
                  </m.div>
                )}
                {fare.loyaltyDiscount > 0 && (
                  <m.div key="points" layout="position" transition={FARE_GLIDE} variants={fareLine} initial="initial" animate="animate" exit="exit" className="flex justify-between text-ok">
                    <dt>Loyalty points</dt><dd>-<GlideNumber value={Math.round(fare.loyaltyDiscount)} format={rupees} /></dd>
                  </m.div>
                )}
              </AnimatePresence>
              <m.div layout="position" transition={FARE_GLIDE} className="flex items-end justify-between border-t border-line pt-4">
                <dt className="font-semibold">Estimated total</dt>
                <dd className="font-wide font-black text-3xl">{totalDays > 0 ? <GlideNumber value={fare.totalAmount} format={rupees} /> : '–'}</dd>
              </m.div>
              <m.p layout="position" transition={FARE_GLIDE} className="text-xs text-muted">Taxes included. The final amount is confirmed when you book. Free cancellation before your pickup day.</m.p>
            </m.dl>
          </div>
        </aside>
      </div>

      <PayBookingModal booking={created} onClose={handleCheckoutClosed} onPaid={handlePaid} />
    </div>
  );
}
