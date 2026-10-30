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
const connectDB = require('./config/db');

// Load environment variables (.env)
dotenv.config();

// Connect to MongoDB database instance
connectDB();

const app = express();

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
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Body parsers for JSON payloads and form-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded car pictures from the /uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
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
