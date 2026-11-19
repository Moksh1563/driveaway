const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  name:             { type: String, required: true },
  company:          { type: String, required: true },
  type:             { type: String, enum: ['Sedan', 'SUV', 'Hatchback', 'Luxury', 'Sports', 'Electric', 'Hypercar', 'Supercar'], required: true },
  yearModel:        {
    type: Number,
    min: [1900, 'Model year must be 1900 or later'],
    validate: { validator: (v) => v == null || v <= new Date().getFullYear() + 2, message: 'Model year is too far in the future' },
  },
  dailyRate:        { type: Number, required: [true, 'Daily rate is required'], min: [1, 'Daily rate must be at least ₹1'] },
  // Set by the admin: 'Available' or 'Maintenance'. 'Rented' is only kept for older data and is
  // treated as 'Available'; whether a car is out right now is worked out from its bookings.
  status:           { type: String, enum: ['Available', 'Rented', 'Maintenance'], default: 'Available' },
  fuelType:         { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'], default: 'Petrol' },
  transmission:     { type: String, enum: ['Manual', 'Automatic'], default: 'Manual' },
  seats:            { type: Number, default: 5, min: [1, 'Seats must be at least 1'] },
  luggage:          { type: String, enum: ['Small', 'Medium', 'Large'], default: 'Medium' },
  mileage:          { type: String, default: '' },
  kilometersDriven: { type: Number, default: 0, min: [0, 'Kilometres driven cannot be negative'] },
  description:      { type: String, default: '' },
  images: {
    main: { type: String, default: '' },
    img1: { type: String, default: '' },
    img2: { type: String, default: '' },
    img3: { type: String, default: '' },
    img4: { type: String, default: '' },
  },
  // Photo credits (author + licence) for images from Wikimedia Commons, shown on the car page
  imageCredits: [{
    _id: false,
    url:     { type: String },
    author:  { type: String },
    license: { type: String },
    source:  { type: String },
  }],
  averageRating:  { type: Number, default: 0 },
  totalReviews:   { type: Number, default: 0 },
  // Short-lived lock taken while a booking is checked and saved, so two people cannot
  // book the same dates at once (works without replica-set transactions). Never sent to clients.
  bookingLockUntil: { type: Date, select: false },
  bookingLockToken: { type: String, select: false },
}, { timestamps: true });

// Indexes for the fleet filters and sorts used by GET /api/cars
carSchema.index({ status: 1, createdAt: -1 });
carSchema.index({ type: 1, dailyRate: 1 });
carSchema.index({ dailyRate: 1 });
carSchema.index({ averageRating: -1 });

module.exports = mongoose.model('Car', carSchema);
