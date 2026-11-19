/**
 * WhatsApp invoice text and click-to-chat link (GET /api/bookings/:id/whatsapp).
 * Same message design as the website's Share on WhatsApp button, and the same figures as the
 * PDF invoice and booking emails (invoiceFormat.js). Nothing is sent from the server: the link
 * opens WhatsApp with the message ready for the customer or the hub to send.
 */
const { PAINTS } = require('./paints');
const { extractBookingInfo, fareLines, formatAmount, formatDate, dayLabel, numberToWordsINR } = require('./invoiceFormat');
const { clientUrl } = require('../middleware/securityMiddleware');

// A coloured square per paint, so the message carries the car's category colour into WhatsApp
const PAINT_SWATCH = { Hypercar: '🟦', Supercar: '🟥', Luxury: '🟩', SUV: '🟨', Electric: '⚡', Sports: '🟧', Sedan: '⬛', Hatchback: '🟪' };

/**
 * Format phone number to international standard without '+'
 * Default to India (+91) if 10 digits
 */
const formatWhatsAppPhone = (phone) => {
  if (!phone) return '';
  let cleaned = phone.toString().replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
};

/**
 * Generate the WhatsApp invoice message (WhatsApp formatting: *bold*, _italic_)
 */
const generateWhatsAppInvoiceText = (booking, car) => {
  const info = extractBookingInfo(booking, car);
  const paint = PAINTS[info.carType];
  const inr = (n) => `₹${formatAmount(n)}`;
  const days = dayLabel(info.totalDays);
  const site = clientUrl().replace(/\/+$/, '');

  const fare = fareLines(info).map((line) =>
    line.kind === 'base' ? `${inr(line.rate)} × ${days}: ${inr(line.amount)}` : `${line.label}: −${inr(line.amount)}`
  );
  fare.push(`GST 18% included (CGST ${inr(info.cgst)} + SGST ${inr(info.sgst)})`);

  return [
    `*DRIVEAWAY* · Tax invoice ${info.invoiceNumber}`,
    paint ? `${PAINT_SWATCH[info.carType]} Paint ${paint.no} · ${info.carType} · ${paint.name}` : null,
    '',
    `*${info.vehicleName.toUpperCase()}*`,
    `${formatDate(info.pickupDate)} → ${formatDate(info.returnDate)} (${days})`,
    `Pickup hub: ${info.pickupLocation}`,
    '',
    '*Fare*',
    ...fare.map((l) => `• ${l}`),
    '',
    `*${info.payment.totalLabel}: ${inr(info.payment.amount)}*`,
    `_${numberToWordsINR(info.payment.amount)}_`,
    `Payment: ${info.paymentMethod} · ${info.payment.label}${info.paid && info.paymentId ? ` · Ref ${info.paymentId}` : ''}`,
    '',
    `Billed to ${info.customerName}`,
    info.cancelled ? null : 'Bring your driving licence and an original government ID to the hub.',
    '',
    booking?._id ? `View booking and PDF invoice: ${site}/booking-success/${booking._id}` : null,
    `Book your next drive: ${site}`,
    'Help: +91 79-2630-0000',
  ].filter((l) => l !== null).join('\n');
};

/**
 * Generate click-to-chat WhatsApp URL
 */
const getWhatsAppUrl = (phone, text) => {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone && cleanPhone.length >= 10) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
};

module.exports = {
  formatWhatsAppPhone,
  generateWhatsAppInvoiceText,
  getWhatsAppUrl,
};
