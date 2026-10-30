const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  name:             { type: String, required: true },
  company:          { type: String, required: true },
  type:             { type: String, enum: ['Sedan', 'SUV', 'Hatchback', 'Luxury', 'Sports', 'Electric', 'Hypercar', 'Supercar'], required: true },
  yearModel:        { type: Number },
  dailyRate:        { type: Number, required: true },
  status:           { type: String, enum: ['Available', 'Rented', 'Maintenance'], default: 'Available' },
  fuelType:         { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'], default: 'Petrol' },
  transmission:     { type: String, enum: ['Manual', 'Automatic'], default: 'Manual' },
  seats:            { type: Number, default: 5 },
  luggage:          { type: String, enum: ['Small', 'Medium', 'Large'], default: 'Medium' },
  mileage:          { type: String, default: '' },
  kilometersDriven: { type: Number, default: 0 },
  description:      { type: String, default: '' },
  images: {
    main: { type: String, default: '' },
    img1: { type: String, default: '' },
    img2: { type: String, default: '' },
    img3: { type: String, default: '' },
    img4: { type: String, default: '' },
  },
  averageRating:  { type: Number, default: 0 },
  totalReviews:   { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Car', carSchema);
