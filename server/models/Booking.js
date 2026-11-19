const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  invoiceNumber:      { type: String, unique: true },
  user:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  car:                { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  // Customer snapshot
  customerName:       { type: String },
  customerEmail:      { type: String },
  customerPhone:      { type: String },
  // Dates
  pickupDate:         { type: Date, required: true },
  returnDate:         { type: Date, required: true },
  pickupLocation:     { type: String },
  // Financials
  dailyRateSnapshot:  { type: Number },
  totalDays:          { type: Number },
  totalAmount:        { type: Number },
  discountAmount:     { type: Number, default: 0 },
  discountCode:       { type: String },
  discountClaimed:    { type: Boolean, default: false }, // this booking took one of the code's uses
  loyaltyPointsUsed:  { type: Number, default: 0 },
  loyaltyDiscount:    { type: Number, default: 0 },     // rupees taken off for loyaltyPointsUsed
  advancePayment:     { type: Number, default: 0 },
  // Loyalty points are earned when the trip is completed, once (older bookings earned them at creation)
  pointsAwarded:      { type: Boolean, default: false },
  loyaltyPointsEarned:{ type: Number, default: 0 },
  // 'UPI', 'Card', 'Net Banking' and 'Wallet' only exist on older bookings; payments are now
  // 'Cash' (collected at the hub) or the simulated 'Online test (...)' checkout, both set by the server
  paymentMethod:      { type: String, enum: ['Cash', 'UPI', 'Net Banking', 'Card', 'Wallet', 'Online test', 'Online test (UPI)', 'Online test (CARD)', 'Online test (NETBANKING)', 'Online test (WALLET)',
    /* older bookings */ 'Razorpay', 'Razorpay (UPI)', 'Razorpay (CARD)', 'Razorpay (NETBANKING)', 'Razorpay (WALLET)'], default: 'Cash' },
  paymentCompleted:   { type: Boolean, default: false },
  paymentCompletedAt: { type: Date },
  paymentId:          { type: String },
  paidAmount:         { type: Number },                  // what was recorded as paid (= totalAmount)
  refundedAt:         { type: Date },                    // simulated refund when a paid booking is cancelled
  // Status
  status:             { type: String, enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'], default: 'Pending' },
  cancellationReason: { type: String },
  cancelledAt:        { type: Date },
  cancelledBy:        { type: String },
  // Driver details
  licenseNumber:      { type: String },
  dateOfBirth:        { type: Date },
  address:            { type: String },
  drivingExperience:  { type: Number },
  idProofType:        { type: String },
  idProofNumber:      { type: String },
  emergencyContact:   { type: String },
  emergencyPhone:     { type: String },
  specialRequirements:{ type: String },
  bookingNotes:       { type: String },
}, { timestamps: true });

// Indexes for "my bookings", overlap checks and admin listing
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ car: 1, status: 1, pickupDate: 1, returnDate: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ createdAt: -1 });
// Unpaid-booking cap and per-user discount checks
bookingSchema.index({ user: 1, status: 1, paymentCompleted: 1, returnDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
