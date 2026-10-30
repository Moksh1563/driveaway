/**
 * ============================================================================
 * CAR AVAILABILITY ALERT MODEL (CarAlert)
 * ============================================================================
 * Represents a user's subscription to receive a one-time automated email
 * notification when an unavailable car (Rented or Maintenance) returns to
 * 'Available' status in the fleet.
 */

const mongoose = require('mongoose');

const carAlertSchema = new mongoose.Schema({
  // Reference to the vehicle the user is waiting for
  car: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: true,
  },
  // Recipient email address to be notified
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  // Optional reference to a registered User document if logged in
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Flag indicating whether the availability notification email was dispatched
  notified: {
    type: Boolean,
    default: false,
  },
  // Timestamp recording when the notification email was sent
  notifiedAt: {
    type: Date,
  },
}, { timestamps: true });

// Compound index to quickly find pending alerts for a car and prevent duplicate notifications
carAlertSchema.index({ car: 1, email: 1, notified: 1 });

module.exports = mongoose.model('CarAlert', carAlertSchema);
