/**
 * Fills a database with the demo fleet, two accounts, sample bookings, reviews and messages.
 * It first DELETES every user, car, booking, review, discount code, contact message, car alert,
 * newsletter subscriber and uploaded photo in the target database.
 *
 * Safety guard (it never wipes real data by accident):
 *  - It prints the target host and database and what it contains before doing anything.
 *  - A database that already has users or bookings is only wiped when SEED_CONFIRM equals its name.
 *  - A non-local database (e.g. Atlas) is only touched when SEED_CONFIRM equals its name,
 *    except a completely empty one (the very first deploy).
 *
 * Usage (from server/):
 *   npm run seed                                           # empty or local-and-empty database
 *   SEED_CONFIRM=<database name> npm run seed              # bash: wipe and re-seed that database
 *   $env:SEED_CONFIRM="<database name>"; npm run seed      # PowerShell (then: Remove-Item Env:SEED_CONFIRM)
 * To keep users and bookings and only update the cars, use scripts/syncFleet.js instead.
 */
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
const CarAlert = require('./models/CarAlert');
const DiscountSubscriber = require('./models/DiscountSubscriber');
const Upload = require('./models/Upload');
const connectDB = require('./config/db');
const buildFleet = require('./data/buildFleet');
const { todayStart, addDays, dayStart } = require('./utils/dates');
const { paymentReference } = require('./utils/paymentReference');
const crypto = require('crypto');

// No passwords live in this file. Set SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD in server/.env
// (never committed) to choose them; otherwise strong random ones are made and printed once.
const randomPassword = () => `${crypto.randomBytes(12).toString('base64url')}7a`;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || randomPassword();
const USER_PASSWORD = process.env.SEED_USER_PASSWORD || randomPassword();

// Everything the seed deletes, with a label for the summary
const WIPED = [
  ['users', User], ['cars', Car], ['bookings', Booking], ['reviews', Review], ['discount codes', DiscountCode],
  ['contact messages', ContactMessage], ['car alerts', CarAlert], ['newsletter subscribers', DiscountSubscriber],
  ['uploaded photos', Upload],
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Hosts named in the connection string (all of them must be local for the database to count as local)
const uriHosts = (uri) => {
  const m = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(uri || '');
  if (!m) return [];
  return m[1].split(',').map((h) => h.trim().replace(/:\d+$/, '').toLowerCase()).filter(Boolean);
};

// The India calendar day `days` from today, stored the way the API stores booking days
// (UTC midnight of that date, see utils/dates.js), so seeded trips compare like real ones
const istDay = (days) => addDays(todayStart(), days);

// Same shape as the checkout's payment references
const testPaymentId = paymentReference;

// Prints the target and its contents; exits without changing anything unless seeding is allowed
const guard = async () => {
  const conn = mongoose.connection;
  const dbName = conn.name;
  const hosts = uriHosts(connectDB.mongoUri());
  const isLocal = hosts.length > 0 && hosts.every((h) => LOCAL_HOSTS.has(h));
  const counts = await Promise.all(WIPED.map(([, Model]) => Model.countDocuments({})));
  const contents = WIPED.map(([label], i) => `${counts[i]} ${label}`).join(', ');
  const [users, , bookings] = counts;
  const isEmpty = counts.every((n) => n === 0);
  const confirmed = process.env.SEED_CONFIRM === dbName;

  console.log('🌱 Driveaway seed');
  console.log(`   Target:   ${hosts.join(', ') || conn.host} / ${dbName} (${isLocal ? 'local' : 'REMOTE'})`);
  console.log(`   Contains: ${contents}`);
  console.log('   Plan:     DELETE everything listed above, then create the demo fleet, 2 accounts and sample data.');

  const refuse = (reason) => {
    console.error(`\n⛔ Not seeding: ${reason}`);
    console.error(`   Nothing was changed. If you really want to wipe "${dbName}", run:`);
    console.error(`     bash:        SEED_CONFIRM=${dbName} npm run seed`);
    console.error(`     PowerShell:  $env:SEED_CONFIRM="${dbName}"; npm run seed; Remove-Item Env:SEED_CONFIRM`);
    console.error('   To keep users and bookings and only update the cars, run: node scripts/syncFleet.js');
    process.exit(1);
  };

  if (process.env.SEED_CONFIRM && !confirmed) {
    console.warn(`   ⚠️ SEED_CONFIRM is "${process.env.SEED_CONFIRM}", which does not match "${dbName}"; it was ignored.`);
  }
  if ((users > 0 || bookings > 0) && !confirmed) {
    refuse(`"${dbName}" already has ${users} users and ${bookings} bookings.`);
  }
  if (!isLocal && !isEmpty && !confirmed) {
    refuse(`"${dbName}" is a remote database and is not empty.`);
  }
  console.log(confirmed ? `   Confirmed by SEED_CONFIRM=${dbName}.\n` : '   Database is empty or holds no users or bookings.\n');
};

const seedData = async () => {
  try {
    await connectDB();
    await guard();
    console.log('🌱 Starting database seed...');

    // Clear all collections
    await Promise.all(WIPED.map(([, Model]) => Model.deleteMany()));
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

    const customer = await User.create({
      username: 'demo_customer',
      email: 'customer@example.com',
      password: userPassword,
      name: 'Aarav Shah',
      phone: '9800000001',
      loyaltyPoints: 250,
      licenseNumber: 'GJ01-DL-2020-0000000',
      address: '12 Shanti Residency, Prahlad Nagar, Ahmedabad - 380015',
      drivingExperience: 2,
      emergencyContact: 'Riya Shah',
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
      user: customer._id,
      car: carByName('Honda Civic Type R')._id,
      customerName: 'Aarav Shah',
      customerEmail: 'customer@example.com',
      customerPhone: '9800000001',
      pickupDate: dayStart('2025-04-05'),
      returnDate: dayStart('2025-04-07'),
      pickupLocation: 'SG Highway',
      dailyRateSnapshot: carByName('Honda Civic Type R').dailyRate,
      totalDays: 2,
      totalAmount: carByName('Honda Civic Type R').dailyRate * 2,
      paymentCompleted: true,
      paymentCompletedAt: new Date('2025-04-05T00:00:00+05:30'),
      paidAmount: carByName('Honda Civic Type R').dailyRate * 2,
      paymentMethod: 'Online test (UPI)',
      paymentId: testPaymentId(),
      status: 'Completed',
      pointsAwarded: true,
      licenseNumber: 'GJ01-DL-2020-0000000',
      address: '12 Shanti Residency, Prahlad Nagar, Ahmedabad - 380015',
    });

    await Booking.create({
      invoiceNumber: 'DA-2025-000002',
      user: customer._id,
      car: carByName('Porsche 911 GT3 RS (992)')._id,
      customerName: 'Aarav Shah',
      customerEmail: 'customer@example.com',
      customerPhone: '9800000001',
      pickupDate: istDay(1),
      returnDate: istDay(3),
      pickupLocation: 'Vastrapur',
      dailyRateSnapshot: carByName('Porsche 911 GT3 RS (992)').dailyRate,
      totalDays: 2,
      totalAmount: carByName('Porsche 911 GT3 RS (992)').dailyRate * 2,
      paymentCompleted: true,
      paymentCompletedAt: new Date(),
      paidAmount: carByName('Porsche 911 GT3 RS (992)').dailyRate * 2,
      paymentMethod: 'Online test (NETBANKING)',
      paymentId: testPaymentId(),
      status: 'Confirmed',
      licenseNumber: 'GJ01-DL-2020-0000000',
    });

    await Booking.create({
      invoiceNumber: 'DA-2025-000003',
      user: customer._id,
      car: carByName('Volkswagen Golf GTI')._id,
      customerName: 'Aarav Shah',
      customerEmail: 'customer@example.com',
      customerPhone: '9800000001',
      pickupDate: istDay(7),
      returnDate: istDay(9),
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
        user: customer._id,
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
    if (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_USER_PASSWORD) {
      console.log('⚠️  Save these passwords now: they are not stored anywhere else.');
    }
    console.log('🎟️  Discount Codes: DRIVEAWAY20, NEWUSER10, AHMEDABAD15\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedData();
