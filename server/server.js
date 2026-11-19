/**
 * ============================================================================
 * DRIVEAWAY BACKEND SERVER
 * ============================================================================
 * Express.js API server for Driveaway Car Rentals (Ahmedabad, Gujarat).
 * Provides RESTful endpoints for authentication, cars fleet, reservations,
 * reviews, a simulated test checkout, image uploads, and discount broadcasting.
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { disconnectDB } = require('./config/db');
const { sanitizeInput, isAllowedOrigin, clientUrl } = require('./middleware/securityMiddleware');
const { isDbUnavailable, DB_DOWN_MESSAGE } = require('./utils/handleError');

// Load environment variables (.env)
dotenv.config();

// Refuse to start without a strong JWT secret — a missing/weak secret lets anyone forge admin tokens
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('❌ JWT_SECRET is missing or too short (min 16 chars). Set it in server/.env');
  process.exit(1);
}

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Without CLIENT_URL, links in emails fall back to a guess; say so loudly instead of failing silently
if (isProd && !process.env.CLIENT_URL) {
  console.warn(`⚠️ CLIENT_URL is not set. Links in emails will point to ${clientUrl()}. Set it to your website's URL.`);
}

app.disable('x-powered-by');
app.set('trust proxy', 1); // correct client IPs behind Render/Vercel proxies (used by rate limiter)

// Secure HTTP headers; allow images in /uploads to be embedded by the frontend origin
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Gzip responses — big win for JSON lists of cars/bookings
app.use(compression());

// Enable CORS only for this project's own website(s): exact CLIENT_URL entries, the project's
// production Vercel URL, its preview URLs when VERCEL_PREVIEW_SUFFIX is set, and localhost
// (see securityMiddleware.js)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Health check for Render and the website's "waking up" banner: 200 only when MongoDB is connected.
// Mounted before the rate limiters so frequent pings never count against anyone.
app.get('/api/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.set('Cache-Control', 'no-store');
  res.status(dbUp ? 200 : 503).json(dbUp ? { status: 'ok', db: 'up' } : { status: 'degraded', db: 'down' });
});

// Rate limiting: generous global limit + strict limits on auth, password reset, code guessing and public forms
const limiter = (windowMin, max, message) =>
  rateLimit({ windowMs: windowMin * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { message } });

// Uploaded car photos stored in MongoDB. Browsers cache them forever (and revalidate with the ETag),
// so they get their own generous limit instead of counting against the API limiter: a page full of
// photos never trips it, but nobody can pull megabytes out of the database in a loop.
app.get('/api/uploads/:id', limiter(15, 300, 'Too many image requests. Please try again later.'), require('./routes/uploadRoutes').serveUpload);

// Body parsers for JSON payloads and form-encoded data
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// Strip MongoDB operators ($ne, $gt, ...) from all user input
app.use(sanitizeInput);

// Every API route
app.use('/api', limiter(15, 1000, 'Too many requests, please slow down.'));
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/password'], limiter(15, 20, 'Too many attempts. Please try again in 15 minutes.'));
// Reset emails and reset-token guesses
app.post(['/api/auth/forgot-password', '/api/auth/reset-password/:token'], limiter(15, 8, 'Too many password reset attempts. Please try again in 15 minutes.'));
// Discount-code guessing: checking a code and booking with one share the same count,
// so booking is not a faster way to try codes
const discountLimiter = limiter(15, 30, 'Too many discount code attempts. Please try again in 15 minutes.');
app.post('/api/discount/validate', discountLimiter);
app.post('/api/bookings', (req, res, next) => (req.body && req.body.discountCode ? discountLimiter(req, res, next) : next()));
// Public forms that send email or store submissions
app.post(['/api/contact', '/api/discount/subscribe', '/api/cars/:id/notify'], limiter(15, 10, 'Too many submissions. Please try again later.'));

// Serve older car pictures uploaded to disk before uploads moved to MongoDB
// (cached for a week, no directory listing)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  index: false,
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));

// ----------------------------------------------------------------------------
// API Route Mounts
// ----------------------------------------------------------------------------
app.use('/api/auth', require('./routes/authRoutes'));          // User & admin authentication (JWT)
app.use('/api/cars', require('./routes/carRoutes'));          // Fleet catalog, CRUD & availability alerts
app.use('/api/bookings', require('./routes/bookingRoutes'));  // Reservations, invoices & cancellations
app.use('/api/reviews', require('./routes/reviewRoutes'));    // Customer ratings and reviews
app.use('/api/contact', require('./routes/contactRoutes'));    // Contact inquiries (team notification)
app.use('/api/admin', require('./routes/adminRoutes'));        // Administrative analytics and management
app.use('/api/discount', require('./routes/discountRoutes'));  // Promo codes, validation & broadcast alerts
app.use('/api/upload', require('./routes/uploadRoutes'));      // Admin car image uploads (stored in MongoDB)

// Simple liveness response (the database-aware check is /api/health)
app.get('/', (req, res) => res.json({ message: 'Driveaway API Running 🚗' }));

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ message: 'Route not found' }));

// Global Error Handler Middleware
// Express recognises an error handler by its four arguments, so `next` stays even though it is unused
app.use((err, req, res, next) => {
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON body' });
  if (err.message && err.message.includes('not allowed by CORS')) return res.status(403).json({ message: err.message });
  if (isDbUnavailable(err)) return res.status(503).json({ message: DB_DOWN_MESSAGE });
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ message: isProd ? 'Internal Server Error' : err.message });
});

const { createTransporter } = require('./utils/emailService');

const PORT = process.env.PORT || 5000;

// Report how email will be sent (Render's free plan blocks SMTP, so use Brevo there)
const reportEmailMode = () => {
  const transporter = createTransporter();
  if (transporter?.mode === 'brevo') {
    console.log('✉️ Email service ready (Brevo API)');
  } else if (transporter) {
    if (process.env.RENDER) console.warn('⚠️ Gmail SMTP is blocked on Render\'s free plan. Set BREVO_API_KEY instead.');
    transporter.verify((err) => {
      if (err) console.error('⚠️ Email service SMTP connection failed:', err.message);
      else console.log('✉️ Email service ready (Gmail SMTP)');
    });
  }
};

// Connect to MongoDB first, then accept traffic (connectDB exits if the first connect fails)
const start = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`🚗 Driveaway server running on port ${PORT}`);
    reportEmailMode();
  });

  // Graceful shutdown on deploys/restarts: stop taking new requests, let in-flight ones finish,
  // then close the database connection. Forced exit after 10 s so a stuck request can't block it.
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);
    setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      try {
        await disconnectDB();
      } finally {
        process.exit(0);
      }
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start();
