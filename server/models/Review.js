const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  car:        { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  booking:    { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  rating:     { type: Number, required: true, min: 1, max: 5 },
  reviewText: { type: String, default: '' },
}, { timestamps: true });

reviewSchema.index({ user: 1, booking: 1 }, { unique: true });
reviewSchema.index({ car: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
