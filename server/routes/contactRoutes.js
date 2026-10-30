const express = require('express');
const router = express.Router();
const { submitContact, getMessages, markAsRead } = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

router.post('/', submitContact);
router.get('/', protect, admin, getMessages);
router.patch('/:id/read', protect, admin, markAsRead);

module.exports = router;
