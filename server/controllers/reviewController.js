const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Car = require('../models/Car');

// @desc   Create review
// @route  POST /api/reviews
exports.createReview = async (req, res) => {
  try {
    const { bookingId, rating, reviewText } = req.body;

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
      rating: Number(rating),
      reviewText,
    });

    // Recalculate average rating
    const reviews = await Review.find({ car: booking.car });
    const avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
    await Car.findByIdAndUpdate(booking.car, {
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length,
    });

    const populated = await Review.findById(review._id).populate('user', 'name username');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'You have already reviewed this booking' });
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get reviews for a car
// @route  GET /api/reviews/car/:carId
exports.getCarReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ car: req.params.carId })
      .populate('user', 'name username')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
