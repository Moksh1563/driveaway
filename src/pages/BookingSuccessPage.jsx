import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, MessageCircle, ArrowRight } from 'lucide-react';
import api from '../api/axios';
import { generatePDF, sendWhatsAppInvoice } from '../components/invoice/InvoiceGenerator';
import Badge from '../components/ui/Badge';
import { carTitle, paintFor, paintStyle, rupees } from '../theme/paints';
import { sizedImage, handleImageError } from '../utils/image';
import { SuccessSkeleton } from '../components/ui/Skeletons';

const longDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function BookingSuccessPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get(`/bookings/${id}`)
      .then(({ data }) => { if (!cancelled) setBooking(data); })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <SuccessSkeleton />;

  if (!booking) {
    return (
      <div className="page-container grid min-h-screen place-items-center pt-[72px] text-center">
        <div>
          <h1 className="display text-5xl">Booking not found</h1>
          <Link to="/dashboard" className="btn-ink mt-8">Go to my garage</Link>
        </div>
      </div>
    );
  }

  const car = booking.car || {};
  const paint = paintFor(car.type);
  const paid = booking.paymentCompleted;
  const points = Math.floor((booking.totalAmount || 0) / 100);

  return (
    <div className="pt-[72px]" style={paintStyle(car.type)}>
      <section className="lacquer on-paint">
        <div className="page-container grid gap-10 py-14 lg:grid-cols-12 lg:py-20">
          <div className="min-w-0 lg:col-span-6" style={{ containerType: 'inline-size' }}>
            {/* Sized so the longest word ("RESERVED.") always fits its column */}
            <h1 className="display" style={{ fontSize: 'min(5.5rem, calc(100cqw / 8.4))' }}>
              {paid ? 'The keys are yours.' : 'Your car is reserved.'}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-snug">
              {paid
                ? `Payment received. Collect your ${car.name} at ${booking.pickupLocation || 'your hub'} on ${longDate(booking.pickupDate)}.`
                : `Pay in cash when you collect your ${car.name} at ${booking.pickupLocation || 'your hub'}, or pay online from your garage.`}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => generatePDF(booking, car)} className="btn !bg-on-paint !text-paint !px-6 !py-3.5">
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
                <img src={sizedImage(car.images?.main, 960)} alt={car.name || ''} onError={(e) => handleImageError(e, 960)} className="h-full w-full object-cover" />
                <span className="lacquer absolute left-4 top-4 rounded-lg px-2.5 py-1.5 code-label text-[11px]">Paint {paint.no} · {car.type}</span>
                <span
                  className="stamp-in absolute bottom-4 right-4 rotate-[-8deg] rounded-lg border-[3px] border-white bg-[#0C0C0D]/80 px-4 py-2 font-wide font-black uppercase tracking-tight text-xl text-white shadow-lift"
                  aria-hidden="true"
                >
                  {paid ? 'Paid' : 'Reserved'}
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
                  <dt className="text-muted">{paid ? 'Paid' : 'Due at pickup'}</dt>
                  <dd className="font-wide font-black text-3xl">{rupees(booking.totalAmount)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="page-container flex flex-wrap items-center justify-between gap-6 py-12">
        <p className="text-muted">
          You earned <strong className="text-ink">{points.toLocaleString('en-IN')} loyalty points</strong> with this booking.
        </p>
        <Link to="/dashboard" className="btn-ink">Go to my garage <ArrowRight className="h-4 w-4" /></Link>
      </section>
    </div>
  );
}
