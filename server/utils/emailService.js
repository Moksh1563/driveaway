require('dotenv').config();
const nodemailer = require('nodemailer');
const { escapeHtml } = require('../middleware/securityMiddleware');
const { PAINTS, PAINT_ORDER, paintFor } = require('./paints');

// Escape user-controlled booking fields before they are embedded in email HTML
const safeBooking = (booking) => {
  const obj = booking && typeof booking.toObject === 'function' ? booking.toObject() : { ...booking };
  ['customerName', 'pickupLocation', 'discountCode', 'paymentMethod', 'invoiceNumber'].forEach((k) => {
    if (obj[k] !== undefined && obj[k] !== null) obj[k] = escapeHtml(obj[k]);
  });
  return obj;
};

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set in .env. Emails will not be sent.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

const rupees = (n) => `&#8377;${Number(n || 0).toLocaleString('en-IN')}`;

/** "McLaren Senna" stays as is; "Spectre" from Rolls-Royce becomes "Rolls-Royce Spectre". Plain text (for subjects). */
const carTitleText = (car) => {
  const name = (car?.name || '').trim();
  const company = (car?.company || '').trim();
  const firstWord = (s) => s.toLowerCase().split(/[\s-]/)[0];
  return (company && firstWord(name) !== firstWord(company) ? `${company} ${name}` : name) || 'Rental car';
};
const carTitle = (car) => escapeHtml(carTitleText(car));

/* ───────────────── Lacquer email kit ─────────────────
 * Same design language as the website: a band in the car category's paint, wide black
 * uppercase type, hairline rules and the eight-paint strip. Table layout + inline styles
 * so it renders in Gmail, Outlook and Apple Mail alike.
 */
const INK = '#111113';
const MUTED = '#6B6862';
const LINE = '#D6D2CB';
const GROUND = '#ECEAE6';
const DISPLAY = "'Archivo', 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const BODY = "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const strip = () => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    ${PAINT_ORDER.map((t) => `<td height="6" style="height:6px;line-height:6px;font-size:0;background:${PAINTS[t].hex};">&nbsp;</td>`).join('')}
  </tr></table>`;

const label = (text, color = MUTED) =>
  `<div style="font-family:${BODY};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${color};">${text}</div>`;

/** A label / value line, separated from the next by a hairline. */
const row = (name, value, { strong = false, color = INK } = {}) => `
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${BODY};font-size:14px;color:${MUTED};">${name}</td>
    <td align="right" style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${BODY};font-size:14px;font-weight:${strong ? 800 : 600};color:${color};">${value}</td>
  </tr>`;

const rows = (items) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.join('')}</table>`;

const section = (title, inner) => `
  <tr><td style="padding:28px 32px 0 32px;">
    ${label(title)}
    <div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>
    ${inner}
  </td></tr>`;

const button = (href, text, paint) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-radius:999px;background:${paint.hex};">
      <a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${BODY};font-size:15px;font-weight:700;color:${paint.on};text-decoration:none;border-radius:999px;">${text} &rarr;</a>
    </td>
  </tr></table>`;

/** Full email: preheader, paint band with eyebrow + headline, body rows, footer. */
const layout = ({ paint, eyebrow, title, preheader = '', intro = '', body = '', footer = '' }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${title.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${GROUND};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GROUND};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;">
        <tr><td style="background:${paint.hex};padding:28px 32px 34px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="font-family:${DISPLAY};font-size:18px;font-weight:900;letter-spacing:-0.3px;text-transform:uppercase;color:${paint.on};">Driveaway</td>
            <td align="right">${label(eyebrow, paint.on)}</td>
          </tr></table>
          <div style="height:36px;line-height:36px;font-size:0;">&nbsp;</div>
          <div style="font-family:${DISPLAY};font-size:36px;line-height:1.02;font-weight:900;letter-spacing:-1px;text-transform:uppercase;color:${paint.on};">${title}</div>
          ${paint.type ? `<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>${label(`Paint ${paint.no} &middot; ${paint.type} &middot; ${paint.name}`, paint.on)}` : ''}
        </td></tr>
        <tr><td>${strip()}</td></tr>
        ${intro ? `<tr><td style="padding:28px 32px 0 32px;font-family:${BODY};font-size:15px;line-height:1.6;color:${INK};">${intro}</td></tr>` : ''}
        ${body}
        <tr><td style="padding:32px;">
          <div style="border-top:1px solid ${LINE};padding-top:18px;font-family:${BODY};font-size:12px;line-height:1.6;color:${MUTED};">
            ${footer || 'Questions? Reply to this email or call +91 79-2630-0000.'}<br>
            Driveaway &middot; Premium car rentals &middot; Ahmedabad, Gujarat
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/**
 * Booking confirmation (sent right after a booking is made)
 */
const buildBookingConfirmationEmail = ({ booking: rawBooking, car, user }) => {
  const booking = safeBooking(rawBooking);
  const carDoc = car || booking.car || {};
  const paint = paintFor(carDoc.type);
  const name = booking.customerName || escapeHtml((user && user.name) || 'there'); // customerName is already escaped
  const carName = carTitle(carDoc);

  const totalDays = Math.max(1, Number(booking.totalDays) || 1);
  const dailyRate = Number(booking.dailyRateSnapshot || carDoc.dailyRate || 0);
  const baseRental = totalDays * (dailyRate > 0 ? dailyRate : Math.round(Number(booking.totalAmount || 0) / totalDays));
  const totalAmount = Number(booking.totalAmount || 0);
  const gst = Math.round((totalAmount - totalAmount / 1.18) * 100) / 100;
  const paid = Boolean(booking.paymentCompleted);

  const fare = [
    row(`${rupees(dailyRate)} &times; ${totalDays} day${totalDays > 1 ? 's' : ''}`, rupees(baseRental)),
    booking.discountAmount > 0 ? row(`Promo ${booking.discountCode || ''}`, `&minus;${rupees(booking.discountAmount)}`, { color: '#15803D' }) : '',
    booking.loyaltyPointsUsed > 0
      ? row(`Loyalty points (${booking.loyaltyPointsUsed})`, `&minus;${rupees(Math.round(booking.loyaltyPointsUsed / 10))}`, { color: '#15803D' })
      : '',
    row('GST 18% (included)', rupees(gst)),
    row('Payment', `${booking.paymentMethod || 'Online'} &middot; ${paid ? 'Paid' : 'Pay at pickup'}`),
  ];

  const total = `
    <tr><td style="padding:20px 32px 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paint.hex};border-radius:14px;">
        <tr>
          <td style="padding:18px 22px;">${label(paid ? 'Total paid' : 'Total due at pickup', paint.on)}</td>
          <td align="right" style="padding:18px 22px;font-family:${DISPLAY};font-size:28px;font-weight:900;color:${paint.on};">${rupees(totalAmount)}</td>
        </tr>
      </table>
    </td></tr>`;

  return {
    subject: `Booking confirmed: ${carTitleText(carDoc)} · Invoice ${rawBooking?.invoiceNumber || ''}`.trim(),
    html: layout({
      paint,
      eyebrow: `Invoice ${booking.invoiceNumber || ''}`,
      title: paid ? 'Paid. The keys<br>are yours.' : 'Reserved. See you<br>at the hub.',
      preheader: `${carName}, ${formatDate(booking.pickupDate)} to ${formatDate(booking.returnDate)}.`,
      intro: `Hi <strong>${name}</strong>, your <strong>${carName}</strong> is booked. Here is everything you need for pickup.`,
      body:
        section('Your drive', rows([
          row('Car', carName, { strong: true }),
          row('Pickup hub', booking.pickupLocation || 'Main hub, Ahmedabad'),
          row('Pickup', formatDate(booking.pickupDate)),
          row('Return', formatDate(booking.returnDate)),
          row('Duration', `${totalDays} day${totalDays > 1 ? 's' : ''}`),
        ])) +
        section('Fare', rows(fare)) +
        total +
        `<tr><td style="padding:22px 32px 0 32px;font-family:${BODY};font-size:13px;line-height:1.6;color:${MUTED};">
          Bring your driving licence and an original government ID to the hub. You can download the PDF invoice from <strong style="color:${INK};">My garage</strong> on the website.
        </td></tr>`,
    }),
  };
};

const sendBookingConfirmationEmail = async ({ booking, car, user }) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    const recipient = booking.customerEmail || (user && user.email);
    if (!recipient) {
      console.warn('⚠️ No recipient email found for booking confirmation.');
      return;
    }
    const { subject, html } = buildBookingConfirmationEmail({ booking, car, user });
    const info = await transporter.sendMail({ from: `"Driveaway Rentals" <${process.env.EMAIL_USER}>`, to: recipient, subject, html });
    console.log(`✉️ Booking confirmation email sent to ${recipient} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error('❌ Error sending booking confirmation email:', error.message);
  }
};

/**
 * Booking status update (admin confirms, completes or cancels)
 */
const STATUS_COPY = {
  Confirmed: { title: 'Confirmed.<br>Engine warm.', text: 'Your booking is confirmed. The car will be ready at the hub on your pickup date.' },
  Completed: { title: 'Thanks for<br>the drive.', text: 'Your rental is complete. We hope it was a good one. You can leave a review from My garage.' },
  Cancelled: { title: 'Booking<br>cancelled.', text: 'Your booking has been cancelled. If you paid online, the refund goes back to your original payment method.' },
  Pending: { title: 'Booking<br>received.', text: 'We have your booking and will confirm it shortly.' },
};

const buildBookingStatusUpdateEmail = ({ booking: rawBooking, newStatus }) => {
  const booking = safeBooking(rawBooking);
  const carDoc = booking.car || {};
  const paint = paintFor(carDoc.type);
  const status = escapeHtml(newStatus);
  const copy = STATUS_COPY[newStatus] || { title: `Status:<br>${status}.`, text: `Your booking status is now ${status}.` };

  return {
    subject: `Booking ${rawBooking?.invoiceNumber || ''}: ${newStatus}`.replace(/\s+/g, ' '),
    html: layout({
      paint,
      eyebrow: `Invoice ${booking.invoiceNumber || ''}`,
      title: copy.title,
      preheader: copy.text,
      intro: `Hi <strong>${booking.customerName || 'there'}</strong>, ${copy.text.charAt(0).toLowerCase()}${copy.text.slice(1)}`,
      body: section('Booking', rows([
        row('Car', carTitle(carDoc), { strong: true }),
        row('Status', status, { strong: true, color: newStatus === 'Cancelled' ? '#B91C1C' : INK }),
        row('Pickup', formatDate(booking.pickupDate)),
        row('Return', formatDate(booking.returnDate)),
      ])),
    }),
  };
};

const sendBookingStatusUpdateEmail = async ({ booking, newStatus }) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    const recipient = booking.customerEmail || (booking.user && booking.user.email);
    if (!recipient) return;
    const { subject, html } = buildBookingStatusUpdateEmail({ booking, newStatus });
    await transporter.sendMail({ from: `"Driveaway Rentals" <${process.env.EMAIL_USER}>`, to: recipient, subject, html });
    console.log(`✉️ Booking status update email sent to ${recipient} (Status: ${newStatus})`);
  } catch (error) {
    console.error('❌ Error sending status update email:', error.message);
  }
};

/**
 * Car is available again (customer asked to be notified)
 */
const buildCarAvailabilityEmail = ({ car }) => {
  const paint = paintFor(car.type);
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const carName = carTitle(car);
  const image = car.images?.main ? escapeHtml(String(car.images.main).replace('/1280px-', '/960px-')) : '';

  return {
    subject: `${carTitleText(car)} is free again`,
    html: layout({
      paint,
      eyebrow: 'Now available',
      title: 'It is back<br>in the garage.',
      preheader: `${carName} is available to book.`,
      intro: `You asked us to tell you when <strong>${carName}</strong> was free. It is, as of now.`,
      body: `
        ${image ? `<tr><td style="padding:24px 32px 0 32px;"><img src="${image}" width="536" alt="${carName}" style="display:block;width:100%;height:auto;border-radius:14px;"></td></tr>` : ''}
        ${section('The car', rows([
          row('Car', carName, { strong: true }),
          row('Daily rate', rupees(car.dailyRate), { strong: true }),
          row('Seats', escapeHtml(car.seats || 5)),
          row('Fuel', escapeHtml(car.fuelType || 'Petrol')),
          row('Gearbox', escapeHtml(car.transmission || 'Automatic')),
        ]))}
        <tr><td style="padding:26px 32px 0 32px;">${button(`${clientUrl}/cars/${car._id}`, 'Book it now', paint)}</td></tr>`,
      footer: 'This was a one-time alert because you asked to be notified about this car.',
    }),
  };
};

const sendCarAvailabilityEmail = async ({ recipientEmail, car }) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    if (!recipientEmail || !car) return;
    const { subject, html } = buildCarAvailabilityEmail({ car });
    const info = await transporter.sendMail({ from: `"Driveaway Fleet Alerts" <${process.env.EMAIL_USER}>`, to: recipientEmail, subject, html });
    console.log(`✉️ Car availability email sent to ${recipientEmail} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ Error sending car availability email to ${recipientEmail}:`, error.message);
  }
};

/**
 * Promo code broadcast (no single car, so the band is the house ink with the full paint strip)
 */
const buildDiscountBroadcastEmail = ({ recipientName: rawName, discountCode: rawCode, percentageOff, maxDiscount, description: rawDescription }) => {
  const paint = paintFor(null);
  const recipientName = escapeHtml(rawName);
  const description = escapeHtml(rawDescription);
  const code = escapeHtml(rawCode);
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const pct = Number(percentageOff) || 0;

  return {
    subject: `${pct}% off your next drive with ${rawCode}`,
    html: layout({
      paint,
      eyebrow: 'Offer',
      title: `${pct}% off<br>any paint.`,
      preheader: `Use code ${code} at checkout.`,
      intro: `${recipientName ? `Hi <strong>${recipientName}</strong>, h` : 'H'}ere is ${pct}% off your next rental, on any car in the fleet.`,
      body: `
        <tr><td style="padding:24px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px dashed ${INK};border-radius:14px;">
            <tr><td align="center" style="padding:22px;">
              ${label('Promo code')}
              <div style="font-family:${DISPLAY};font-size:34px;font-weight:900;letter-spacing:3px;color:${INK};padding:6px 0;">${code}</div>
              <div style="font-family:${BODY};font-size:14px;color:${MUTED};">${pct}% off${maxDiscount ? `, up to ${rupees(maxDiscount)}` : ''}</div>
            </td></tr>
          </table>
        </td></tr>
        ${description ? `<tr><td style="padding:18px 32px 0 32px;font-family:${BODY};font-size:14px;line-height:1.6;color:${MUTED};">${description}</td></tr>` : ''}
        <tr><td style="padding:26px 32px 0 32px;">${button(`${clientUrl}/fleet`, 'Pick a car', { hex: INK, on: '#FFFFFF' })}</td></tr>`,
      footer: `Enter ${code} at checkout. You received this because you signed up for Driveaway offers.`,
    }),
  };
};

const sendDiscountBroadcastEmail = async (opts) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    if (!opts.recipientEmail || !opts.discountCode) return;
    const { subject, html } = buildDiscountBroadcastEmail(opts);
    const info = await transporter.sendMail({ from: `"Driveaway Offers" <${process.env.EMAIL_USER}>`, to: opts.recipientEmail, subject, html });
    console.log(`✉️ Discount broadcast email sent to ${opts.recipientEmail} with code ${opts.discountCode} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ Error sending discount broadcast email to ${opts.recipientEmail}:`, error.message);
  }
};

/**
 * Contact form: auto-reply to the visitor + a copy for the team
 */
const buildContactEmails = (raw) => {
  const paint = paintFor(null);
  const name = escapeHtml(raw.name);
  const email = escapeHtml(raw.email);
  const phone = escapeHtml(raw.phone);
  const subject = escapeHtml(raw.subject);
  const message = escapeHtml(raw.message).replace(/\n/g, '<br>');
  const quote = `<tr><td style="padding:22px 32px 0 32px;">
      <div style="border-left:4px solid ${INK};padding:4px 0 4px 16px;font-family:${BODY};font-size:14px;line-height:1.6;color:${MUTED};">${message}</div>
    </td></tr>`;

  return {
    reply: {
      subject: 'We have your message',
      html: layout({
        paint,
        eyebrow: 'Support',
        title: 'Message<br>received.',
        preheader: 'Our Ahmedabad team will get back to you shortly.',
        intro: `Thanks, <strong>${name}</strong>. We got your message about <strong>${subject || 'your enquiry'}</strong> and our Ahmedabad team will reply shortly (7:00 AM to 10:00 PM, every day).`,
        body: quote,
      }),
    },
    team: {
      subject: `New enquiry from ${raw.name} (${raw.subject || 'General'})`,
      html: layout({
        paint,
        eyebrow: 'Contact form',
        title: 'New<br>enquiry.',
        body: section('From', rows([
          row('Name', name, { strong: true }),
          row('Email', email),
          row('Phone', phone || 'Not given'),
          row('Subject', subject || 'General'),
        ])) + quote,
        footer: 'Sent from the contact form on the Driveaway website.',
      }),
    },
  };
};

const sendContactMessageEmail = async (raw) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return;
    const { reply, team } = buildContactEmails(raw);
    await transporter.sendMail({ from: `"Driveaway Support" <${process.env.EMAIL_USER}>`, to: raw.email, ...reply });
    await transporter.sendMail({ from: `"Driveaway Contact Form" <${process.env.EMAIL_USER}>`, to: process.env.EMAIL_USER, replyTo: raw.email, ...team });
    console.log(`✉️ Contact auto-reply sent to ${raw.email} and team notified.`);
  } catch (error) {
    console.error('❌ Error sending contact message emails:', error.message);
  }
};

module.exports = {
  createTransporter,
  sendBookingConfirmationEmail,
  sendContactMessageEmail,
  sendBookingStatusUpdateEmail,
  sendCarAvailabilityEmail,
  sendDiscountBroadcastEmail,
  // builders (used to preview the templates without sending)
  buildBookingConfirmationEmail,
  buildBookingStatusUpdateEmail,
  buildCarAvailabilityEmail,
  buildDiscountBroadcastEmail,
  buildContactEmails,
};
