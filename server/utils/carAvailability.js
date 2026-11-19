/**
 * Car availability is decided by bookings, not by a flag on the car.
 *  - Car.status is the admin's setting: 'Available' or 'Maintenance' (an old stored 'Rented' counts as 'Available').
 *  - A car is out right now when a Pending/Confirmed booking covers today (India date).
 *  - Two bookings clash when existing.pickup < new.return AND existing.return > new.pickup (half-open days).
 */
const crypto = require('crypto');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const User = require('../models/User');
const { todayStart } = require('./dates');

const ACTIVE_BOOKING_STATUSES = ['Pending', 'Confirmed'];

const adminStatusOf = (car) => (car && car.status === 'Maintenance' ? 'Maintenance' : 'Available');

/** Filter for active bookings on a car (or cars) that cover the given day. */
const coveringFilter = (day) => ({
  status: { $in: ACTIVE_BOOKING_STATUSES },
  pickupDate: { $lte: day },
  returnDate: { $gt: day },
});

/**
 * For the given cars (or every car), which are out today and when they are next free.
 * Back-to-back bookings are followed, so nextFreeDate is the first day nobody holds the car.
 * @returns {Promise<Map<string, Date>>} carId -> next free day, only for cars that are out today
 */
const busyNowMap = async (carIds) => {
  const today = todayStart();
  const filter = coveringFilter(today);
  if (carIds) filter.car = { $in: carIds };
  const busyIds = await Booking.distinct('car', filter);
  const map = new Map();
  if (!busyIds.length) return map;

  const upcoming = await Booking.find({
    car: { $in: busyIds },
    status: { $in: ACTIVE_BOOKING_STATUSES },
    returnDate: { $gt: today },
  }).select('car pickupDate returnDate').sort({ pickupDate: 1 }).lean();

  const byCar = new Map();
  for (const b of upcoming) {
    const id = b.car.toString();
    if (!byCar.has(id)) byCar.set(id, []);
    byCar.get(id).push(b);
  }
  for (const id of busyIds.map(String)) {
    let freeFrom = today;
    for (const b of byCar.get(id) || []) {
      if (b.pickupDate <= freeFrom && b.returnDate > freeFrom) freeFrom = b.returnDate;
    }
    map.set(id, freeFrom);
  }
  return map;
};

/** Add bookedNow, nextFreeDate, adminStatus and the effective status to plain car objects. */
const decorateCar = (car, busy) => {
  const freeFrom = busy.get(car._id.toString());
  const adminStatus = adminStatusOf(car);
  const bookedNow = Boolean(freeFrom);
  return {
    ...car,
    adminStatus,
    bookedNow,
    nextFreeDate: bookedNow ? freeFrom.toISOString() : null,
    status: adminStatus === 'Maintenance' ? 'Maintenance' : bookedNow ? 'Rented' : 'Available',
  };
};

const withAvailability = async (cars) => {
  if (!cars.length) return [];
  const busy = await busyNowMap(cars.map((c) => c._id));
  return cars.map((car) => decorateCar(car, busy));
};

/** Is the car free for someone to book or be told about right now? */
const isAvailableNow = async (car) => {
  if (!car || adminStatusOf(car) === 'Maintenance') return false;
  const covering = await Booking.exists({ car: car._id, ...coveringFilter(todayStart()) });
  return !covering;
};

/** Upcoming booked ranges for a car's calendar (no customer data). */
const bookedRangesFor = async (carId) => {
  const ranges = await Booking.find({
    car: carId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    returnDate: { $gt: todayStart() },
  }).select('pickupDate returnDate -_id').sort({ pickupDate: 1 }).limit(200).lean();
  return ranges.map((r) => ({ pickupDate: r.pickupDate.toISOString(), returnDate: r.returnDate.toISOString() }));
};

/** An active booking that overlaps [pickup, ret), if any. */
const findClash = (carId, pickup, ret) => Booking.findOne({
  car: carId,
  status: { $in: ACTIVE_BOOKING_STATUSES },
  pickupDate: { $lt: ret },
  returnDate: { $gt: pickup },
}).select('_id pickupDate returnDate').lean();

/**
 * Short-lived lock on one document (its bookingLockUntil/bookingLockToken fields), held while a
 * booking is checked and saved. Works without replica-set transactions. Returns a release function,
 * or null if the lock stayed busy for too long (or the document no longer exists).
 */
const LOCK_MS = 15000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lockDocument = async (Model, id, what, { attempts = 60 } = {}) => {
  const token = crypto.randomBytes(8).toString('hex');
  for (let i = 0; i < attempts; i++) {
    const now = new Date();
    const result = await Model.updateOne(
      { _id: id, $or: [{ bookingLockUntil: null }, { bookingLockUntil: { $lte: now } }] },
      { $set: { bookingLockUntil: new Date(now.getTime() + LOCK_MS), bookingLockToken: token } },
      { timestamps: false }
    );
    if (result.modifiedCount === 1) {
      return () => Model.updateOne(
        { _id: id, bookingLockToken: token },
        { $unset: { bookingLockUntil: '', bookingLockToken: '' } },
        { timestamps: false }
      ).catch((err) => console.error(`Could not release ${what} lock:`, err.message));
    }
    // Nothing to wait for when the document is gone (e.g. a customer account deleted meanwhile).
    // Checked every tenth miss only: a busy lock does not match the filter either.
    if (i % 10 === 0 && !(await Model.exists({ _id: id }))) return null;
    await sleep(40 + Math.floor(Math.random() * 60));
  }
  return null;
};

/** Per-car lock: two people cannot take the same dates at once. */
const lockCar = (carId, opts) => lockDocument(Car, carId, 'car', opts);

/**
 * Per-customer lock: one booking at a time per account, so the unpaid-booking cap and the
 * per-customer discount limits count every booking the customer has (even from two tabs at once).
 * Take it before lockCar, never while holding a car lock.
 */
const lockUser = (userId, opts) => lockDocument(User, userId, 'customer', opts);

module.exports = {
  ACTIVE_BOOKING_STATUSES,
  adminStatusOf,
  busyNowMap,
  decorateCar,
  withAvailability,
  isAvailableNow,
  bookedRangesFor,
  findClash,
  lockCar,
  lockUser,
};
