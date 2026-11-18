const handleError = require('../utils/handleError');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const User = require('../models/User');
const { escapeRegex } = require('../middleware/securityMiddleware');

// @desc   Get admin dashboard stats
// @route  GET /api/admin/dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    // Only fetch the fields the dashboard needs (lean = plain objects, much faster)
    const [allBookings, cars, totalUsers] = await Promise.all([
      Booking.find()
        .select('invoiceNumber customerName totalAmount paymentCompleted status createdAt car user pickupDate returnDate')
        .populate('user', 'name')
        .populate('car', 'name company')
        .lean(),
      Car.find().select('name company type dailyRate status images averageRating totalReviews').lean(),
      User.countDocuments({ role: 'user' }),
    ]);

    const totalRevenue = allBookings
      .filter(b => b.paymentCompleted && b.status !== 'Cancelled')
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // Monthly revenue (last 6 months)
    const months = [...Array(6)].map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return {
        m: d.getMonth(),
        y: d.getFullYear(),
        name: d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear(),
      };
    });

    const monthlyRevenue = months.map(m => {
      const rev = allBookings
        .filter(b => {
          const d = new Date(b.createdAt);
          return b.paymentCompleted && b.status !== 'Cancelled' && d.getMonth() === m.m && d.getFullYear() === m.y;
        })
        .reduce((s, b) => s + (b.totalAmount || 0), 0);
      return { month: m.name, revenue: rev };
    });

    // Top 5 cars by booking count
    const carBookingCount = {};
    allBookings.forEach(b => {
      if (b.car && b.car._id) {
        const id = b.car._id.toString();
        carBookingCount[id] = (carBookingCount[id] || 0) + 1;
      }
    });
    const topCars = cars
      .map(c => ({ ...c, bookingCount: carBookingCount[c._id.toString()] || 0 }))
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 5);

    const recentBookings = [...allBookings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    res.json({
      totalRevenue: Math.round(totalRevenue),
      totalBookings: allBookings.length,
      activeRentals: allBookings.filter(b => b.status === 'Confirmed').length,
      pendingBookings: allBookings.filter(b => b.status === 'Pending').length,
      completedBookings: allBookings.filter(b => b.status === 'Completed').length,
      cancelledBookings: allBookings.filter(b => b.status === 'Cancelled').length,
      totalCars: cars.length,
      availableCars: cars.filter(c => c.status === 'Available').length,
      rentedCars: cars.filter(c => c.status === 'Rented').length,
      maintenanceCars: cars.filter(c => c.status === 'Maintenance').length,
      totalUsers,
      monthlyRevenue,
      recentBookings,
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

// @desc   Delete user (Admin)
// @route  DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot delete an admin account' });
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    handleError(res, error);
  }
};
