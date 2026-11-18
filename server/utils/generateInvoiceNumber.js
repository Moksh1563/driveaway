const Booking = require('../models/Booking');

/**
 * Next invoice number in the form DA-<year>-<000001>.
 * Uses the highest existing number for the year (not a document count), so deleting
 * a booking can never cause a duplicate invoice number.
 */
const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `DA-${year}-`;
  const last = await Booking.findOne({ invoiceNumber: { $regex: `^${prefix}\\d+$` } })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean();
  const lastSeq = last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(6, '0')}`;
};

module.exports = generateInvoiceNumber;
