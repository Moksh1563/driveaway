const Booking = require('../models/Booking');
const Car = require('../models/Car');
const DiscountCode = require('../models/DiscountCode');
const User = require('../models/User');
const generateInvoiceNumber = require('../utils/generateInvoiceNumber');
const { sendBookingConfirmationEmail, sendBookingStatusUpdateEmail } = require('../utils/emailService');
const { triggerCarAvailabilityAlerts } = require('../utils/carAlertService');

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

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    if (car.status !== 'Available') return res.status(400).json({ message: 'This car is not available for booking' });

    // Check date overlap
    const existingBooking = await Booking.findOne({
      car: carId,
      status: { $in: ['Pending', 'Confirmed'] },
      $or: [
        { pickupDate: { $lte: new Date(returnDate) }, returnDate: { $gte: new Date(pickupDate) } },
      ],
    });
    if (existingBooking) return res.status(400).json({ message: 'This car is already booked for the selected dates' });

    // Calculate cost
    const pickup = new Date(pickupDate);
    const ret = new Date(returnDate);
    const totalDays = Math.max(1, Math.ceil((ret - pickup) / (1000 * 60 * 60 * 24)));
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

    const booking = await Booking.create({
      invoiceNumber,
      user: req.user.id,
      car: carId,
      customerName: customerName || user.name,
      customerEmail: customerEmail || user.email,
      customerPhone: customerPhone || user.phone,
      pickupDate,
      returnDate,
      pickupLocation,
      dailyRateSnapshot: car.dailyRate,
      totalDays,
      totalAmount,
      discountAmount,
      discountCode: appliedDiscountCode,
      loyaltyPointsUsed,
      paymentMethod: paymentMethod || 'Razorpay',
      paymentCompleted: paymentCompleted !== undefined ? paymentCompleted : (paymentMethod !== 'Cash'),
      paymentCompletedAt: (paymentCompleted || paymentMethod !== 'Cash') ? new Date() : undefined,
      paymentId: paymentId || (paymentMethod !== 'Cash' ? `pay_RZP_${Date.now()}` : undefined),
      status: (paymentCompleted || paymentMethod !== 'Cash') ? 'Confirmed' : 'Pending',
      licenseNumber,
      dateOfBirth,
      address,
      drivingExperience,
      idProofType,
      idProofNumber,
      emergencyContact,
      emergencyPhone,
      specialRequirements,
      bookingNotes,
    });

    // Update car status
    await Car.findByIdAndUpdate(carId, { status: 'Rented' });

    // Award loyalty points (1 pt per ₹100)
    const pointsEarned = Math.floor(totalAmount / 100);
    user.loyaltyPoints += pointsEarned;
    await user.save();

    const populatedBooking = await Booking.findById(booking._id).populate('car', 'name company images.main dailyRate');

    // Send confirmation email asynchronously (does not block response)
    sendBookingConfirmationEmail({
      booking: populatedBooking,
      car: populatedBooking.car,
      user,
    }).catch(err => console.error('Email send error:', err));

    res.status(201).json(populatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get my bookings
// @route  GET /api/bookings/my
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('car', 'name company images type')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this booking' });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    const populated = await Booking.findById(booking._id).populate('car', 'name company');
    sendBookingStatusUpdateEmail({ booking: populated || booking, newStatus: 'Cancelled' }).catch(err => console.error(err));

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Mark payment complete
// @route  PATCH /api/bookings/:id/payment
exports.markPaymentComplete = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    booking.paymentCompleted = true;
    booking.paymentCompletedAt = new Date();
    if (req.body.paymentId) booking.paymentId = req.body.paymentId;
    if (req.body.paymentMethod) booking.paymentMethod = req.body.paymentMethod;
    if (booking.status === 'Pending') booking.status = 'Confirmed';
    await booking.save();
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get all bookings (Admin)
// @route  GET /api/bookings
exports.getAllBookings = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    let query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const bookings = await Booking.find(query)
      .populate('car', 'name company type')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    const total = await Booking.countDocuments(query);
    res.json({ bookings, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page), total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Update booking status (Admin)
// @route  PATCH /api/bookings/:id/status
exports.updateBookingStatus = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    ).populate('car', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (['Completed', 'Cancelled'].includes(req.body.status)) {
      await Car.findByIdAndUpdate(booking.car._id, { status: 'Available' });
      triggerCarAvailabilityAlerts(booking.car._id).catch(err => console.error(err));
    }

    // Send email notification about status change
    sendBookingStatusUpdateEmail({ booking, newStatus: req.body.status }).catch(err => console.error(err));

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get WhatsApp invoice text and direct link
// @route  GET /api/bookings/:id/whatsapp
exports.getWhatsAppInvoice = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('car').populate('user', 'name phone email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { generateWhatsAppInvoiceText, getWhatsAppUrl, sendWhatsAppMessageViaTwilio } = require('../utils/whatsappService');
    const text = generateWhatsAppInvoiceText(booking, booking.car);
    const targetPhone = req.query.phone || booking.customerPhone || booking.user?.phone;
    const url = getWhatsAppUrl(targetPhone, text);

    let apiSendResult = null;
    if (req.query.send === 'true') {
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
    res.status(500).json({ message: error.message });
  }
};
