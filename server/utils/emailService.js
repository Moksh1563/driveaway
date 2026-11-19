require('dotenv').config();
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { escapeHtml, isValidEmail, clientUrl } = require('../middleware/securityMiddleware');
const { PAINTS, PAINT_ORDER, HOUSE_PAINT, paintFor } = require('./paints');
const { buildInvoicePdf, invoiceFilename } = require('./invoicePdf');
const {
  carTitle: carTitleText, extractBookingInfo, fareLines, formatAmount, formatDate, dayLabel,
} = require('./invoiceFormat');

/* ───────────────── Sending ─────────────────
 * Two ways to send, picked from the environment:
 *  - BREVO_API_KEY set  -> Brevo's HTTPS API. Use this on Render: its free plan blocks SMTP ports.
 *  - EMAIL_USER + EMAIL_PASS -> Gmail SMTP (fine on your own computer).
 * EMAIL_FROM is the sender address (must be verified in Brevo); EMAIL_TEAM gets contact-form copies.
 * Every send* function resolves to { sent: true } or { sent: false, error } and never rejects.
 */
const senderEmail = () => process.env.EMAIL_FROM || process.env.EMAIL_USER || '';
const teamEmail = () => process.env.EMAIL_TEAM || senderEmail();
const from = (name) => `"${name}" <${senderEmail()}>`;

const emailMode = () => {
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return 'smtp';
  return null;
};

// Last send result, shown to admins so a broken setup is visible instead of silent
const lastSend = { ok: null, at: null, error: null };
const track = async (promise) => {
  try {
    const info = await promise;
    Object.assign(lastSend, { ok: true, at: new Date().toISOString(), error: null });
    return info;
  } catch (err) {
    Object.assign(lastSend, { ok: false, at: new Date().toISOString(), error: err.message });
    throw err;
  }
};

const parseAddress = (value) => {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value || '');
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: String(value || '').trim() };
};

const sendWithBrevo = async ({ from: sender, to, subject, html, replyTo, attachments }) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: parseAddress(sender),
      to: [parseAddress(to)],
      subject,
      htmlContent: html,
      ...(attachments?.length
        ? { attachment: attachments.map((a) => ({ name: a.filename, content: Buffer.from(a.content).toString('base64') })) }
        : {}),
      ...(replyTo ? { replyTo: parseAddress(replyTo) } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brevo refused the email (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json().catch(() => ({}));
  return { messageId: data.messageId || 'brevo' };
};

let warned = false;
const createTransporter = () => {
  const mode = emailMode();
  if (!mode) {
    if (!warned) console.warn('⚠️ Email is off: set BREVO_API_KEY + EMAIL_FROM (or EMAIL_USER + EMAIL_PASS for Gmail SMTP).');
    warned = true;
    return null;
  }
  if (!senderEmail()) {
    if (!warned) console.warn('⚠️ Email is off: set EMAIL_FROM to the sender address.');
    warned = true;
    return null;
  }
  if (mode === 'brevo') {
    return { mode, verify: (cb) => cb && cb(null), sendMail: (opts) => track(sendWithBrevo(opts)) };
  }
  const smtp = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 15000,
  });
  return { mode, verify: (cb) => smtp.verify(cb), sendMail: (opts) => track(smtp.sendMail(opts)) };
};

/** For the admin panel: how email is set up and how the last send went. */
const emailStatus = () => ({
  mode: emailMode(),
  sender: senderEmail() || null,
  team: teamEmail() || null,
  lastSend: { ...lastSend },
});

const NOT_SET_UP = 'Email is not set up on the server';

/** Send one email and report the outcome instead of throwing. */
const deliver = async (what, build) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return { sent: false, error: NOT_SET_UP };
    const message = await build();
    if (!message) {
      console.warn(`⚠️ ${what} email not sent: no valid recipient.`);
      return { sent: false, error: `No valid recipient for the ${what} email` };
    }
    const info = await transporter.sendMail(message);
    console.log(`✉️ ${what} email sent to ${message.to} (Message ID: ${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending ${what} email:`, error.message);
    return { sent: false, error: error.message };
  }
};

/** Admin "send a test email" check; throws with the provider's reason if it fails. */
const sendTestEmail = async (to) => {
  const transporter = createTransporter();
  if (!transporter) throw new Error(`${NOT_SET_UP} (see DEPLOY.md, "Booking emails").`);
  const html = layout({
    paint: HOUSE_PAINT,
    eyebrow: 'Test',
    title: 'Email<br>works.',
    intro: `This test came from the Driveaway server using <strong>${transporter.mode === 'brevo' ? 'Brevo' : 'Gmail SMTP'}</strong>. Booking confirmations, status updates and alerts will arrive the same way.`,
  });
  return transporter.sendMail({ from: from('Driveaway'), to, subject: 'Driveaway test email', html });
};

const rupees = (n) => `&#8377;${formatAmount(n)}`;
const rupeesText = (n) => `₹${formatAmount(n)}`;
const carTitle = (car) => escapeHtml(carTitleText(car) || 'Rental car');
const site = () => clientUrl().replace(/\/+$/, '');

/* ───────────────── Lacquer email kit ─────────────────
 * Same design language as the website: a band in the car category's paint, wide black
 * uppercase type, hairline rules and the eight-paint strip. Table layout + inline styles
 * so it renders in Gmail, Outlook and Apple Mail alike.
 */
const INK = '#111113';
const MUTED = '#6B6862';
const LINE = '#D6D2CB';
const GROUND = '#ECEAE6';
const GREEN = '#15803D';
const RED = '#B91C1C';
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

const note = (html) =>
  `<tr><td style="padding:22px 32px 0 32px;font-family:${BODY};font-size:13px;line-height:1.6;color:${MUTED};">${html}</td></tr>`;

const button = (href, text, paint) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-radius:999px;background:${paint.hex};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 30px;font-family:${BODY};font-size:15px;font-weight:700;color:${paint.on};text-decoration:none;border-radius:999px;">${text} &rarr;</a>
    </td>
  </tr></table>`;

/** The big total in the car's paint. */
const totalBox = (paint, title, amount) => `
    <tr><td style="padding:20px 32px 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paint.hex};border-radius:14px;">
        <tr>
          <td style="padding:18px 22px;">${label(title, paint.on)}</td>
          <td align="right" style="padding:18px 22px;font-family:${DISPLAY};font-size:28px;font-weight:900;color:${paint.on};">${rupees(amount)}</td>
        </tr>
      </table>
    </td></tr>`;

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

/* ───────────────── Who booking emails go to ─────────────────
 * Always the email on the booking's account, never the free-text customerEmail from the
 * booking form, so the booking flow cannot be used to email arbitrary addresses.
 */
const idOf = (ref) => (ref && typeof ref === 'object' && ref._id ? ref._id : ref);

const resolveAccount = async (booking, user) => {
  const ownerId = idOf(booking?.user);
  const isOwner = (u) => u && typeof u === 'object' && u.email && (!ownerId || !idOf(u) || String(idOf(u)) === String(ownerId));
  if (isOwner(user)) return user;
  if (booking?.user && typeof booking.user === 'object' && booking.user.email) return booking.user;
  if (!ownerId) return null;
  return User.findById(ownerId).select('name email phone').lean();
};

/** The booking with its account attached, so the invoice's "Billed to" shows the account email. */
const withAccount = (booking, account) => {
  if (booking?.user && typeof booking.user === 'object' && booking.user.email) return booking;
  const obj = booking && typeof booking.toObject === 'function' ? booking.toObject() : { ...booking };
  return { ...obj, user: account };
};

// Lets the caller send its HTTP response first: the PDF render is synchronous and would hold it up
const afterResponse = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Booking email, with the PDF invoice attached:
 *  'booked'  – right after booking: reserved, payment pending (or paid, for older flows)
 *  'payment' – a booking that was waiting for payment has just been paid
 */
const buildBookingConfirmationEmail = ({ booking, car, user, variant = 'booked' }) => {
  const info = extractBookingInfo(booking, car);
  const carDoc = car || (booking?.car && typeof booking.car === 'object' ? booking.car : {}) || {};
  const paint = paintFor(info.carType);
  const name = escapeHtml(info.customerName !== 'Valued Customer' ? info.customerName : (user && user.name) || 'there');
  const carName = carTitle(carDoc);
  const invoiceNo = escapeHtml(info.invoiceNumber);
  const days = dayLabel(info.totalDays);
  const isCash = /^cash$/i.test(String(booking?.paymentMethod || ''));

  const fare = fareLines(info).map((line) =>
    line.kind === 'base'
      ? row(`${rupees(line.rate)} &times; ${days}`, rupees(line.amount))
      : row(escapeHtml(line.label), `&minus;${rupees(line.amount)}`, { color: GREEN })
  );
  fare.push(row('GST 18% (included)', rupees(info.gstAmount)));
  fare.push(row('Payment', `${escapeHtml(info.paymentMethod)} &middot; ${escapeHtml(info.payment.label)}`));

  const copy =
    variant === 'payment'
      ? {
          subject: `Payment received: ${rupeesText(info.paidAmount)} · Invoice ${info.invoiceNumber}`,
          title: 'Payment<br>received.',
          intro: `Hi <strong>${name}</strong>, we've received <strong>${rupees(info.paidAmount)}</strong> for your <strong>${carName}</strong>. Your booking is confirmed and the paid invoice is attached.`,
        }
      : info.paid
        ? {
            subject: `Booking confirmed and paid: ${carTitleText(carDoc) || 'Rental car'} · Invoice ${info.invoiceNumber}`,
            title: 'Paid. The keys<br>are yours.',
            intro: `Hi <strong>${name}</strong>, your <strong>${carName}</strong> is booked and paid. Your invoice is attached, and here is everything you need for pickup.`,
          }
        : isCash
          ? {
              subject: `Booking reserved, pay at pickup: ${carTitleText(carDoc) || 'Rental car'} · Invoice ${info.invoiceNumber}`,
              title: 'Reserved. Pay<br>at the hub.',
              intro: `Hi <strong>${name}</strong>, your <strong>${carName}</strong> is reserved. <strong>${rupees(info.totalAmount)}</strong> is due when you collect it, or pay online from My garage while the booking is waiting for confirmation. Your invoice is attached.`,
            }
          : {
              subject: `Booking reserved, payment pending: ${carTitleText(carDoc) || 'Rental car'} · Invoice ${info.invoiceNumber}`,
              title: 'Reserved.<br>Payment next.',
              intro: `Hi <strong>${name}</strong>, your <strong>${carName}</strong> is reserved. Complete the payment online from My garage to confirm it, or pay <strong>${rupees(info.totalAmount)}</strong> at the hub when you collect it. Your invoice is attached.`,
            };

  return {
    subject: copy.subject.trim(),
    html: layout({
      paint,
      eyebrow: `Invoice ${invoiceNo}`,
      title: copy.title,
      preheader: `${carName}, ${formatDate(info.pickupDate)} to ${formatDate(info.returnDate)}.`,
      intro: copy.intro,
      body:
        section('Your drive', rows([
          row('Car', carName, { strong: true }),
          row('Pickup hub', escapeHtml(info.pickupLocation)),
          row('Pickup', formatDate(info.pickupDate)),
          row('Return', formatDate(info.returnDate)),
          row('Duration', days),
        ])) +
        section('Fare', rows(fare)) +
        totalBox(paint, escapeHtml(info.payment.totalLabel), info.payment.amount) +
        note(`Bring your driving licence and an original government ID to the hub. The PDF invoice is attached to this email, and you can download it again any time from <strong style="color:${INK};">My garage</strong>.`),
    }),
  };
};

const sendBookingEmail = async ({ booking, car, user, variant }) => {
  await afterResponse();
  return deliver(`booking (${variant})`, async () => {
    const account = await resolveAccount(booking, user);
    if (!account || !isValidEmail(account.email)) return null;
    const carDoc = car || booking.car;
    const forInvoice = withAccount(booking, account);
    const { subject, html } = buildBookingConfirmationEmail({ booking: forInvoice, car: carDoc, user: account, variant });
    return {
      from: from('Driveaway Rentals'),
      to: account.email,
      subject,
      html,
      attachments: [{ filename: invoiceFilename(booking), content: buildInvoicePdf(forInvoice, carDoc), contentType: 'application/pdf' }],
    };
  });
};

/** Right after booking: reserved with payment pending (or paid). Invoice attached. Sent to the account email. */
const sendBookingConfirmationEmail = ({ booking, car, user }) => sendBookingEmail({ booking, car, user, variant: 'booked' });

/** A booking that was waiting for payment has been paid. Paid invoice attached. Sent to the account email. */
const sendPaymentReceivedEmail = ({ booking, car, user }) => sendBookingEmail({ booking, car, user, variant: 'payment' });

/**
 * Booking status update (admin confirms, completes or cancels; customer cancels)
 */
const STATUS_COPY = {
  Confirmed: { title: 'Confirmed.<br>Engine warm.', text: 'Your booking is confirmed. The car will be ready at the hub on your pickup date.' },
  Completed: { title: 'Thanks for<br>the drive.', text: 'Your rental is complete. We hope it was a good one. You can leave a review from My garage.' },
  Cancelled: { title: 'Booking<br>cancelled.', text: 'Your booking has been cancelled.' },
  Pending: { title: 'Booking<br>received.', text: 'We have your booking and will confirm it shortly.' },
};

const buildBookingStatusUpdateEmail = ({ booking, newStatus, user }) => {
  const info = extractBookingInfo(booking, null);
  const carDoc = booking?.car && typeof booking.car === 'object' ? booking.car : {};
  const paint = paintFor(info.carType);
  const status = escapeHtml(newStatus);
  const copy = STATUS_COPY[newStatus] || { title: `Status:<br>${status}.`, text: `Your booking status is now ${status}.` };
  const name = escapeHtml(info.customerName !== 'Valued Customer' ? info.customerName : (user && user.name) || 'there');

  // What happens to the money, in the same words as the invoice
  let after = '';
  const extra = [];
  if (newStatus === 'Cancelled') {
    if (info.refunded) {
      after = info.paymentMethod === 'Cash'
        ? ` Your payment of ${rupees(info.paidAmount)} has been marked as refunded.`
        : ` Your payment of ${rupees(info.paidAmount)} has been refunded to your ${escapeHtml(info.paymentMethod)} account.`;
      extra.push(row('Refund', `${rupees(info.paidAmount)} &middot; ${escapeHtml(info.payment.label)}`, { strong: true, color: GREEN }));
    } else if (info.paid) {
      after = ` The ${rupees(info.paidAmount)} you paid will be refunded to the original payment method.`;
      extra.push(row('Refund', `${rupees(info.paidAmount)} &middot; due`, { strong: true }));
    } else {
      after = ' Nothing was charged.';
    }
    if (info.loyaltyPointsUsed > 0) after += ` The ${info.loyaltyPointsUsed.toLocaleString('en-IN')} loyalty points you used are back in your account.`;
  }
  if (newStatus === 'Completed' && booking?.pointsAwarded) {
    const earned = Number(booking.loyaltyPointsEarned) || Math.floor(info.totalAmount / 100);
    if (earned > 0) extra.push(row('Loyalty points earned', earned.toLocaleString('en-IN'), { strong: true, color: GREEN }));
  }

  const text = `${copy.text}${after}`;
  return {
    subject: `Booking ${info.invoiceNumber !== 'N/A' ? info.invoiceNumber : ''}: ${newStatus}`.replace(/\s+/g, ' '),
    html: layout({
      paint,
      eyebrow: `Invoice ${escapeHtml(info.invoiceNumber)}`,
      title: copy.title,
      preheader: copy.text,
      intro: `Hi <strong>${name}</strong>, ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
      body: section('Booking', rows([
        row('Car', carTitle(carDoc), { strong: true }),
        row('Status', status, { strong: true, color: newStatus === 'Cancelled' ? RED : INK }),
        row('Pickup', formatDate(info.pickupDate)),
        row('Return', formatDate(info.returnDate)),
        ...extra,
      ])),
    }),
  };
};

/** Status change email, sent to the booking's account email. */
const sendBookingStatusUpdateEmail = async ({ booking, newStatus, user }) =>
  deliver(`booking status (${newStatus})`, async () => {
    const account = await resolveAccount(booking, user);
    if (!account || !isValidEmail(account.email)) return null;
    const { subject, html } = buildBookingStatusUpdateEmail({ booking: withAccount(booking, account), newStatus, user: account });
    return { from: from('Driveaway Rentals'), to: account.email, subject, html };
  });

/**
 * Car is available again (customer asked to be notified)
 */
const buildCarAvailabilityEmail = ({ car }) => {
  const paint = paintFor(car.type);
  const carName = carTitle(car);
  const image = car.images?.main ? String(car.images.main).replace('/1280px-', '/960px-') : '';

  return {
    subject: `${carTitleText(car) || 'Your car'} is free again`,
    html: layout({
      paint,
      eyebrow: 'Now available',
      title: 'It is back<br>in the garage.',
      preheader: `${carName} is available to book.`,
      intro: `You asked us to tell you when <strong>${carName}</strong> was free. It is, as of now.`,
      body: `
        ${image ? `<tr><td style="padding:24px 32px 0 32px;"><img src="${escapeHtml(image)}" width="536" alt="${carName}" style="display:block;width:100%;height:auto;border-radius:14px;"></td></tr>` : ''}
        ${section('The car', rows([
          row('Car', carName, { strong: true }),
          row('Daily rate', rupees(car.dailyRate), { strong: true }),
          row('Seats', escapeHtml(car.seats || 5)),
          row('Fuel', escapeHtml(car.fuelType || 'Petrol')),
          row('Gearbox', escapeHtml(car.transmission || 'Automatic')),
        ]))}
        <tr><td style="padding:26px 32px 0 32px;">${button(`${site()}/cars/${car._id}`, 'Book it now', paint)}</td></tr>`,
      footer: 'This was a one-time alert because you asked to be notified about this car.',
    }),
  };
};

const sendCarAvailabilityEmail = async ({ recipientEmail, car }) =>
  deliver('car availability', async () => {
    if (!car || !isValidEmail(recipientEmail)) return null;
    const { subject, html } = buildCarAvailabilityEmail({ car });
    return { from: from('Driveaway Fleet Alerts'), to: recipientEmail, subject, html };
  });

/**
 * Promo code broadcast (no single car, so the band is the house ink with the full paint strip).
 * Every copy carries a one-click unsubscribe link; `reason` says why this person got it.
 */
const BROADCAST_REASON = {
  subscriber: 'You received this because you signed up for Driveaway offers.',
  account: 'You received this because you have a Driveaway account.',
};

const buildDiscountBroadcastEmail = ({
  recipientName: rawName, discountCode: rawCode, percentageOff, maxDiscount, minAmount, expiresAt, maxUsesPerUser,
  description: rawDescription, unsubscribeUrl, reason = 'subscriber',
}) => {
  const paint = HOUSE_PAINT;
  const recipientName = escapeHtml(rawName);
  const description = escapeHtml(rawDescription);
  const code = escapeHtml(rawCode);
  const pct = Number(percentageOff) || 0;

  // The code's rules, so nobody is surprised at checkout
  const terms = [
    `${pct}% off${Number(maxDiscount) > 0 ? `, up to ${rupees(maxDiscount)}` : ''}`,
    Number(minAmount) > 0 ? `on bookings of ${rupees(minAmount)} or more` : '',
    Number(maxUsesPerUser) === 1 ? 'one use per customer' : Number(maxUsesPerUser) > 1 ? `up to ${Number(maxUsesPerUser)} uses per customer` : '',
    expiresAt ? `valid until ${formatDate(expiresAt)}` : '',
  ].filter(Boolean).join(', ');

  const unsubscribe = unsubscribeUrl
    ? ` <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a> with one click.`
    : '';

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
              <div style="font-family:${BODY};font-size:14px;color:${MUTED};">${terms.charAt(0).toUpperCase()}${terms.slice(1)}</div>
            </td></tr>
          </table>
        </td></tr>
        ${description ? `<tr><td style="padding:18px 32px 0 32px;font-family:${BODY};font-size:14px;line-height:1.6;color:${MUTED};">${description}</td></tr>` : ''}
        <tr><td style="padding:26px 32px 0 32px;">${button(`${site()}/fleet`, 'Pick a car', { hex: INK, on: '#FFFFFF' })}</td></tr>`,
      footer: `Enter ${code} at checkout. ${BROADCAST_REASON[reason] || BROADCAST_REASON.subscriber}${unsubscribe}`,
    }),
  };
};

const sendDiscountBroadcastEmail = async (opts) =>
  deliver(`offer ${opts?.discountCode || ''}`.trim(), async () => {
    if (!opts || !isValidEmail(opts.recipientEmail) || !opts.discountCode) return null;
    const { subject, html } = buildDiscountBroadcastEmail(opts);
    return { from: from('Driveaway Offers'), to: opts.recipientEmail, subject, html };
  });

/**
 * Contact form: a copy for the team only. There is no auto-reply to the visitor, so the form
 * cannot be used to send Driveaway emails to an address someone typed in.
 */
const buildContactEmails = (raw) => {
  const name = escapeHtml(raw.name);
  const email = escapeHtml(raw.email);
  const phone = escapeHtml(raw.phone);
  const subject = escapeHtml(raw.subject);
  const message = escapeHtml(raw.message).replace(/\n/g, '<br>');
  const oneLine = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim();

  return {
    team: {
      subject: `New enquiry from ${oneLine(raw.name)} (${oneLine(raw.subject) || 'General'})`,
      html: layout({
        paint: HOUSE_PAINT,
        eyebrow: 'Contact form',
        title: 'New<br>enquiry.',
        body: section('From', rows([
          row('Name', name, { strong: true }),
          row('Email', email),
          row('Phone', phone || 'Not given'),
          row('Subject', subject || 'General'),
        ])) + `<tr><td style="padding:22px 32px 0 32px;">
            <div style="border-left:4px solid ${INK};padding:4px 0 4px 16px;font-family:${BODY};font-size:14px;line-height:1.6;color:${MUTED};">${message}</div>
          </td></tr>`,
        footer: 'Sent from the contact form on the Driveaway website. Reply to this email to answer the visitor.',
      }),
    },
  };
};

const sendContactMessageEmail = async (raw) =>
  deliver('contact form (team copy)', async () => {
    const to = teamEmail();
    if (!to) return null;
    const { team } = buildContactEmails(raw);
    return { from: from('Driveaway Contact Form'), to, ...(isValidEmail(raw.email) ? { replyTo: raw.email.trim() } : {}), ...team };
  });

/**
 * Password reset link (POST /api/auth/forgot-password)
 */
const buildPasswordResetEmail = ({ name: rawName, resetUrl, expiresInMinutes = 30 }) => {
  const name = escapeHtml(rawName || '');
  const url = escapeHtml(resetUrl);
  return {
    subject: 'Reset your Driveaway password',
    html: layout({
      paint: HOUSE_PAINT,
      eyebrow: 'Account',
      title: 'Reset your<br>password.',
      preheader: `This link works for ${expiresInMinutes} minutes.`,
      intro: `${name ? `Hi <strong>${name}</strong>, w` : 'W'}e got a request to reset the password for your Driveaway account. Choose a new one with the button below. The link works once, for the next ${expiresInMinutes} minutes.`,
      body: `
        <tr><td style="padding:26px 32px 0 32px;">${button(resetUrl, 'Choose a new password', { hex: INK, on: '#FFFFFF' })}</td></tr>
        ${note(`If the button does not work, paste this address into your browser:<br><a href="${url}" style="color:${INK};word-break:break-all;">${url}</a>`)}`,
      footer: 'Did not ask for this? Ignore this email and your password stays the same.',
    }),
  };
};

/** Resolves to { sent, error? }; never rejects. */
const sendPasswordResetEmail = async ({ to, name, resetUrl } = {}) =>
  deliver('password reset', async () => {
    if (!isValidEmail(to) || typeof resetUrl !== 'string' || !/^https?:\/\/\S+$/i.test(resetUrl)) return null;
    const { subject, html } = buildPasswordResetEmail({ name, resetUrl });
    return { from: from('Driveaway Accounts'), to: to.trim(), subject, html };
  });

/**
 * Confirm offer emails for an address that unsubscribed earlier (someone asked to subscribe it again)
 */
const buildResubscribeEmail = ({ confirmUrl }) => {
  const url = escapeHtml(confirmUrl);
  return {
    subject: 'Confirm Driveaway offer emails',
    html: layout({
      paint: HOUSE_PAINT,
      eyebrow: 'Offers',
      title: 'Offers<br>again?',
      preheader: 'Nothing changes until you confirm.',
      intro: 'Someone, hopefully you, asked for Driveaway offer emails at this address. You unsubscribed earlier, so nothing changes until you confirm with the button below.',
      body: `
        <tr><td style="padding:26px 32px 0 32px;">${button(confirmUrl, 'Yes, send me offers', { hex: INK, on: '#FFFFFF' })}</td></tr>
        ${note(`If the button does not work, paste this address into your browser:<br><a href="${url}" style="color:${INK};word-break:break-all;">${url}</a>`)}`,
      footer: 'Did not ask for this? Ignore this email and you stay unsubscribed.',
    }),
  };
};

/** Resolves to { sent, error? }; never rejects. */
const sendResubscribeEmail = async ({ to, confirmUrl } = {}) =>
  deliver('resubscribe confirmation', async () => {
    if (!isValidEmail(to) || typeof confirmUrl !== 'string' || !/^https?:\/\/\S+$/i.test(confirmUrl)) return null;
    const { subject, html } = buildResubscribeEmail({ confirmUrl });
    return { from: from('Driveaway Offers'), to: to.trim(), subject, html };
  });

module.exports = {
  createTransporter,
  emailStatus,
  sendTestEmail,
  sendBookingConfirmationEmail,
  sendPaymentReceivedEmail,
  sendBookingStatusUpdateEmail,
  sendCarAvailabilityEmail,
  sendDiscountBroadcastEmail,
  sendContactMessageEmail,
  sendPasswordResetEmail,
  sendResubscribeEmail,
  // builders (used to preview the templates without sending)
  buildBookingConfirmationEmail,
  buildBookingStatusUpdateEmail,
  buildCarAvailabilityEmail,
  buildDiscountBroadcastEmail,
  buildContactEmails,
  buildPasswordResetEmail,
  buildResubscribeEmail,
};
