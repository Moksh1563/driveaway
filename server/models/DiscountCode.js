const mongoose = require('mongoose');

const discountCodeSchema = new mongoose.Schema({
  code:          { type: String, unique: true, required: true, uppercase: true },
  percentageOff: { type: Number, required: true },
  maxDiscount:   { type: Number },
  isActive:      { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('DiscountCode', discountCodeSchema);
