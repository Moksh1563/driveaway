/**
 * ============================================================================
 * DISCOUNT & PROMOTION ROUTES
 * ============================================================================
 * Endpoints for:
 *  - Validating discount codes at checkout (POST /api/discount/validate)
 *  - Subscribing to discount notifications & newsletter (POST /api/discount/subscribe)
 *  - Admin listing, creation, toggling & deletion of promo codes (GET, POST, PATCH, DELETE)
 *  - Admin mass-broadcasting promotional emails to all users & subscribers (POST /broadcast/:id)
 */

const express = require('express');
const router = express.Router();
const DiscountCode = require('../models/DiscountCode');
const DiscountSubscriber = require('../models/DiscountSubscriber');
const User = require('../models/User');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { sendDiscountBroadcastEmail } = require('../utils/emailService');

// ----------------------------------------------------------------------------
// @desc   Validate a discount promo code during checkout
// @route  POST /api/discount/validate
// @access Private (authenticated users)
// ----------------------------------------------------------------------------
router.post('/validate', protect, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Please provide a discount code' });

    // Find active discount matching uppercase code
    const discount = await DiscountCode.findOne({ code: code.toUpperCase(), isActive: true });
    if (!discount) return res.status(404).json({ message: 'Invalid or expired discount code' });

    res.json({
      percentageOff: discount.percentageOff,
      maxDiscount: discount.maxDiscount,
      code: discount.code,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already in subscriber database
    let subscriber = await DiscountSubscriber.findOne({ email: normalizedEmail });
    if (subscriber) {
      if (!subscriber.isActive) {
        // Re-activate previously inactive subscriber
        subscriber.isActive = true;
        await subscriber.save();
        return res.json({ message: `Welcome back! You've been re-subscribed to Driveaway discount alerts at ${normalizedEmail}.` });
      }
      return res.json({ message: `You are already subscribed to receive exclusive discounts at ${normalizedEmail}!` });
    }

    // Register new discount subscriber
    subscriber = await DiscountSubscriber.create({
      email: normalizedEmail,
      user: req.user ? req.user._id : null,
      isActive: true,
    });

    res.status(201).json({
      message: `🎉 You're subscribed! We will notify ${normalizedEmail} whenever exciting new discounts are launched.`,
      subscriber,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ----------------------------------------------------------------------------
// @desc   Get all promo codes and subscriber statistics (Admin only)
// @route  GET /api/discount
// @access Private/Admin
// ----------------------------------------------------------------------------
router.get('/', protect, admin, async (req, res) => {
  try {
    const discounts = await DiscountCode.find().sort({ createdAt: -1 });
    const subscriberCount = await DiscountSubscriber.countDocuments({ isActive: true });
    const userCount = await User.countDocuments({ role: 'user' });

    res.json({ discounts, subscriberCount, userCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ----------------------------------------------------------------------------
// @desc   Create new discount code with optional immediate email broadcast
// @route  POST /api/discount
// @access Private/Admin
// ----------------------------------------------------------------------------
router.post('/', protect, admin, async (req, res) => {
  try {
    const { code, percentageOff, maxDiscount, isActive = true, notifyUsers = false, customMessage } = req.body;

    if (!code || !percentageOff) {
      return res.status(400).json({ message: 'Code and percentage discount are required' });
    }

    const upperCode = code.toUpperCase().trim();
    const existing = await DiscountCode.findOne({ code: upperCode });
    if (existing) {
      return res.status(400).json({ message: `Discount code "${upperCode}" already exists` });
    }

    const discount = await DiscountCode.create({
      code: upperCode,
      percentageOff: Number(percentageOff),
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      isActive: Boolean(isActive),
    });

    // If notifyUsers flag is checked, immediately broadcast to all users & subscribers
    let broadcastCount = 0;
    if (notifyUsers) {
      broadcastCount = await broadcastDiscountHelper(discount, customMessage);
    }

    res.status(201).json({
      message: `Discount code "${upperCode}" created successfully!${notifyUsers ? ` Dispatched emails to ${broadcastCount} recipients.` : ''}`,
      discount,
      broadcastCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
});

// ----------------------------------------------------------------------------
// @desc   Broadcast a specific discount code to all users & subscribers (Admin)
// @route  POST /api/discount/broadcast/:id
// @access Private/Admin
// ----------------------------------------------------------------------------
router.post('/broadcast/:id', protect, admin, async (req, res) => {
  try {
    const discount = await DiscountCode.findById(req.params.id);
    if (!discount) return res.status(404).json({ message: 'Discount code not found' });

    const broadcastCount = await broadcastDiscountHelper(discount, req.body.customMessage);

    res.json({
      message: `📢 Successfully broadcast discount code "${discount.code}" to ${broadcastCount} users & subscribers!`,
      broadcastCount,
      discount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * Helper to dispatch discount broadcast emails to all users and subscribers
 * Deduplicates recipient emails between registered accounts and newsletter subscribers.
 */
async function broadcastDiscountHelper(discount, customMessage) {
  try {
    const registeredUsers = await User.find({ email: { $exists: true, $ne: '' } }, 'name email');
    const subscribers = await DiscountSubscriber.find({ isActive: true, email: { $exists: true, $ne: '' } });

    // Use a Map keyed by lowercase email to deduplicate
    const recipientMap = new Map();

    registeredUsers.forEach(u => {
      if (u.email) recipientMap.set(u.email.toLowerCase().trim(), { email: u.email, name: u.name });
    });

    subscribers.forEach(s => {
      const email = s.email.toLowerCase().trim();
      if (!recipientMap.has(email)) {
        recipientMap.set(email, { email: s.email, name: '' });
      }
    });

    const recipientList = Array.from(recipientMap.values());
    console.log(`📢 Broadcasting discount ${discount.code} to ${recipientList.length} total recipients...`);

    // Dispatch emails asynchronously (does not block HTTP response)
    recipientList.forEach(recipient => {
      sendDiscountBroadcastEmail({
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        discountCode: discount.code,
        percentageOff: discount.percentageOff,
        maxDiscount: discount.maxDiscount,
        description: customMessage || `Use promo code ${discount.code} at checkout to save ${discount.percentageOff}%!`,
      }).catch(err => console.error(`Error sending broadcast to ${recipient.email}:`, err.message));
    });

    return recipientList.length;
  } catch (err) {
    console.error('Error in broadcastDiscountHelper:', err.message);
    return 0;
  }
}

module.exports = router;
