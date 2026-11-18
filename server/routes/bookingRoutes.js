const express = require('express');
const router = express.Router();
const {
  createBooking, getMyBookings, getBookingById, cancelBooking,
  markPaymentComplete, getAllBookings, updateBookingStatus, deleteBooking,
  getWhatsAppInvoice, getInvoicePdf
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

// NOTE: /my must come BEFORE /:id to avoid conflict
router.get('/my', protect, getMyBookings);
router.post('/', protect, createBooking);
router.get('/:id/whatsapp', protect, getWhatsAppInvoice);
router.get('/:id/invoice', protect, getInvoicePdf);
router.get('/:id', protect, getBookingById);
router.patch('/:id/cancel', protect, cancelBooking);
router.patch('/:id/payment', protect, markPaymentComplete);
// Admin routes
router.get('/', protect, admin, getAllBookings);
router.patch('/:id/status', protect, admin, updateBookingStatus);
router.delete('/:id', protect, admin, deleteBooking);

module.exports = router;
