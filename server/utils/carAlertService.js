/**
 * ============================================================================
 * CAR ALERT NOTIFICATION SERVICE
 * ============================================================================
 * Emails the people who asked to be told when a car is free again. Runs when
 * an admin takes a car out of maintenance, and when a booking is cancelled or
 * completed. Sends only if the car really is bookable now (not in maintenance
 * and no booking covers today). Each alert is claimed before sending, so two
 * triggers at once never email the same person twice, and an alert is only
 * used up when its email actually went out.
 */

const CarAlert = require('../models/CarAlert');
const Car = require('../models/Car');
const { createTransporter, sendCarAvailabilityEmail } = require('./emailService');
const { isValidEmail } = require('../middleware/securityMiddleware');
const { isAvailableNow } = require('./carAvailability');

/**
 * Check and notify all users waiting for a specific car when it becomes available
 * @param {string|mongoose.Types.ObjectId} carId - The unique ID of the car
 * @returns {Promise<number>} how many alert emails were sent
 */
const triggerCarAvailabilityAlerts = async (carId) => {
  try {
    const car = await Car.findById(carId).lean();
    if (!car || !(await isAvailableNow(car))) return 0;

    const pendingCount = await CarAlert.countDocuments({ car: car._id, notified: false });
    if (!pendingCount) return 0;

    // Email is not set up: keep the alerts for later instead of using them up silently
    if (!createTransporter()) {
      console.warn(`⚠️ ${pendingCount} availability alert(s) for "${car.name}" kept: email is not set up.`);
      return 0;
    }

    console.log(`🔔 Found ${pendingCount} subscriber(s) waiting for car: "${car.company} ${car.name}"`);
    let sent = 0;

    for (;;) {
      // Claim one alert at a time; another trigger running at once cannot take the same one
      const alert = await CarAlert.findOneAndUpdate(
        { car: car._id, notified: false },
        { $set: { notified: true, notifiedAt: new Date() } },
        { new: true, sort: { createdAt: 1 } }
      );
      if (!alert) break;
      if (!isValidEmail(alert.email)) continue; // can never be delivered; leave it used up

      const result = await sendCarAvailabilityEmail({ recipientEmail: alert.email, car });
      if (result && result.sent) {
        sent += 1;
        continue;
      }
      // Put it back so the next trigger tries again, and stop: the provider is failing (quota, outage)
      await CarAlert.updateOne({ _id: alert._id }, { $set: { notified: false }, $unset: { notifiedAt: '' } });
      console.error(`Failed to send alert to ${alert.email}:`, result?.error || 'unknown error');
      break;
    }

    if (sent) console.log(`✅ Dispatched ${sent} availability notification(s) for "${car.name}".`);
    return sent;
  } catch (error) {
    console.error('❌ Error in triggerCarAvailabilityAlerts:', error.message);
    return 0;
  }
};

module.exports = {
  triggerCarAvailabilityAlerts,
};
