const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

// Full public URL for an uploaded file, so it works when the website is served from another domain
// (e.g. website on Vercel, API on Render). PUBLIC_API_URL overrides the detected host if needed.
const fileUrl = (req, filename) => {
  const base = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  return `${base}/uploads/${filename}`;
};

// @desc    Upload single image
// @route   POST /api/upload
// @access  Private/Admin
router.post('/', protect, admin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Error uploading file' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    res.json({
      success: true,
      url: fileUrl(req, req.file.filename),
      filename: req.file.filename,
      size: req.file.size,
    });
  });
});

// @desc    Upload multiple images (up to 5)
// @route   POST /api/upload/multiple
// @access  Private/Admin
router.post('/multiple', protect, admin, (req, res) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Error uploading files' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files provided' });
    }

    const uploadedUrls = req.files.map((file) => fileUrl(req, file.filename));
    res.json({
      success: true,
      urls: uploadedUrls,
      files: req.files.map((f) => ({ filename: f.filename, url: fileUrl(req, f.filename) })),
    });
  });
});

module.exports = router;
