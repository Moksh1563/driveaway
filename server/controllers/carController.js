const handleError = require('../utils/handleError');
const Car = require('../models/Car');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const CarAlert = require('../models/CarAlert');
const { triggerCarAvailabilityAlerts } = require('../utils/carAlertService');
const { escapeRegex, isValidEmail } = require('../middleware/securityMiddleware');

// Fields an admin may set on a car (prevents overwriting ratings/review counts via the API)
const CAR_FIELDS = ['name', 'company', 'type', 'yearModel', 'dailyRate', 'status', 'fuelType', 'transmission',
  'seats', 'luggage', 'mileage', 'kilometersDriven', 'description', 'images', 'imageCredits'];
const pickCarFields = (body) => CAR_FIELDS.reduce((acc, k) => {
  if (body[k] !== undefined) acc[k] = body[k];
  return acc;
}, {});
const CAR_STATUSES = ['Available', 'Rented', 'Maintenance'];

// @desc   Get all cars with filters/pagination
// @route  GET /api/cars
exports.getCars = async (req, res) => {
  try {
    const { type, fuelType, transmission, minPrice, maxPrice, status, search, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
    let query = {};

    if (type) query.type = type;
    if (fuelType) query.fuelType = fuelType;
    if (transmission) query.transmission = transmission;
    if (status) query.status = status;
    if (minPrice || maxPrice) {
      query.dailyRate = {};
      if (minPrice && !isNaN(minPrice)) query.dailyRate.$gte = Number(minPrice);
      if (maxPrice && !isNaN(maxPrice)) query.dailyRate.$lte = Number(maxPrice);
      if (!Object.keys(query.dailyRate).length) delete query.dailyRate;
    }
    if (search) {
      const rx = escapeRegex(search);
      query.$or = [
        { name: { $regex: rx, $options: 'i' } },
        { company: { $regex: rx, $options: 'i' } },
        { type: { $regex: rx, $options: 'i' } },
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { dailyRate: 1 };
    else if (sort === 'price_desc') sortObj = { dailyRate: -1 };
    else if (sort === 'newest') sortObj = { createdAt: -1 };
    else if (sort === 'rating') sortObj = { averageRating: -1 };

    const skip = (page - 1) * limit;
    const [cars, totalCars] = await Promise.all([
      Car.find(query).sort({ ...sortObj, _id: 1 }).skip(skip).limit(limit).lean(),
      Car.countDocuments(query),
    ]);

    // Public catalogue — let browsers/CDNs cache briefly
    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      cars,
      totalPages: Math.ceil(totalCars / limit),
      currentPage: page,
      totalCars,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Get single car with reviews
// @route  GET /api/cars/:id
exports.getCarById = async (req, res) => {
  try {
    const [car, reviews] = await Promise.all([
      Car.findById(req.params.id).lean(),
      Review.find({ car: req.params.id }).populate('user', 'name username').sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    res.json({ car, reviews });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Create car (Admin)
// @route  POST /api/cars
exports.createCar = async (req, res) => {
  try {
    const car = await Car.create(pickCarFields(req.body));
    res.status(201).json(car);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Update car (Admin)
// @route  PUT /api/cars/:id
exports.updateCar = async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(req.params.id, pickCarFields(req.body), { new: true, runValidators: true });
    if (!car) return res.status(404).json({ message: 'Car not found' });

    // If car was set to Available, trigger availability alerts
    if (req.body.status === 'Available') {
      triggerCarAvailabilityAlerts(car._id).catch(err => console.error(err));
    }

    res.json(car);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Delete car (Admin)
// @route  DELETE /api/cars/:id
exports.deleteCar = async (req, res) => {
  try {
    const activeBookings = await Booking.findOne({
      car: req.params.id,
      status: { $in: ['Pending', 'Confirmed'] },
    });
    if (activeBookings) return res.status(400).json({ message: 'Cannot delete car with active bookings' });
    const deleted = await Car.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Car not found' });
    res.json({ message: 'Car removed successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Change car status (Admin)
// @route  PATCH /api/cars/:id/status
exports.changeCarStatus = async (req, res) => {
  try {
    if (!CAR_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `Status must be one of: ${CAR_STATUSES.join(', ')}` });
    }
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!car) return res.status(404).json({ message: 'Car not found' });

    // If car changed to Available, notify subscribed users
    if (req.body.status === 'Available') {
      triggerCarAvailabilityAlerts(car._id).catch(err => console.error(err));
    }

    res.json(car);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Subscribe for car availability alert
// @route  POST /api/cars/:id/notify
exports.subscribeCarAlert = async (req, res) => {
  try {
    const { email } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'A valid email address is required' });
    }

    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    if (car.status === 'Available') {
      return res.status(400).json({ message: 'This car is already available for booking!' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already subscribed and pending notification
    const existing = await CarAlert.findOne({
      car: car._id,
      email: normalizedEmail,
      notified: false,
    });

    if (existing) {
      return res.json({ message: `You are already registered to receive an alert at ${normalizedEmail} when this ${car.name} becomes available!` });
    }

    const alert = await CarAlert.create({
      car: car._id,
      email: normalizedEmail,
      user: req.user ? req.user._id : null,
      notified: false,
    });

    res.status(201).json({
      message: `You're all set! We'll email ${normalizedEmail} the moment this ${car.name} is back and ready to book.`,
      alert: { _id: alert._id, car: alert.car, email: alert.email },
    });
  } catch (error) {
    handleError(res, error);
  }
};

