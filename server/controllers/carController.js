const Car = require('../models/Car');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const CarAlert = require('../models/CarAlert');
const { triggerCarAvailabilityAlerts } = require('../utils/carAlertService');

// @desc   Get all cars with filters/pagination
// @route  GET /api/cars
exports.getCars = async (req, res) => {
  try {
    const { type, fuelType, transmission, minPrice, maxPrice, status, search, sort, page = 1, limit = 12 } = req.query;
    let query = {};

    if (type) query.type = type;
    if (fuelType) query.fuelType = fuelType;
    if (transmission) query.transmission = transmission;
    if (status) query.status = status;
    if (minPrice || maxPrice) {
      query.dailyRate = {};
      if (minPrice) query.dailyRate.$gte = Number(minPrice);
      if (maxPrice) query.dailyRate.$lte = Number(maxPrice);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { dailyRate: 1 };
    else if (sort === 'price_desc') sortObj = { dailyRate: -1 };
    else if (sort === 'newest') sortObj = { createdAt: -1 };
    else if (sort === 'rating') sortObj = { averageRating: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const cars = await Car.find(query).sort(sortObj).skip(skip).limit(Number(limit));
    const totalCars = await Car.countDocuments(query);

    res.json({
      cars,
      totalPages: Math.ceil(totalCars / Number(limit)),
      currentPage: Number(page),
      totalCars,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get single car with reviews
// @route  GET /api/cars/:id
exports.getCarById = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    const reviews = await Review.find({ car: req.params.id })
      .populate('user', 'name username')
      .sort({ createdAt: -1 });
    res.json({ car, reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Create car (Admin)
// @route  POST /api/cars
exports.createCar = async (req, res) => {
  try {
    const car = await Car.create(req.body);
    res.status(201).json(car);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Update car (Admin)
// @route  PUT /api/cars/:id
exports.updateCar = async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!car) return res.status(404).json({ message: 'Car not found' });

    // If car was set to Available, trigger availability alerts
    if (req.body.status === 'Available') {
      triggerCarAvailabilityAlerts(car._id).catch(err => console.error(err));
    }

    res.json(car);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    await Car.findByIdAndDelete(req.params.id);
    res.json({ message: 'Car removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Change car status (Admin)
// @route  PATCH /api/cars/:id/status
exports.changeCarStatus = async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
};

// @desc   Subscribe for car availability alert
// @route  POST /api/cars/:id/notify
exports.subscribeCarAlert = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
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
      alert,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

