const handleError = require('../utils/handleError');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Car = require('../models/Car');

// @desc   Create review
// @route  POST /api/reviews
exports.createReview = async (req, res) => {
  try {
    const { bookingId, rating, reviewText } = req.body;
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5' });
    }
    if (reviewText !== undefined && (typeof reviewText !== 'string' || reviewText.length > 1000)) {
      return res.status(400).json({ message: 'Review text must be under 1000 characters' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (booking.status !== 'Completed') return res.status(400).json({ message: 'You can only review completed bookings' });

    const existingReview = await Review.findOne({ booking: bookingId });
    if (existingReview) return res.status(400).json({ message: 'You have already reviewed this booking' });

    const review = await Review.create({
      user: req.user.id,
      car: booking.car,
      booking: bookingId,
      rating: numRating,
      reviewText: (reviewText || '').trim(),
    });

    // Recalculate average rating in the database (no need to load every review)
    const [stats] = await Review.aggregate([
      { $match: { car: booking.car } },
      { $group: { _id: '$car', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await Car.findByIdAndUpdate(booking.car, {
      averageRating: stats ? Math.round(stats.avg * 10) / 10 : 0,
      totalReviews: stats ? stats.count : 0,
    });

    const populated = await Review.findById(review._id).populate('user', 'name username');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'You have already reviewed this booking' });
    handleError(res, error);
  }
};

// @desc   Get reviews for a car
// @route  GET /api/reviews/car/:carId
exports.getCarReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ car: req.params.carId })
      .populate('user', 'name username')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(reviews);
  } catch (error) {
    handleError(res, error);
  }
};
