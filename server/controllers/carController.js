const handleError = require('../utils/handleError');
const Car = require('../models/Car');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const CarAlert = require('../models/CarAlert');
const Upload = require('../models/Upload');
const { triggerCarAvailabilityAlerts } = require('../utils/carAlertService');
const { escapeRegex, isValidEmail } = require('../middleware/securityMiddleware');
const {
  ACTIVE_BOOKING_STATUSES, busyNowMap, withAvailability, bookedRangesFor, decorateCar,
} = require('../utils/carAvailability');

// Fields an admin may set on a car (prevents overwriting ratings/review counts via the API)
const CAR_FIELDS = ['name', 'company', 'type', 'yearModel', 'dailyRate', 'status', 'fuelType', 'transmission',
  'seats', 'luggage', 'mileage', 'kilometersDriven', 'description', 'images', 'imageCredits'];
const pickCarFields = (body) => CAR_FIELDS.reduce((acc, k) => {
  if (body[k] !== undefined) acc[k] = body[k];
  return acc;
}, {});
// What an admin can set. Whether a car is out on a trip comes from its bookings.
const CAR_STATUSES = ['Available', 'Maintenance'];
const EFFECTIVE_STATUSES = ['Available', 'Rented', 'Maintenance'];

// Photo and credit links must be web addresses or site paths (/uploads/..., /api/uploads/...),
// never javascript:, data: or other schemes that would run when rendered as a link or image
const isSafeLink = (v) => v === undefined || v === null || v === '' ||
  (typeof v === 'string' && (/^https?:\/\//i.test(v.trim()) || /^\/(?!\/)/.test(v.trim())));

const linkInputError = (fields) => {
  if (fields.images !== undefined) {
    if (!fields.images || typeof fields.images !== 'object' || Array.isArray(fields.images)) return 'Images must be an object of photo links';
    if (!Object.values(fields.images).every(isSafeLink)) return 'Photo links must start with https:// (or be an uploaded photo)';
  }
  if (fields.imageCredits !== undefined) {
    if (!Array.isArray(fields.imageCredits)) return 'Photo credits must be a list';
    const bad = fields.imageCredits.some((c) => !c || typeof c !== 'object' || !isSafeLink(c.url) || !isSafeLink(c.source));
    if (bad) return 'Photo credit links must start with https://';
  }
  return null;
};

/** Check admin input before it reaches the database. Returns an error message or null. */
const carInputError = (fields, { creating }) => {
  const linkError = linkInputError(fields);
  if (linkError) return linkError;
  if (creating || 'dailyRate' in fields) {
    const rate = Number(fields.dailyRate);
    if (fields.dailyRate === null || fields.dailyRate === '' || !Number.isFinite(rate) || rate < 1) {
      return 'Daily rate must be a number of at least ₹1';
    }
  }
  if ('status' in fields && !CAR_STATUSES.includes(fields.status)) {
    return fields.status === 'Rented'
      ? 'Rented is worked out from bookings. Set the car to Available or Maintenance.'
      : `Status must be one of: ${CAR_STATUSES.join(', ')}`;
  }
  return null;
};

// Photos uploaded to this API are stored in MongoDB and linked as .../api/uploads/<id>
const IMAGE_KEYS = ['main', 'img1', 'img2', 'img3', 'img4'];
const UPLOAD_ID_RE = /\/api\/uploads\/([a-f0-9]{24})$/i;
const uploadIdsIn = (images) => Object.values(images || {})
  .map((url) => (typeof url === 'string' ? UPLOAD_ID_RE.exec(url.trim()) : null))
  .filter(Boolean)
  .map((m) => m[1].toLowerCase());

/** Delete uploaded photos that no car shows any more, so they don't fill the free 512 MB database. */
const removeUnusedUploads = async (ids) => {
  for (const id of new Set(ids)) {
    const link = new RegExp(`/api/uploads/${id}$`, 'i');
    const inUse = await Car.exists({ $or: IMAGE_KEYS.map((k) => ({ [`images.${k}`]: link })) });
    if (!inUse) await Upload.deleteOne({ _id: id });
  }
};

// Car data changes when admins edit it and when customers book, so browsers must check back each time
// (the ETag makes that a cheap 304 when nothing changed)
const revalidate = (res) => {
  res.set('Cache-Control', 'no-cache');
  res.vary('Authorization');
};

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
    // status filters on the effective status (Maintenance / out on a booking today / Available)
    if (status && EFFECTIVE_STATUSES.includes(status)) {
      if (status === 'Maintenance') {
        query.status = 'Maintenance';
      } else {
        const busyIds = [...(await busyNowMap()).keys()];
        query.status = { $ne: 'Maintenance' };
        query._id = status === 'Rented' ? { $in: busyIds } : { $nin: busyIds };
      }
    }
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

    revalidate(res);
    res.json({
      cars: await withAvailability(cars),
      totalPages: Math.ceil(totalCars / limit),
      currentPage: page,
      totalCars,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Get single car with reviews and the dates it is already booked
// @route  GET /api/cars/:id
exports.getCarById = async (req, res) => {
  try {
    const [car, reviews] = await Promise.all([
      Car.findById(req.params.id).lean(),
      Review.find({ car: req.params.id }).populate('user', 'name').sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    const [busy, bookedRanges] = await Promise.all([busyNowMap([car._id]), bookedRangesFor(car._id)]);
    revalidate(res);
    res.json({ car: { ...decorateCar(car, busy), bookedRanges }, reviews });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Create car (Admin)
// @route  POST /api/cars
exports.createCar = async (req, res) => {
  try {
    const fields = pickCarFields(req.body);
    const invalid = carInputError(fields, { creating: true });
    if (invalid) return res.status(400).json({ message: invalid });
    const car = await Car.create(fields);
    const [decorated] = await withAvailability([car.toObject()]);
    res.status(201).json(decorated);
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * After an admin change: tell waiting customers if the car just came out of maintenance
 * (or an older stored 'Rented' was cleared). The alert service sends only if no booking covers today.
 */
const alertIfReleased = (before, after) => {
  if (before && before.status !== 'Available' && after.status === 'Available') {
    triggerCarAvailabilityAlerts(after._id).catch(err => console.error(err));
  }
};

// @desc   Update car (Admin)
// @route  PUT /api/cars/:id
exports.updateCar = async (req, res) => {
  try {
    const fields = pickCarFields(req.body);
    const invalid = carInputError(fields, { creating: false });
    if (invalid) return res.status(400).json({ message: invalid });
    const before = await Car.findById(req.params.id).select('status images').lean();
    if (!before) return res.status(404).json({ message: 'Car not found' });
    const car = await Car.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true }).lean();
    if (!car) return res.status(404).json({ message: 'Car not found' });

    alertIfReleased(before, car);
    if (fields.images !== undefined) {
      const kept = new Set(uploadIdsIn(car.images));
      removeUnusedUploads(uploadIdsIn(before.images).filter((id) => !kept.has(id)))
        .catch((err) => console.error('Could not remove replaced photos:', err.message));
    }

    const [decorated] = await withAvailability([car]);
    res.json(decorated);
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
      status: { $in: ACTIVE_BOOKING_STATUSES },
    });
    if (activeBookings) return res.status(400).json({ message: 'Cannot delete car with active bookings' });
    const deleted = await Car.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Car not found' });
    await CarAlert.deleteMany({ car: deleted._id });
    removeUnusedUploads(uploadIdsIn(deleted.images)).catch((err) => console.error('Could not remove the deleted car photos:', err.message));
    res.json({ message: 'Car removed successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Change car status (Admin): Available or Maintenance
// @route  PATCH /api/cars/:id/status
exports.changeCarStatus = async (req, res) => {
  try {
    const invalid = carInputError({ status: req.body.status }, { creating: false });
    if (invalid) return res.status(400).json({ message: invalid });
    const before = await Car.findById(req.params.id).select('status').lean();
    if (!before) return res.status(404).json({ message: 'Car not found' });
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    ).lean();
    if (!car) return res.status(404).json({ message: 'Car not found' });

    // If the car came out of maintenance, notify subscribed users
    alertIfReleased(before, car);

    const [decorated] = await withAvailability([car]);
    res.json(decorated);
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

    const found = await Car.findById(req.params.id).lean();
    if (!found) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Offered only while the car is in maintenance or out on a booking today
    const [car] = await withAvailability([found]);
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
