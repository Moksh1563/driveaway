/**
 * End-to-end API tests (security + core flows).
 * Run with:  cd server && npm test
 *
 * Starts its own server on TEST_PORT against the database in server/.env,
 * with email sending disabled. Creates temporary users/bookings and removes them afterwards.
 * Creates its own temporary admin (random password) directly in the database, so no
 * real password is needed or stored here.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const PORT = process.env.TEST_PORT || 5055;
const BASE = `http://127.0.0.1:${PORT}/api`;
const stamp = Date.now().toString(36);
// Throwaway passwords made fresh for every run (letters + digits, so they pass the password rule)
const PW = `T${crypto.randomBytes(9).toString('hex')}9`;
const ADMIN = { email: `test_admin_${stamp}@example.com`, password: `A${crypto.randomBytes(9).toString('hex')}7` };
let tempAdminId;

let server;
let adminToken;
const users = {}; // a, b -> { token, id, email }
const created = { bookings: [], users: [] };

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

const isoDay = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), EMAIL_USER: '', EMAIL_PASS: '', BREVO_API_KEY: '', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  // wait for server + DB
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`);
      if (r.ok && log.includes('MongoDB Connected')) break;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  assert.ok(process.env.MONGO_URI, 'Set MONGO_URI in server/.env');
  await mongoose.connect(process.env.MONGO_URI);
  const admin = await User.create({
    username: `test_admin_${stamp}`, name: 'Test Admin', email: ADMIN.email, role: 'admin',
    password: await bcrypt.hash(ADMIN.password, 10),
  });
  tempAdminId = admin._id;

  const login = await api('POST', '/auth/login', { body: ADMIN });
  assert.equal(login.status, 200, `temporary admin login failed. ${JSON.stringify(login.data)}`);
  adminToken = login.data.token;

  for (const key of ['a', 'b']) {
    const email = `test_${key}_${stamp}@example.com`;
    const r = await api('POST', '/auth/register', {
      body: { username: `test_${key}_${stamp}`, name: `Test ${key.toUpperCase()}`, email, phone: '9876543210', password: PW },
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    users[key] = { token: r.data.token, id: r.data.user._id, email };
    created.users.push(r.data.user._id);
  }
});

after(async () => {
  try {
    for (const id of created.bookings) {
      await api('PATCH', `/bookings/${id}/status`, { token: adminToken, body: { status: 'Cancelled' } });
      await api('DELETE', `/bookings/${id}`, { token: adminToken });
    }
    for (const id of created.users) await api('DELETE', `/admin/users/${id}`, { token: adminToken });
  } finally {
    if (tempAdminId) await User.deleteOne({ _id: tempAdminId });
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

// ───────────────────────── Auth ─────────────────────────
test('register rejects weak passwords and bad emails', async () => {
  const weak = await api('POST', '/auth/register', { body: { username: `w_${stamp}`, name: 'W', email: `w_${stamp}@example.com`, password: '123' } });
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
let bookingId;
let carId;

test('booking validation: past dates and reversed dates are rejected', async () => {
  const cars = await api('GET', '/cars?status=Available&limit=1');
  assert.ok(cars.data.cars.length > 0, 'need at least one Available car');
  carId = cars.data.cars[0]._id;
  const past = await api('POST', '/bookings', { token: users.a.token, body: { car: carId, pickupDate: isoDay(-5), returnDate: isoDay(-2), paymentMethod: 'Cash' } });
  assert.equal(past.status, 400);
  const reversed = await api('POST', '/bookings', { token: users.a.token, body: { car: carId, pickupDate: isoDay(5), returnDate: isoDay(3), paymentMethod: 'Cash' } });
  assert.equal(reversed.status, 400);
  const badMethod = await api('POST', '/bookings', { token: users.a.token, body: { car: carId, pickupDate: isoDay(3), returnDate: isoDay(5), paymentMethod: 'Bitcoin' } });
  assert.equal(badMethod.status, 400);
});

test('booking is created with a server-calculated price', async () => {
  const car = (await api('GET', `/cars/${carId}`)).data.car;
  const r = await api('POST', '/bookings', {
    token: users.a.token,
    body: { car: carId, pickupDate: isoDay(2), returnDate: isoDay(4), pickupLocation: 'SG Highway', paymentMethod: 'Cash', totalAmount: 1 },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  bookingId = r.data._id;
  created.bookings.push(bookingId);
  assert.equal(r.data.totalDays, 2);
  assert.equal(r.data.totalAmount, car.dailyRate * 2);
  assert.equal(r.data.status, 'Pending');
  assert.match(r.data.invoiceNumber, /^DA-\d{4}-\d{6}$/);
});

test('car cannot be double-booked', async () => {
  const r = await api('POST', '/bookings', { token: users.b.token, body: { car: carId, pickupDate: isoDay(2), returnDate: isoDay(4), paymentMethod: 'Cash' } });
  assert.equal(r.status, 400);
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

test('owner can view and pay their booking', async () => {
  const view = await api('GET', `/bookings/${bookingId}`, { token: users.a.token });
  assert.equal(view.status, 200);
  const pay = await api('PATCH', `/bookings/${bookingId}/payment`, { token: users.a.token, body: { paymentId: 'pay_test', paymentMethod: 'UPI' } });
  assert.equal(pay.status, 200);
  assert.equal(pay.data.paymentCompleted, true);
  assert.equal(pay.data.status, 'Confirmed');
  const mine = await api('GET', '/bookings/my', { token: users.a.token });
  assert.ok(mine.data.some((b) => b._id === bookingId));
});

test('whatsapp invoice ignores phone override from non-admins', async () => {
  const r = await api('GET', `/bookings/${bookingId}/whatsapp?phone=1111111111`, { token: users.a.token });
  assert.equal(r.status, 200);
  assert.notEqual(r.data.phone, '1111111111');
});

test('admin status update validates status values', async () => {
  const bad = await api('PATCH', `/bookings/${bookingId}/status`, { token: adminToken, body: { status: 'Hacked' } });
  assert.equal(bad.status, 400);
});

test('admin dashboard and lists load', async () => {
  const dash = await api('GET', '/admin/dashboard', { token: adminToken });
  assert.equal(dash.status, 200);
  assert.ok(typeof dash.data.totalRevenue === 'number');
  const list = await api('GET', '/bookings?search=' + encodeURIComponent('DA-('), { token: adminToken });
  assert.equal(list.status, 200);
  const usersList = await api('GET', '/admin/users?search=test_', { token: adminToken });
  assert.equal(usersList.status, 200);
  assert.ok(usersList.data.every((u) => u.password === undefined));
});

test('owner can cancel and the car becomes available again', async () => {
  const r = await api('PATCH', `/bookings/${bookingId}/cancel`, { token: users.a.token, body: { reason: 'test' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'Cancelled');
  const car = await api('GET', `/cars/${carId}`);
  assert.equal(car.data.car.status, 'Available');
});

test('reviews require a completed booking and a valid rating', async () => {
  const r = await api('POST', '/reviews', { token: users.a.token, body: { bookingId, rating: 5, reviewText: 'x' } });
  assert.equal(r.status, 400);
  const bad = await api('POST', '/reviews', { token: users.a.token, body: { bookingId, rating: 99 } });
  assert.equal(bad.status, 400);
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
  assert.equal(val.status, 404);
  const badCreate = await api('POST', '/discount', { token: adminToken, body: { code: 'BAD', percentageOff: 500 } });
  assert.equal(badCreate.status, 400);
});

test('admin can create, use, toggle and delete a discount code', async () => {
  const code = `T${stamp}`.toUpperCase().slice(0, 20);
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
    assert.equal(invalid.status, 404);
  } finally {
    const del = await api('DELETE', `/discount/${id}`, { token: adminToken });
    assert.equal(del.status, 200);
  }
});

test('cancelled bookings are excluded from revenue', async () => {
  const dash = await api('GET', '/admin/dashboard', { token: adminToken });
  const own = await api('GET', `/bookings?limit=100`, { token: adminToken });
  const expected = own.data.bookings
    .filter((b) => b.paymentCompleted && b.status !== 'Cancelled')
    .reduce((s, b) => s + (b.totalAmount || 0), 0);
  if (own.data.total <= 100) assert.equal(dash.data.totalRevenue, Math.round(expected));
});
