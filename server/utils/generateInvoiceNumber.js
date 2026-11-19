const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const { todayIST } = require('./dates');

// One counter document per year ({ _id: 'invoice-2026', seq: 41 }), bumped atomically
const Counter = mongoose.models.InvoiceCounter || mongoose.model('InvoiceCounter', new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
}, { versionKey: false }));

const prefixFor = (year) => `DA-${year}-`;

/** Highest invoice number already used for the year (0 if none). */
const highestExisting = async (year) => {
  const prefix = prefixFor(year);
  const last = await Booking.findOne({ invoiceNumber: { $regex: `^${prefix}\\d+$` } })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean();
  return last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) || 0 : 0;
};

/**
 * Move the year's counter up to the highest number already on a booking (never down).
 * Used the first time a year is seen, and if an insert ever hits a duplicate number.
 */
const syncInvoiceCounter = async (year = todayIST().slice(0, 4)) => {
  const highest = await highestExisting(year);
  await Counter.updateOne({ _id: `invoice-${year}` }, { $max: { seq: highest } }, { upsert: true });
};

/**
 * Next invoice number in the form DA-<year>-<000001>. The year is the India date's year.
 * The sequence comes from an atomic $inc, so simultaneous bookings always get different numbers.
 */
const generateInvoiceNumber = async () => {
  const year = todayIST().slice(0, 4);
  const id = `invoice-${year}`;
  let counter = await Counter.findOneAndUpdate({ _id: id }, { $inc: { seq: 1 } }, { new: true }).lean();
  if (!counter) {
    // First invoice of the year on this database: start after the highest number already used
    try {
      await syncInvoiceCounter(year);
    } catch (err) {
      if (err.code !== 11000) throw err; // another request created it at the same moment
    }
    counter = await Counter.findOneAndUpdate({ _id: id }, { $inc: { seq: 1 } }, { new: true }).lean();
  }
  return `${prefixFor(year)}${String(counter.seq).padStart(6, '0')}`;
};

module.exports = generateInvoiceNumber;
module.exports.syncInvoiceCounter = syncInvoiceCounter;
