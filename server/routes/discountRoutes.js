const handleError = require('../utils/handleError');
/**
 * ============================================================================
 * DISCOUNT & PROMOTION ROUTES
 * ============================================================================
 * Endpoints for:
 *  - Validating discount codes at checkout (POST /api/discount/validate)
 *  - Subscribing to discount notifications & newsletter (POST /api/discount/subscribe)
 *  - One-click unsubscribe from offer emails (GET /api/discount/unsubscribe)
 *  - Confirming offer emails again after an unsubscribe (GET /api/discount/resubscribe)
 *  - Admin listing, creation, editing, toggling & deletion of promo codes (GET, POST, PATCH, DELETE)
 *  - Admin broadcasting a promo code to subscribers & customers (POST /broadcast/:id)
 * The rules for whether a code applies live in utils/discounts.js (shared with booking creation);
 * recipients, sending and unsubscribe links live in utils/discountBroadcast.js.
 */

const express = require('express');
const router = express.Router();
const DiscountCode = require('../models/DiscountCode');
const DiscountSubscriber = require('../models/DiscountSubscriber');
const User = require('../models/User');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { createTransporter } = require('../utils/emailService');
const { evaluateDiscount } = require('../utils/discounts');
const { dayStart, DAY_MS } = require('../utils/dates');
const {
  apiBaseUrl, collectRecipients, broadcastDiscount, verifyUnsubscribeToken, unsubscribeEmail, unsubscribePage,
  verifyResubscribeToken, resubscribeEmail, requestResubscribe,
} = require('../utils/discountBroadcast');
const { isValidEmail } = require('../middleware/securityMiddleware');

// One answer for unknown, switched-off, expired and used-up codes, so codes cannot be probed
const INVALID_CODE = 'Invalid or expired discount code';
const EMAIL_OFF = 'Email is not set up on the server, so offer emails cannot be sent. See DEPLOY.md, "Booking emails".';
const IST_OFFSET_MS = 330 * 60 * 1000;
const MAX_AMOUNT = 10000000; // Rs 1 crore: sanity cap for rupee fields
const MAX_COUNT = 1000000;

/* ───────────────── Admin input parsing ─────────────────
 * Each parser returns { value } (undefined = field not sent, leave unchanged) or { error }.
 * An empty string or null clears an optional limit.
 */
const isBlank = (v) => v === '' || v === null;

const parseRupees = (v, name, { blankValue }) => {
  if (v === undefined) return {};
  if (isBlank(v)) return { value: blankValue };
  const n = Number(v);
  if (typeof v === 'boolean' || !Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) return { error: `${name} must be a number from 0 to ${MAX_AMOUNT.toLocaleString('en-IN')}` };
  return { value: Math.round(n) };
};

const parseCount = (v, name) => {
  if (v === undefined) return {};
  if (isBlank(v)) return { value: null };
  const n = Number(v);
  if (typeof v === 'boolean' || !Number.isInteger(n) || n < 1 || n > MAX_COUNT) return { error: `${name} must be a whole number of at least 1, or empty for no limit` };
  return { value: n };
};

/** "YYYY-MM-DD" means "valid through that day in India"; a full timestamp is used as is. */
const parseExpiry = (v) => {
  if (v === undefined) return {};
  if (isBlank(v)) return { value: null };
  if (typeof v !== 'string' || v.length > 40) return { error: 'Expiry date is not a valid date' };
  const trimmed = v.trim();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? dayStart(trimmed) : null;
  const date = day ? new Date(day.getTime() + DAY_MS - IST_OFFSET_MS - 1) : new Date(trimmed);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() > 2100) return { error: 'Expiry date is not a valid date' };
  return { value: date };
};

const parseBoolean = (v) => (v === undefined ? undefined : v === true || v === 'true');

/** Validates the fields shared by create and update. Returns { fields } or { error }. */
const readDiscountFields = (body, { creating }) => {
  const fields = {};
  if (body.percentageOff !== undefined || creating) {
    const pct = Number(body.percentageOff);
    if (body.percentageOff === undefined || isBlank(body.percentageOff) || !Number.isFinite(pct) || pct <= 0 || pct > 90) {
      return { error: 'Percentage off must be between 1 and 90' };
    }
    fields.percentageOff = pct;
  }
  const checks = [
    ['maxDiscount', parseRupees(body.maxDiscount, 'Max discount', { blankValue: null })],
    ['minAmount', parseRupees(body.minAmount, 'Minimum booking amount', { blankValue: 0 })],
    ['maxUses', parseCount(body.maxUses, 'Total uses')],
    ['maxUsesPerUser', parseCount(body.maxUsesPerUser, 'Uses per customer')],
    ['expiresAt', parseExpiry(body.expiresAt)],
  ];
  for (const [key, result] of checks) {
    if (result.error) return { error: result.error };
    if (result.value !== undefined) fields[key] = result.value;
  }
  // 0 means "no cap" at checkout, so store it as no cap
  if (fields.maxDiscount === 0) fields.maxDiscount = null;
  const isActive = parseBoolean(body.isActive);
  if (isActive !== undefined) fields.isActive = isActive;
  return { fields };
};

const readCustomMessage = (value) => {
  if (value === undefined || value === null || value === '') return { value: '' };
  if (typeof value !== 'string' || value.trim().length > 500) return { error: 'The message must be text of at most 500 characters' };
  return { value: value.trim() };
};

/** Why a code cannot be emailed out right now, or null when it can (same rules as checkout). */
const broadcastBlocker = async (discount) => {
  if (!discount.isActive) return 'Activate this code before broadcasting it.';
  const check = await evaluateDiscount(discount.code);
  return check.ok ? null : `${check.message}, so it cannot be broadcast.`;
};

const broadcastMessage = (code, r) => {
  if (!r.total) return `No one to send "${code}" to yet: there are no subscribers or customers who accept offer emails.`;
  const parts = [`Sent "${code}" to ${r.sent} of ${r.total} recipient${r.total === 1 ? '' : 's'}`];
  if (r.failed) parts.push(`${r.failed} failed`);
  if (r.skipped) parts.push(`${r.skipped} skipped`);
  let message = `${parts.join(', ')}.`;
  if (r.stoppedEarly) message += ' Sending stopped because the email provider kept refusing.';
  if (r.failed && r.lastError) message += ` Last error: ${r.lastError}`;
  return message;
};

const broadcastPayload = (r) => ({ sent: r.sent, failed: r.failed, skipped: r.skipped, total: r.total, broadcastCount: r.sent });

// ----------------------------------------------------------------------------
// @desc   Validate a discount promo code during checkout
// @route  POST /api/discount/validate   { code, subtotal? }
// @access Private (authenticated users)
// ----------------------------------------------------------------------------
router.post('/validate', protect, async (req, res) => {
  try {
    const { code, subtotal } = req.body || {};
    if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ message: 'Please provide a discount code' });
    let amount;
    if (subtotal !== undefined && subtotal !== null && subtotal !== '') {
      amount = Number(subtotal);
      if (typeof subtotal === 'boolean' || !Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ message: 'Invalid booking amount' });
      }
    }

    // Is the code live at all? Every "no" gets the same answer.
    const live = await evaluateDiscount(code);
    if (!live.ok) return res.status(404).json({ message: INVALID_CODE });

    // It is live: now the rules for this customer and this booking (minimum amount, uses per customer)
    const result = await evaluateDiscount(code, { subtotal: amount, userId: req.user.id });
    if (!result.ok) {
      return result.status === 404
        ? res.status(404).json({ message: INVALID_CODE })
        : res.status(400).json({ message: result.message });
    }

    const d = result.discount;
    res.json({
      code: d.code,
      percentageOff: d.percentageOff,
      maxDiscount: d.maxDiscount ?? null,
      minAmount: d.minAmount || 0,
      expiresAt: d.expiresAt || null,
      ...(amount !== undefined ? { amount: result.amount } : {}),
    });
  } catch (error) {
    handleError(res, error);
  }
});

// ----------------------------------------------------------------------------
// @desc   Subscribe email to discount alerts & flash promotions
// @route  POST /api/discount/subscribe
// @access Public (with optional user context)
// ----------------------------------------------------------------------------
router.post('/subscribe', optionalProtect, async (req, res) => {
  try {
    const { email } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    // Anyone can type any address here; only the signed-in owner of this one counts as its owner
    const own = Boolean(req.user && String(req.user.email || '').toLowerCase() === normalizedEmail);

    const [subscriber, account] = await Promise.all([
      DiscountSubscriber.findOne({ email: normalizedEmail }).lean(),
      User.findOne({ email: normalizedEmail }).select('marketingOptOut').lean(),
    ]);
    // An unsubscribe link (inactive record) or the profile switch (marketingOptOut) is an opt-out
    const optedOut = Boolean((subscriber && !subscriber.isActive) || (account && account.marketingOptOut));

    if (optedOut && !own) {
      // The opt-out stands until the owner confirms through a link emailed to the address
      requestResubscribe(normalizedEmail, apiBaseUrl(req));
      return res.json({
        message: `Check your inbox: we have emailed ${normalizedEmail} a link to confirm you want Driveaway offers again.`,
        confirmationSent: true,
      });
    }
    if (optedOut) {
      await resubscribeEmail(normalizedEmail);
      return res.json({ message: `Welcome back! You've been re-subscribed to Driveaway discount alerts at ${normalizedEmail}.` });
    }
    if (subscriber) {
      return res.json({ message: `You are already subscribed to receive exclusive discounts at ${normalizedEmail}!` });
    }

    // Register new discount subscriber
    await DiscountSubscriber.create({
      email: normalizedEmail,
      user: own ? req.user._id : null,
      isActive: true,
    });

    res.status(201).json({
      message: `🎉 You're subscribed! We will notify ${normalizedEmail} whenever exciting new discounts are launched.`,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// ----------------------------------------------------------------------------
// @desc   One-click unsubscribe from offer emails (the link in every broadcast)
// @route  GET /api/discount/unsubscribe?email=<email>&token=<hmac>
// @access Public (the token proves the link came from an offer email)
// ----------------------------------------------------------------------------
router.get('/unsubscribe', async (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!isValidEmail(email) || !verifyUnsubscribeToken(email, token)) {
    return res.status(400).type('html').send(unsubscribePage({ ok: false }));
  }
  try {
    await unsubscribeEmail(email);
    res.type('html').send(unsubscribePage({ ok: true, email }));
  } catch (error) {
    console.error('Unsubscribe failed:', error.message);
    res.status(503).type('html').send(unsubscribePage({ ok: false, retry: true }));
  }
});

// ----------------------------------------------------------------------------
// @desc   Confirm offer emails again for an address that opted out (the link in the confirmation email)
// @route  GET /api/discount/resubscribe?email=<email>&token=<hmac>
// @access Public (the token proves the link came from the confirmation email)
// ----------------------------------------------------------------------------
router.get('/resubscribe', async (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!isValidEmail(email) || !verifyResubscribeToken(email, token)) {
    return res.status(400).type('html').send(unsubscribePage({ ok: false, action: 'resubscribe' }));
  }
  try {
    await resubscribeEmail(email);
    res.type('html').send(unsubscribePage({ ok: true, email, action: 'resubscribe' }));
  } catch (error) {
    console.error('Resubscribe failed:', error.message);
    res.status(503).type('html').send(unsubscribePage({ ok: false, retry: true, action: 'resubscribe' }));
  }
});

// ----------------------------------------------------------------------------
// @desc   Get all promo codes and subscriber statistics (Admin only)
// @route  GET /api/discount
// @access Private/Admin
// ----------------------------------------------------------------------------
router.get('/', protect, admin, async (req, res) => {
  try {
    const [discounts, subscriberCount, userCount, recipients] = await Promise.all([
      DiscountCode.find().sort({ createdAt: -1 }),
      DiscountSubscriber.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'user', marketingOptOut: { $ne: true } }),
      collectRecipients(),
    ]);

    res.json({
      discounts,
      subscriberCount,
      userCount,
      audienceCount: recipients.length, // distinct addresses a broadcast would reach
      emailReady: Boolean(createTransporter()),
    });
  } catch (error) {
    handleError(res, error);
  }
});

// ----------------------------------------------------------------------------
// @desc   Create new discount code with optional immediate email broadcast
// @route  POST /api/discount
// @access Private/Admin
// ----------------------------------------------------------------------------
router.post('/', protect, admin, async (req, res) => {
  try {
    const { code, notifyUsers = false } = req.body;

    if (!code || typeof code !== 'string' || req.body.percentageOff === undefined || req.body.percentageOff === '') {
      return res.status(400).json({ message: 'Code and percentage discount are required' });
    }
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(code.trim())) {
      return res.status(400).json({ message: 'Code must be 3-20 letters, numbers, - or _' });
    }
    const { fields, error } = readDiscountFields({ isActive: true, ...req.body }, { creating: true });
    if (error) return res.status(400).json({ message: error });
    if (fields.expiresAt && fields.expiresAt <= new Date()) {
      return res.status(400).json({ message: 'The last valid day must be today or later' });
    }
    if (fields.maxUses && fields.maxUsesPerUser && fields.maxUsesPerUser > fields.maxUses) {
      return res.status(400).json({ message: 'Uses per customer cannot be more than the total uses' });
    }
    const message = readCustomMessage(req.body.customMessage);
    if (message.error) return res.status(400).json({ message: message.error });

    // Check everything a broadcast needs before creating anything
    const notify = notifyUsers === true || notifyUsers === 'true';
    if (notify && !fields.isActive) {
      return res.status(400).json({ message: 'Activate this code before broadcasting it, or create it without emailing customers.' });
    }
    if (notify && !createTransporter()) return res.status(503).json({ message: EMAIL_OFF });

    const upperCode = code.toUpperCase().trim();
    const existing = await DiscountCode.findOne({ code: upperCode });
    if (existing) {
      return res.status(400).json({ message: `Discount code "${upperCode}" already exists` });
    }

    const discount = await DiscountCode.create({ code: upperCode, ...fields });

    if (!notify) {
      return res.status(201).json({ message: `Discount code "${upperCode}" created successfully!`, discount });
    }

    const blocker = await broadcastBlocker(discount);
    if (blocker) {
      return res.status(201).json({ message: `Discount code "${upperCode}" created, but not emailed: ${blocker}`, discount, ...broadcastPayload({ sent: 0, failed: 0, skipped: 0, total: 0 }) });
    }
    const result = await broadcastDiscount(discount, { customMessage: message.value, baseUrl: apiBaseUrl(req) });
    res.status(201).json({
      message: `Discount code "${upperCode}" created. ${broadcastMessage(upperCode, result)}`,
      discount,
      ...broadcastPayload(result),
    });
  } catch (error) {
    handleError(res, error);
  }
});

// ----------------------------------------------------------------------------
// @desc   Edit a promo code's discount and limits (the code itself stays the same)
// @route  PATCH /api/discount/:id
// @access Private/Admin
// ----------------------------------------------------------------------------
router.patch('/:id', protect, admin, async (req, res) => {
  try {
    const discount = await DiscountCode.findById(req.params.id);
    if (!discount) return res.status(404).json({ message: 'Discount code not found' });
    if (req.body.code !== undefined && String(req.body.code).trim().toUpperCase() !== discount.code) {
      return res.status(400).json({ message: 'The code itself cannot be changed. Create a new code instead.' });
    }

    const { fields, error } = readDiscountFields(req.body, { creating: false });
    if (error) return res.status(400).json({ message: error });
    if (!Object.keys(fields).length) return res.status(400).json({ message: 'Nothing to update' });

    const maxUses = fields.maxUses !== undefined ? fields.maxUses : discount.maxUses;
    const perUser = fields.maxUsesPerUser !== undefined ? fields.maxUsesPerUser : discount.maxUsesPerUser;
    if (maxUses && perUser && perUser > maxUses) {
      return res.status(400).json({ message: 'Uses per customer cannot be more than the total uses' });
    }

    Object.assign(discount, fields);
    await discount.save();
    res.json({ message: `Discount code ${discount.code} updated`, discount });
  } catch (error) {
    handleError(res, error);
  }
});

// ----------------------------------------------------------------------------
// @desc   Toggle promo code active / inactive status (Admin only)
// @route  PATCH /api/discount/:id/toggle
// @access Private/Admin
// ----------------------------------------------------------------------------
router.patch('/:id/toggle', protect, admin, async (req, res) => {
  try {
    const discount = await DiscountCode.findById(req.params.id);
    if (!discount) return res.status(404).json({ message: 'Discount code not found' });

    discount.isActive = !discount.isActive;
    await discount.save();

    res.json({ message: `Discount code ${discount.code} is now ${discount.isActive ? 'Active' : 'Inactive'}`, discount });
  } catch (error) {
    handleError(res, error);
  }
});

// ----------------------------------------------------------------------------
// @desc   Delete a discount code (Admin only)
// @route  DELETE /api/discount/:id
// @access Private/Admin
// ----------------------------------------------------------------------------
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const discount = await DiscountCode.findByIdAndDelete(req.params.id);
    if (!discount) return res.status(404).json({ message: 'Discount code not found' });

    res.json({ message: `Discount code ${discount.code} deleted successfully` });
  } catch (error) {
    handleError(res, error);
  }
});

// ----------------------------------------------------------------------------
// @desc   Email a promo code to subscribers & customers who accept offers (Admin)
// @route  POST /api/discount/broadcast/:id   { customMessage? }
// @access Private/Admin
// Responds with { sent, failed, skipped, total } once every email has been tried.
// ----------------------------------------------------------------------------
router.post('/broadcast/:id', protect, admin, async (req, res) => {
  try {
    const discount = await DiscountCode.findById(req.params.id);
    if (!discount) return res.status(404).json({ message: 'Discount code not found' });

    const message = readCustomMessage(req.body.customMessage);
    if (message.error) return res.status(400).json({ message: message.error });
    const blocker = await broadcastBlocker(discount);
    if (blocker) return res.status(400).json({ message: blocker });
    if (!createTransporter()) return res.status(503).json({ message: EMAIL_OFF });

    const result = await broadcastDiscount(discount, { customMessage: message.value, baseUrl: apiBaseUrl(req) });
    // Nothing went out although there were people to send to: report it as a failure
    const status = result.sent === 0 && result.failed > 0 ? 502 : 200;
    res.status(status).json({
      message: broadcastMessage(discount.code, result),
      ...broadcastPayload(result),
      discount,
    });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
