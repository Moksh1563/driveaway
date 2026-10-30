/**
 * ============================================================================
 * DISCOUNT SUBSCRIBER MODEL (DiscountSubscriber)
 * ============================================================================
 * Stores newsletter and discount alert subscriptions. When the admin launches
 * a promo code or broadcasts a special offer, all active subscribers receive
 * promotional email notifications.
 */

const mongoose = require('mongoose');

const discountSubscriberSchema = new mongoose.Schema({
  // Unique subscriber email address
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  // Optional reference to the user if subscribed while logged in
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Subscription status (allows opt-out / re-subscription)
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('DiscountSubscriber', discountSubscriberSchema);
