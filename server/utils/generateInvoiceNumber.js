const Booking = require('../models/Booking');

const generateInvoiceNumber = async () => {
  const count = await Booking.countDocuments();
  const year = new Date().getFullYear();
  const sequence = String(count + 1).padStart(6, '0');
  return `DA-${year}-${sequence}`;
};

module.exports = generateInvoiceNumber;
