const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { normalizeType, uploadErrorMessage } = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const Upload = require('../models/Upload');
const handleError = require('../utils/handleError');

// Images are stored in MongoDB (Render's free plan wipes the local disk on every restart)
// and served by GET /api/uploads/:id. The URL is absolute so it works when the website is
// served from another domain (website on Vercel, API on Render). PUBLIC_API_URL overrides
// the detected host if needed.
const fileUrl = (req, id) => {
  const base = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  return `${base}/api/uploads/${id}`;
};

const saveFiles = (req, files) =>
  Upload.insertMany(files.map((file) => ({
    data: file.buffer,
    contentType: normalizeType(file.mimetype),
    size: file.size,
    filename: String(file.originalname || '').slice(0, 200),
    uploadedBy: req.user ? req.user._id : null,
  })));

// @desc    Upload single image
// @route   POST /api/upload
// @access  Private/Admin
router.post('/', protect, admin, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: uploadErrorMessage(err) });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    try {
      const [doc] = await saveFiles(req, [req.file]);
      res.json({
        success: true,
        url: fileUrl(req, doc._id),
        filename: doc.filename,
        size: doc.size,
      });
    } catch (error) {
      handleError(res, error);
    }
  });
});

// @desc    Upload multiple images (up to 5)
// @route   POST /api/upload/multiple
// @access  Private/Admin
router.post('/multiple', protect, admin, (req, res) => {
  upload.array('images', 5)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: uploadErrorMessage(err) });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files provided' });
    }

    try {
      const docs = await saveFiles(req, req.files);
      res.json({
        success: true,
        urls: docs.map((doc) => fileUrl(req, doc._id)),
        files: docs.map((doc) => ({ filename: doc.filename, url: fileUrl(req, doc._id) })),
      });
    } catch (error) {
      handleError(res, error);
    }
  });
});

// An id never points at different bytes, so browsers and CDNs may keep it forever,
// and the id itself is the ETag
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
};

/** Does the If-None-Match header name this ETag? (a list, with or without the weak W/ prefix) */
const etagMatches = (header, etag) =>
  typeof header === 'string' && header.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag);

// @desc    Serve an uploaded image
// @route   GET /api/uploads/:id  (mounted in server.js with its own rate limit)
// @access  Public
const serveUpload = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Image not found' });
    const etag = `"${String(req.params.id).toLowerCase()}"`;
    // The browser already has these bytes: answer without reading the image from the database
    if (etagMatches(req.headers['if-none-match'], etag)) {
      res.set({ ...CACHE_HEADERS, ETag: etag });
      return res.status(304).end();
    }

    // Not lean(): Mongoose turns the stored binary back into a Node Buffer
    const file = await Upload.findById(req.params.id).select('data contentType');
    if (!file) return res.status(404).json({ message: 'Image not found' });

    const data = file.data;
    res.set({
      ...CACHE_HEADERS,
      ETag: etag,
      'Content-Type': file.contentType,
      'Content-Length': String(data.length),
      'Content-Disposition': 'inline',
    });
    res.end(data);
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = router;
module.exports.serveUpload = serveUpload;
