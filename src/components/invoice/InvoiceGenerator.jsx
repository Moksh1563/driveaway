// jsPDF is loaded on demand (only when an invoice is downloaded) to keep page loads fast
import { PAINTS, PAINT_ORDER, carTitle } from '../../theme/paints';
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
 * Generate the PDF tax invoice in the Lacquer design: a band in the car category's paint,
 * the eight-paint strip, hairline rules and the total set in the same paint. White page so it prints well.
 */
const rgbOf = (spaceSeparated) => spaceSeparated.split(' ').map(Number);
const INK = [17, 17, 19];
const MUTED = [107, 104, 98];
const LINE = [214, 210, 203];
// The PDF's built-in fonts have no rupee glyph, so amounts use "Rs".
const rs = (n) => {
  const v = Number(n || 0);
  const digits = Number.isInteger(v) ? 0 : 2;
  return `Rs ${v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A');

export const generatePDF = async (booking, car) => {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const info = extractBookingInfo(booking, car);
  const type = car?.type || booking?.car?.type;
  const paint = PAINTS[type] ? { ...PAINTS[type], type } : { no: '00', name: 'Driveaway Ink', rgb: '17 17 19', on: '255 255 255', type: null };
  const P = rgbOf(paint.rgb);
  const ON = rgbOf(paint.on);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16; // page margin

  const label = (value, x, y, color = MUTED, align = 'left') => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setCharSpace(0.6);
    doc.setTextColor(...color);
    doc.text(value.toUpperCase(), x, y, { align });
    doc.setCharSpace(0);
  };
  const text = (value, x, y, { size = 9.5, bold = false, color = INK, align = 'left' } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(value), x, y, { align });
  };
  const hairline = (y) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(M, y, W - M, y);
  };
  const strip = (y, h) => {
    const w = W / PAINT_ORDER.length;
    PAINT_ORDER.forEach((t, i) => {
      doc.setFillColor(...rgbOf(PAINTS[t].rgb));
      doc.rect(i * w, y, w + 0.2, h, 'F');
    });
  };

  // ── Paint band ─────────────────────────────────────────
  doc.setFillColor(...P);
  doc.rect(0, 0, W, 54, 'F');
  text('DRIVEAWAY', M, 17, { size: 15, bold: true, color: ON });
  label('Tax invoice', W - M, 12, ON, 'right');
  text(`#${info.invoiceNumber}`, W - M, 18, { size: 10, bold: true, color: ON, align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  let carLines = doc.splitTextToSize(info.fullVehicleName.toUpperCase(), W - 2 * M);
  if (carLines.length > 1) {
    doc.setFontSize(21);
    carLines = doc.splitTextToSize(info.fullVehicleName.toUpperCase(), W - 2 * M).slice(0, 2);
  }
  doc.setTextColor(...ON);
  doc.text(carLines, M, carLines.length > 1 ? 31 : 39);
  if (paint.type) label(`Paint ${paint.no}  ·  ${paint.type}  ·  ${paint.name}`, M, 47, ON);
  strip(54, 2.2);

  // ── Issued by / Billed to ──────────────────────────────
  let y = 68;
  label('Issued by', M, y);
  label('Billed to', W / 2 + 4, y);
  text('Driveaway Luxury Rentals Pvt. Ltd.', M, y + 7, { bold: true });
  text(info.customerName.length > 34 ? info.customerName.slice(0, 32) + '...' : info.customerName, W / 2 + 4, y + 7, { bold: true });
  const issuer = ['Shop No. 12, SG Highway, Bodakdev', 'Ahmedabad 380054, Gujarat', 'GSTIN 24DRWAY1234A1Z5', '+91 79-2630-0000 · info@driveaway.in'];
  const billed = [
    info.customerPhone !== 'N/A' ? info.customerPhone : null,
    info.customerEmail !== 'N/A' ? info.customerEmail : null,
    info.licenseNumber ? `Licence ${info.licenseNumber}` : null,
    info.address ? info.address.slice(0, 44) : 'Ahmedabad, Gujarat',
  ].filter(Boolean);
  issuer.forEach((l, i) => text(l, M, y + 13 + i * 5, { size: 8.5, color: MUTED }));
  billed.forEach((l, i) => text(l, W / 2 + 4, y + 13 + i * 5, { size: 8.5, color: MUTED }));

  // ── The drive ──────────────────────────────────────────
  y = 102;
  hairline(y);
  const cols = [
    ['Pickup hub', info.pickupLocation],
    ['Pickup', fmtDate(info.pickupDate)],
    ['Return', fmtDate(info.returnDate)],
    ['Duration', `${info.totalDays} day${info.totalDays > 1 ? 's' : ''}`],
    ['Issued', fmtDate(info.createdAt)],
  ];
  const cw = (W - 2 * M) / cols.length;
  cols.forEach(([k, v], i) => {
    label(k, M + i * cw, y + 8);
    text(v.length > 20 ? v.slice(0, 19) + '...' : v, M + i * cw, y + 14, { size: 9, bold: true });
  });
  hairline(y + 20);

  // ── Fare table ─────────────────────────────────────────
  const body = [[`${info.fullVehicleName}, base fare`, `${info.totalDays} x ${rs(info.dailyRate)}`, rs(info.baseRental)]];
  if (info.discountAmount > 0) body.push([`Promo code ${info.discountCode || ''}`.trim(), 'Discount', `- ${rs(info.discountAmount)}`]);
  if (info.loyaltyDiscount > 0) body.push([`Loyalty points (${info.loyaltyPointsUsed})`, 'Redeemed', `- ${rs(info.loyaltyDiscount)}`]);
  body.push(['Taxable value', '', rs(info.taxableAmount)]);
  body.push(['CGST 9%', '', rs(info.cgst)]);
  body.push(['SGST 9%', '', rs(info.sgst)]);

  autoTable(doc, {
    startY: y + 25,
    head: [['DESCRIPTION', 'DETAILS', 'AMOUNT']],
    body,
    theme: 'plain',
    margin: { left: M, right: M },
    styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 3, bottom: 3, left: 0, right: 0 }, lineColor: LINE },
    headStyles: { fontSize: 7, fontStyle: 'bold', textColor: MUTED, lineWidth: { bottom: 0.25 } },
    bodyStyles: { lineWidth: { bottom: 0.25 } },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 44, textColor: MUTED }, 2: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (d) => {
      if (d.section === 'head' && d.column.index === 2) d.cell.styles.halign = 'right';
      if (d.section === 'body' && String(d.cell.raw).startsWith('- ')) d.cell.styles.textColor = [21, 128, 61];
    },
  });

  // ── Total in the car's paint ───────────────────────────
  y = doc.lastAutoTable.finalY + 6;
  doc.setFillColor(...P);
  doc.roundedRect(M, y, W - 2 * M, 20, 3, 3, 'F');
  label(info.paymentCompleted ? 'Total paid (GST included)' : 'Total due at pickup (GST included)', M + 7, y + 11.5, ON);
  text(rs(info.totalAmount), W - M - 7, y + 13, { size: 17, bold: true, color: ON, align: 'right' });

  y += 27;
  label('Amount in words', M, y);
  text(numberToWordsINR(info.totalAmount), M, y + 6, { size: 9 });

  // ── Payment ────────────────────────────────────────────
  y += 13;
  hairline(y);
  const pay = [
    ['Payment method', info.paymentMethod],
    ['Reference', info.paymentId.slice(0, 26)],
    ['Status', info.paymentCompleted ? 'PAID' : 'PAY AT PICKUP'],
  ];
  const pw = (W - 2 * M) / 3;
  pay.forEach(([k, v], i) => {
    label(k, M + i * pw, y + 8);
    text(v, M + i * pw, y + 14, { size: 9.5, bold: true, color: i === 2 ? (info.paymentCompleted ? [21, 128, 61] : [180, 83, 9]) : INK });
  });
  hairline(y + 20);

  // ── Footer: flows under the content; moves to a new page if it would not fit ──
  strip(H - 6, 6);
  if (y + 48 > H) { // the payment block ends at y + 20; the footer needs the last ~28mm
    doc.addPage();
    strip(H - 6, 6);
  }
  text('Thank you for driving with Driveaway. This is a computer-generated tax invoice and needs no signature.', M, H - 20, { size: 8, color: MUTED });
  text('Questions? +91 79-2630-0000 · info@driveaway.in · Place of supply: Ahmedabad, Gujarat (24)', M, H - 15, { size: 8, color: MUTED });

  doc.save(`Driveaway_Invoice_${info.invoiceNumber}.pdf`);
};

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
