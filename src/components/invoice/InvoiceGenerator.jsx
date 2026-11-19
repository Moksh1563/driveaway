// Invoice helpers: the PDF and the WhatsApp message come from the server (the same figures as the
// emails); the message is built here only when the server cannot be reached.
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PAINTS, carTitle } from '../../theme/paints';
import { paymentLabel, paymentRef } from '../../utils/payment';
import { formatDay } from '../../utils/dates';

/**
 * Convert number to words in Indian Rupees format (Lakhs, Crores)
 */
export const numberToWordsINR = (amount) => {
  if (!amount || isNaN(amount)) return 'Zero Rupees Only';
  const num = Math.round(Number(amount));
  if (num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  };

  return inWords(num).trim() + ' Rupees Only';
};

/**
 * Extract resolved customer name and vehicle details dynamically
 */
export const extractBookingInfo = (booking, car) => {
  const customerName = (
    booking?.customerName ||
    (booking?.user && typeof booking.user === 'object' && booking.user.name) ||
    'Valued Customer'
  ).trim();

  const customerEmail = (
    booking?.customerEmail ||
    (booking?.user && typeof booking.user === 'object' && booking.user.email) ||
    'N/A'
  ).trim();

  const customerPhone = (
    booking?.customerPhone ||
    (booking?.user && typeof booking.user === 'object' && booking.user.phone) ||
    'N/A'
  ).trim();

  const carCompany = (car?.company || booking?.car?.company || '').trim();
  const carModel = (car?.name || booking?.car?.name || 'Rental Vehicle').trim();
  const fullVehicleName = carTitle({ name: carModel, company: carCompany }) || 'Rental Vehicle';

  const totalDays = Math.max(1, Number(booking?.totalDays) || 1);
  const dailyRate = Number(booking?.dailyRateSnapshot || car?.dailyRate || booking?.car?.dailyRate || 0);
  const baseRental = totalDays * (dailyRate > 0 ? dailyRate : Math.round(Number(booking?.totalAmount || 0) / totalDays));
  const discountAmount = Math.max(0, Number(booking?.discountAmount) || 0);
  const loyaltyPointsUsed = Math.max(0, Number(booking?.loyaltyPointsUsed) || 0);
  // The server stores the rupee value it applied; older bookings only have the points
  const loyaltyDiscount = Number(booking?.loyaltyDiscount) > 0
    ? Number(booking.loyaltyDiscount)
    : loyaltyPointsUsed > 0 ? Math.round(loyaltyPointsUsed / 10) : 0;
  const totalAmount = Number(
    booking?.totalAmount !== undefined
      ? booking.totalAmount
      : Math.max(0, baseRental - discountAmount - loyaltyDiscount)
  );

  // 18% GST included in the total, split as the server does (server/utils/invoiceFormat.js):
  // CGST and SGST are equal halves in paise and the taxable value takes the last paisa
  const totalP = Math.round(totalAmount * 100);
  const halfGstP = Math.round((totalP - Math.round(totalP / 1.18)) / 2);
  const taxableAmount = (totalP - 2 * halfGstP) / 100;
  const gstAmount = (2 * halfGstP) / 100;
  const cgst = halfGstP / 100;
  const sgst = halfGstP / 100;

  return {
    customerName,
    customerEmail,
    customerPhone,
    carCompany,
    carModel,
    fullVehicleName,
    totalDays,
    dailyRate,
    baseRental,
    discountAmount,
    discountCode: booking?.discountCode || '',
    loyaltyPointsUsed,
    loyaltyDiscount,
    totalAmount,
    taxableAmount,
    gstAmount,
    cgst,
    sgst,
    invoiceNumber: booking?.invoiceNumber || 'DA-2026-000001',
    pickupDate: booking?.pickupDate,
    returnDate: booking?.returnDate,
    pickupLocation: booking?.pickupLocation || 'Main Hub, Ahmedabad',
    licenseNumber: booking?.licenseNumber || '',
    address: booking?.address || '',
    paymentMethod: paymentLabel(booking?.paymentMethod),
    paymentCompleted: Boolean(booking?.paymentCompleted),
    cancelled: booking?.status === 'Cancelled',
    paymentId: paymentRef(booking?.paymentId),
    createdAt: booking?.createdAt || Date.now(),
  };
};

// Bookings whose invoice is downloading now: a second click while it is on its way does nothing
const pdfInFlight = new Set();

/**
 * Download the PDF invoice. The server makes it (server/utils/invoicePdf.js), so the download is
 * exactly the file attached to the booking emails.
 */
export const generatePDF = async (booking) => {
  const id = booking?._id;
  if (!id || pdfInFlight.has(id)) return;
  pdfInFlight.add(id);
  const toastId = toast.loading('Preparing invoice…');
  try {
    const { data } = await api.get(`/bookings/${id}/invoice`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Driveaway_Invoice_${booking.invoiceNumber || 'booking'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.dismiss(toastId);
  } catch {
    toast.error('Could not download the invoice. Please try again.', { id: toastId });
  } finally {
    pdfInFlight.delete(id);
  }
};

/** Date in the invoice style (the trip's day in India time), used by the WhatsApp message. */
const fmtDate = (d) => formatDay(d, { day: '2-digit', month: 'short', year: 'numeric' }) || 'N/A';

/**
 * The public website address used in shared messages. Set VITE_SITE_URL on Vercel to pin it;
 * otherwise it is the address of the site the message is sent from (your Vercel URL when live).
 */
export const siteUrl = () =>
  (import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');

// A coloured square per paint, so the message carries the car's category colour into WhatsApp
const PAINT_SWATCH = { Hypercar: '🟦', Supercar: '🟥', Luxury: '🟩', SUV: '🟨', Electric: '⚡', Sports: '🟧', Sedan: '⬛', Hatchback: '🟪' };

/**
 * Generate the WhatsApp invoice message (WhatsApp formatting: *bold*, _italic_)
 */
export const generateWhatsAppInvoiceMessage = (booking, car) => {
  const info = extractBookingInfo(booking, car);
  const type = car?.type || booking?.car?.type;
  const paint = PAINTS[type];
  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const days = `${info.totalDays} day${info.totalDays > 1 ? 's' : ''}`;
  const site = siteUrl();

  const fare = [
    `${inr(info.dailyRate)} × ${days}: ${inr(info.baseRental)}`,
    info.discountAmount > 0 ? `Promo ${info.discountCode || ''}: −${inr(info.discountAmount)}`.replace('  ', ' ') : null,
    info.loyaltyDiscount > 0 ? `Loyalty points (${info.loyaltyPointsUsed}): −${inr(info.loyaltyDiscount)}` : null,
    `GST 18% included (CGST ${inr(info.cgst)} + SGST ${inr(info.sgst)})`,
  ].filter(Boolean);

  // A cancelled booking owes nothing; one that was paid shows its refund instead of "paid"
  let totalLine;
  let paymentLine;
  if (info.cancelled) {
    totalLine = info.paymentCompleted ? `*Cancelled · refunded: ${inr(info.totalAmount)}*` : `*Cancelled · nothing to pay (was ${inr(info.totalAmount)})*`;
    paymentLine = `Payment: ${info.paymentMethod} · ${info.paymentCompleted ? 'Refunded' : 'Not charged'}`;
  } else {
    const due = info.paymentMethod === 'Cash' ? 'Total due at pickup' : 'Total due';
    totalLine = `*${info.paymentCompleted ? 'Total paid' : due}: ${inr(info.totalAmount)}*`;
    paymentLine = `Payment: ${info.paymentMethod} · ${info.paymentCompleted ? 'Paid ✅' : info.paymentMethod === 'Cash' ? 'Pay at pickup' : 'Not paid yet'}${info.paymentCompleted && info.paymentId ? ` · Ref ${info.paymentId}` : ''}`;
  }

  return [
    `*DRIVEAWAY* · Tax invoice ${info.invoiceNumber}`,
    paint ? `${PAINT_SWATCH[type]} Paint ${paint.no} · ${type} · ${paint.name}` : null,
    '',
    `*${info.fullVehicleName.toUpperCase()}*`,
    `${fmtDate(info.pickupDate)} → ${fmtDate(info.returnDate)} (${days})`,
    `Pickup hub: ${info.pickupLocation}`,
    '',
    '*Fare*',
    ...fare.map((l) => `• ${l}`),
    '',
    totalLine,
    `_${numberToWordsINR(info.totalAmount)}_`,
    paymentLine,
    '',
    `Billed to ${info.customerName}`,
    'Bring your driving licence and an original government ID to the hub.',
    '',
    site && booking?._id ? `View booking and PDF invoice: ${site}/booking-success/${booking._id}` : null,
    site ? `Book your next drive: ${site}` : null,
    'Help: +91 79-2630-0000',
  ].filter((l) => l !== null).join('\n');
};

/** The click-to-chat link for the locally built message (used when the server cannot be reached). */
const localWhatsAppUrl = (booking, car, customPhone) => {
  const rawPhone = customPhone || booking.customerPhone || booking.user?.phone || '';
  let cleanPhone = rawPhone.toString().replace(/[^0-9]/g, '');

  // Prepend 91 for 10-digit Indian numbers
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const encodedMessage = encodeURIComponent(generateWhatsAppInvoiceMessage(booking, car));
  return cleanPhone && cleanPhone.length >= 10
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
    : `https://api.whatsapp.com/send?text=${encodedMessage}`;
};

/**
 * Open WhatsApp with the invoice message. The server builds it (GET /bookings/:id/whatsapp), so the
 * figures match the PDF and the emails to the paisa. The tab is opened straight away, while the click
 * still counts as the user's, and pointed at WhatsApp once the message arrives. If the server is slow
 * (asleep on the free plan), the message built here is used after a few seconds instead.
 */
const WHATSAPP_TIMEOUT_MS = 8000;

export const sendWhatsAppInvoice = async (booking, car, customPhone) => {
  if (!booking) return;
  const tab = window.open('', '_blank');
  if (tab) {
    tab.opener = null;
    // Say what is happening instead of showing an empty tab while the message is fetched
    try {
      tab.document.title = 'Preparing WhatsApp message…';
      if (tab.document.body) tab.document.body.textContent = 'Preparing your WhatsApp message…';
    } catch {
      // Not ours to write to: it simply stays blank until WhatsApp opens
    }
  }

  let url;
  if (booking._id) {
    try {
      const { data } = await api.get(`/bookings/${booking._id}/whatsapp`, {
        params: customPhone ? { phone: customPhone } : undefined,
        timeout: WHATSAPP_TIMEOUT_MS,
      });
      url = data?.url;
    } catch {
      // Fall back to the message built here
    }
  }
  if (!url) url = localWhatsAppUrl(booking, car, customPhone);

  if (tab && !tab.closed) tab.location.href = url;
  else window.open(url, '_blank', 'noopener');
};
