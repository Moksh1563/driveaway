/**
 * ============================================================================
 * UPLOADED IMAGE MODEL (Upload)
 * ============================================================================
 * Admin-uploaded car photos, stored in MongoDB itself. Render's free plan wipes
 * the local disk on every deploy, restart and idle spin-down, so files written
 * to server/uploads would disappear. Served by GET /api/uploads/:id.
 */

const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
  // Raw image bytes (max 5 MB, enforced by the upload middleware)
  data:        { type: Buffer, required: true },
  // Allow-listed image type: image/jpeg, image/png, image/webp, image/avif or image/gif
  contentType: { type: String, required: true },
  size:        { type: Number, required: true },
  // Original file name, for the admin's reference only (never used in URLs)
  filename:    { type: String, default: '' },
  uploadedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('Upload', uploadSchema);
