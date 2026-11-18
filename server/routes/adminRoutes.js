const express = require('express');
const router = express.Router();
const { getDashboardStats, getAllUsers, deleteUser } = require('../controllers/adminController');
const { getMessages, markAsRead } = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const { emailStatus, sendTestEmail } = require('../utils/emailService');

router.get('/dashboard', protect, admin, getDashboardStats);
router.get('/users', protect, admin, getAllUsers);
router.delete('/users/:id', protect, admin, deleteUser);
router.get('/messages', protect, admin, getMessages);
router.patch('/messages/:id/read', protect, admin, markAsRead);

// Email health: how sending is set up, and a test send to the signed-in admin
router.get('/email-status', protect, admin, (req, res) => res.json(emailStatus()));
router.post('/test-email', protect, admin, async (req, res) => {
  try {
    await sendTestEmail(req.user.email);
    res.json({ message: `Test email sent to ${req.user.email}`, status: emailStatus() });
  } catch (err) {
    res.status(502).json({ message: err.message, status: emailStatus() });
  }
});

module.exports = router;
