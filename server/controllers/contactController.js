const ContactMessage = require('../models/ContactMessage');
const { sendContactMessageEmail } = require('../utils/emailService');

// @desc   Submit contact message
// @route  POST /api/contact
exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ message: 'Please provide name, email and message' });
    const msg = await ContactMessage.create({ name, email, phone, subject, message });

    // Send auto-reply to user and alert to admin asynchronously
    sendContactMessageEmail({ name, email, phone, subject, message }).catch(err => console.error('Email send error:', err));

    res.status(201).json({ message: 'Message sent successfully', data: msg });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get all messages (Admin)
// @route  GET /api/contact
exports.getMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Mark message as read (Admin)
// @route  PATCH /api/contact/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!message) return res.status(404).json({ message: 'Message not found' });
    res.json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
