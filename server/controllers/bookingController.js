const mongoose = require('mongoose');
const handleError = require('../utils/handleError');
const { paymentReference } = require('../utils/paymentReference');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const User = require('../models/User');
const generateInvoiceNumber = require('../utils/generateInvoiceNumber');
const { sendBookingConfirmationEmail, sendBookingStatusUpdateEmail, sendPaymentReceivedEmail } = require('../utils/emailService');
const { buildInvoicePdf, invoiceFilename } = require('../utils/invoicePdf');
const { escapeRegex, isValidEmail } = require('../middleware/securityMiddleware');
const { parseDay, todayStart, addDays, billingDays, MAX_LEAD_DAYS, MAX_DURATION_DAYS } = require('../utils/dates');
const { evaluateDiscount, claimDiscountUse, releaseDiscountUse } = require('../utils/discounts');
const { ACTIVE_BOOKING_STATUSES, adminStatusOf, findClash, lockCar, lockUser } = require('../utils/carAvailability');
const {
  allowedNextStatuses, bookingView, cancelBooking: cancelWithEffects, confirmBooking, completeBooking,
} = require('../utils/bookingLifecycle');

const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
const MAX_UNPAID_BOOKINGS = 3;
// Methods of the simulated test checkout
const TEST_METHODS = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];
const TEST_METHOD_RE = /^Online test \((UPI|CARD|NETBANKING|WALLET)\)$/i;

const str = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max) : undefined);

/** Payment method chosen at booking time: 'Cash' (pay at pickup) or 'Online test'. Null if invalid. */
const bookingMethod = (value) => {
  if (value === undefined || value === null || value === '') return 'Online test';
  if (value === 'Cash') return 'Cash';
  if (value === 'Online test' || (typeof value === 'string' && TEST_METHOD_RE.test(value))) return 'Online test';
  return null;
};

/**
 * Method for PATCH /:id/payment. Owners may only use the test checkout methods;
 * admins may also record cash collected at the hub.
 * Accepts { method: 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'CASH' } or the older
 * { paymentMethod: 'Online test (UPI)' }. Returns { kind: 'test', method } | { kind: 'cash' } | null.
 */
const paymentChoice = (body, isAdmin) => {
  const { method, paymentMethod } = body || {};
  if (typeof method === 'string' && method.trim()) {
    const m = method.trim().toUpperCase();
    if (TEST_METHODS.includes(m)) return { kind: 'test', method: m };
    if (m === 'CASH' && isAdmin) return { kind: 'cash' };
    return null;
  }
  if (typeof paymentMethod === 'string' && paymentMethod.trim()) {
    const match = TEST_METHOD_RE.exec(paymentMethod.trim());
    if (match) return { kind: 'test', method: match[1].toUpperCase() };
    if (paymentMethod.trim() === 'Cash' && isAdmin) return { kind: 'cash' };
  }
  return null;
};

/** Insert a booking with the next invoice number; on a duplicate number, resync the counter and retry. */
const createWithInvoiceNumber = async (doc) => {
  for (let attempt = 0; ; attempt++) {
    const invoiceNumber = await generateInvoiceNumber();
    try {
      return await Booking.create({ ...doc, invoiceNumber });
    } catch (err) {
      const duplicateInvoice = err && err.code === 11000 && (err.keyPattern?.invoiceNumber || /invoiceNumber/.test(err.message || ''));
      if (!duplicateInvoice || attempt >= 4) throw err;
      await generateInvoiceNumber.syncInvoiceCounter();
    }
  }
};

// Booking emails go to the account's email address (emailService resolves it from booking.user),
// never to the free-text contact field on the form
const sendStatusEmail = async (bookingId, newStatus) => {
  const full = await Booking.findById(bookingId).populate('car', 'name company type').populate('user', 'name email phone');
  if (!full) return;
  await sendBookingStatusUpdateEmail({ booking: full, newStatus, user: full.user });
};

// 409 answers carry a code, so the booking page can tell taken dates from a busy moment
const DATES_TAKEN = { code: 'DATES_TAKEN', message: 'This car is already booked for some of those dates' };

// @desc   Create booking (always unpaid and Pending; the server works out every amount)
// @route  POST /api/bookings
exports.createBooking = async (req, res) => {
  let releaseUser = null;
  try {
    // paymentCompleted / paymentId in the body are ignored: only the server records payments
    const {
      car: carId, pickupDate, returnDate, pickupLocation,
      discountCode, useLoyaltyPoints, paymentMethod,
      customerName, customerEmail, customerPhone,
      licenseNumber, dateOfBirth, address, drivingExperience,
      idProofType, idProofNumber, emergencyContact, emergencyPhone,
      specialRequirements, bookingNotes,
    } = req.body;

    if (!mongoose.isValidObjectId(carId)) return res.status(400).json({ message: 'Invalid car selected' });

    // Dates are India calendar days: not in the past, at most 180 days ahead, at most 90 days long
    const pickup = parseDay(pickupDate);
    const ret = parseDay(returnDate);
    if (!pickup || !ret) return res.status(400).json({ message: 'Please select valid pickup and return dates' });
    const today = todayStart();
    if (pickup < today) return res.status(400).json({ message: 'Pickup date cannot be in the past' });
    if (pickup > addDays(today, MAX_LEAD_DAYS)) {
      return res.status(400).json({ message: `Pickup can be at most ${MAX_LEAD_DAYS} days from today` });
    }
    if (ret <= pickup) return res.status(400).json({ message: 'Return date must be after the pickup date' });
    if (billingDays(pickup, ret) > MAX_DURATION_DAYS) {
      return res.status(400).json({ message: `Bookings cannot exceed ${MAX_DURATION_DAYS} days` });
    }
    const method = bookingMethod(paymentMethod);
    if (!method) return res.status(400).json({ message: 'Invalid payment method' });
    if (discountCode !== undefined && discountCode !== null && typeof discountCode !== 'string') {
      return res.status(400).json({ message: 'Invalid discount code' });
    }
    const code = typeof discountCode === 'string' ? discountCode.trim() : '';
    const contactEmail = typeof customerEmail === 'string' ? customerEmail.trim() : '';
    if (contactEmail && !isValidEmail(contactEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const car = await Car.findById(carId).lean();
    if (!car) return res.status(404).json({ message: 'Car not found' });
    if (adminStatusOf(car) === 'Maintenance') {
      return res.status(400).json({ message: 'This car is in maintenance and cannot be booked right now' });
    }

    // Taken dates get their answer first, before any code is looked at, so a clashing request
    // tells nothing about a discount code (checked again under the car lock below)
    if (await findClash(car._id, pickup, ret)) return res.status(409).json(DATES_TAKEN);

    // One booking at a time per customer: the unpaid-booking cap and the per-customer code limit
    // below then count every booking this customer has, even when two tabs book different cars at once
    releaseUser = await lockUser(req.user.id);
    if (!releaseUser) {
      return res.status(409).json({ code: 'BOOKING_IN_PROGRESS', message: 'Another booking of yours is still being saved. Please try again in a moment.' });
    }

    // Unpaid bookings hold cars for free, so each account may only have a few at once
    const unpaidFilter = { user: req.user.id, status: 'Pending', paymentCompleted: false, returnDate: { $gt: today } };
    if (await Booking.countDocuments(unpaidFilter) >= MAX_UNPAID_BOOKINGS) {
      return res.status(429).json({ message: `You already have ${MAX_UNPAID_BOOKINGS} unpaid bookings. Pay for or cancel one before booking another car.` });
    }

    // Calculate cost (always server-side — never trust a client-sent price)
    const totalDays = billingDays(pickup, ret);
    const subtotal = totalDays * car.dailyRate;
    let discount = null;
    let discountAmount = 0;
    if (code) {
      const result = await evaluateDiscount(code, { subtotal, userId: req.user.id });
      // Expired and used-up codes get the same answer as unknown ones (as /discount/validate does),
      // so booking is not a second way to probe codes; minimum-amount and per-customer reasons stay.
      // Attempts with a code also share the /discount/validate rate limit (server.js).
      if (!result.ok) {
        const generic = result.status === 404 || /has expired|fully redeemed/.test(result.message);
        return res.status(400).json({ message: generic ? 'Invalid or expired discount code' : result.message });
      }
      discount = result.discount;
      discountAmount = result.amount;
    }
    const afterDiscount = subtotal - discountAmount;

    const user = await User.findById(req.user.id).select('name email phone loyaltyPoints').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Loyalty points: 10 pts = ₹1, at most 50% of the fare, whole rupees
    let loyaltyPointsUsed = 0;
    let loyaltyDiscount = 0;
    if (useLoyaltyPoints === true || useLoyaltyPoints === 'true') {
      loyaltyDiscount = Math.floor(Math.min((user.loyaltyPoints || 0) / 10, afterDiscount * 0.5));
      loyaltyPointsUsed = loyaltyDiscount * 10;
    }
    const totalAmount = Math.max(0, Math.round(afterDiscount - loyaltyDiscount));

    // Hold the car while the dates are checked and the booking saved, so two people cannot take the same dates
    const release = await lockCar(car._id);
    if (!release) {
      return res.status(409).json({ code: 'CAR_BUSY', message: 'Someone else is booking this car right now. Please try again in a moment.' });
    }

    let booking;
    let pointsTaken = false;
    let discountClaimed = false;
    const undo = async () => {
      if (pointsTaken) await User.updateOne({ _id: user._id }, { $inc: { loyaltyPoints: loyaltyPointsUsed } });
      if (discountClaimed) await releaseDiscountUse(discount.code);
    };
    try {
      const clash = await findClash(car._id, pickup, ret);
      if (clash) return res.status(409).json(DATES_TAKEN);

      // Spend the points atomically: only if the balance still covers them right now
      if (loyaltyPointsUsed > 0) {
        const spent = await User.findOneAndUpdate(
          { _id: user._id, loyaltyPoints: { $gte: loyaltyPointsUsed } },
          { $inc: { loyaltyPoints: -loyaltyPointsUsed } },
          { new: true }
        );
        if (!spent) return res.status(409).json({ code: 'POINTS_CHANGED', message: 'Your loyalty points balance changed. Please review the fare and try again.' });
        pointsTaken = true;
      }
      if (discount) {
        discountClaimed = await claimDiscountUse(discount._id);
        if (!discountClaimed) {
          await undo();
          pointsTaken = false;
          return res.status(400).json({ message: `Discount code ${discount.code} is no longer available` });
        }
      }

      booking = await createWithInvoiceNumber({
        user: req.user.id,
        car: car._id,
        customerName: str(customerName, 80) || user.name,
        customerEmail: contactEmail || user.email,
        customerPhone: str(customerPhone, 20) || user.phone,
        pickupDate: pickup,
        returnDate: ret,
        pickupLocation: str(pickupLocation, 120),
        dailyRateSnapshot: car.dailyRate,
        totalDays,
        totalAmount,
        discountAmount,
        discountCode: discount ? discount.code : '',
        discountClaimed,
        loyaltyPointsUsed,
        loyaltyDiscount,
        pointsAwarded: false,
        paymentMethod: method,
        paymentCompleted: false,
        status: 'Pending',
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
    } catch (err) {
      await undo().catch((e) => console.error('Could not undo booking side effects:', e.message));
      throw err;
    } finally {
      await release();
    }
    // Saved: the customer's next booking may start
    await releaseUser();
    releaseUser = null;

    const populatedBooking = await Booking.findById(booking._id).populate('car', 'name company type images.main dailyRate');

    // Send confirmation email asynchronously (does not block response)
    sendBookingConfirmationEmail({
      booking: populatedBooking,
      car: populatedBooking.car,
      user,
    }).catch(err => console.error('Email send error:', err));

    res.status(201).json(bookingView(populatedBooking, today));
  } catch (error) {
    handleError(res, error);
  } finally {
    if (releaseUser) await releaseUser();
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
    const today = todayStart();
    res.json(bookings.map((b) => bookingView(b, today)));
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
    res.json(bookingView(booking));
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Download the PDF invoice (the same file that is attached to booking emails)
// @route  GET /api/bookings/:id/invoice
exports.getInvoicePdf = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('car', 'name company type dailyRate')
      .populate('user', 'name email phone');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user?._id?.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    const pdf = buildInvoicePdf(booking, booking.car);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceFilename(booking)}"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(pdf);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Cancel booking (owner, before the pickup day)
// @route  PATCH /api/bookings/:id/cancel
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      return res.status(400).json({ message: 'This booking cannot be cancelled' });
    }
    const today = todayStart();
    if (booking.pickupDate <= today) {
      return res.status(400).json({ message: 'This trip has already started, so it cannot be cancelled online. Please contact the hub.' });
    }

    const cancelled = await cancelWithEffects(
      { _id: booking._id, user: booking.user, pickupDate: { $gt: today } },
      { reason: req.body.reason || 'Cancelled by user', cancelledBy: req.user.name || req.user.id }
    );
    if (!cancelled) return res.status(400).json({ message: 'This booking cannot be cancelled' });

    // Notify customer about cancellation
    sendStatusEmail(cancelled._id, 'Cancelled').catch(err => console.error(err));

    res.json(bookingView(cancelled, today));
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Record a payment: the owner's simulated test checkout, or cash collected by an admin
// @route  PATCH /api/bookings/:id/payment
exports.markPaymentComplete = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const isAdmin = req.user.role === 'admin';
    // Only the booking owner (or an admin) may pay
    if (booking.user.toString() !== req.user.id && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const choice = paymentChoice(req.body, isAdmin);
    if (!choice) {
      return res.status(400).json({
        message: isAdmin
          ? 'Choose CASH or an online method (UPI, CARD, NETBANKING, WALLET)'
          : 'Choose UPI, CARD, NETBANKING or WALLET to pay online.',
      });
    }
    if (booking.status === 'Cancelled') return res.status(400).json({ message: 'Cannot pay for a cancelled booking' });
    if (booking.paymentCompleted) return res.status(400).json({ message: 'This booking is already paid' });

    const today = todayStart();
    const filter = { _id: booking._id, paymentCompleted: false, status: booking.status };
    if (!isAdmin) {
      if (booking.status !== 'Pending') return res.status(400).json({ message: 'Only bookings waiting for payment can be paid' });
      if (booking.returnDate <= today) return res.status(400).json({ message: 'This booking has ended and can no longer be paid online' });
      filter.returnDate = { $gt: today };
    }

    const set = {
      paymentCompleted: true,
      paymentCompletedAt: new Date(),
      paidAmount: booking.totalAmount,
      paymentMethod: choice.kind === 'cash' ? 'Cash' : `Online test (${choice.method})`,
    };
    // The reference is made here; anything the client sends is ignored
    if (choice.kind === 'test') set.paymentId = paymentReference();
    if (booking.status === 'Pending') set.status = 'Confirmed';

    // Single-use transition: only one request can turn an unpaid booking into a paid one
    const updated = await Booking.findOneAndUpdate(filter, { $set: set }, { new: true });
    if (!updated) return res.status(400).json({ message: 'This booking can no longer be paid. Refresh and try again.' });

    // Email the paid invoice (it can only become paid once, so this sends once)
    Booking.findById(updated._id)
      .populate('car', 'name company type dailyRate')
      .populate('user', 'name email phone')
      .then((full) => sendPaymentReceivedEmail({ booking: full, car: full.car, user: full.user }))
      .catch((err) => console.error('Email send error:', err));

    res.json(bookingView(updated, today));
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
    const today = todayStart();
    res.json({ bookings: bookings.map((b) => bookingView(b, today)), totalPages: Math.ceil(total / limit), currentPage: page, total });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Update booking status (Admin). Allowed: Pending -> Confirmed/Cancelled, Confirmed -> Completed/Cancelled
// @route  PATCH /api/bookings/:id/status
exports.updateBookingStatus = async (req, res) => {
  try {
    const next = req.body.status;
    if (!BOOKING_STATUSES.includes(next)) {
      return res.status(400).json({ message: `Status must be one of: ${BOOKING_STATUSES.join(', ')}` });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!allowedNextStatuses(booking.status).includes(next)) {
      const message = booking.status === next
        ? `This booking is already ${next}`
        : ['Completed', 'Cancelled'].includes(booking.status)
          ? `A ${booking.status.toLowerCase()} booking cannot be changed`
          : `A ${booking.status.toLowerCase()} booking cannot be moved to ${next}`;
      return res.status(400).json({ message });
    }

    let updated;
    if (next === 'Cancelled') {
      updated = await cancelWithEffects(
        { _id: booking._id, status: booking.status },
        { reason: req.body.reason || 'Cancelled by Driveaway', cancelledBy: req.user.name || 'Admin' }
      );
    } else if (next === 'Confirmed') {
      updated = await confirmBooking(booking._id);
    } else {
      updated = await completeBooking(booking._id);
    }
    if (!updated) return res.status(409).json({ message: 'This booking was changed in the meantime. Refresh and try again.' });

    const populated = await Booking.findById(updated._id)
      .populate('car', 'name company type')
      .populate('user', 'name email phone');

    // Send email notification about status change
    sendBookingStatusUpdateEmail({ booking: populated, newStatus: next, user: populated.user }).catch(err => console.error(err));

    res.json(bookingView(populated));
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Delete booking (Admin). An active booking is cancelled first (points, code use, alerts)
// @route  DELETE /api/bookings/:id
exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      const cancelled = await cancelWithEffects(
        { _id: booking._id },
        { reason: 'Booking removed by Driveaway', cancelledBy: req.user.name || 'Admin' }
      );
      if (cancelled) {
        // Load it for the email before it is deleted; the send itself does not hold up the response
        const full = await Booking.findById(cancelled._id).populate('car', 'name company type').populate('user', 'name email phone');
        if (full) {
          sendBookingStatusUpdateEmail({ booking: full, newStatus: 'Cancelled', user: full.user }).catch(err => console.error(err));
        }
      }
    }
    await Booking.deleteOne({ _id: booking._id });
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

    const { generateWhatsAppInvoiceText, getWhatsAppUrl } = require('../utils/whatsappService');
    const text = generateWhatsAppInvoiceText(booking, booking.car);
    const isAdmin = req.user.role === 'admin';
    // Only admins may address the link to an arbitrary number
    const targetPhone = (isAdmin && typeof req.query.phone === 'string' && req.query.phone) || booking.customerPhone || booking.user?.phone;
    const url = getWhatsAppUrl(targetPhone, text);

    res.json({
      success: true,
      phone: targetPhone,
      message: text,
      url,
    });
  } catch (error) {
    handleError(res, error);
  }
};
