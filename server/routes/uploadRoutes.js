const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

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
      url: `/uploads/${req.file.filename}`,
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

    const uploadedUrls = req.files.map((file) => `/uploads/${file.filename}`);
    res.json({
      success: true,
      urls: uploadedUrls,
      files: req.files.map((f) => ({ filename: f.filename, url: `/uploads/${f.filename}` })),
    });
  });
});

module.exports = router;
