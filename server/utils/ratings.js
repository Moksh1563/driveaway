const mongoose = require('mongoose');
const Review = require('../models/Review');
const Car = require('../models/Car');

/** Recalculate a car's average rating and review count in the database (no need to load every review). */
const recomputeCarRating = async (carId) => {
  const id = new mongoose.Types.ObjectId(String(carId));
  const [stats] = await Review.aggregate([
    { $match: { car: id } },
    { $group: { _id: '$car', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Car.updateOne({ _id: id }, {
    averageRating: stats ? Math.round(stats.avg * 10) / 10 : 0,
    totalReviews: stats ? stats.count : 0,
  });
};

module.exports = { recomputeCarRating };
