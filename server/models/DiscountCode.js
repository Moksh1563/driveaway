const mongoose = require('mongoose');

const discountCodeSchema = new mongoose.Schema({
  code:           { type: String, unique: true, required: true, uppercase: true },
  percentageOff:  { type: Number, required: true },
  maxDiscount:    { type: Number },
  isActive:       { type: Boolean, default: true },
  // Optional limits (empty = no limit). usedCount goes up when a booking uses the code
  // and back down when that booking is cancelled.
  expiresAt:      { type: Date, default: null },
  maxUses:        { type: Number, default: null, min: [1, 'Max uses must be at least 1'] },
  usedCount:      { type: Number, default: 0, min: 0 },
  minAmount:      { type: Number, default: 0, min: [0, 'Minimum booking amount cannot be negative'] },
  maxUsesPerUser: { type: Number, default: null, min: [1, 'Uses per customer must be at least 1'] },
}, { timestamps: true });

module.exports = mongoose.model('DiscountCode', discountCodeSchema);
