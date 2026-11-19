# 🚗 Driveaway — Premium Car Rental Platform

**Ahmedabad's premier car rental web application.** Built as a full-stack MERN project for Semester 5.

It is a demonstration project: online payment is a simulated, clearly labelled **test checkout**.
No payment provider is involved and no money is charged.

---

## 📋 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, Tailwind CSS (dark/light), Framer Motion, Lucide React, Axios, react-hot-toast |
| Backend | Node.js 22+, Express, Mongoose, JWT (jsonwebtoken), bcryptjs, compression |
| Security | helmet (HTTP headers), express-rate-limit, CORS allow-list, input sanitising, Content-Security-Policy on Vercel |
| Database | MongoDB: a local server for development, MongoDB Atlas in production |
| Uploads | multer (in memory), images stored in MongoDB |
| PDF invoices | jsPDF + jspdf-autotable, generated on the server |
| Email | Brevo HTTP API, or Gmail SMTP through Nodemailer |
| Tests | Node's built-in test runner (`node:test`), end-to-end against a separate test database |
| Hosting | Vercel (website), Render free plan (API), MongoDB Atlas M0 (database). See [DEPLOY.md](DEPLOY.md) |

---

## ✨ Features

### For customers

- **Fleet of 48 cars**: six each of Hypercar, Supercar, Luxury, SUV, Electric, Sports, Sedan and Hatchback.
  Filter by type, fuel, gearbox and price, search and sort; the filters stay in the page address.
- **Car pages** with a photo gallery (Wikimedia Commons photos, credited), specs and reviews.
- **Date-based availability.** A car is only unavailable for the dates already held by a Pending or
  Confirmed booking, or while an admin has it in maintenance. A car booked today shows "Booked until …"
  and can still be booked for later dates. Days are calendar days in India time (IST); a car returned
  on a day can be picked up by someone else that same day. Pickup up to 180 days ahead, trips up to 90 days.
- **"Notify me when available"** email alerts for cars that are booked right now or in maintenance.
- **3-step booking** (trip, driver, confirm). The server works out every price: days × daily rate,
  promo code and loyalty points.
- **Paying.** The booking is saved first (Pending, unpaid). Then either pay cash at the pickup hub, or use
  the test checkout: the site sends only the chosen test method, and the **server** records the payment,
  makes its `pay_TEST_…` reference and confirms the booking. The card details shown are fixed test values.
  An account can hold at most 3 unpaid upcoming bookings.
- **Cancelling** is possible up to the day before pickup. Used loyalty points come back, the promo code use is
  released, and a paid test payment is marked as refunded (simulated).
- **Loyalty points**: 1 point per ₹100 of the final fare, credited once when the trip is completed;
  10 points = ₹1 off, up to 50% of a fare.
- **Promo codes** can have a cap, a minimum booking amount, an expiry date, a total number of uses and a
  per-customer limit. A code that doesn't apply is refused with the reason, never silently dropped.
- **Invoices**: a PDF made on the server (also attached to the booking confirmation email) and a WhatsApp
  message. Booking, payment and status emails go to the account's email address.
- **Accounts**: register, sign in, profile, change password (signs out other sessions) and **forgot password**
  (an emailed link valid for 30 minutes; outside production the link is also printed in the server console).
- **Offer emails**: subscribe to new promo codes; every offer email has a one-click unsubscribe link.
- Rental terms and privacy pages, dark and light themes, and a "waking up the server" banner when the
  free API host is starting up.

### For admins

- **Dashboard**: collected revenue (payments received, cancelled bookings excluded), monthly revenue,
  booking counts, top cars and recent bookings.
- **Fleet**: add, edit and delete cars, set them Available or in Maintenance, upload photos
  (JPEG, PNG, WebP, AVIF or GIF, up to 5 MB each). Uploads are stored in MongoDB, so they survive restarts.
- **Bookings**: only valid steps are offered (Pending → Confirmed or Cancelled, Confirmed → Completed or
  Cancelled), each with a confirmation that says what will happen. "Mark cash collected" records a hub
  payment; completing an unpaid booking records it as paid in cash.
- **Customers**: deleting one is refused while they have a Pending or Confirmed booking that hasn't ended;
  otherwise their reviews, alerts and offer subscription are removed and their past bookings are kept with
  personal details erased.
- **Promo codes** with the limits above, and an email broadcast to subscribers and customers who haven't opted out.
- **Contact messages**, and an email status card with a **Send test email** button.

---

## 🚀 Quick Start

You need **Node.js 22 or newer** (development, CI and Render use 24) and **MongoDB**: either MongoDB Community Server on
your computer (default port 27017) or a free MongoDB Atlas cluster.

### 1. Install Dependencies

```bash
npm install
npm --prefix server install
```

### 2. Create `server/.env`

```bash
cp server/.env.example server/.env
```

(PowerShell: `Copy-Item server/.env.example server/.env`)

Then edit `server/.env`:

- `JWT_SECRET`: required, at least 16 characters. Make one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `MONGO_URI`: `mongodb://127.0.0.1:27017/driveaway` for a local MongoDB (the default), or your Atlas
  connection string.
- Email settings are optional. Without them the site works and simply sends no email.

The website itself needs no `.env` locally: Vite forwards `/api` to the API on port 5000.

### 3. Start MongoDB

Start it yourself; nothing in this project starts it for you. If you installed MongoDB as a Windows
service it is usually already running. Otherwise run `mongod --dbpath <some folder>`, or use Atlas.

### 4. Fill the Database (first time)

```bash
npm run seed
```

This creates:
- 👤 An admin (`admin@driveaway.com`) and a demo customer (`customer@example.com`). Their passwords are
  random and printed once when seeding, or set your own with `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` in `server/.env`.
- 🚗 The 48-car fleet from `server/data/fleet.js`, each car with four photos and their credits
- 🎟️ Discount codes: `DRIVEAWAY20`, `NEWUSER10`, `AHMEDABAD15`
- 📋 3 sample bookings, 1 review and 2 contact messages

### 5. Run the API and the Website

```bash
npm run dev:all
```

This starts:
- ⚙️ **Backend Express Server on Port 5000** (restarts on changes)
- 🎨 **Frontend Vite App on Port 5173**: open <http://localhost:5173>

`npm run server` and `npm run dev` start them one at a time. The API connects to MongoDB before it
accepts requests, and stops with a clear message if `JWT_SECRET` or `MONGO_URI` is missing or MongoDB
can't be reached. `GET /api/health` answers `{"status":"ok","db":"up"}` while the database is connected.

---

## 🌱 Re-seeding and Updating the Fleet

The seed **deletes** every user, car, booking, review, discount code, contact message, car alert,
newsletter subscriber and uploaded photo in the target database before filling it. So it has a guard:

- It first prints the target host, the database name and what the database contains.
- It refuses, changing nothing, when the database already has users or bookings, or when it is a remote
  database (such as Atlas) that is not empty. A completely empty database is always fine.
- To wipe and re-seed anyway, set `SEED_CONFIRM` to the database's name for that one run:

```bash
SEED_CONFIRM=driveaway npm run seed                                          # bash
$env:SEED_CONFIRM="driveaway"; npm run seed; Remove-Item Env:SEED_CONFIRM    # PowerShell
```

To change the cars without touching users and bookings, edit `server/data/fleet.js` and run, from `server/`:

```bash
node scripts/syncFleet.js --dry-run   # show what would change, write nothing
node scripts/syncFleet.js             # add missing cars, update their specs
```

By default it keeps prices and photos an admin changed, and keeps cars that are not in the fleet data.
`--overwrite-prices` and `--overwrite-photos` replace them with the fleet data; `--prune` deletes cars that
are not in the fleet data, except any car that has ever been booked.

### Fleet photos (needs Python 3)

`server/data/fleetPhotos.json` holds four Wikimedia Commons photos per car with author and licence.
To pick them again (for example after adding a car), from `server/`:

```bash
node -e "console.log(JSON.stringify(require('./data/fleet.js')))" > data/fleet.json
python -I scripts/fetchFleetPhotos.py data/fleet.json data/fleetPhotos.json
```

Then run `node scripts/syncFleet.js --overwrite-photos` to use the new photos in an existing database.

---

## 🧪 Tests

```bash
cd server
npm test
```

The end-to-end suite starts its own copy of the API on a free port, with email turned off, and runs
against a **separate test database**:

- It uses `TEST_MONGO_URI` (default `mongodb://127.0.0.1:27017/driveaway_test`), never `MONGO_URI`.
  The database name must contain `test`, and a non-local host is refused unless `ALLOW_REMOTE_TEST_DB=yes`.
- It creates its own users, cars and codes and removes them afterwards, so no seed is needed.
- It needs MongoDB running and a `JWT_SECRET` (from `server/.env` or the environment).
  `TEST_PORT` pins the port if you need to.

It covers sign-in and admin protection, server-side prices, payments that can't be forged, double
bookings (including simultaneous ones), loyalty points, promo code limits, cancelling, maintenance,
customer deletion, invoices and input validation.

For the website: `npm run lint` and `npm run build`.

---

## ☁️ Deployment

The live demo runs on Vercel (website), Render's free plan (API) and MongoDB Atlas (database).
Step-by-step instructions are in [DEPLOY.md](DEPLOY.md).
