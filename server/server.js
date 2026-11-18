/**
 * ============================================================================
 * DRIVEAWAY BACKEND SERVER
 * ============================================================================
 * Express.js API server for Driveaway Car Rentals (Ahmedabad, Gujarat).
 * Provides RESTful endpoints for authentication, cars fleet, reservations,
 * reviews, razorpay dupe payments, image uploads, and discount broadcasting.
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { sanitizeInput } = require('./middleware/securityMiddleware');

// Load environment variables (.env)
dotenv.config();

// Refuse to start without a strong JWT secret — a missing/weak secret lets anyone forge admin tokens
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('❌ JWT_SECRET is missing or too short (min 16 chars). Set it in server/.env');
  process.exit(1);
}

// Connect to MongoDB database instance
connectDB();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', 1); // correct client IPs behind Render/Vercel proxies (used by rate limiter)

// Secure HTTP headers; allow images in /uploads to be embedded by the frontend origin
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Gzip responses — big win for JSON lists of cars/bookings
app.use(compression());

// Enable CORS for Vite frontend client and deployed production domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Only allow this project's own Vercel previews, not every *.vercel.app site
      const vercelPrefix = process.env.VERCEL_PROJECT_PREFIX || 'driveaway';
      const isOwnVercel = /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) &&
        new URL(origin).hostname.startsWith(vercelPrefix);
      if (allowedOrigins.includes(origin) || isOwnVercel) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Body parsers for JSON payloads and form-encoded data
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// Strip MongoDB operators ($ne, $gt, ...) from all user input
app.use(sanitizeInput);

// Rate limiting: generous global limit + strict limit on auth & public forms (brute force / spam)
const limiter = (windowMin, max, message) =>
  rateLimit({ windowMs: windowMin * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { message } });
app.use('/api', limiter(15, 1000, 'Too many requests, please slow down.'));
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/password'], limiter(15, 20, 'Too many attempts. Please try again in 15 minutes.'));
app.post(['/api/contact', '/api/discount/subscribe', '/api/cars/:id/notify'], limiter(15, 10, 'Too many submissions. Please try again later.'));

// Serve static uploaded car pictures (cached for a week, no directory listing)
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
app.use('/api/contact', require('./routes/contactRoutes'));    // Contact inquiries and auto-replies
app.use('/api/admin', require('./routes/adminRoutes'));        // Administrative analytics and management
app.use('/api/discount', require('./routes/discountRoutes'));  // Promo codes, validation & broadcast alerts
app.use('/api/upload', require('./routes/uploadRoutes'));      // Multer car image upload engine

// Health Check Endpoint
app.get('/', (req, res) => res.json({ message: 'Driveaway API Running 🚗' }));

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ message: 'Route not found' }));

// Global Error Handler Middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON body' });
  if (err.message && err.message.includes('not allowed by CORS')) return res.status(403).json({ message: err.message });
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ message: isProd ? 'Internal Server Error' : err.message });
});

const { createTransporter } = require('./utils/emailService');

const PORT = process.env.PORT || 5000;

// Start Express HTTP Server
app.listen(PORT, () => {
  console.log(`🚗 Driveaway server running on port ${PORT}`);

  // Verify Gmail SMTP transport configuration on startup
  const transporter = createTransporter();
  if (transporter) {
    transporter.verify((err) => {
      if (err) console.error('⚠️ Email service SMTP connection failed:', err.message);
      else console.log('✉️ Email service ready (Gmail SMTP)');
    });
  }
});
