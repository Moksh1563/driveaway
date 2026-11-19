/**
 * Promo-code broadcasts and one-click unsubscribe.
 *  - Recipients: active discount subscribers plus customer accounts that have not opted out,
 *    one email per address. An unsubscribed (inactive) subscriber record also stops offers to
 *    an account with the same email.
 *  - Sends a few at a time, so one broadcast never fires hundreds of requests at once.
 *  - Every offer email links to GET /api/discount/unsubscribe?email=..&token=.., where the token is
 *    an HMAC-SHA256 of the lowercased email keyed with JWT_SECRET, so only the recipient can use it.
 *  - An opt-out is only lifted by the signed-in owner of the address, or through a confirmation link
 *    emailed to it (GET /api/discount/resubscribe, its own HMAC key), never by someone typing it in.
 */
const crypto = require('crypto');
const DiscountSubscriber = require('../models/DiscountSubscriber');
const User = require('../models/User');
const { sendDiscountBroadcastEmail, sendResubscribeEmail } = require('./emailService');
const { escapeHtml, isValidEmail, clientUrl } = require('../middleware/securityMiddleware');
const { PAINTS, PAINT_ORDER } = require('./paints');

const CONCURRENCY = 4;
const STOP_AFTER_FAILURES_IN_A_ROW = 5; // the provider is refusing (bad key, quota used up): stop early

const normEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

const unsubscribeToken = (email) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || '').update(normEmail(email)).digest('hex');

// Confirmation links for subscribing again use their own key, so an unsubscribe link can never
// be replayed as a resubscribe link (or the other way round)
const resubscribeToken = (email) =>
  crypto.createHmac('sha256', `resubscribe|${process.env.JWT_SECRET || ''}`).update(normEmail(email)).digest('hex');

/** Constant-time check of a link token against the one expected for its email. */
const tokenMatches = (email, token, makeToken) => {
  if (!normEmail(email) || typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const expected = Buffer.from(makeToken(email), 'hex');
  const given = Buffer.from(token.toLowerCase(), 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

const verifyUnsubscribeToken = (email, token) => tokenMatches(email, token, unsubscribeToken);
const verifyResubscribeToken = (email, token) => tokenMatches(email, token, resubscribeToken);

/** Public address of this API: PUBLIC_API_URL, else the host the request came in on. */
const apiBaseUrl = (req) => (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

const unsubscribeUrl = (baseUrl, email) =>
  `${baseUrl}/api/discount/unsubscribe?email=${encodeURIComponent(normEmail(email))}&token=${unsubscribeToken(email)}`;

const resubscribeUrl = (baseUrl, email) =>
  `${baseUrl}/api/discount/resubscribe?email=${encodeURIComponent(normEmail(email))}&token=${resubscribeToken(email)}`;

/** Everyone who should get an offer email, de-duplicated by email. */
const collectRecipients = async () => {
  const [subscribers, users] = await Promise.all([
    DiscountSubscriber.find({}, 'email isActive').lean(),
    User.find({ role: 'user', marketingOptOut: { $ne: true } }, 'name email').lean(),
  ]);
  const unsubscribed = new Set(subscribers.filter((s) => !s.isActive).map((s) => normEmail(s.email)));
  const recipients = new Map();
  subscribers.forEach((s) => {
    const email = normEmail(s.email);
    if (s.isActive && email && !recipients.has(email)) recipients.set(email, { email, name: '', reason: 'subscriber' });
  });
  users.forEach((u) => {
    const email = normEmail(u.email);
    if (!email || unsubscribed.has(email)) return;
    const existing = recipients.get(email);
    if (existing) existing.name = existing.name || u.name || '';
    else recipients.set(email, { email, name: u.name || '', reason: 'account' });
  });
  return [...recipients.values()];
};

/** Run `worker` over `items`, at most `size` at a time. `shouldStop()` ends it early. */
const runPool = async (items, size, worker, shouldStop = () => false) => {
  let next = 0;
  const lane = async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane));
  return next;
};

/**
 * Email a promo code to every recipient.
 * @returns {Promise<{ total, sent, failed, skipped, stoppedEarly, lastError }>}
 *   skipped = invalid addresses, plus anyone not tried after the provider kept refusing
 */
const broadcastDiscount = async (discount, { customMessage, baseUrl }) => {
  const recipients = await collectRecipients();
  const valid = recipients.filter((r) => isValidEmail(r.email));
  let sent = 0;
  let failed = 0;
  let failuresInARow = 0;
  let lastError = null;

  console.log(`📢 Broadcasting discount ${discount.code} to ${valid.length} recipient(s)...`);
  const tried = await runPool(
    valid,
    CONCURRENCY,
    async (r) => {
      const result = await sendDiscountBroadcastEmail({
        recipientEmail: r.email,
        recipientName: r.name,
        reason: r.reason,
        discountCode: discount.code,
        percentageOff: discount.percentageOff,
        maxDiscount: discount.maxDiscount,
        minAmount: discount.minAmount,
        maxUsesPerUser: discount.maxUsesPerUser,
        expiresAt: discount.expiresAt,
        description: customMessage || `Use promo code ${discount.code} at checkout to save ${discount.percentageOff}%!`,
        unsubscribeUrl: unsubscribeUrl(baseUrl, r.email),
      });
      if (result.sent) {
        sent += 1;
        failuresInARow = 0;
      } else {
        failed += 1;
        failuresInARow += 1;
        lastError = result.error || lastError;
      }
    },
    () => failuresInARow >= STOP_AFTER_FAILURES_IN_A_ROW
  );

  const stoppedEarly = tried < valid.length;
  const skipped = recipients.length - valid.length + (valid.length - tried);
  console.log(`📢 Broadcast ${discount.code}: ${sent} sent, ${failed} failed, ${skipped} skipped${stoppedEarly ? ' (stopped: the email provider kept refusing)' : ''}.`);
  return { total: recipients.length, sent, failed, skipped, stoppedEarly, lastError };
};

/** Turn off offer emails for an address: the subscriber record (kept as an opt-out) and the account. */
const unsubscribeEmail = async (email) => {
  const address = normEmail(email);
  await Promise.all([
    DiscountSubscriber.updateOne({ email: address }, { $set: { isActive: false } }, { upsert: true }),
    User.updateOne({ email: address }, { $set: { marketingOptOut: true } }),
  ]);
};

/** Turn offer emails back on for an address: only for its signed-in owner, or from the emailed confirmation link. */
const resubscribeEmail = async (email) => {
  const address = normEmail(email);
  const account = await User.findOneAndUpdate({ email: address }, { $set: { marketingOptOut: false } }, { new: true }).select('_id').lean();
  await DiscountSubscriber.updateOne(
    { email: address },
    { $set: { isActive: true }, $setOnInsert: { user: account ? account._id : null } },
    { upsert: true }
  );
};

// At most one confirmation email per address a day, so the subscribe form cannot flood an inbox
const CONFIRM_GAP_MS = 24 * 60 * 60 * 1000;
const confirmationSentAt = new Map();

/**
 * Someone asked to subscribe an address that opted out earlier. The opt-out stands; the address
 * gets a link to confirm instead (double opt-in). Never throws and never waits for the email.
 */
const requestResubscribe = (email, baseUrl) => {
  const address = normEmail(email);
  const now = Date.now();
  if (now - (confirmationSentAt.get(address) || 0) < CONFIRM_GAP_MS) return;
  if (confirmationSentAt.size >= 5000) {
    confirmationSentAt.forEach((at, key) => { if (now - at >= CONFIRM_GAP_MS) confirmationSentAt.delete(key); });
    if (confirmationSentAt.size >= 5000) confirmationSentAt.clear();
  }
  confirmationSentAt.set(address, now);

  const confirmUrl = resubscribeUrl(baseUrl, address);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📨 Offer emails confirmation link for ${address} (shown outside production only): ${confirmUrl}`);
  }
  sendResubscribeEmail({ to: address, confirmUrl })
    .then((result) => {
      if (result && result.sent === false) console.warn(`⚠️ Resubscribe confirmation not sent: ${result.error || 'email is not configured'}`);
    })
    .catch((err) => console.error('❌ Resubscribe confirmation failed:', err.message));
};

const PAGE_COPY = {
  unsubscribe: {
    name: 'Unsubscribe',
    done: 'Unsubscribed',
    okTitle: 'You are unsubscribed.',
    okText: (email) => `<strong>${email}</strong> will not get Driveaway offer emails any more. Booking confirmations and receipts still arrive as usual. Changed your mind? Subscribe again from the website footer.`,
    badText: 'The unsubscribe link is incomplete or was changed. Open it again from the offer email, or reply to that email and we will take you off the list.',
  },
  resubscribe: {
    name: 'Offer emails',
    done: 'Subscribed',
    okTitle: 'You are subscribed again.',
    okText: (email) => `<strong>${email}</strong> will get Driveaway offer emails again, each with a one-click unsubscribe link.`,
    badText: 'The confirmation link is incomplete or was changed. Open it again from the email, or subscribe again from the website footer.',
  },
};

/** Small self-contained page shown after an unsubscribe or resubscribe link is opened (light and dark). */
const unsubscribePage = ({ ok, email = '', retry = false, action = 'unsubscribe' }) => {
  const copy = PAGE_COPY[action] || PAGE_COPY.unsubscribe;
  const home = clientUrl().replace(/\/+$/, '');
  const title = ok ? copy.okTitle : retry ? 'Please try again.' : 'This link does not work.';
  const text = ok
    ? copy.okText(escapeHtml(email))
    : retry
      ? 'We could not update your email preferences just now. Open the link from the email again in a minute.'
      : copy.badText;
  const strip = PAINT_ORDER.map((t) => `<span style="background:${PAINTS[t].hex}"></span>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${ok ? copy.done : copy.name} - Driveaway</title>
  <style>
    :root { --ground: #ECEAE6; --card: #FFFFFF; --ink: #111113; --muted: #6B6862; --line: #D6D2CB; --band: #111113; --on-band: #FFFFFF; }
    @media (prefers-color-scheme: dark) {
      :root { --ground: #0B0B0C; --card: #17171A; --ink: #F2F0EC; --muted: #A9A49B; --line: #2C2B2E; --band: #F2F0EC; --on-band: #111113; }
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px;
      background: var(--ground); color: var(--ink); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    main { width: 100%; max-width: 520px; background: var(--card); border-radius: 18px; overflow: hidden; }
    .band { background: var(--band); color: var(--on-band); padding: 24px 28px 28px; }
    .brand { font-weight: 900; letter-spacing: -0.3px; text-transform: uppercase; font-size: 16px; }
    h1 { margin: 28px 0 0; font-size: 30px; line-height: 1.05; font-weight: 900; letter-spacing: -0.8px; text-transform: uppercase; }
    .strip { display: flex; height: 6px; }
    .strip span { flex: 1; }
    .body { padding: 24px 28px 28px; font-size: 15px; line-height: 1.6; }
    .body p { margin: 0 0 20px; overflow-wrap: anywhere; }
    a.button { display: inline-block; padding: 13px 26px; border-radius: 999px; background: var(--ink); color: var(--card);
      font-weight: 700; text-decoration: none; }
    a.button:focus-visible { outline: 3px solid var(--muted); outline-offset: 3px; }
  </style>
</head>
<body>
  <main>
    <div class="band"><div class="brand">Driveaway</div><h1>${title}</h1></div>
    <div class="strip" aria-hidden="true">${strip}</div>
    <div class="body">
      <p>${text}</p>
      <a class="button" href="${escapeHtml(home)}">Back to Driveaway</a>
    </div>
  </main>
</body>
</html>`;
};

module.exports = {
  unsubscribeToken,
  verifyUnsubscribeToken,
  resubscribeToken,
  verifyResubscribeToken,
  apiBaseUrl,
  unsubscribeUrl,
  resubscribeUrl,
  collectRecipients,
  broadcastDiscount,
  unsubscribeEmail,
  resubscribeEmail,
  requestResubscribe,
  unsubscribePage,
};
