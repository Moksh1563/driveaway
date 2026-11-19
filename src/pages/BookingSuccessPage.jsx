import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, MessageCircle, ArrowRight, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { generatePDF, sendWhatsAppInvoice } from '../components/invoice/InvoiceGenerator';
import PayBookingModal from '../components/booking/PayBookingModal';
import Badge from '../components/ui/Badge';
import { carTitle, paintFor, paintStyle, rupees } from '../theme/paints';
import { sizedImage, handleImageError } from '../utils/image';
import { formatDay } from '../utils/dates';
import { canPayOnline, paymentStatus } from '../utils/payment';
import usePageTitle from '../hooks/usePageTitle';
import { SuccessSkeleton } from '../components/ui/Skeletons';

const LONG_DAY = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
const longDate = (d) => formatDay(d, LONG_DAY);

export default function BookingSuccessPage() {
  const { id } = useParams();
  const { refreshUser } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | notfound | error
  const [loadError, setLoadError] = useState('');
  const [paying, setPaying] = useState(null);
  const request = useRef(0);

  // quiet: refresh in place (after a payment) without the skeleton or error screens
  const load = useCallback(async (quiet = false) => {
    const n = ++request.current;
    if (!quiet) setLoadState('loading');
    try {
      const { data } = await api.get(`/bookings/${id}`);
      if (n !== request.current) return;
      setBooking(data);
      setLoadState('ready');
    } catch (err) {
      if (n !== request.current || quiet) return;
      const status = err.response?.status;
      setLoadError(err.response?.data?.message || 'Could not load this booking.');
      setLoadState(status === 404 || status === 400 || status === 403 ? 'notfound' : 'error');
    }
  }, [id]);

  useEffect(() => {
    load();
    return () => { request.current += 1; };
  }, [load]);

  usePageTitle(booking?.invoiceNumber ? `Booking ${booking.invoiceNumber}` : null);

  const handlePaid = (updated) => {
    setPaying(null);
    if (updated && updated._id) {
      setBooking((prev) => ({ ...prev, ...updated, car: updated.car && typeof updated.car === 'object' ? updated.car : prev.car }));
    }
    toast.success('Payment received');
    refreshUser();
    load(true);
  };

  if (loadState === 'loading' && !booking) return <SuccessSkeleton />;

  if (!booking) {
    const notFound = loadState === 'notfound';
    return (
      <div className="page-container grid min-h-screen place-items-center pt-[72px] text-center">
        <div role={notFound ? undefined : 'alert'}>
          <h1 className="display text-5xl">{notFound ? 'Booking not found' : 'Could not load your booking'}</h1>
          {!notFound && <p className="mt-4 text-muted">{loadError}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!notFound && <button type="button" onClick={() => load()} className="btn-ink">Try again</button>}
            <Link to="/dashboard" className={notFound ? 'btn-ink' : 'btn-line'}>Go to my garage</Link>
          </div>
        </div>
      </div>
    );
  }

  const car = booking.car || {};
  const paint = paintFor(car.type);
  const paid = Boolean(booking.paymentCompleted);
  const cancelled = booking.status === 'Cancelled';
  const cash = booking.paymentMethod === 'Cash';
  const payable = canPayOnline(booking);
  const money = paymentStatus(booking);
  const points = Math.floor((booking.totalAmount || 0) / 100);
  const hub = booking.pickupLocation || 'your hub';

  const headline = cancelled ? 'This booking is cancelled.' : paid ? 'The keys are yours.' : 'Your car is reserved.';
  let lead;
  if (cancelled) lead = paid ? `Your payment of ${rupees(booking.paidAmount ?? booking.totalAmount)} has been refunded.` : 'Nothing was charged for this booking.';
  else if (paid) lead = `Payment received. Collect your ${car.name} at ${hub} on ${longDate(booking.pickupDate)}.`;
  // Online payment is only open while the booking waits for confirmation; after that it is cash at the hub
  else if (!payable) lead = `Pay ${rupees(booking.totalAmount)} in cash at ${hub} when you collect the car.`;
  else if (cash) lead = `Pay in cash when you collect your ${car.name} at ${hub}, or pay online from your garage.`;
  else lead = `Payment is still due. Pay online now, or pay later from My bookings or in cash at ${hub}.`;
  const stamp = cancelled ? (paid ? 'Refunded' : 'Cancelled') : paid ? 'Paid' : 'Reserved';
  const totalLabel = cancelled || paid ? money.label : cash ? 'Due at pickup' : 'Payment due';

  return (
    <div className="pt-[72px]" style={paintStyle(car.type)}>
      <section className="lacquer on-paint">
        <div className="page-container grid gap-10 py-14 lg:grid-cols-12 lg:py-20">
          <div className="min-w-0 lg:col-span-6" style={{ containerType: 'inline-size' }}>
            {/* Sized so the longest word ("CANCELLED.") always fits its column */}
            <h1 className="display" style={{ fontSize: 'min(5.5rem, calc(100cqw / 9.2))' }}>
              {headline}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-snug">{lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {payable && (
                <button type="button" onClick={() => setPaying(booking)} className="btn !bg-on-paint !text-paint !px-6 !py-3.5">
                  <CreditCard className="h-4 w-4" /> Pay {rupees(booking.totalAmount)} now
                </button>
              )}
              <button
                type="button"
                onClick={() => generatePDF(booking, car)}
                className={payable ? 'btn border border-on-paint/40 !px-6 !py-3.5 hover:border-on-paint' : 'btn !bg-on-paint !text-paint !px-6 !py-3.5'}
              >
                <Download className="h-4 w-4" /> Download invoice
              </button>
              <button type="button" onClick={() => sendWhatsAppInvoice(booking, car)} className="btn border border-on-paint/40 !px-6 !py-3.5 hover:border-on-paint">
                <MessageCircle className="h-4 w-4" /> Send to WhatsApp
              </button>
            </div>
          </div>

          {/* Job sheet */}
          <div className="enter lg:col-span-6" style={{ '--d': '150ms' }}>
            <div className="overflow-hidden rounded-chip bg-raised text-ink shadow-lift">
              <div className="relative aspect-[16/7] bg-ink/10">
                <img src={sizedImage(car.images?.main, 960)} alt={car.name || ''} onError={(e) => handleImageError(e, 960)} className={`h-full w-full object-cover ${cancelled ? 'unlit' : ''}`} />
                <span className="lacquer absolute left-4 top-4 rounded-lg px-2.5 py-1.5 code-label text-[11px]">Paint {paint.no} · {car.type}</span>
                <span
                  className="stamp-in absolute bottom-4 right-4 rotate-[-8deg] rounded-lg border-[3px] border-white bg-[#0C0C0D]/80 px-4 py-2 font-wide font-black uppercase tracking-tight text-xl text-white shadow-lift"
                  aria-hidden="true"
                >
                  {stamp}
                </span>
              </div>
              <dl className="divide-y divide-line text-sm">
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <dt className="text-muted">Invoice</dt><dd className="font-semibold">{booking.invoiceNumber}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <dt className="text-muted">Car</dt><dd className="text-right font-semibold">{carTitle(car)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <dt className="text-muted">Pickup</dt><dd className="text-right font-semibold">{booking.pickupLocation || 'To be confirmed'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <dt className="text-muted">Dates</dt>
                  <dd className="text-right font-semibold">{longDate(booking.pickupDate)} to {longDate(booking.returnDate)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <dt className="text-muted">Status</dt><dd><Badge status={booking.status} /></dd>
                </div>
                <div className="flex items-end justify-between gap-4 bg-ink/[0.03] px-6 py-5">
                  <dt className="text-muted">{totalLabel}</dt>
                  <dd className={`font-wide font-black text-3xl ${cancelled ? 'text-muted line-through decoration-2' : ''}`}>{rupees(booking.totalAmount)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="page-container flex flex-wrap items-center justify-between gap-6 py-12">
        <p className="text-muted">
          {cancelled ? (
            'Cancelled bookings do not earn loyalty points.'
          ) : booking.status === 'Completed' ? (
            <>You earned <strong className="text-ink">{points.toLocaleString('en-IN')} loyalty points</strong> with this trip.</>
          ) : (
            <>You will earn <strong className="text-ink">{points.toLocaleString('en-IN')} loyalty points</strong> when this trip is completed.</>
          )}
        </p>
        <Link to="/dashboard" className="btn-ink">Go to my garage <ArrowRight className="h-4 w-4" /></Link>
      </section>

      {/* Leaving the checkout re-reads the booking, in case a failed payment means it has changed */}
      <PayBookingModal booking={paying} onClose={() => { setPaying(null); load(true); }} onPaid={handlePaid} />
    </div>
  );
}
