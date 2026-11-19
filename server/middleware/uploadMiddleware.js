const multer = require('multer');
const path = require('path');

// Files are kept in memory and then saved to MongoDB (see routes/uploadRoutes.js):
// Render's free plan has no persistent disk.
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 5;

// Allow-list: the extension AND the declared type must both be one of these
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const normalizeType = (mimetype) => (mimetype === 'image/jpg' ? 'image/jpeg' : String(mimetype || '').toLowerCase());

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext) && ALLOWED_TYPES.has(normalizeType(file.mimetype))) {
    return cb(null, true);
  }
  const err = new Error('Only image files (JPEG, JPG, PNG, WEBP, GIF, AVIF) are permitted!');
  err.code = 'INVALID_FILE_TYPE';
  return cb(err);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES, fields: 10, parts: MAX_FILES + 10 },
  fileFilter,
});

// Friendly text for multer's error codes
const uploadErrorMessage = (err) => {
  switch (err && err.code) {
    case 'LIMIT_FILE_SIZE': return `Each image must be ${MAX_FILE_SIZE / (1024 * 1024)} MB or smaller`;
    case 'LIMIT_FILE_COUNT': return `You can upload up to ${MAX_FILES} images at once`;
    case 'LIMIT_UNEXPECTED_FILE': return `Unexpected file field "${err.field}", or more than ${MAX_FILES} images`;
    case 'LIMIT_PART_COUNT':
    case 'LIMIT_FIELD_COUNT': return 'Too many form fields in the upload';
    default: return (err && err.message) || 'Error uploading file';
  }
};

module.exports = upload;
module.exports.normalizeType = normalizeType;
module.exports.uploadErrorMessage = uploadErrorMessage;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
module.exports.MAX_FILES = MAX_FILES;
