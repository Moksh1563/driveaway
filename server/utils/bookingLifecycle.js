/**
 * Booking status changes and their side effects, in one place so the customer's
 * cancel, the admin's cancel and the admin's complete all behave the same.
 * Every change is a conditional update on the current status, so it can only happen once.
 */
const Booking = require('../models/Booking');
const User = require('../models/User');
const { releaseDiscountUse } = require('./discounts');
const { triggerCarAvailabilityAlerts } = require('./carAlertService');
const { ACTIVE_BOOKING_STATUSES } = require('./carAvailability');
const { todayStart } = require('./dates');

// Admin transitions. Completed and Cancelled are final.
const NEXT_STATUSES = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};

const allowedNextStatuses = (status) => NEXT_STATUSES[status] || [];

// 1 point per ₹100 of the final total, earned when the trip is completed
const pointsFor = (totalAmount) => Math.max(0, Math.floor((Number(totalAmount) || 0) / 100));

const toPlain = (booking) => (booking && typeof booking.toObject === 'function' ? booking.toObject() : { ...booking });

/**
 * Booking as sent to clients: the stored fields plus what can happen next.
 *  allowedNextStatuses - admin transitions from the current status
 *  canCancel           - the customer may still cancel (active and pickup is after today)
 *  canPay              - the customer may still pay through the test checkout
 */
const bookingView = (booking, today = todayStart()) => {
  if (!booking) return booking;
  const obj = toPlain(booking);
  const active = ACTIVE_BOOKING_STATUSES.includes(obj.status);
  obj.allowedNextStatuses = allowedNextStatuses(obj.status);
  obj.canCancel = active && new Date(obj.pickupDate) > today;
  obj.canPay = obj.status === 'Pending' && !obj.paymentCompleted && new Date(obj.returnDate) > today;
  return obj;
};

/** Refund points, give back the discount use, mark a paid booking refunded, tell waiting customers. */
const applyCancellationEffects = async (booking) => {
  const work = [];
  if (booking.loyaltyPointsUsed > 0) {
    work.push(User.updateOne({ _id: booking.user }, { $inc: { loyaltyPoints: booking.loyaltyPointsUsed } }));
  }
  if (booking.discountCode && booking.discountClaimed) {
    work.push(releaseDiscountUse(booking.discountCode));
  }
  if (booking.paymentCompleted && !booking.refundedAt) {
    // Payments are simulated, so the refund is too: record when it was issued
    const refundedAt = new Date();
    booking.refundedAt = refundedAt;
    work.push(Booking.updateOne({ _id: booking._id, refundedAt: null }, { $set: { refundedAt } }));
  }
  await Promise.all(work);
  triggerCarAvailabilityAlerts(booking.car).catch((err) => console.error(err));
  return booking;
};

/**
 * Cancel a booking that matches `filter` and is still Pending/Confirmed, then apply the effects.
 * @returns {Promise<Document|null>} the cancelled booking, or null if nothing matched
 */
const cancelBooking = async (filter, { reason, cancelledBy } = {}) => {
  const booking = await Booking.findOneAndUpdate(
    { $and: [filter, { status: { $in: ACTIVE_BOOKING_STATUSES } }] },
    {
      $set: {
        status: 'Cancelled',
        cancellationReason: (typeof reason === 'string' && reason.trim() ? reason.trim() : 'Cancelled').slice(0, 300),
        cancelledAt: new Date(),
        cancelledBy: String(cancelledBy || '').slice(0, 120),
      },
    },
    { new: true }
  );
  if (!booking) return null;
  await applyCancellationEffects(booking);
  return booking;
};

/** Pending -> Confirmed. */
const confirmBooking = (bookingId) =>
  Booking.findOneAndUpdate({ _id: bookingId, status: 'Pending' }, { $set: { status: 'Confirmed' } }, { new: true });

/**
 * Confirmed -> Completed. An unpaid booking is recorded as cash collected at the hub,
 * and the loyalty points are credited (once; older bookings got theirs when they were made).
 * @returns {Promise<Document|null>} the completed booking, or null if it was not Confirmed
 */
const completeBooking = async (bookingId) => {
  let booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'Confirmed' },
    { $set: { status: 'Completed' } },
    { new: true }
  );
  if (!booking) return null;

  if (!booking.paymentCompleted) {
    const paid = await Booking.findOneAndUpdate(
      { _id: booking._id, paymentCompleted: false },
      { $set: { paymentCompleted: true, paymentMethod: 'Cash', paidAmount: booking.totalAmount, paymentCompletedAt: new Date() } },
      { new: true }
    );
    if (paid) booking = paid;
  }

  // pointsAwarded: false is only stored on bookings made since points moved to completion,
  // so older bookings (which earned points at creation) never get them twice
  const points = pointsFor(booking.totalAmount);
  const awarded = await Booking.findOneAndUpdate(
    { _id: booking._id, pointsAwarded: false },
    { $set: { pointsAwarded: true, loyaltyPointsEarned: points } },
    { new: true }
  );
  if (awarded) {
    booking = awarded;
    if (points > 0) await User.updateOne({ _id: booking.user }, { $inc: { loyaltyPoints: points } });
  }

  triggerCarAvailabilityAlerts(booking.car).catch((err) => console.error(err));
  return booking;
};

module.exports = {
  NEXT_STATUSES,
  allowedNextStatuses,
  pointsFor,
  bookingView,
  applyCancellationEffects,
  cancelBooking,
  confirmBooking,
  completeBooking,
};
