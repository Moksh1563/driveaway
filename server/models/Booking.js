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
  loyaltyPointsUsed:  { type: Number, default: 0 },
  advancePayment:     { type: Number, default: 0 },
  paymentMethod:      { type: String, enum: ['Cash', 'UPI', 'Net Banking', 'Card', 'Wallet', 'Razorpay', 'Razorpay (UPI)', 'Razorpay (CARD)', 'Razorpay (NETBANKING)', 'Razorpay (WALLET)'], default: 'Cash' },
  paymentCompleted:   { type: Boolean, default: false },
  paymentCompletedAt: { type: Date },
  paymentId:          { type: String },
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

module.exports = mongoose.model('Booking', bookingSchema);
