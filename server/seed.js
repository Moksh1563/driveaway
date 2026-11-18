const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const User = require('./models/User');
const Car = require('./models/Car');
const DiscountCode = require('./models/DiscountCode');
const Booking = require('./models/Booking');
const Review = require('./models/Review');
const ContactMessage = require('./models/ContactMessage');
const connectDB = require('./config/db');
const buildFleet = require('./data/buildFleet');
const crypto = require('crypto');

// The demo passwords below are public (they are in this repository), so they are only used
// for a database on this computer. Seeding any other database (e.g. Atlas) uses
// SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD if set, otherwise strong random passwords.
const isLocalDb = /^mongodb:\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(process.env.MONGO_URI || 'mongodb://127.0.0.1');
const pick = (envName, demo) => process.env[envName] || (isLocalDb ? demo : crypto.randomBytes(12).toString('base64url'));
const ADMIN_PASSWORD = pick('SEED_ADMIN_PASSWORD', 'REMOVED-PASSWORD');
const USER_PASSWORD = pick('SEED_USER_PASSWORD', 'REMOVED-PASSWORD');

const seedData = async () => {
  try {
    await connectDB();
    console.log('🌱 Starting database seed...');

    // Clear all collections
    await Promise.all([
      User.deleteMany(),
      Car.deleteMany(),
      DiscountCode.deleteMany(),
      Booking.deleteMany(),
      Review.deleteMany(),
      ContactMessage.deleteMany(),
    ]);
    console.log('🗑️  Cleared all collections');

    // Create users
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
    const userPassword = await bcrypt.hash(USER_PASSWORD, salt);

    await User.create({
      username: 'admin',
      email: 'admin@driveaway.com',
      password: adminPassword,
      role: 'admin',
      name: 'Driveaway Admin',
      phone: '+91 79-2630-0000',
    });
    console.log('✅ Admin user created');

    const moksh = await User.create({
      username: 'demo_customer',
      email: 'customer@example.com',
      password: userPassword,
      name: 'Aarav Shah',
      phone: '9800000001',
      loyaltyPoints: 250,
      licenseNumber: 'GJ01-DL-2020-0000000',
      address: '12 Demo Residency, Prahlad Nagar, Ahmedabad - 380015',
      drivingExperience: 2,
      emergencyContact: 'Demo Contact',
      emergencyPhone: '9800000002',
    });
    console.log('✅ Sample user created');

    // Create cars
    // 48 cars, 6 per category, each with four photos of that exact model (see data/fleet.js)
    const cars = await Car.insertMany(buildFleet());
    const carByName = (name) => {
      const c = cars.find((x) => x.name === name);
      if (!c) throw new Error(`Seed car not found: ${name}`);
      return c;
    };
    console.log(`✅ ${cars.length} cars created`);

    // Create discount codes
    await DiscountCode.create([
      { code: 'DRIVEAWAY20', percentageOff: 20, maxDiscount: 2000, isActive: true },
      { code: 'NEWUSER10', percentageOff: 10, maxDiscount: 1000, isActive: true },
      { code: 'AHMEDABAD15', percentageOff: 15, maxDiscount: 1500, isActive: true },
    ]);
    console.log('✅ Discount codes created');

    // Create sample bookings
    const b1 = await Booking.create({
      invoiceNumber: 'DA-2025-000001',
      user: moksh._id,
      car: carByName('Honda Civic Type R')._id,
      customerName: 'Aarav Shah',
      customerEmail: 'customer@example.com',
      customerPhone: '9800000001',
      pickupDate: new Date('2025-04-05'),
      returnDate: new Date('2025-04-07'),
      pickupLocation: 'SG Highway',
      dailyRateSnapshot: carByName('Honda Civic Type R').dailyRate,
      totalDays: 2,
      totalAmount: carByName('Honda Civic Type R').dailyRate * 2,
      paymentCompleted: true,
      paymentCompletedAt: new Date('2025-04-05'),
      paymentMethod: 'UPI',
      status: 'Completed',
      licenseNumber: 'GJ01-DL-2020-0000000',
      address: '12 Demo Residency, Prahlad Nagar, Ahmedabad - 380015',
    });

    const b2 = await Booking.create({
      invoiceNumber: 'DA-2025-000002',
      user: moksh._id,
      car: carByName('Porsche 911 GT3 RS (992)')._id,
      customerName: 'Aarav Shah',
      customerEmail: 'customer@example.com',
      customerPhone: '9800000001',
      pickupDate: new Date(Date.now() + 86400000),
      returnDate: new Date(Date.now() + 86400000 * 3),
      pickupLocation: 'Vastrapur',
      dailyRateSnapshot: carByName('Porsche 911 GT3 RS (992)').dailyRate,
      totalDays: 2,
      totalAmount: carByName('Porsche 911 GT3 RS (992)').dailyRate * 2,
      paymentCompleted: true,
      paymentCompletedAt: new Date(),
      paymentMethod: 'Net Banking',
      status: 'Confirmed',
      licenseNumber: 'GJ01-DL-2020-0000000',
    });

    await Booking.create({
      invoiceNumber: 'DA-2025-000003',
      user: moksh._id,
      car: carByName('Volkswagen Golf GTI')._id,
      customerName: 'Aarav Shah',
      customerEmail: 'customer@example.com',
      customerPhone: '9800000001',
      pickupDate: new Date(Date.now() + 86400000 * 7),
      returnDate: new Date(Date.now() + 86400000 * 9),
      pickupLocation: 'Bopal',
      dailyRateSnapshot: carByName('Volkswagen Golf GTI').dailyRate,
      totalDays: 2,
      totalAmount: carByName('Volkswagen Golf GTI').dailyRate * 2,
      paymentCompleted: false,
      paymentMethod: 'Cash',
      status: 'Pending',
    });
    console.log('✅ Sample bookings created');

    // Create reviews
    await Review.create([
      {
        user: moksh._id,
        car: carByName('Honda Civic Type R')._id,
        booking: b1._id,
        rating: 5,
        reviewText: 'Absolutely loved the Civic Type R! Smooth drive on SG Highway. The car was spotless and the booking process was super easy. Highly recommend Driveaway!',
      },
    ]);

    // Update car rating
    await Car.findByIdAndUpdate(carByName('Honda Civic Type R')._id, { averageRating: 5, totalReviews: 1 });

    // Sample contact messages
    await ContactMessage.create([
      {
        name: 'Priya Sharma',
        email: 'priya@gmail.com',
        phone: '9876543210',
        subject: 'Query about Airport Pickup',
        message: 'Hi, I want to know if you offer pickup service from Ahmedabad Airport. Also, is there any extra charge for late night pickups?',
        isRead: false,
      },
      {
        name: 'Rahul Patel',
        email: 'rahul.patel@gmail.com',
        phone: '9512345678',
        subject: 'Corporate Rental Inquiry',
        message: 'We are looking for long-term rental options for our company vehicles. Do you offer monthly plans or bulk discounts for corporate clients?',
        isRead: true,
      },
    ]);
    console.log('✅ Reviews & messages created');

    console.log('\n🎉 Database seeded successfully!\n');
    console.log(`📧 Admin Login:  admin@driveaway.com / ${ADMIN_PASSWORD}`);
    console.log(`📧 User Login:   customer@example.com / ${USER_PASSWORD}`);
    if (!isLocalDb) console.log('⚠️  Save these passwords now: they are not stored anywhere else.');
    console.log('🎟️  Discount Codes: DRIVEAWAY20, NEWUSER10, AHMEDABAD15\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedData();
