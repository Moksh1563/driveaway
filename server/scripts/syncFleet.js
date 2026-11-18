/**
 * Bring the database fleet in line with data/fleet.js without wiping users or bookings.
 *  - Cars are matched by name: existing ones keep their _id, ratings and current status; specs and photos are updated.
 *  - Missing cars are created.
 *  - Cars not in the fleet list are removed, unless they have Pending/Confirmed bookings (those are reported and kept).
 *
 * Usage (from server/):  node scripts/syncFleet.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const buildFleet = require('../data/buildFleet');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const fleet = buildFleet();
  const names = new Set(fleet.map((c) => c.name));
  let created = 0;
  let updated = 0;

  for (const car of fleet) {
    const existing = await Car.findOne({ name: car.name });
    if (existing) {
      const { status, ...rest } = car; // keep the live status (a car may be out on a booking)
      await Car.updateOne({ _id: existing._id }, { $set: rest });
      updated++;
    } else {
      await Car.create(car);
      created++;
    }
  }

  const extras = await Car.find({ name: { $nin: [...names] } });
  let removed = 0;
  for (const car of extras) {
    const active = await Booking.exists({ car: car._id, status: { $in: ['Pending', 'Confirmed'] } });
    if (active) {
      console.log(`Kept "${car.name}" (not in fleet list) because it has an active booking.`);
    } else {
      await Car.deleteOne({ _id: car._id });
      removed++;
    }
  }

  const byType = await Car.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  console.log(`Fleet synced: ${created} created, ${updated} updated, ${removed} removed.`);
  console.log(byType.map((t) => `${t._id}: ${t.n}`).join(', '));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
