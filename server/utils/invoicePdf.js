/**
 * The one place invoice PDFs are made. Used for the email attachment and for the website's
 * Download invoice button (GET /api/bookings/:id/invoice), so both are always identical.
 * Lacquer design: a band in the car category's paint, the eight-paint strip, hairline rules,
 * and the total set in the same paint, on a white page that prints well.
 * The figures come from invoiceFormat.js, the same ones the booking emails and WhatsApp text show.
 */
const { jsPDF } = require('jspdf');
const { autoTable } = require('jspdf-autotable');
const { PAINTS, PAINT_ORDER, paintFor } = require('./paints');
const { extractBookingInfo, fareLines, formatAmount, formatDate, dayLabel, numberToWordsINR } = require('./invoiceFormat');

// jsPDF takes colours as [r, g, b]
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const INK = [17, 17, 19];
const MUTED = [107, 104, 98];
const LINE = [214, 210, 203];
const GREEN = [21, 128, 61];
const AMBER = [180, 83, 9];
// The PDF's built-in fonts have no rupee glyph, so amounts use "Rs".
const rs = (n) => `Rs ${formatAmount(n)}`;

const STATUS_COLOR = { paid: GREEN, refunded: GREEN, due: AMBER, pending: AMBER, 'refund-due': AMBER, cancelled: MUTED };

/**
 * Generate the PDF tax invoice in the Lacquer design: a band in the car category's paint,
 * the eight-paint strip, hairline rules and the total set in the same paint. White page so it prints well.
 */
const buildInvoicePdf = (booking, car) => {
  const info = extractBookingInfo(booking, car);
  const paint = paintFor(info.carType);
  const P = rgbOf(paint.hex);
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
      doc.setFillColor(...rgbOf(PAINTS[t].hex));
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
  let carLines = doc.splitTextToSize(info.vehicleName.toUpperCase(), W - 2 * M);
  if (carLines.length > 1) {
    doc.setFontSize(21);
    carLines = doc.splitTextToSize(info.vehicleName.toUpperCase(), W - 2 * M).slice(0, 2);
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
    info.customerPhone || null,
    info.customerEmail ? info.customerEmail.slice(0, 44) : null,
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
    ['Pickup', formatDate(info.pickupDate)],
    ['Return', formatDate(info.returnDate)],
    ['Duration', dayLabel(info.totalDays)],
    ['Issued', formatDate(info.createdAt)],
  ];
  const cw = (W - 2 * M) / cols.length;
  cols.forEach(([k, v], i) => {
    label(k, M + i * cw, y + 8);
    text(v.length > 20 ? v.slice(0, 19) + '...' : v, M + i * cw, y + 14, { size: 9, bold: true });
  });
  hairline(y + 20);

  // ── Fare table: base - deductions = total; taxable + CGST + SGST = total ──
  const body = fareLines(info).map((line) =>
    line.kind === 'base'
      ? [`${info.vehicleName}, base fare`, `${line.days} x ${rs(line.rate)}`, rs(line.amount)]
      : [line.label, line.kind === 'promo' ? 'Discount' : 'Redeemed', `- ${rs(line.amount)}`]
  );
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
      if (d.section === 'body' && String(d.cell.raw).startsWith('- ')) d.cell.styles.textColor = GREEN;
    },
  });

  // ── Total in the car's paint ───────────────────────────
  y = doc.lastAutoTable.finalY + 6;
  doc.setFillColor(...P);
  doc.roundedRect(M, y, W - 2 * M, 20, 3, 3, 'F');
  label(`${info.payment.totalLabel} (GST included)`, M + 7, y + 11.5, ON);
  text(rs(info.payment.amount), W - M - 7, y + 13, { size: 17, bold: true, color: ON, align: 'right' });

  y += 27;
  label('Amount in words', M, y);
  text(numberToWordsINR(info.payment.amount), M, y + 6, { size: 9 });

  // ── Payment ────────────────────────────────────────────
  y += 13;
  hairline(y);
  const pay = [
    ['Payment method', info.paymentMethod],
    ['Reference', info.paymentReference.slice(0, 26)],
    ['Status', info.refunded ? `REFUNDED ${formatDate(booking?.refundedAt).toUpperCase()}` : info.payment.short],
  ];
  const pw = (W - 2 * M) / 3;
  pay.forEach(([k, v], i) => {
    label(k, M + i * pw, y + 8);
    text(v, M + i * pw, y + 14, { size: 9.5, bold: true, color: i === 2 ? STATUS_COLOR[info.payment.key] || INK : INK });
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

  return Buffer.from(doc.output('arraybuffer'));
};

const invoiceFilename = (booking) => `Driveaway_Invoice_${booking?.invoiceNumber || 'booking'}.pdf`;

module.exports = { buildInvoicePdf, invoiceFilename };
