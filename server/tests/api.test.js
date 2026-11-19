/**
 * End-to-end API tests (security + core flows).
 * Run with:  cd server && npm test
 *
 * Uses its own database: TEST_MONGO_URI (default mongodb://127.0.0.1:27017/driveaway_test), for both
 * this process and the server it starts on TEST_PORT or a free port (email sending disabled). It refuses to run
 * against a host other than localhost unless ALLOW_REMOTE_TEST_DB=yes, and the database name must
 * contain "test". Test users, cars, codes and bookings are created directly in that database and
 * removed again at the end; leftovers from an interrupted run are removed at the start.
 * The temporary admin gets a random password, so no real password is needed or stored here.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const DiscountCode = require('../models/DiscountCode');
const Review = require('../models/Review');
const CarAlert = require('../models/CarAlert');
const DiscountSubscriber = require('../models/DiscountSubscriber');
const Upload = require('../models/Upload');
const { todayIST, dayStart, addDays } = require('../utils/dates');

const TEST_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/driveaway_test';
let PORT;  // TEST_PORT, or a free port picked at start so we never talk to some other server
let BASE;
const stamp = Date.now().toString(36);
// Throwaway passwords made fresh for every run (letters + digits, so they pass the password rule)
const PW = `T${crypto.randomBytes(9).toString('hex')}9`;
const ADMIN = { email: `test_admin_${stamp}@example.com`, password: `A${crypto.randomBytes(9).toString('hex')}7` };
const TEST_EMAIL_RE = /^test_.+@example\.com$/i;
const TEST_COMPANY = 'Driveaway Test Motors';
const CODE_PREFIX = 'ZT';

let server;
let serverLog = '';
let adminToken;
const users = {}; // a, b, c, d, f -> { token, id, email }
const cars = [];  // test cars (Available), plus one in Maintenance
let maintenanceCar;

/** Refuse anything that is not a local test database. */
function checkTestDatabase(uri) {
  let host;
  let dbName;
  try {
    const u = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://'));
    host = u.hostname.replace(/^\[|\]$/g, '');
    dbName = u.pathname.replace(/^\//, '');
  } catch {
    throw new Error(`TEST_MONGO_URI is not a valid MongoDB URI: ${uri}`);
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  if (!local && process.env.ALLOW_REMOTE_TEST_DB !== 'yes') {
    throw new Error(`Refusing to run tests against ${host}. Use a local database, or set ALLOW_REMOTE_TEST_DB=yes.`);
  }
  if (!/test/i.test(dbName || '')) {
    throw new Error(`Refusing to run tests against database "${dbName || '(none)'}": its name must contain "test".`);
  }
}

/** Remove test data straight from the database (this run's, or any run's when leftovers=true). */
async function removeTestData() {
  const testUsers = await User.find({ email: TEST_EMAIL_RE }).select('_id email').lean();
  const userIds = testUsers.map((u) => u._id);
  const emails = testUsers.map((u) => u.email);
  const carIds = (await Car.find({ company: TEST_COMPANY }).select('_id').lean()).map((c) => c._id);
  await Promise.all([
    Booking.deleteMany({ $or: [{ user: { $in: userIds } }, { car: { $in: carIds } }] }),
    Review.deleteMany({ $or: [{ user: { $in: userIds } }, { car: { $in: carIds } }] }),
    CarAlert.deleteMany({ $or: [{ car: { $in: carIds } }, { email: TEST_EMAIL_RE }] }),
    DiscountSubscriber.deleteMany({ $or: [{ email: TEST_EMAIL_RE }, { email: { $in: emails } }] }),
    DiscountCode.deleteMany({ code: { $regex: `^${CODE_PREFIX}` } }),
    Upload.deleteMany({ uploadedBy: { $in: userIds } }),
  ]);
  await Promise.all([
    User.deleteMany({ _id: { $in: userIds } }),
    Car.deleteMany({ _id: { $in: carIds } }),
  ]);
}

async function api(method, url, { token, body, headers = {} } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data, headers: res.headers };
}

// Calendar days counted from today's date in India, as the API expects ("YYYY-MM-DD")
const isoDay = (offsetDays) => addDays(dayStart(todayIST()), offsetDays).toISOString().slice(0, 10);
const dayIso = (offsetDays) => `${isoDay(offsetDays)}T00:00:00.000Z`;

const book = (who, car, from, to, extra = {}) => api('POST', '/bookings', {
  token: users[who].token,
  body: { car: car._id.toString(), pickupDate: isoDay(from), returnDate: isoDay(to), pickupLocation: 'SG Highway', paymentMethod: 'Cash', ...extra },
});
const setStatus = (id, status) => api('PATCH', `/bookings/${id}/status`, { token: adminToken, body: { status } });
const cancelAll = async (ids) => {
  for (const id of ids.filter(Boolean)) await setStatus(id, 'Cancelled');
};
const pointsOf = async (who) => (await User.findById(users[who].id).select('loyaltyPoints').lean()).loyaltyPoints;
const setPoints = (who, n) => User.updateOne({ _id: users[who].id }, { $set: { loyaltyPoints: n } });
const dashboard = async () => (await api('GET', '/admin/dashboard', { token: adminToken })).data;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

before(async () => {
  checkTestDatabase(TEST_URI);
  PORT = Number(process.env.TEST_PORT) || await freePort();
  BASE = `http://127.0.0.1:${PORT}/api`;
  await mongoose.connect(TEST_URI);
  await removeTestData(); // anything an interrupted earlier run left behind

  // Fixture cars, made directly in the test database
  const rates = [2000, 2500, 3000, 3500, 4000, 4500];
  for (let i = 0; i < rates.length; i++) {
    cars.push(await Car.create({
      name: `Test Car ${i} ${stamp}`, company: TEST_COMPANY, type: 'Sedan', yearModel: 2024, dailyRate: rates[i],
      fuelType: 'Petrol', transmission: 'Automatic', seats: 5,
      description: 'A car that exists only for the automated API tests. It is removed again when the test run finishes. '.repeat(3),
    }));
  }
  maintenanceCar = await Car.create({
    name: `Test Workshop ${stamp}`, company: TEST_COMPANY, type: 'SUV', dailyRate: 5000, status: 'Maintenance',
  });

  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      MONGO_URI: TEST_URI,
      MONGODB_URI: TEST_URI,
      EMAIL_USER: '', EMAIL_PASS: '', BREVO_API_KEY: '', EMAIL_FROM: '',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  // wait for server + DB (and stop early if our server exited, e.g. the port was taken)
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    assert.equal(server.exitCode, null, `test server exited.\n${serverLog}`);
    try {
      const health = await fetch(`${BASE}/health`);
      if (health.status === 200) up = true;
      else {
        const root = await fetch(`http://127.0.0.1:${PORT}/`);
        if (root.ok && serverLog.includes('MongoDB Connected')) up = true;
      }
    } catch { /* not up yet */ }
    if (!up) await sleep(250);
  }
  assert.ok(up, `test server did not start.\n${serverLog}`);

  const admin = await User.create({
    username: `test_admin_${stamp}`, name: 'Test Admin', email: ADMIN.email, role: 'admin',
    password: await bcrypt.hash(ADMIN.password, 10),
  });
  assert.ok(admin);

  const login = await api('POST', '/auth/login', { body: ADMIN });
  assert.equal(login.status, 200, `temporary admin login failed. ${JSON.stringify(login.data)}\n${serverLog}`);
  adminToken = login.data.token;

  for (const key of ['a', 'b', 'c', 'd', 'f']) {
    const email = `test_${key}_${stamp}@example.com`;
    const r = await api('POST', '/auth/register', {
      body: { username: `test_${key}_${stamp}`, name: `Test ${key.toUpperCase()}`, email, phone: '9876543210', password: PW },
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    users[key] = { token: r.data.token, id: r.data.user._id, email };
  }
});

after(async () => {
  try {
    if (mongoose.connection.readyState === 1) await removeTestData();
  } finally {
    await mongoose.disconnect();
    server?.kill();
  }
});

// ───────────────────────── Platform / headers ─────────────────────────
test('security headers are set and Express fingerprint is hidden', async () => {
  const r = await api('GET', '/cars?limit=1');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('x-frame-options'));
});

test('responses are gzip-compressed', async () => {
  const res = await fetch(`${BASE}/cars?limit=50`, { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(res.headers.get('content-encoding'), 'gzip');
});

test('unknown API route returns JSON 404', async () => {
  const r = await api('GET', '/does-not-exist');
  assert.equal(r.status, 404);
});

test('malformed JSON returns 400, not 500', async () => {
  const r = await api('POST', '/auth/login', { body: '{bad json' });
  assert.equal(r.status, 400);
});

// ───────────────────────── Cars ─────────────────────────
test('cars list works with filters and pagination is capped', async () => {
  const r = await api('GET', '/cars?limit=100000&sort=price_asc');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.data.cars));
  assert.ok(r.data.cars.length <= 100);
  const rates = r.data.cars.map((c) => c.dailyRate);
  assert.deepEqual(rates, [...rates].sort((x, y) => x - y));
});

test('car list is revalidated on every load (no stale list after admin edits)', async () => {
  const first = await fetch(`${BASE}/cars?limit=100`);
  assert.equal(first.status, 200);
  assert.match(first.headers.get('cache-control') || '', /no-cache|no-store/);
  const etag = first.headers.get('etag');
  assert.ok(etag, 'expected an ETag');
  // Revalidate the way a browser cache does (fetch() would add "Cache-Control: no-cache" and skip the 304)
  const status = await new Promise((resolve, reject) => {
    http.get(`${BASE}/cars?limit=100`, { headers: { 'If-None-Match': etag } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject);
  });
  assert.equal(status, 304);
});

test('NoSQL operator injection in query string is ignored', async () => {
  const all = await api('GET', '/cars?limit=100');
  const inj = await api('GET', '/cars?limit=100&status[$ne]=zzz');
  assert.equal(inj.status, 200);
  assert.equal(inj.data.totalCars, all.data.totalCars);
});

test('regex special characters in search do not crash the server', async () => {
  const r = await api('GET', `/cars?search=${encodeURIComponent('((((a+)+)+)+$')}`);
  assert.equal(r.status, 200);
});

test('invalid car id returns 400', async () => {
  const r = await api('GET', '/cars/not-an-id');
  assert.equal(r.status, 400);
});

test('non-admin cannot create cars', async () => {
  const r = await api('POST', '/cars', { token: users.a.token, body: { name: 'X', company: 'Y', type: 'SUV', dailyRate: 1 } });
  assert.equal(r.status, 403);
});

test('admin car edits: Rented and zero/negative/missing daily rates are rejected', async () => {
  const id = cars[0]._id.toString();
  for (const body of [{ status: 'Rented' }, { dailyRate: 0 }, { dailyRate: -5 }, { dailyRate: null }, { dailyRate: '' }]) {
    const r = await api('PUT', `/cars/${id}`, { token: adminToken, body });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  const missing = await api('POST', '/cars', { token: adminToken, body: { name: 'X', company: TEST_COMPANY, type: 'SUV' } });
  assert.equal(missing.status, 400);
  const ok = await api('PUT', `/cars/${id}`, { token: adminToken, body: { description: 'Edited by the API tests.', status: 'Available' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.adminStatus, 'Available');
  assert.equal((await Car.findById(id).lean()).dailyRate, 2000);
});

// ───────────────────────── Auth ─────────────────────────
test('register rejects weak passwords and bad emails', async () => {
  const weak = await api('POST', '/auth/register', { body: { username: `w_${stamp}`, name: 'W', email: `test_w_${stamp}@example.com`, password: '123' } });
  assert.equal(weak.status, 400);
  const bad = await api('POST', '/auth/register', { body: { username: `w2_${stamp}`, name: 'W', email: 'not-an-email', password: PW } });
  assert.equal(bad.status, 400);
});

test('register response never contains the password hash', async () => {
  const r = await api('GET', '/auth/me', { token: users.a.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.password, undefined);
});

test('login rejects NoSQL injection payload', async () => {
  const r = await api('POST', '/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } });
  assert.equal(r.status, 400);
});

test('login with wrong password returns 401', async () => {
  const r = await api('POST', '/auth/login', { body: { email: users.a.email, password: `${PW}x` } });
  assert.equal(r.status, 401);
});

test('login by email and by username both work', async () => {
  const byEmail = await api('POST', '/auth/login', { body: { email: users.a.email, password: PW } });
  assert.equal(byEmail.status, 200);
  const byUsername = await api('POST', '/auth/login', { body: { email: `test_a_${stamp}`, password: PW } });
  assert.equal(byUsername.status, 200);
});

test('forged / unsigned JWT is rejected', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ id: users.a.id })).toString('base64url');
  const r = await api('GET', '/auth/me', { token: `${header}.${payload}.` });
  assert.equal(r.status, 401);
});

test('user cannot escalate to admin via profile update', async () => {
  await api('PUT', '/auth/profile', { token: users.a.token, body: { role: 'admin', loyaltyPoints: 999999, name: 'Test A' } });
  const me = await api('GET', '/auth/me', { token: users.a.token });
  assert.equal(me.data.role, 'user');
  assert.equal(me.data.loyaltyPoints, 0);
});

test('regular user is blocked from admin endpoints', async () => {
  for (const url of ['/admin/dashboard', '/admin/users', '/bookings', '/discount', '/admin/messages']) {
    const r = await api('GET', url, { token: users.a.token });
    assert.equal(r.status, 403, url);
  }
  const anon = await api('GET', '/admin/dashboard');
  assert.equal(anon.status, 401);
});

// ───────────────────────── Bookings ─────────────────────────
let bookingId;   // a, cars[0], days 2-4, later paid with the test checkout
let unpaidId;    // a, cars[1], days 2-4, created with a forged "paid" body
let bPendingId;  // b, cars[0], days 4-6
let bCashId;     // b, cars[0], days 10-12

test('booking validation: past, reversed, too far ahead, too long and bad method are rejected', async () => {
  const car = cars[0];
  const cases = [
    [-5, -2, {}],
    [5, 3, {}],
    [181, 183, {}],
    [10, 101, {}],
    [3, 5, { paymentMethod: 'Bitcoin' }],
  ];
  for (const [from, to, extra] of cases) {
    const r = await book('a', car, from, to, extra);
    assert.equal(r.status, 400, `${from}..${to} ${JSON.stringify(extra)}: ${JSON.stringify(r.data)}`);
  }
  const maintenance = await book('a', maintenanceCar, 3, 5);
  assert.equal(maintenance.status, 400);
});

test('booking is created with a server-calculated price', async () => {
  const r = await book('a', cars[0], 2, 4, { totalAmount: 1 });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  bookingId = r.data._id;
  assert.equal(r.data.totalDays, 2);
  assert.equal(r.data.totalAmount, cars[0].dailyRate * 2);
  assert.equal(r.data.status, 'Pending');
  assert.equal(r.data.loyaltyPointsUsed, 0);
  assert.equal(r.data.loyaltyDiscount, 0);
  assert.equal(r.data.discountAmount, 0);
  assert.deepEqual(r.data.allowedNextStatuses, ['Confirmed', 'Cancelled']);
  assert.match(r.data.invoiceNumber, /^DA-\d{4}-\d{6}$/);
  // Creating a booking no longer flips the car to Rented
  assert.equal((await Car.findById(cars[0]._id).lean()).status, 'Available');
});

test('client cannot mark a booking paid at creation', async () => {
  const r = await book('a', cars[1], 2, 4, { paymentMethod: 'Online test (UPI)', paymentCompleted: true, paymentId: 'pay_FORGED' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  unpaidId = r.data._id;
  assert.equal(r.data.paymentCompleted, false);
  assert.equal(r.data.status, 'Pending');
  assert.equal(r.data.paymentId, undefined);
  assert.equal(r.data.paymentMethod, 'Online test');
});

test('overlapping dates get 409; other dates on the same car, back to back, are allowed', async () => {
  const same = await book('b', cars[0], 2, 4);
  assert.equal(same.status, 409);
  assert.match(same.data.message, /already booked/i);
  const overlap = await book('b', cars[0], 3, 5);
  assert.equal(overlap.status, 409);

  const backToBack = await book('b', cars[0], 4, 6); // a returns on day 4, b picks up on day 4
  assert.equal(backToBack.status, 201, JSON.stringify(backToBack.data));
  bPendingId = backToBack.data._id;
  const later = await book('b', cars[0], 10, 12);
  assert.equal(later.status, 201, JSON.stringify(later.data));
  bCashId = later.data._id;
  const clash = await book('b', cars[0], 5, 7);
  assert.equal(clash.status, 409);
});

test('simultaneous bookings for the same dates: exactly one succeeds', async () => {
  const results = await Promise.all([book('a', cars[3], 40, 42), book('c', cars[3], 40, 42)]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409], JSON.stringify(results.map((r) => r.data)));
  await cancelAll(results.filter((r) => r.status === 201).map((r) => r.data._id));
});

test('simultaneous bookings get distinct invoice numbers', async () => {
  const results = await Promise.all([book('a', cars[4], 50, 52), book('b', cars[5], 50, 52), book('c', cars[2], 50, 52)]);
  for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.data));
  const numbers = results.map((r) => r.data.invoiceNumber);
  assert.equal(new Set(numbers).size, numbers.length, numbers.join(', '));
  await cancelAll(results.map((r) => r.data._id));
});

test("another user cannot view, pay or cancel someone else's booking", async () => {
  const view = await api('GET', `/bookings/${bookingId}`, { token: users.b.token });
  assert.equal(view.status, 403);
  const pay = await api('PATCH', `/bookings/${bookingId}/payment`, { token: users.b.token, body: { paymentId: 'x' } });
  assert.equal(pay.status, 403);
  const cancel = await api('PATCH', `/bookings/${bookingId}/cancel`, { token: users.b.token });
  assert.equal(cancel.status, 403);
});

test('invoice PDF downloads for the owner and admin only', async () => {
  const res = await fetch(`${BASE}/bookings/${bookingId}/invoice`, { headers: { Authorization: `Bearer ${users.a.token}` } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.match(res.headers.get('content-disposition'), /attachment; filename="Driveaway_Invoice_DA-\d{4}-\d{6}\.pdf"/);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 5000);

  const other = await fetch(`${BASE}/bookings/${bookingId}/invoice`, { headers: { Authorization: `Bearer ${users.b.token}` } });
  assert.equal(other.status, 403);
  const anon = await fetch(`${BASE}/bookings/${bookingId}/invoice`);
  assert.equal(anon.status, 401);
  const asAdmin = await fetch(`${BASE}/bookings/${bookingId}/invoice`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(asAdmin.status, 200);
});

test('owner pays with an online method and gets a server-made pay_ reference', async () => {
  const view = await api('GET', `/bookings/${bookingId}`, { token: users.a.token });
  assert.equal(view.status, 200);
  assert.deepEqual(view.data.allowedNextStatuses, ['Confirmed', 'Cancelled']);
  const pay = await api('PATCH', `/bookings/${bookingId}/payment`, { token: users.a.token, body: { method: 'CARD', paymentId: 'pay_FORGED' } });
  assert.equal(pay.status, 200, JSON.stringify(pay.data));
  assert.equal(pay.data.paymentCompleted, true);
  assert.equal(pay.data.status, 'Confirmed');
  assert.equal(pay.data.paymentMethod, 'Online test (CARD)');
  assert.match(pay.data.paymentId, /^pay_[A-Za-z0-9]{14}$/);
  assert.notEqual(pay.data.paymentId, 'pay_FORGED');
  assert.equal(pay.data.paidAmount, pay.data.totalAmount);
  assert.ok(pay.data.paymentCompletedAt);

  const twice = await api('PATCH', `/bookings/${bookingId}/payment`, { token: users.a.token, body: { method: 'UPI' } });
  assert.equal(twice.status, 400);
  const mine = await api('GET', '/bookings/my', { token: users.a.token });
  const listed = mine.data.find((b) => b._id === bookingId);
  assert.ok(listed);
  assert.deepEqual(listed.allowedNextStatuses, ['Completed', 'Cancelled']);
});

test('owners cannot record non-test payment methods; the older test-method body still works', async () => {
  for (const body of [{ paymentMethod: 'UPI' }, { paymentMethod: 'Card' }, { paymentMethod: 'Cash' }, { method: 'CASH' }, { method: 'Bitcoin' }, {}]) {
    const r = await api('PATCH', `/bookings/${unpaidId}/payment`, { token: users.a.token, body });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  const legacy = await api('PATCH', `/bookings/${unpaidId}/payment`, { token: users.a.token, body: { paymentMethod: 'Online test (UPI)', paymentId: 'pay_FORGED' } });
  assert.equal(legacy.status, 200, JSON.stringify(legacy.data));
  assert.equal(legacy.data.paymentMethod, 'Online test (UPI)');
  assert.match(legacy.data.paymentId, /^pay_[A-Za-z0-9]{14}$/);
  assert.notEqual(legacy.data.paymentId, 'pay_FORGED');
});

test('admin can record cash collected at the hub', async () => {
  const r = await api('PATCH', `/bookings/${bCashId}/payment`, { token: adminToken, body: { method: 'CASH' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.paymentMethod, 'Cash');
  assert.equal(r.data.paymentCompleted, true);
  assert.equal(r.data.status, 'Confirmed');
  assert.equal(r.data.paidAmount, r.data.totalAmount);
});

test('whatsapp invoice ignores phone override from non-admins', async () => {
  const r = await api('GET', `/bookings/${bookingId}/whatsapp?phone=1111111111`, { token: users.a.token });
  assert.equal(r.status, 200);
  assert.notEqual(r.data.phone, '1111111111');
});

test('admin status update validates status values and transitions', async () => {
  const bad = await api('PATCH', `/bookings/${bookingId}/status`, { token: adminToken, body: { status: 'Hacked' } });
  assert.equal(bad.status, 400);
  const backwards = await setStatus(bookingId, 'Pending'); // Confirmed -> Pending
  assert.equal(backwards.status, 400);
  const skip = await setStatus(bPendingId, 'Completed');  // Pending -> Completed
  assert.equal(skip.status, 400);
});

test('admin dashboard and lists load', async () => {
  const dash = await api('GET', '/admin/dashboard', { token: adminToken });
  assert.equal(dash.status, 200);
  assert.ok(typeof dash.data.totalRevenue === 'number');
  for (const key of ['totalBookings', 'activeRentals', 'pendingBookings', 'completedBookings', 'cancelledBookings',
    'totalCars', 'availableCars', 'rentedCars', 'maintenanceCars', 'totalUsers']) {
    assert.equal(typeof dash.data[key], 'number', key);
  }
  assert.equal(dash.data.monthlyRevenue.length, 6);
  assert.ok(dash.data.recentBookings.length <= 10);
  assert.ok(dash.data.topCars.length <= 5);
  // Top cars carry the same effective status as GET /api/cars, not the stored admin setting
  for (const c of dash.data.topCars) {
    assert.equal(typeof c.bookedNow, 'boolean', c.name);
    assert.ok(['Available', 'Maintenance'].includes(c.adminStatus), c.name);
    assert.equal(c.status, c.adminStatus === 'Maintenance' ? 'Maintenance' : c.bookedNow ? 'Rented' : 'Available', c.name);
  }
  const list = await api('GET', '/bookings?search=' + encodeURIComponent('DA-('), { token: adminToken });
  assert.equal(list.status, 200);
  const all = await api('GET', '/bookings?limit=5', { token: adminToken });
  assert.ok(all.data.bookings.every((b) => Array.isArray(b.allowedNextStatuses)));
  const usersList = await api('GET', '/admin/users?search=test_', { token: adminToken });
  assert.equal(usersList.status, 200);
  assert.ok(usersList.data.every((u) => u.password === undefined));
});

test('owner can cancel a paid booking before pickup: refunded and taken out of revenue', async () => {
  const before = await dashboard();
  const r = await api('PATCH', `/bookings/${bookingId}/cancel`, { token: users.a.token, body: { reason: 'test' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.status, 'Cancelled');
  assert.ok(r.data.refundedAt, 'a cancelled paid booking records the simulated refund');
  assert.deepEqual(r.data.allowedNextStatuses, []);
  const afterCancel = await dashboard();
  assert.equal(before.totalRevenue - afterCancel.totalRevenue, r.data.paidAmount);
  // The cancelled dates are free again: gone from the calendar, and someone else can book them
  const car = await api('GET', `/cars/${cars[0]._id}`);
  assert.ok(
    !car.data.car.bookedRanges.some((range) => range.pickupDate === dayIso(2) && range.returnDate === dayIso(4)),
    JSON.stringify(car.data.car.bookedRanges)
  );
  const rebook = await book('c', cars[0], 2, 4);
  assert.equal(rebook.status, 201, JSON.stringify(rebook.data));
  await cancelAll([rebook.data._id]);
  const reopen = await setStatus(bookingId, 'Confirmed'); // Cancelled is final
  assert.equal(reopen.status, 400);
  const again = await api('PATCH', `/bookings/${bookingId}/cancel`, { token: users.a.token });
  assert.equal(again.status, 400);
});

test('reviews require a completed booking and a valid rating', async () => {
  const r = await api('POST', '/reviews', { token: users.a.token, body: { bookingId, rating: 5, reviewText: 'x' } });
  assert.equal(r.status, 400);
  const bad = await api('POST', '/reviews', { token: users.a.token, body: { bookingId, rating: 99 } });
  assert.equal(bad.status, 400);
});

test('more than 3 unpaid bookings per account are refused with 429', async () => {
  const ids = [];
  for (const [from, to] of [[120, 121], [122, 123], [124, 125]]) {
    const r = await book('d', cars[2], from, to);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    ids.push(r.data._id);
  }
  const fourth = await book('d', cars[2], 126, 127);
  assert.equal(fourth.status, 429);
  await cancelAll(ids);
  const afterCancel = await book('d', cars[2], 126, 127);
  assert.equal(afterCancel.status, 201);
  await cancelAll([afterCancel.data._id]);
});

test('simultaneous bookings on different cars cannot go past the unpaid-booking cap', async () => {
  const results = await Promise.all([0, 1, 2, 3].map((i) => book('d', cars[i], 130, 131)));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 201, 201, 429], JSON.stringify(results.map((r) => r.data)));
  await cancelAll(results.filter((r) => r.status === 201).map((r) => r.data._id));
});

test('loyalty points are spent at booking and refunded on cancel', async () => {
  await setPoints('b', 3000); // worth ₹300
  const r = await book('b', cars[1], 60, 62, { useLoyaltyPoints: true });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.loyaltyPointsUsed, 3000);
  assert.equal(r.data.loyaltyDiscount, 300);
  assert.equal(r.data.totalAmount, cars[1].dailyRate * 2 - 300);
  assert.equal(await pointsOf('b'), 0);
  const cancel = await api('PATCH', `/bookings/${r.data._id}/cancel`, { token: users.b.token });
  assert.equal(cancel.status, 200);
  assert.equal(await pointsOf('b'), 3000);
  await setPoints('b', 0);
});

test('loyalty points cannot be spent twice by simultaneous bookings', async () => {
  await setPoints('c', 1000); // worth ₹100
  const results = await Promise.all([
    book('c', cars[2], 70, 72, { useLoyaltyPoints: true }),
    book('c', cars[3], 70, 72, { useLoyaltyPoints: true }),
  ]);
  const created = results.filter((r) => r.status === 201);
  assert.ok(created.length >= 1, JSON.stringify(results.map((r) => r.data)));
  for (const r of results) assert.ok([201, 409].includes(r.status), JSON.stringify(r.data));
  const spent = created.reduce((s, r) => s + r.data.loyaltyPointsUsed, 0);
  assert.ok(spent <= 1000, `spent ${spent}`);
  assert.equal(await pointsOf('c'), 1000 - spent);
  await cancelAll(created.map((r) => r.data._id));
  assert.equal(await pointsOf('c'), 1000);
  await setPoints('c', 0);
});

test('points are earned only when the trip is completed, once; completing records cash and revenue', async () => {
  const before = await dashboard();
  const r = await book('c', cars[4], 80, 83);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const total = r.data.totalAmount;
  assert.equal(await pointsOf('c'), 0, 'no points at creation');

  const confirm = await setStatus(r.data._id, 'Confirmed');
  assert.equal(confirm.status, 200);
  assert.equal(await pointsOf('c'), 0, 'no points on confirm');
  assert.equal((await dashboard()).totalRevenue, before.totalRevenue, 'unpaid cash is not revenue yet');

  const complete = await setStatus(r.data._id, 'Completed');
  assert.equal(complete.status, 200, JSON.stringify(complete.data));
  assert.equal(complete.data.paymentCompleted, true);
  assert.equal(complete.data.paymentMethod, 'Cash');
  assert.equal(complete.data.paidAmount, total);
  assert.equal(complete.data.pointsAwarded, true);
  assert.deepEqual(complete.data.allowedNextStatuses, []);
  assert.equal(await pointsOf('c'), Math.floor(total / 100));

  const again = await setStatus(r.data._id, 'Completed');
  assert.equal(again.status, 400);
  const cancelCompleted = await setStatus(r.data._id, 'Cancelled');
  assert.equal(cancelCompleted.status, 400);
  assert.equal(await pointsOf('c'), Math.floor(total / 100));

  const afterDash = await dashboard();
  assert.equal(afterDash.totalRevenue - before.totalRevenue, total);
  assert.equal(afterDash.completedBookings - before.completedBookings, 1);
  const thisMonth = (d) => d.monthlyRevenue[d.monthlyRevenue.length - 1].revenue;
  assert.equal(thisMonth(afterDash) - thisMonth(before), total);

  // The completed trip can be reviewed; public review data shows the name, never the login username
  const review = await api('POST', '/reviews', { token: users.c.token, body: { bookingId: r.data._id, rating: 4, reviewText: 'Smooth.' } });
  assert.equal(review.status, 201, JSON.stringify(review.data));
  assert.equal(review.data.user.username, undefined);
  const publicReviews = await api('GET', `/reviews/car/${cars[4]._id}`);
  assert.equal(publicReviews.data[0].user.name, 'Test C');
  assert.equal(publicReviews.data[0].user.username, undefined);
  const carPage = await api('GET', `/cars/${cars[4]._id}`);
  assert.equal(carPage.data.reviews[0].user.username, undefined);
  assert.equal(carPage.data.car.totalReviews, 1);
});

test('discount codes: invalid, expired, minimum spend and usage cap are enforced; a cancel gives the use back', async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [expired, minimum, single] = await DiscountCode.create([
    { code: `${CODE_PREFIX}${stamp}EXP`.toUpperCase(), percentageOff: 10, expiresAt: yesterday },
    { code: `${CODE_PREFIX}${stamp}MIN`.toUpperCase(), percentageOff: 10, minAmount: 10000000 },
    { code: `${CODE_PREFIX}${stamp}ONE`.toUpperCase(), percentageOff: 10, maxDiscount: 500, maxUses: 1 },
  ]);

  const unknown = await book('d', cars[5], 90, 92, { discountCode: `${CODE_PREFIX}NOPE${stamp}` });
  assert.equal(unknown.status, 400, 'an unknown code is refused, not silently dropped');
  const exp = await book('d', cars[5], 90, 92, { discountCode: expired.code });
  assert.equal(exp.status, 400);
  assert.match(exp.data.message, /expired/i);
  const min = await book('d', cars[5], 90, 92, { discountCode: minimum.code });
  assert.equal(min.status, 400);
  assert.match(min.data.message, /at least/i);

  const first = await book('d', cars[5], 90, 92, { discountCode: single.code.toLowerCase() });
  assert.equal(first.status, 201, JSON.stringify(first.data));
  const subtotal = cars[5].dailyRate * 2;
  const expectedOff = Math.min(Math.round(subtotal * 0.1), 500);
  assert.equal(first.data.discountCode, single.code);
  assert.equal(first.data.discountAmount, expectedOff);
  assert.equal(first.data.totalAmount, subtotal - expectedOff);
  assert.equal((await DiscountCode.findById(single._id).lean()).usedCount, 1);

  const second = await book('d', cars[5], 94, 96, { discountCode: single.code });
  assert.equal(second.status, 400);
  // Same answer as an unknown code, so booking cannot be used to probe codes
  assert.match(second.data.message, /invalid or expired/i);

  const cancel = await api('PATCH', `/bookings/${first.data._id}/cancel`, { token: users.d.token });
  assert.equal(cancel.status, 200);
  assert.equal((await DiscountCode.findById(single._id).lean()).usedCount, 0);
  const third = await book('d', cars[5], 94, 96, { discountCode: single.code });
  assert.equal(third.status, 201, JSON.stringify(third.data));
  await cancelAll([third.data._id]);
  assert.equal((await DiscountCode.findById(single._id).lean()).usedCount, 0);

  const validateExpired = await api('POST', '/discount/validate', { token: users.d.token, body: { code: expired.code } });
  assert.ok(validateExpired.status >= 400 && validateExpired.status < 500, `validate expired -> ${validateExpired.status}`);
});

test('a once-per-customer code cannot be used twice by simultaneous bookings for different cars', async () => {
  const once = await DiscountCode.create({ code: `${CODE_PREFIX}${stamp}PER1`.toUpperCase(), percentageOff: 10, maxUsesPerUser: 1 });
  const results = await Promise.all([
    book('d', cars[2], 104, 106, { discountCode: once.code }),
    book('d', cars[3], 104, 106, { discountCode: once.code }),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 400], JSON.stringify(results.map((r) => r.data)));
  assert.match(results.find((r) => r.status === 400).data.message, /already used/i);
  assert.equal((await DiscountCode.findById(once._id).lean()).usedCount, 1);
  await cancelAll(results.filter((r) => r.status === 201).map((r) => r.data._id));
});

test('admin deleting an active booking cancels it first: points refunded and the code use given back', async () => {
  const code = await DiscountCode.create({ code: `${CODE_PREFIX}${stamp}DEL`.toUpperCase(), percentageOff: 10, maxUses: 5 });
  await setPoints('d', 2000); // worth ₹200
  const r = await book('d', cars[1], 100, 102, { discountCode: code.code, useLoyaltyPoints: true });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.loyaltyPointsUsed, 2000);
  assert.equal(await pointsOf('d'), 0);
  assert.equal((await DiscountCode.findById(code._id).lean()).usedCount, 1);

  const del = await api('DELETE', `/bookings/${r.data._id}`, { token: adminToken });
  assert.equal(del.status, 200, JSON.stringify(del.data));
  assert.equal(await Booking.findById(r.data._id), null);
  assert.equal(await pointsOf('d'), 2000, 'points refunded');
  assert.equal((await DiscountCode.findById(code._id).lean()).usedCount, 0, 'code use given back');
  await setPoints('d', 0);
});

test('a car booked today shows as Rented with its booked ranges; it cannot be cancelled after pickup', async () => {
  const car = cars[5];
  const r = await book('a', car, 0, 2);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const later = await book('b', car, 30, 33);
  assert.equal(later.status, 201, JSON.stringify(later.data));

  const detail = await api('GET', `/cars/${car._id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.car.status, 'Rented');
  assert.equal(detail.data.car.adminStatus, 'Available');
  assert.equal(detail.data.car.bookedNow, true);
  assert.equal(detail.data.car.nextFreeDate, dayIso(2));
  assert.deepEqual(detail.data.car.bookedRanges.slice(0, 2), [
    { pickupDate: dayIso(0), returnDate: dayIso(2) },
    { pickupDate: dayIso(30), returnDate: dayIso(33) },
  ]);
  assert.equal((await Car.findById(car._id).lean()).status, 'Available', 'stored status is untouched');

  const rented = await api('GET', '/cars?status=Rented&limit=100');
  assert.ok(rented.data.cars.some((c) => c._id === car._id.toString()));
  const available = await api('GET', '/cars?status=Available&limit=100');
  assert.ok(!available.data.cars.some((c) => c._id === car._id.toString()));
  const listed = (await api('GET', '/cars?limit=100')).data.cars.find((c) => c._id === car._id.toString());
  assert.equal(listed?.status, 'Rented');

  const lateCancel = await api('PATCH', `/bookings/${r.data._id}/cancel`, { token: users.a.token });
  assert.equal(lateCancel.status, 400);

  // "Notify me" is offered while the car is out; with email off the alert is kept, not used up
  const notify = await api('POST', `/cars/${car._id}/notify`, { body: { email: `test_alert_${stamp}@example.com` } });
  assert.equal(notify.status, 201, JSON.stringify(notify.data));
  const adminCancel = await setStatus(r.data._id, 'Cancelled');
  assert.equal(adminCancel.status, 200);
  const freed = await api('GET', `/cars/${car._id}`);
  assert.equal(freed.data.car.status, 'Available');
  assert.equal(freed.data.car.nextFreeDate, null);
  await sleep(300);
  const alert = await CarAlert.findOne({ car: car._id, email: `test_alert_${stamp}@example.com` }).lean();
  assert.equal(alert.notified, false);
  await cancelAll([later.data._id]);
});

test('maintenance: booking refused, notify offered, Available again via the admin', async () => {
  const notify = await api('POST', `/cars/${maintenanceCar._id}/notify`, { body: { email: `test_alert2_${stamp}@example.com` } });
  assert.equal(notify.status, 201);
  const detail = await api('GET', `/cars/${maintenanceCar._id}`);
  assert.equal(detail.data.car.status, 'Maintenance');
  const back = await api('PATCH', `/cars/${maintenanceCar._id}/status`, { token: adminToken, body: { status: 'Available' } });
  assert.equal(back.status, 200);
  assert.equal(back.data.status, 'Available');
  const rented = await api('PATCH', `/cars/${maintenanceCar._id}/status`, { token: adminToken, body: { status: 'Rented' } });
  assert.equal(rented.status, 400);
});

test('deleting a customer: refused with an active booking, then removes reviews and anonymises bookings', async () => {
  const car = cars[3];
  // A finished, reviewed trip
  const done = await book('f', car, 150, 152, { licenseNumber: 'GJ01 2020 1234567', address: '1 Test Road', idProofNumber: 'X123' });
  assert.equal(done.status, 201, JSON.stringify(done.data));
  assert.equal((await setStatus(done.data._id, 'Confirmed')).status, 200);
  assert.equal((await setStatus(done.data._id, 'Completed')).status, 200);
  const review = await api('POST', '/reviews', { token: users.f.token, body: { bookingId: done.data._id, rating: 2 } });
  assert.equal(review.status, 201);
  assert.equal((await Car.findById(car._id).lean()).totalReviews, 1);

  // And an upcoming one
  const upcoming = await book('f', car, 160, 162);
  assert.equal(upcoming.status, 201);
  const refused = await api('DELETE', `/admin/users/${users.f.id}`, { token: adminToken });
  assert.equal(refused.status, 409);

  assert.equal((await setStatus(upcoming.data._id, 'Cancelled')).status, 200);
  const del = await api('DELETE', `/admin/users/${users.f.id}`, { token: adminToken });
  assert.equal(del.status, 200, JSON.stringify(del.data));
  assert.equal(await User.findById(users.f.id), null);
  const kept = await Booking.findById(done.data._id).lean();
  assert.ok(kept, 'bookings stay for the records');
  assert.equal(kept.customerName, 'Deleted customer');
  for (const field of ['customerEmail', 'customerPhone', 'licenseNumber', 'address', 'idProofNumber']) {
    assert.equal(kept[field], undefined, field);
  }
  assert.equal(await Review.countDocuments({ user: users.f.id }), 0);
  const carAfter = await Car.findById(car._id).lean();
  assert.equal(carAfter.totalReviews, 0);
  assert.equal(carAfter.averageRating, 0);
});

// ───────────────────────── Public forms ─────────────────────────
test('contact form validates input', async () => {
  const missing = await api('POST', '/contact', { body: { name: 'A' } });
  assert.equal(missing.status, 400);
  const badEmail = await api('POST', '/contact', { body: { name: 'A', email: '<script>@x', message: 'hi' } });
  assert.equal(badEmail.status, 400);
  const tooLong = await api('POST', '/contact', { body: { name: 'A', email: 'a@example.com', message: 'x'.repeat(5000) } });
  assert.equal(tooLong.status, 400);
});

test('discount endpoints validate input', async () => {
  const sub = await api('POST', '/discount/subscribe', { body: { email: 'nope' } });
  assert.equal(sub.status, 400);
  const val = await api('POST', '/discount/validate', { token: users.a.token, body: { code: 'DEFINITELY_NOT_A_CODE' } });
  assert.ok(val.status >= 400 && val.status < 500, `validate unknown -> ${val.status}`);
  const badCreate = await api('POST', '/discount', { token: adminToken, body: { code: 'BAD', percentageOff: 500 } });
  assert.equal(badCreate.status, 400);
});

test('admin can create, use, toggle and delete a discount code', async () => {
  const code = `${CODE_PREFIX}${stamp}`.toUpperCase().slice(0, 20);
  const create = await api('POST', '/discount', { token: adminToken, body: { code, percentageOff: 10, maxDiscount: 500, notifyUsers: false } });
  assert.equal(create.status, 201, JSON.stringify(create.data));
  const id = create.data.discount._id;
  try {
    const valid = await api('POST', '/discount/validate', { token: users.b.token, body: { code: code.toLowerCase() } });
    assert.equal(valid.status, 200);
    assert.equal(valid.data.percentageOff, 10);
    const off = await api('PATCH', `/discount/${id}/toggle`, { token: adminToken });
    assert.equal(off.data.discount.isActive, false);
    const invalid = await api('POST', '/discount/validate', { token: users.b.token, body: { code } });
    assert.ok(invalid.status >= 400 && invalid.status < 500, `validate inactive -> ${invalid.status}`);
  } finally {
    const del = await api('DELETE', `/discount/${id}`, { token: adminToken });
    assert.equal(del.status, 200);
  }
});

// ───────────────────────── Health check ─────────────────────────
test('health check reports the database as up and is never cached', async () => {
  const r = await api('GET', '/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { status: 'ok', db: 'up' });
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

// ───────────────────────── Password reset and change ─────────────────────────
// Forgot and reset share a limit of 8 requests per 15 minutes, so these tests make 7 between them.
const FORGOT_MESSAGE = 'If an account exists for that email, a reset link is on its way.';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const resetToken = () => crypto.randomBytes(32).toString('hex');
const NEW_PW = `N${crypto.randomBytes(9).toString('hex')}4`;
const NEWER_PW = `M${crypto.randomBytes(9).toString('hex')}5`;

test('forgot-password answers 200 with the same message for known and unknown emails', async () => {
  const known = await api('POST', '/auth/forgot-password', { body: { email: users.b.email } });
  const unknown = await api('POST', '/auth/forgot-password', { body: { email: `test_nobody_${stamp}@example.com` } });
  for (const r of [known, unknown]) {
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.deepEqual(r.data, { message: FORGOT_MESSAGE });
  }
  // Only the hash of the emailed token is stored, with an expiry about 30 minutes out
  const stored = await User.findById(users.b.id).select('+passwordResetTokenHash +passwordResetExpires').lean();
  assert.match(stored.passwordResetTokenHash, /^[a-f0-9]{64}$/);
  const minutesLeft = (new Date(stored.passwordResetExpires) - Date.now()) / 60000;
  assert.ok(minutesLeft > 25 && minutesLeft <= 30, `expires in ${minutesLeft} min`);
});

test('password reset: invalid and expired tokens are refused; a valid one works once and signs out old sessions', async () => {
  const email = `test_g_${stamp}@example.com`;
  const reg = await api('POST', '/auth/register', { body: { username: `test_g_${stamp}`, name: 'Test G', email, password: PW } });
  assert.equal(reg.status, 201, JSON.stringify(reg.data));
  users.g = { token: reg.data.token, id: reg.data.user._id, email };
  const setReset = (token, expires) => User.updateOne(
    { _id: users.g.id },
    { $set: { passwordResetTokenHash: sha256(token), passwordResetExpires: expires } }
  );

  const expiredToken = resetToken();
  await setReset(expiredToken, new Date(Date.now() - 60 * 1000));
  const expired = await api('POST', `/auth/reset-password/${expiredToken}`, { body: { password: NEW_PW } });
  assert.equal(expired.status, 400);
  const malformed = await api('POST', '/auth/reset-password/not-a-real-token', { body: { password: NEW_PW } });
  assert.equal(malformed.status, 400);
  const unknown = await api('POST', `/auth/reset-password/${resetToken()}`, { body: { password: NEW_PW } });
  assert.equal(unknown.status, 400);

  const token = resetToken();
  await setReset(token, new Date(Date.now() + 30 * 60 * 1000));
  await sleep(1100); // the registration token must be from an earlier second than the reset
  const ok = await api('POST', `/auth/reset-password/${token}`, { body: { password: NEW_PW } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const reused = await api('POST', `/auth/reset-password/${token}`, { body: { password: NEWER_PW } });
  assert.equal(reused.status, 400, 'a reset link works only once');

  const stored = await User.findById(users.g.id).select('+passwordResetTokenHash +passwordResetExpires').lean();
  assert.equal(stored.passwordResetTokenHash, undefined);
  assert.equal(stored.passwordResetExpires, undefined);
  assert.ok(stored.passwordChangedAt);

  const oldSession = await api('GET', '/auth/me', { token: users.g.token });
  assert.equal(oldSession.status, 401);
  const login = await api('POST', '/auth/login', { body: { email, password: NEW_PW } });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  users.g.token = login.data.token;
});

test('changing the password rejects older tokens; the token it returns works', async () => {
  const oldToken = users.g.token;
  await sleep(1100); // older token from an earlier second than the change
  const r = await api('PUT', '/auth/password', { token: oldToken, body: { oldPassword: NEW_PW, newPassword: NEWER_PW } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.token && r.data.token !== oldToken);
  assert.equal((await api('GET', '/auth/me', { token: oldToken })).status, 401);
  const fresh = await api('GET', '/auth/me', { token: r.data.token });
  assert.equal(fresh.status, 200);
  assert.equal(fresh.data.email, users.g.email);
});

// ───────────────────────── Uploads ─────────────────────────
// A 1x1 PNG
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const uploadForm = (bytes = PIXEL_PNG, type = 'image/png', name = 'pixel.png') => {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type }), name);
  return form;
};
const upload = (token, form) => fetch(`${BASE}/upload`, {
  method: 'POST',
  headers: token ? { Authorization: `Bearer ${token}` } : {},
  body: form,
});

test('uploads: an admin image is stored in MongoDB and served back with its type; others are refused', async () => {
  assert.equal((await upload(null, uploadForm())).status, 401);
  assert.equal((await upload(users.a.token, uploadForm())).status, 403);
  const svg = await upload(adminToken, uploadForm(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml', 'x.svg'));
  assert.equal(svg.status, 400, 'svg is not on the allow-list');

  const res = await upload(adminToken, uploadForm());
  const data = await res.json();
  assert.equal(res.status, 200, JSON.stringify(data));
  assert.equal(data.success, true);
  const match = /^https?:\/\/[^/]+\/api\/uploads\/([a-f0-9]{24})$/.exec(data.url);
  assert.ok(match, `absolute /api/uploads/<id> URL expected, got ${data.url}`);
  assert.equal((await Upload.findById(match[1]).lean()).size, PIXEL_PNG.length);

  const img = await fetch(`${BASE}/uploads/${match[1]}`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
  assert.match(img.headers.get('cache-control') || '', /immutable/);
  assert.ok(Buffer.from(await img.arrayBuffer()).equals(PIXEL_PNG), 'the same bytes come back');
  // A browser that already has it gets a 304 (answered without reading the image from the database)
  const etag = img.headers.get('etag');
  assert.equal(etag, `"${match[1]}"`);
  const revalidated = await new Promise((resolve, reject) => {
    http.get(`${BASE}/uploads/${match[1]}`, { headers: { 'If-None-Match': etag } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject);
  });
  assert.equal(revalidated, 304);

  assert.equal((await fetch(`${BASE}/uploads/${'0'.repeat(24)}`)).status, 404);
  assert.equal((await fetch(`${BASE}/uploads/not-an-id`)).status, 404);
});

test('deleting a car removes the photos it uploaded, unless another car still shows them', async () => {
  const send = async () => {
    const res = await upload(adminToken, uploadForm());
    assert.equal(res.status, 200);
    return (await res.json()).url;
  };
  const [own, shared] = [await send(), await send()];
  const idOf = (url) => url.split('/').pop();
  const make = (name, images) => api('POST', '/cars', {
    token: adminToken,
    body: { name: `${name} ${stamp}`, company: TEST_COMPANY, type: 'Sedan', dailyRate: 1500, images },
  });
  const first = await make('Photo Car', { main: own, img1: shared });
  assert.equal(first.status, 201, JSON.stringify(first.data));
  const second = await make('Photo Twin', { main: shared });
  assert.equal(second.status, 201, JSON.stringify(second.data));

  const del = await api('DELETE', `/cars/${first.data._id}`, { token: adminToken });
  assert.equal(del.status, 200);
  await sleep(300); // the clean-up runs after the response
  assert.equal(await Upload.exists({ _id: idOf(own) }), null, 'a photo no car shows any more is removed');
  assert.ok(await Upload.exists({ _id: idOf(shared) }), 'a photo another car still shows is kept');
  assert.equal((await api('DELETE', `/cars/${second.data._id}`, { token: adminToken })).status, 200);
});

// ───────────────────────── Offers: validate, broadcast, unsubscribe ─────────────────────────
test('discount validate: expired and used-up codes get the same 404 as an unknown code', async () => {
  const [expired, usedUp, live] = await DiscountCode.create([
    { code: `${CODE_PREFIX}${stamp}VEXP`.toUpperCase(), percentageOff: 10, expiresAt: new Date(Date.now() - 60 * 1000) },
    { code: `${CODE_PREFIX}${stamp}VUSED`.toUpperCase(), percentageOff: 10, maxUses: 2, usedCount: 2 },
    { code: `${CODE_PREFIX}${stamp}VLIVE`.toUpperCase(), percentageOff: 10, maxDiscount: 300, minAmount: 1000 },
  ]);
  const validate = (code, subtotal) => api('POST', '/discount/validate', { token: users.b.token, body: { code, subtotal } });

  const unknown = await validate(`${CODE_PREFIX}NOPE${stamp}`);
  assert.equal(unknown.status, 404);
  for (const code of [expired.code, usedUp.code]) {
    const r = await validate(code);
    assert.equal(r.status, 404, code);
    assert.deepEqual(r.data, unknown.data, 'no hint that the code exists');
  }

  const ok = await validate(live.code.toLowerCase(), 5000);
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.code, live.code);
  assert.equal(ok.data.amount, 300, '10% of 5000 is 500, capped at 300');
  assert.equal(ok.data.minAmount, 1000);
  const tooSmall = await validate(live.code, 500);
  assert.equal(tooSmall.status, 400);
  assert.match(tooSmall.data.message, /at least/i);
});

test('broadcast is refused for an inactive code, and for non-admins', async () => {
  const off = await DiscountCode.create({ code: `${CODE_PREFIX}${stamp}OFF`.toUpperCase(), percentageOff: 10, isActive: false });
  const r = await api('POST', `/discount/broadcast/${off._id}`, { token: adminToken, body: {} });
  assert.equal(r.status, 400, JSON.stringify(r.data));
  assert.match(r.data.message, /activate/i);
  const asUser = await api('POST', `/discount/broadcast/${off._id}`, { token: users.a.token, body: {} });
  assert.equal(asUser.status, 403);
});

test('unsubscribe link: forged tokens are refused; the real one opts the address out', async () => {
  const email = users.b.email;
  await DiscountSubscriber.create({ email, isActive: true });
  const link = (address, token) => fetch(`${BASE}/discount/unsubscribe?email=${encodeURIComponent(address)}&token=${token}`);
  // The token is HMAC-SHA256(lowercased email) keyed with JWT_SECRET, which the test server shares
  const tokenFor = (address) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(address.toLowerCase()).digest('hex');

  for (const token of ['0'.repeat(64), tokenFor(users.a.email), 'abc']) {
    const forged = await link(email, token);
    assert.equal(forged.status, 400, token);
    assert.match(forged.headers.get('content-type') || '', /text\/html/);
  }
  assert.equal((await DiscountSubscriber.findOne({ email }).lean()).isActive, true, 'still subscribed');

  const real = await link(email.toUpperCase(), tokenFor(email));
  assert.equal(real.status, 200);
  assert.match(real.headers.get('content-type') || '', /text\/html/);
  assert.equal((await DiscountSubscriber.findOne({ email }).lean()).isActive, false);
  assert.equal((await User.findById(users.b.id).lean()).marketingOptOut, true);
});

test('an opt-out is only undone by its owner or the emailed confirmation link, never by someone typing the address', async () => {
  const email = users.b.email; // unsubscribed by the previous test
  const optedOut = async () => {
    const [sub, account] = await Promise.all([DiscountSubscriber.findOne({ email }).lean(), User.findById(users.b.id).lean()]);
    return !sub.isActive && account.marketingOptOut === true;
  };

  const stranger = await api('POST', '/discount/subscribe', { body: { email } });
  assert.equal(stranger.status, 200, JSON.stringify(stranger.data));
  assert.equal(stranger.data.confirmationSent, true);
  assert.ok(await optedOut(), 'still unsubscribed');

  // The confirmation link: its own HMAC key, so an unsubscribe token does not work here
  const link = (token) => fetch(`${BASE}/discount/resubscribe?email=${encodeURIComponent(email)}&token=${token}`);
  const unsubscribeToken = crypto.createHmac('sha256', process.env.JWT_SECRET).update(email).digest('hex');
  const resubscribeToken = crypto.createHmac('sha256', `resubscribe|${process.env.JWT_SECRET}`).update(email).digest('hex');
  assert.equal((await link(unsubscribeToken)).status, 400);
  assert.ok(await optedOut(), 'still unsubscribed');
  const confirmed = await link(resubscribeToken);
  assert.equal(confirmed.status, 200);
  assert.match(confirmed.headers.get('content-type') || '', /text\/html/);
  assert.equal((await DiscountSubscriber.findOne({ email }).lean()).isActive, true);
  assert.equal((await User.findById(users.b.id).lean()).marketingOptOut, false);

  // Opted out again; the signed-in owner can subscribe straight back
  assert.equal((await fetch(`${BASE}/discount/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken}`)).status, 200);
  assert.ok(await optedOut());
  const owner = await api('POST', '/discount/subscribe', { token: users.b.token, body: { email } });
  assert.equal(owner.status, 200, JSON.stringify(owner.data));
  assert.equal(owner.data.confirmationSent, undefined);
  assert.equal((await DiscountSubscriber.findOne({ email }).lean()).isActive, true);
  assert.equal((await User.findById(users.b.id).lean()).marketingOptOut, false);
});
