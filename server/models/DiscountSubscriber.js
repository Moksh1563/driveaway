/**
 * ============================================================================
 * DISCOUNT SUBSCRIBER MODEL (DiscountSubscriber)
 * ============================================================================
 * Stores newsletter and discount alert subscriptions. When the admin launches
 * a promo code or broadcasts a special offer, all active subscribers receive
 * promotional email notifications.
 * The unsubscribe link in every offer email sets isActive to false (creating an
 * inactive record if there was none). An inactive record is an opt-out: it also
 * stops offer emails to a registered account with the same email.
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
  // Subscription status: false = unsubscribed (opt-out). Only the signed-in owner of the address,
  // or the confirmation link emailed to it, sets it back to true
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('DiscountSubscriber', discountSubscriberSchema);
