/**
 * Discount code rules, shared by checkout validation (POST /api/discount/validate)
 * and booking creation, so both accept and reject exactly the same codes.
 */
const DiscountCode = require('../models/DiscountCode');
const Booking = require('../models/Booking');

const rupeesText = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const normalise = (code) => (typeof code === 'string' ? code.trim().toUpperCase() : '');
const fail = (status, message) => ({ ok: false, status, message });

/** Rupees off a subtotal for a code: percentage, capped at maxDiscount, whole rupees. */
const discountFor = (discount, subtotal) => {
  let amount = (subtotal * discount.percentageOff) / 100;
  if (discount.maxDiscount && amount > discount.maxDiscount) amount = discount.maxDiscount;
  return Math.max(0, Math.min(subtotal, Math.round(amount)));
};

/**
 * Check a code for a customer.
 * @param {string} code
 * @param {{ subtotal?: number, userId?: string }} opts subtotal = booking price before discounts
 * @returns {Promise<{ ok: true, discount, amount } | { ok: false, status, message }>}
 */
const evaluateDiscount = async (code, { subtotal, userId } = {}) => {
  const upper = normalise(code);
  if (!upper) return fail(400, 'Please provide a discount code');
  if (upper.length > 40) return fail(404, 'Invalid or expired discount code');

  const discount = await DiscountCode.findOne({ code: upper }).lean();
  if (!discount || !discount.isActive) return fail(404, 'Invalid or expired discount code');
  if (discount.expiresAt && new Date(discount.expiresAt) <= new Date()) {
    return fail(400, `Discount code ${discount.code} has expired`);
  }
  if (discount.maxUses != null && (discount.usedCount || 0) >= discount.maxUses) {
    return fail(400, `Discount code ${discount.code} has been fully redeemed`);
  }
  const hasSubtotal = typeof subtotal === 'number' && Number.isFinite(subtotal);
  if (hasSubtotal && discount.minAmount && subtotal < discount.minAmount) {
    return fail(400, `Discount code ${discount.code} needs a booking of at least ${rupeesText(discount.minAmount)}`);
  }
  if (discount.maxUsesPerUser != null && userId) {
    const used = await Booking.countDocuments({ user: userId, discountCode: discount.code, status: { $ne: 'Cancelled' } });
    if (used >= discount.maxUsesPerUser) {
      return fail(400, `You have already used discount code ${discount.code}`);
    }
  }
  return { ok: true, discount, amount: hasSubtotal ? discountFor(discount, subtotal) : 0 };
};

/**
 * Reserve one use of a code. Atomic: never goes past maxUses, even with simultaneous bookings.
 * @returns {Promise<boolean>} false when the code was used up, switched off or expired meanwhile
 */
const claimDiscountUse = async (discountId) => {
  const now = new Date();
  const result = await DiscountCode.updateOne(
    {
      _id: discountId,
      isActive: true,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ maxUses: null }, { $expr: { $lt: [{ $ifNull: ['$usedCount', 0] }, '$maxUses'] } }] },
      ],
    },
    { $inc: { usedCount: 1 } }
  );
  return result.modifiedCount === 1;
};

/** Give back a use when a booking that used the code is cancelled (or fails to save). */
const releaseDiscountUse = async (code) => {
  const upper = normalise(code);
  if (!upper) return;
  await DiscountCode.updateOne({ code: upper, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
};

module.exports = { evaluateDiscount, claimDiscountUse, releaseDiscountUse, discountFor };
