/**
 * Invoice figures and wording shared by the PDF invoice (invoicePdf.js), the booking emails
 * (emailService.js) and the WhatsApp text (whatsappService.js), so all three always show the
 * same line items. Money is worked out in paise, and the lines always add up exactly to the
 * total stored on the booking.
 */
const { TIME_ZONE } = require('./dates');

/** "McLaren Senna" stays as is; "Spectre" from Rolls-Royce becomes "Rolls-Royce Spectre". Plain text. */
const firstWord = (s) => s.toLowerCase().split(/[\s-]/)[0];
const carTitle = (car) => {
  const name = String(car?.name || '').trim();
  const company = String(car?.company || '').trim();
  return company && firstWord(name) !== firstWord(company) ? `${company} ${name}` : name;
};

const METHOD_LABELS = { UPI: 'UPI', CARD: 'Card', NETBANKING: 'Net banking', WALLET: 'Wallet' };

/**
 * Readable payment method. Online payments are stored as 'Online test (UPI)' and so on (older
 * bookings as 'Razorpay (...)'); invoices, emails and WhatsApp show just the method, e.g. 'UPI'.
 */
const paymentLabel = (method) => {
  if (!method) return 'Online';
  const m = /^(?:Online test|Razorpay)\s*\((\w+)\)$/i.exec(String(method));
  if (m) return METHOD_LABELS[m[1].toUpperCase()] || m[1];
  if (/^(?:Online test|Razorpay)$/i.test(String(method))) return 'Online';
  return String(method);
};

/** Payment reference as shown to people: bookings paid before references changed read 'pay_TEST_...'. */
const paymentRef = (id) => (id ? String(id).trim().replace(/^pay_TEST_/i, 'pay_') : '');

/** Calendar date in India time ("05 Nov 2026"). Booking days are stored as UTC midnight, which is the same date in India. */
const formatDate = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TIME_ZONE });
};

/** Indian digit grouping; whole rupees without decimals, otherwise two decimals ("1,23,456" or "1,525.42"). */
const formatAmount = (n) => {
  const v = Number(n) || 0;
  const digits = Number.isInteger(v) ? 0 : 2;
  return v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const dayLabel = (n) => `${n} day${n === 1 ? '' : 's'}`;

/**
 * Convert number to words in Indian Rupees format (Lakhs, Crores)
 */
const numberToWordsINR = (amount) => {
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

const toPaise = (n) => Math.round((Number(n) || 0) * 100);
const fromPaise = (p) => Math.round(p) / 100;
const hasNumber = (v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));

/**
 * Payment state of a booking, with the wording every document uses for it.
 * `amount` is the figure the total box shows: what was paid (or refunded), else what is due.
 */
const paymentState = ({ booking, totalP, paidP }) => {
  const cancelled = booking.status === 'Cancelled';
  const paid = Boolean(booking.paymentCompleted);
  if (cancelled && paid && booking.refundedAt) {
    return { key: 'refunded', label: `Refunded on ${formatDate(booking.refundedAt)}`, short: 'REFUNDED', totalLabel: 'Total refunded', amountP: paidP };
  }
  if (cancelled && paid) return { key: 'refund-due', label: 'Cancelled, refund due', short: 'REFUND DUE', totalLabel: 'Refund due', amountP: paidP };
  if (cancelled) return { key: 'cancelled', label: 'Cancelled, nothing to pay', short: 'CANCELLED', totalLabel: 'Booking total (cancelled)', amountP: totalP };
  if (paid) return { key: 'paid', label: 'Paid', short: 'PAID', totalLabel: 'Total paid', amountP: paidP };
  if (/^cash$/i.test(String(booking.paymentMethod || ''))) {
    return { key: 'due', label: 'Due at pickup', short: 'PAY AT PICKUP', totalLabel: 'Total due at pickup', amountP: totalP };
  }
  return { key: 'pending', label: 'Payment pending', short: 'PAYMENT PENDING', totalLabel: 'Total due', amountP: totalP };
};

/**
 * The money on a booking, as the documents show it.
 *  - Deductions are whole rupees: the promo code (discountAmount) and loyalty points (loyaltyDiscount;
 *    older bookings only stored the points, at 10 points = Rs 1).
 *  - base fare - promo - loyalty = totalAmount exactly. Older bookings subtracted fractional rupees and
 *    rounded only the total; that leftover (under Rs 2) goes into the last deduction, which is what was
 *    actually taken off. Any larger gap means the stored rate does not match the total, so the base
 *    fare follows the total.
 *  - GST is included at 18%: CGST and SGST are equal halves, and the taxable value takes the last paisa,
 *    so taxable + CGST + SGST = total exactly.
 */
const invoiceTotals = (booking, car) => {
  const b = booking || {};
  const carDoc = car || (b.car && typeof b.car === 'object' ? b.car : null);
  const totalDays = Math.max(1, Number(b.totalDays) || 1);
  const rateP = toPaise(b.dailyRateSnapshot || carDoc?.dailyRate || b.car?.dailyRate || 0);
  const pointsUsed = Math.max(0, Number(b.loyaltyPointsUsed) || 0);

  const promoRawP = Math.max(0, toPaise(b.discountAmount));
  const loyaltyRawP = hasNumber(b.loyaltyDiscount) && Number(b.loyaltyDiscount) > 0
    ? toPaise(b.loyaltyDiscount)
    : toPaise(pointsUsed / 10);
  let promoP = Math.round(promoRawP / 100) * 100;
  let loyaltyP = Math.round(loyaltyRawP / 100) * 100;

  let baseP = rateP > 0 ? rateP * totalDays : null;
  const totalP = hasNumber(b.totalAmount)
    ? Math.max(0, toPaise(b.totalAmount))
    : Math.max(0, (baseP || 0) - promoP - loyaltyP);
  if (baseP === null) baseP = totalP + promoP + loyaltyP;

  let rateShownP = rateP > 0 ? rateP : Math.round(baseP / totalDays);
  const gap = baseP - promoP - loyaltyP - totalP;
  if (gap !== 0) {
    if (Math.abs(gap) <= 200 && loyaltyRawP > 0 && loyaltyP + gap >= 0) loyaltyP += gap;
    else if (Math.abs(gap) <= 200 && promoRawP > 0 && promoP + gap >= 0) promoP += gap;
    else {
      baseP -= gap;
      rateShownP = Math.round(baseP / totalDays);
    }
  }

  const halfGstP = Math.round((totalP - Math.round(totalP / 1.18)) / 2);
  const taxableP = totalP - 2 * halfGstP;

  const paid = Boolean(b.paymentCompleted);
  const paidP = paid ? (hasNumber(b.paidAmount) ? Math.max(0, toPaise(b.paidAmount)) : totalP) : 0;
  const { amountP, ...payment } = paymentState({ booking: b, totalP, paidP });

  return {
    totalDays,
    dailyRate: fromPaise(rateShownP),
    baseRental: fromPaise(baseP),
    discountCode: String(b.discountCode || ''),
    discountAmount: fromPaise(promoP),
    loyaltyPointsUsed: pointsUsed,
    loyaltyDiscount: fromPaise(loyaltyP),
    totalAmount: fromPaise(totalP),
    taxableAmount: fromPaise(taxableP),
    cgst: fromPaise(halfGstP),
    sgst: fromPaise(halfGstP),
    gstAmount: fromPaise(2 * halfGstP),
    paid,
    paidAmount: fromPaise(paidP),
    cancelled: b.status === 'Cancelled',
    refunded: payment.key === 'refunded',
    payment: { ...payment, amount: fromPaise(amountP) },
  };
};

/**
 * The fare as line items: the base fare, then the deductions (positive amounts with `deduction: true`).
 * Each document formats them in its own style; the numbers are always these.
 */
const fareLines = (totals) => {
  const lines = [{ kind: 'base', label: 'Base fare', days: totals.totalDays, rate: totals.dailyRate, amount: totals.baseRental }];
  if (totals.discountAmount > 0) {
    lines.push({ kind: 'promo', label: `Promo code ${totals.discountCode}`.trim(), amount: totals.discountAmount, deduction: true });
  }
  if (totals.loyaltyDiscount > 0) {
    const points = totals.loyaltyPointsUsed > 0 ? ` (${totals.loyaltyPointsUsed.toLocaleString('en-IN')})` : '';
    lines.push({ kind: 'loyalty', label: `Loyalty points${points}`, amount: totals.loyaltyDiscount, deduction: true });
  }
  return lines;
};

/**
 * Everything an invoice shows: customer, vehicle, trip, payment and the money (invoiceTotals).
 * The email shown is the account's (booking.user, when populated): booking emails and invoices go to
 * the account, never to an address typed into the booking form.
 */
const extractBookingInfo = (booking, car) => {
  const b = booking || {};
  const account = b.user && typeof b.user === 'object' ? b.user : {};
  const carDoc = car || (b.car && typeof b.car === 'object' ? b.car : {}) || {};
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  const totals = invoiceTotals(b, carDoc);
  const isCash = /^cash$/i.test(String(b.paymentMethod || ''));

  return {
    customerName: text(b.customerName) || text(account.name) || 'Valued Customer',
    customerEmail: text(account.email) || text(b.customerEmail),
    customerPhone: text(b.customerPhone) || text(account.phone),
    vehicleName: carTitle(carDoc) || 'Rental vehicle',
    carType: carDoc.type || null,
    invoiceNumber: b.invoiceNumber || 'N/A',
    pickupDate: b.pickupDate,
    returnDate: b.returnDate,
    pickupLocation: text(b.pickupLocation) || 'Main hub, Ahmedabad',
    licenseNumber: text(b.licenseNumber),
    address: text(b.address),
    paymentMethod: paymentLabel(b.paymentMethod),
    paymentId: paymentRef(b.paymentId),
    paymentReference: paymentRef(b.paymentId) || (totals.paid ? (isCash ? 'Collected at hub' : 'N/A') : 'Not paid yet'),
    createdAt: b.createdAt || new Date(),
    ...totals,
  };
};

module.exports = {
  carTitle,
  paymentLabel,
  paymentRef,
  formatDate,
  formatAmount,
  dayLabel,
  numberToWordsINR,
  invoiceTotals,
  fareLines,
  extractBookingInfo,
};
