/**
 * ============================================================================
 * CAR ALERT NOTIFICATION SERVICE
 * ============================================================================
 * Handles automated email dispatch when an unavailable car status reverts to
 * 'Available'. Scans for pending subscribers in the CarAlert collection,
 * dispatches vehicle availability emails, and updates notification timestamps.
 */

const CarAlert = require('../models/CarAlert');
const Car = require('../models/Car');
const { sendCarAvailabilityEmail } = require('./emailService');

/**
 * Check and notify all users waiting for a specific car when it becomes Available
 * @param {string|mongoose.Types.ObjectId} carId - The unique ID of the car
 */
const triggerCarAvailabilityAlerts = async (carId) => {
  try {
    // Verify car existence and that its current status is 'Available'
    const car = await Car.findById(carId);
    if (!car || car.status !== 'Available') {
      return;
    }

    // Retrieve all pending (unnotified) subscription alerts for this vehicle
    const pendingAlerts = await CarAlert.find({ car: carId, notified: false });
    if (!pendingAlerts || pendingAlerts.length === 0) {
      return;
    }

    console.log(`🔔 Found ${pendingAlerts.length} subscriber(s) waiting for car: "${car.company} ${car.name}"`);

    // Process notification emails for each subscriber
    for (const alert of pendingAlerts) {
      try {
        await sendCarAvailabilityEmail({
          recipientEmail: alert.email,
          car,
        });

        // Mark alert as dispatched to prevent duplicate notification emails
        alert.notified = true;
        alert.notifiedAt = new Date();
        await alert.save();
      } catch (err) {
        console.error(`Failed to send alert to ${alert.email}:`, err.message);
      }
    }

    console.log(`✅ Dispatched availability notifications for "${car.name}".`);
  } catch (error) {
    console.error('❌ Error in triggerCarAvailabilityAlerts:', error.message);
  }
};

module.exports = {
  triggerCarAvailabilityAlerts,
};
