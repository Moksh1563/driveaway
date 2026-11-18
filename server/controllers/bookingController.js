const handleError = require('../utils/handleError');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const DiscountCode = require('../models/DiscountCode');
const User = require('../models/User');
const generateInvoiceNumber = require('../utils/generateInvoiceNumber');
const { sendBookingConfirmationEmail, sendBookingStatusUpdateEmail } = require('../utils/emailService');
const { triggerCarAvailabilityAlerts } = require('../utils/carAlertService');
const { escapeRegex } = require('../middleware/securityMiddleware');
const mongoose = require('mongoose');

const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
const PAYMENT_METHODS = Booking.schema.path('paymentMethod').enumValues;
const DAY_MS = 1000 * 60 * 60 * 24;

// @desc   Create booking
// @route  POST /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const {
      car: carId, pickupDate, returnDate, pickupLocation,
      discountCode, useLoyaltyPoints, paymentMethod,
      paymentCompleted, paymentId,
      customerName, customerEmail, customerPhone,
      licenseNumber, dateOfBirth, address, drivingExperience,
      idProofType, idProofNumber, emergencyContact, emergencyPhone,
      specialRequirements, bookingNotes,
    } = req.body;

    if (!mongoose.isValidObjectId(carId)) return res.status(400).json({ message: 'Invalid car selected' });

    // Validate dates: real dates, return after pickup, pickup not in the past, max 90 days
    const pickup = new Date(pickupDate);
    const ret = new Date(returnDate);
    if (isNaN(pickup) || isNaN(ret)) return res.status(400).json({ message: 'Please select valid pickup and return dates' });
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    if (pickup < startOfToday) return res.status(400).json({ message: 'Pickup date cannot be in the past' });
    if (ret <= pickup) return res.status(400).json({ message: 'Return date must be after the pickup date' });
    if ((ret - pickup) / DAY_MS > 90) return res.status(400).json({ message: 'Bookings cannot exceed 90 days' });
    if (paymentMethod !== undefined && !PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }
    if (discountCode !== undefined && discountCode !== null && typeof discountCode !== 'string') {
      return res.status(400).json({ message: 'Invalid discount code' });
    }

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    if (car.status !== 'Available') return res.status(400).json({ message: 'This car is not available for booking' });

    // Check date overlap
    const existingBooking = await Booking.findOne({
      car: carId,
      status: { $in: ['Pending', 'Confirmed'] },
      $or: [
        { pickupDate: { $lte: ret }, returnDate: { $gte: pickup } },
      ],
    });
    if (existingBooking) return res.status(400).json({ message: 'This car is already booked for the selected dates' });

    // Calculate cost (always server-side — never trust a client-sent price)
    const totalDays = Math.max(1, Math.ceil((ret - pickup) / DAY_MS));
    let totalAmount = totalDays * car.dailyRate;
    let discountAmount = 0;
    let appliedDiscountCode = '';

    // Apply discount code
    if (discountCode) {
      const discount = await DiscountCode.findOne({ code: discountCode.toUpperCase(), isActive: true });
      if (discount) {
        discountAmount = (totalAmount * discount.percentageOff) / 100;
        if (discount.maxDiscount && discountAmount > discount.maxDiscount) discountAmount = discount.maxDiscount;
        totalAmount -= discountAmount;
        appliedDiscountCode = discountCode.toUpperCase();
      }
    }

    // Apply loyalty points (10 pts = ₹1, max 50% off)
    let loyaltyPointsUsed = 0;
    const user = await User.findById(req.user.id);
    if (useLoyaltyPoints && user.loyaltyPoints > 0) {
      const pointsValueInRupees = user.loyaltyPoints / 10;
      const maxFromPoints = totalAmount * 0.5;
      const rupeeDiscount = Math.min(pointsValueInRupees, maxFromPoints);
      loyaltyPointsUsed = Math.ceil(rupeeDiscount * 10);
      totalAmount -= rupeeDiscount;
      user.loyaltyPoints -= loyaltyPointsUsed;
    }

    totalAmount = Math.max(0, Math.round(totalAmount));
    const invoiceNumber = await generateInvoiceNumber();
    const isPaid = paymentCompleted !== undefined ? paymentCompleted === true : paymentMethod !== 'Cash';
    const str = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max) : undefined);

    const booking = await Booking.create({
      invoiceNumber,
      user: req.user.id,
      car: carId,
      customerName: str(customerName, 80) || user.name,
      customerEmail: str(customerEmail, 254) || user.email,
      customerPhone: str(customerPhone, 20) || user.phone,
      pickupDate: pickup,
      returnDate: ret,
      pickupLocation: str(pickupLocation, 120),
      dailyRateSnapshot: car.dailyRate,
      totalDays,
      totalAmount,
      discountAmount,
      discountCode: appliedDiscountCode,
      loyaltyPointsUsed,
      paymentMethod: paymentMethod || 'Razorpay',
      paymentCompleted: isPaid,
      paymentCompletedAt: isPaid ? new Date() : undefined,
      paymentId: isPaid ? (str(paymentId, 64) || `pay_RZP_${Date.now()}`) : undefined,
      status: isPaid ? 'Confirmed' : 'Pending',
      licenseNumber: str(licenseNumber, 40),
      dateOfBirth: dateOfBirth && !isNaN(new Date(dateOfBirth)) ? dateOfBirth : undefined,
      address: str(address),
      drivingExperience: Number.isFinite(Number(drivingExperience)) ? Number(drivingExperience) : undefined,
      idProofType: str(idProofType, 40),
      idProofNumber: str(idProofNumber, 40),
      emergencyContact: str(emergencyContact, 80),
      emergencyPhone: str(emergencyPhone, 20),
      specialRequirements: str(specialRequirements, 1000),
      bookingNotes: str(bookingNotes, 1000),
    });

    // Update car status
    await Car.findByIdAndUpdate(carId, { status: 'Rented' });

    // Award loyalty points (1 pt per ₹100)
    const pointsEarned = Math.floor(totalAmount / 100);
    user.loyaltyPoints += pointsEarned;
    await user.save();

    const populatedBooking = await Booking.findById(booking._id).populate('car', 'name company type images.main dailyRate');

    // Send confirmation email asynchronously (does not block response)
    sendBookingConfirmationEmail({
      booking: populatedBooking,
      car: populatedBooking.car,
      user,
    }).catch(err => console.error('Email send error:', err));

    res.status(201).json(populatedBooking);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Get my bookings
// @route  GET /api/bookings/my
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('car', 'name company images type')
      .sort({ createdAt: -1 })
      .lean();
    res.json(bookings);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Get booking by ID
// @route  GET /api/bookings/:id
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('car')
      .populate('user', 'name email phone');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user?._id?.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this booking' });
    }
    res.json(booking);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Cancel booking
// @route  PATCH /api/bookings/:id/cancel
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (['Completed', 'Cancelled'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking cannot be cancelled' });
    }

    booking.status = 'Cancelled';
    booking.cancellationReason = req.body.reason || 'Cancelled by user';
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user.name || req.user.id;
    await booking.save();

    await Car.findByIdAndUpdate(booking.car, { status: 'Available' });
    triggerCarAvailabilityAlerts(booking.car).catch(err => console.error(err));
    
    // Notify customer about cancellation
    const populated = await Booking.findById(booking._id).populate('car', 'name company type');
    sendBookingStatusUpdateEmail({ booking: populated || booking, newStatus: 'Cancelled' }).catch(err => console.error(err));

    res.json(booking);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Mark payment complete
// @route  PATCH /api/bookings/:id/payment
exports.markPaymentComplete = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    // Only the booking owner (or an admin) may mark it paid
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (booking.status === 'Cancelled') return res.status(400).json({ message: 'Cannot pay for a cancelled booking' });
    if (req.body.paymentMethod !== undefined && !PAYMENT_METHODS.includes(req.body.paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }
    booking.paymentCompleted = true;
    booking.paymentCompletedAt = new Date();
    if (typeof req.body.paymentId === 'string') booking.paymentId = req.body.paymentId.slice(0, 64);
    if (req.body.paymentMethod) booking.paymentMethod = req.body.paymentMethod;
    if (booking.status === 'Pending') booking.status = 'Confirmed';
    await booking.save();
    res.json(booking);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Get all bookings (Admin)
// @route  GET /api/bookings
exports.getAllBookings = async (req, res) => {
  try {
    const { status, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    let query = {};
    if (status && BOOKING_STATUSES.includes(status)) query.status = status;
    if (search) {
      const rx = escapeRegex(search);
      query.$or = [
        { invoiceNumber: { $regex: rx, $options: 'i' } },
        { customerName: { $regex: rx, $options: 'i' } },
        { customerEmail: { $regex: rx, $options: 'i' } },
      ];
    }
    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('car', 'name company type')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(query),
    ]);
    res.json({ bookings, totalPages: Math.ceil(total / limit), currentPage: page, total });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Update booking status (Admin)
// @route  PATCH /api/bookings/:id/status
exports.updateBookingStatus = async (req, res) => {
  try {
    if (!BOOKING_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `Status must be one of: ${BOOKING_STATUSES.join(', ')}` });
    }
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    ).populate('car', 'name company type');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (['Completed', 'Cancelled'].includes(req.body.status) && booking.car) {
      await Car.findByIdAndUpdate(booking.car._id, { status: 'Available' });
      triggerCarAvailabilityAlerts(booking.car._id).catch(err => console.error(err));
    }

    // Send email notification about status change
    sendBookingStatusUpdateEmail({ booking, newStatus: req.body.status }).catch(err => console.error(err));

    res.json(booking);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Delete booking (Admin)
// @route  DELETE /api/bookings/:id
exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Get WhatsApp invoice text and direct link
// @route  GET /api/bookings/:id/whatsapp
exports.getWhatsAppInvoice = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('car').populate('user', 'name phone email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.user?._id?.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { generateWhatsAppInvoiceText, getWhatsAppUrl, sendWhatsAppMessageViaTwilio } = require('../utils/whatsappService');
    const text = generateWhatsAppInvoiceText(booking, booking.car);
    const isAdmin = req.user.role === 'admin';
    // Only admins may send to an arbitrary number or trigger a server-side send
    const targetPhone = (isAdmin && req.query.phone) || booking.customerPhone || booking.user?.phone;
    const url = getWhatsAppUrl(targetPhone, text);

    let apiSendResult = null;
    if (req.query.send === 'true' && isAdmin) {
      apiSendResult = await sendWhatsAppMessageViaTwilio({ to: targetPhone, text });
    }

    res.json({
      success: true,
      phone: targetPhone,
      message: text,
      url,
      apiSendResult,
    });
  } catch (error) {
    handleError(res, error);
  }
};
