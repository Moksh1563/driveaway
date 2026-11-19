import { istDay, todayIST } from './dates';

const METHOD_LABELS = { UPI: 'UPI', CARD: 'Card', NETBANKING: 'Net banking', WALLET: 'Wallet' };

/**
 * Readable payment method. Online payments are stored as 'Online test (UPI)' and so on (older
 * bookings as 'Razorpay (...)'); customers and admins see just the method, e.g. 'UPI'.
 */
export const paymentLabel = (method) => {
  if (!method) return 'Online';
  const m = /^(?:Online test|Razorpay)\s*\((\w+)\)$/i.exec(method);
  if (m) return METHOD_LABELS[m[1].toUpperCase()] || m[1];
  if (/^(?:Online test|Razorpay)$/i.test(method)) return 'Online';
  return method;
};

/** Payment reference as shown to people: bookings paid before references changed read 'pay_TEST_...'. */
export const paymentRef = (id) => (id ? String(id).trim().replace(/^pay_TEST_/i, 'pay_') : '');

/**
 * Where a booking's money stands, worded for customers. A paid booking that was cancelled reads
 * as refunded rather than "paid".
 * tone: 'ok' | 'warn' | 'muted'
 */
export const paymentStatus = (booking) => {
  const paid = Boolean(booking?.paymentCompleted);
  if (booking?.status === 'Cancelled') {
    return paid ? { label: 'Refunded', tone: 'muted' } : { label: 'Not charged', tone: 'muted' };
  }
  if (paid) return { label: 'Paid', tone: 'ok' };
  return booking?.paymentMethod === 'Cash'
    ? { label: 'Pay at pickup', tone: 'warn' }
    : { label: 'Payment due', tone: 'warn' };
};

export const PAYMENT_TONE = { ok: 'text-ok', warn: 'text-warn', muted: 'text-muted' };

// Stored booking dates are IST calendar days; compare them as days, the way the server does
const afterToday = (value) => Boolean(value) && istDay(value) > todayIST();

/**
 * The server accepts an online payment only for an unpaid Pending booking whose trip has not ended.
 * Bookings from the API carry the server's own answer (canPay); it is used when present.
 */
export const canPayOnline = (booking) => {
  if (!booking) return false;
  if (typeof booking.canPay === 'boolean') return booking.canPay;
  return !booking.paymentCompleted && booking.status === 'Pending' && afterToday(booking.returnDate);
};

/** Customers can cancel a Pending or Confirmed booking before its pickup day (server: canCancel). */
export const canCancel = (booking) => {
  if (!booking) return false;
  if (typeof booking.canCancel === 'boolean') return booking.canCancel;
  return ['Pending', 'Confirmed'].includes(booking.status) && afterToday(booking.pickupDate);
};
