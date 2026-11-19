const handleError = require('../utils/handleError');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const User = require('../models/User');
const Review = require('../models/Review');
const CarAlert = require('../models/CarAlert');
const DiscountSubscriber = require('../models/DiscountSubscriber');
const { escapeRegex } = require('../middleware/securityMiddleware');
const { ACTIVE_BOOKING_STATUSES, busyNowMap, decorateCar, lockUser } = require('../utils/carAvailability');
const { bookingView, cancelBooking } = require('../utils/bookingLifecycle');
const { recomputeCarRating } = require('../utils/ratings');
const { TIME_ZONE, todayIST, todayStart } = require('../utils/dates');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MS = 330 * 60 * 1000; // India has no daylight saving

/** The last six months in India time, oldest first: [{ key: '2026-06', name: 'Jun 2026' }, ...] plus the first instant. */
const lastSixMonths = () => {
  const [y, m] = todayIST().split('-').map(Number);
  const months = [...Array(6)].map((_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    return { key: `${year}-${String(month + 1).padStart(2, '0')}`, name: `${MONTH_NAMES[month]} ${year}`, year, month };
  });
  const first = months[0];
  const since = new Date(Date.UTC(first.year, first.month, 1) - IST_OFFSET_MS);
  return { months, since };
};

// @desc   Get admin dashboard stats
// @route  GET /api/admin/dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const today = todayStart();
    const { months, since } = lastSixMonths();
    // Revenue: paid, not cancelled; the amount recorded as paid (older bookings: the total)
    const paid = { paymentCompleted: true, status: { $ne: 'Cancelled' } };
    const amount = { $ifNull: ['$paidAmount', '$totalAmount'] };

    const [[stats], recentBookings, totalCars, maintenanceCars, busy, totalUsers] = await Promise.all([
      Booking.aggregate([{
        $facet: {
          byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
          revenue: [{ $match: paid }, { $group: { _id: null, total: { $sum: amount } } }],
          monthly: [
            { $match: paid },
            { $project: { amount, paidAt: { $ifNull: ['$paymentCompletedAt', '$createdAt'] } } },
            { $match: { paidAt: { $gte: since } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: TIME_ZONE } }, revenue: { $sum: '$amount' } } },
          ],
          topCars: [
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: '$car', bookingCount: { $sum: 1 } } },
            { $sort: { bookingCount: -1, _id: 1 } },
            { $limit: 5 },
          ],
          // On the road today, not every confirmed booking
          activeNow: [
            { $match: { status: 'Confirmed', pickupDate: { $lte: today }, returnDate: { $gt: today } } },
            { $count: 'n' },
          ],
        },
      }]),
      Booking.find()
        .select('invoiceNumber customerName totalAmount paidAmount paymentCompleted status createdAt car user pickupDate returnDate')
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'name')
        .populate('car', 'name company')
        .lean(),
      Car.countDocuments(),
      Car.countDocuments({ status: 'Maintenance' }),
      busyNowMap(),
      User.countDocuments({ role: 'user' }),
    ]);

    const byStatus = Object.fromEntries(stats.byStatus.map((s) => [s._id, s.n]));
    const monthlyByKey = Object.fromEntries(stats.monthly.map((m) => [m._id, m.revenue]));

    // Cars by effective status: maintenance, out on a booking today, or free
    const rentedCars = busy.size
      ? await Car.countDocuments({ _id: { $in: [...busy.keys()] }, status: { $ne: 'Maintenance' } })
      : 0;

    // Top 5 cars by bookings (cancelled ones not counted); topped up with other cars if fewer have bookings.
    // Each carries the same effective status as GET /api/cars (status, adminStatus, bookedNow, nextFreeDate).
    const topIds = stats.topCars.map((t) => t._id);
    const carFields = 'name company type dailyRate status images averageRating totalReviews';
    const topDocs = await Car.find({ _id: { $in: topIds } }).select(carFields).lean();
    const countById = Object.fromEntries(stats.topCars.map((t) => [String(t._id), t.bookingCount]));
    let topCars = topDocs
      .map((c) => ({ ...decorateCar(c, busy), bookingCount: countById[c._id.toString()] || 0 }))
      .sort((a, b) => b.bookingCount - a.bookingCount);
    if (topCars.length < 5) {
      const extra = await Car.find({ _id: { $nin: topIds } }).select(carFields).sort({ createdAt: -1 }).limit(5 - topCars.length).lean();
      topCars = topCars.concat(extra.map((c) => ({ ...decorateCar(c, busy), bookingCount: 0 })));
    }

    res.json({
      totalRevenue: Math.round(stats.revenue[0]?.total || 0),
      totalBookings: Object.values(byStatus).reduce((s, n) => s + n, 0),
      activeRentals: stats.activeNow[0]?.n || 0,
      confirmedBookings: byStatus.Confirmed || 0,
      pendingBookings: byStatus.Pending || 0,
      completedBookings: byStatus.Completed || 0,
      cancelledBookings: byStatus.Cancelled || 0,
      totalCars,
      availableCars: Math.max(0, totalCars - maintenanceCars - rentedCars),
      rentedCars,
      maintenanceCars,
      totalUsers,
      monthlyRevenue: months.map((m) => ({ month: m.name, revenue: Math.round(monthlyByKey[m.key] || 0) })),
      recentBookings: recentBookings.map((b) => bookingView(b, today)),
      topCars,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Get all users (Admin)
// @route  GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { role: 'user' };
    if (search) {
      const rx = escapeRegex(search);
      query.$or = [
        { name: { $regex: rx, $options: 'i' } },
        { email: { $regex: rx, $options: 'i' } },
        { username: { $regex: rx, $options: 'i' } },
      ];
    }
    const users = await User.find(query).select('-password').sort({ createdAt: -1 }).limit(500).lean();
    res.json(users);
  } catch (error) {
    handleError(res, error);
  }
};

// Personal details removed from a deleted customer's bookings (the bookings stay for the business records)
const BOOKING_PERSONAL_FIELDS = ['customerEmail', 'customerPhone', 'licenseNumber', 'idProofType', 'idProofNumber',
  'address', 'dateOfBirth', 'emergencyContact', 'emergencyPhone'];

// @desc   Delete user (Admin): removes the account, their reviews, alerts and subscription,
//         and anonymises their past bookings. Refused while they have a trip coming up or under way.
// @route  DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot delete an admin account' });
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account' });

    const activeFilter = () => ({ user: user._id, status: { $in: ACTIVE_BOOKING_STATUSES }, returnDate: { $gt: todayStart() } });

    // Hold the customer's booking lock (createBooking takes the same one) while checking for trips
    // and removing the account, so no booking can be saved in between
    const release = await lockUser(user._id);
    if (!release) {
      return res.status(409).json({ message: 'This customer is saving a booking right now. Please try again in a moment.' });
    }
    try {
      if (await Booking.exists(activeFilter())) {
        return res.status(409).json({ message: 'This customer has an upcoming or ongoing booking. Cancel or complete it before deleting the account.' });
      }
      // The account goes first: from here on the customer's token, and any request still under way, is refused
      await User.deleteOne({ _id: user._id });
    } finally {
      await release();
    }

    // A booking that got in anyway (only possible if the lock had run out) is cancelled,
    // which gives back its loyalty points and discount-code use; it is anonymised below
    const lateBookings = await Booking.find(activeFilter()).select('_id').lean();
    for (const b of lateBookings) {
      await cancelBooking({ _id: b._id }, { reason: 'Customer account deleted', cancelledBy: req.user.name || 'Admin' });
    }

    // Reviews go, and the ratings of the cars they reviewed are recalculated
    const reviewedCars = await Review.distinct('car', { user: user._id });
    const { deletedCount: removedReviews } = await Review.deleteMany({ user: user._id });
    await Promise.all(reviewedCars.map((carId) => recomputeCarRating(carId)));

    await Promise.all([
      CarAlert.deleteMany({ $or: [{ user: user._id }, { email: user.email }] }),
      DiscountSubscriber.deleteMany({ $or: [{ user: user._id }, { email: user.email }] }),
    ]);

    const { modifiedCount: anonymisedBookings } = await Booking.updateMany(
      { user: user._id },
      {
        $set: { customerName: 'Deleted customer' },
        $unset: Object.fromEntries(BOOKING_PERSONAL_FIELDS.map((f) => [f, ''])),
      }
    );

    res.json({ message: 'User deleted successfully', anonymisedBookings, removedReviews });
  } catch (error) {
    handleError(res, error);
  }
};
