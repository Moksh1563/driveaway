// Invoice helpers: the PDF comes from the server; the WhatsApp message is built here.
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PAINTS, carTitle } from '../../theme/paints';
import { paymentLabel } from '../../utils/payment';

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
  const loyaltyDiscount = loyaltyPointsUsed > 0 ? Math.round(loyaltyPointsUsed / 10) : 0;
  const totalAmount = Number(
    booking?.totalAmount !== undefined
      ? booking.totalAmount
      : Math.max(0, baseRental - discountAmount - loyaltyDiscount)
  );

  // 18% GST (Tax included in total)
  const taxableAmount = Math.round((totalAmount / 1.18) * 100) / 100;
  const gstAmount = Math.round((totalAmount - taxableAmount) * 100) / 100;
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const sgst = Math.round((gstAmount / 2) * 100) / 100;

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
    paymentId: booking?.paymentId || (booking?.paymentCompleted ? 'PAID-ONLINE' : 'PENDING'),
    createdAt: booking?.createdAt || Date.now(),
  };
};

/**
 * Download the PDF invoice. The server makes it (server/utils/invoicePdf.js), so the download is
 * exactly the file attached to the booking emails.
 */
export const generatePDF = async (booking) => {
  const id = booking?._id;
  if (!id) return;
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
  } catch {
    toast.error('Could not download the invoice. Please try again.');
  }
};

/** Date in the invoice style, used by the WhatsApp message. */
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A');

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
    `*${info.paymentCompleted ? 'Total paid' : 'Total due at pickup'}: ${inr(info.totalAmount)}*`,
    `_${numberToWordsINR(info.totalAmount)}_`,
    `Payment: ${info.paymentMethod} · ${info.paymentCompleted ? 'Paid ✅' : 'Pay at pickup'}${info.paymentCompleted && info.paymentId ? ` · Ref ${info.paymentId}` : ''}`,
    '',
    `Billed to ${info.customerName}`,
    'Bring your driving licence and an original government ID to the hub.',
    '',
    site && booking?._id ? `View booking and PDF invoice: ${site}/booking-success/${booking._id}` : null,
    site ? `Book your next drive: ${site}` : null,
    'Help: +91 79-2630-0000',
  ].filter((l) => l !== null).join('\n');
};

/**
 * Trigger WhatsApp invoice send
 */
export const sendWhatsAppInvoice = (booking, car, customPhone) => {
  if (!booking) return;

  const rawPhone = customPhone || booking.customerPhone || booking.user?.phone || '';
  let cleanPhone = rawPhone.toString().replace(/[^0-9]/g, '');

  // Prepend 91 for 10-digit Indian numbers
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const message = generateWhatsAppInvoiceMessage(booking, car);
  const encodedMessage = encodeURIComponent(message);

  const url = cleanPhone && cleanPhone.length >= 10
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
    : `https://api.whatsapp.com/send?text=${encodedMessage}`;

  window.open(url, '_blank');
};
