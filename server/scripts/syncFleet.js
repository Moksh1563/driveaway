/**
 * Bring the database fleet in line with data/fleet.js without wiping users, bookings or admin edits.
 *  - Cars are matched by name. Missing cars are created.
 *  - Existing cars keep their _id, ratings, status and the admin's price and photos. Only specs are
 *    updated by default (company, type, year, fuel, transmission, seats, luggage, mileage, description).
 *  - A price or photo set that differs from the fleet data is reported and kept, unless you pass
 *    --overwrite-prices / --overwrite-photos.
 *  - Cars that are not in the fleet data (e.g. added in the admin panel) are listed and kept. With --prune
 *    they are deleted, except any car that has ever been booked (its bookings, invoices and reviews need it).
 *  - --dry-run prints every planned change and writes nothing.
 *
 * Usage (from server/):  node scripts/syncFleet.js [--dry-run] [--overwrite-prices] [--overwrite-photos] [--prune]
 */
require('dotenv').config();
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const CarAlert = require('../models/CarAlert');
const connectDB = require('../config/db');
const { disconnectDB } = require('../config/db');
const buildFleet = require('../data/buildFleet');

const FLAGS = ['--dry-run', '--overwrite-prices', '--overwrite-photos', '--prune'];
const args = process.argv.slice(2);
const unknown = args.filter((a) => !FLAGS.includes(a));
if (unknown.length) {
  console.error(`Unknown option(s): ${unknown.join(' ')}`);
  console.error(`Usage: node scripts/syncFleet.js [${FLAGS.join('] [')}]`);
  process.exit(1);
}
const DRY_RUN = args.includes('--dry-run');
const OVERWRITE_PRICES = args.includes('--overwrite-prices');
const OVERWRITE_PHOTOS = args.includes('--overwrite-photos');
const PRUNE = args.includes('--prune');

// Fields owned by data/fleet.js. dailyRate, images and imageCredits are only replaced with a flag;
// status, ratings and everything else the admin manages are never touched.
const SPEC_FIELDS = ['company', 'type', 'yearModel', 'fuelType', 'transmission', 'seats', 'luggage', 'mileage', 'description'];
const IMAGE_SLOTS = ['main', 'img1', 'img2', 'img3', 'img4'];

const imagesOf = (images = {}) => IMAGE_SLOTS.map((k) => (images && images[k]) || '');
const creditsOf = (credits = []) => JSON.stringify((credits || []).map(({ url, author, license, source }) => [url, author, license, source]));
const show = (v) => (typeof v === 'string' && v.length > 60 ? `${JSON.stringify(v.slice(0, 57))}...` : JSON.stringify(v));

(async () => {
  const conn = await connectDB();
  console.log(`Fleet sync target: ${conn.host} / ${conn.name}${DRY_RUN ? '  (dry run: nothing will be written)' : ''}`);

  const fleet = buildFleet();
  const names = new Set(fleet.map((c) => c.name));
  let created = 0;
  let updated = 0;
  let keptPrices = 0;
  let keptPhotos = 0;

  for (const car of fleet) {
    const existing = await Car.findOne({ name: car.name }).lean();
    if (!existing) {
      console.log(`+ ${car.name}: new car (₹${car.dailyRate}/day)`);
      if (!DRY_RUN) await Car.create(car);
      created++;
      continue;
    }

    const set = {};
    const notes = [];
    for (const field of SPEC_FIELDS) {
      if (car[field] !== undefined && car[field] !== existing[field]) {
        set[field] = car[field];
        notes.push(`${field} ${show(existing[field])} -> ${show(car[field])}`);
      }
    }

    if (car.dailyRate !== existing.dailyRate) {
      if (OVERWRITE_PRICES) {
        set.dailyRate = car.dailyRate;
        notes.push(`dailyRate ₹${existing.dailyRate} -> ₹${car.dailyRate}`);
      } else {
        keptPrices++;
        notes.push(`kept price ₹${existing.dailyRate} (fleet data: ₹${car.dailyRate}; --overwrite-prices to replace)`);
      }
    }

    const photosDiffer = imagesOf(existing.images).join('|') !== imagesOf(car.images).join('|');
    if (photosDiffer) {
      if (OVERWRITE_PHOTOS) {
        set.images = car.images;
        set.imageCredits = car.imageCredits;
        notes.push('photos replaced with the fleet data photos');
      } else {
        keptPhotos++;
        notes.push('kept current photos (differ from fleet data; --overwrite-photos to replace)');
      }
    } else if (creditsOf(existing.imageCredits) !== creditsOf(car.imageCredits)) {
      // Same photos, newer author/licence details
      set.imageCredits = car.imageCredits;
      notes.push('photo credits updated');
    }

    if (notes.length) console.log(`~ ${car.name}: ${notes.join('; ')}`);
    if (Object.keys(set).length) {
      if (!DRY_RUN) await Car.updateOne({ _id: existing._id }, { $set: set });
      updated++;
    }
  }

  const extras = await Car.find({ name: { $nin: [...names] } }).select('name').lean();
  let removed = 0;
  for (const car of extras) {
    if (!PRUNE) {
      console.log(`= Kept "${car.name}": not in the fleet data (pass --prune to remove cars that were never booked).`);
      continue;
    }
    const booked = await Booking.exists({ car: car._id });
    if (booked) {
      console.log(`= Kept "${car.name}": not in the fleet data, but it has bookings.`);
      continue;
    }
    console.log(`- ${car.name}: removed (not in the fleet data, never booked)`);
    if (!DRY_RUN) {
      await Car.deleteOne({ _id: car._id });
      await CarAlert.deleteMany({ car: car._id });
    }
    removed++;
  }

  const byType = await Car.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  const verb = DRY_RUN ? 'would be' : '';
  console.log(`\nFleet sync${DRY_RUN ? ' (dry run)' : ''}: ${created} ${verb} created, ${updated} ${verb} updated, ${removed} ${verb} removed.`.replace(/ {2,}/g, ' '));
  if (keptPrices || keptPhotos) {
    console.log(`Kept admin values: ${keptPrices} prices, ${keptPhotos} photo sets.`);
  }
  console.log(byType.map((t) => `${t._id}: ${t.n}`).join(', '));
  await disconnectDB();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
