const handleError = require('../utils/handleError');
const ContactMessage = require('../models/ContactMessage');
const { sendContactMessageEmail } = require('../utils/emailService');
const { isValidEmail } = require('../middleware/securityMiddleware');

const LIMITS = { name: 80, email: 254, phone: 20, subject: 150, message: 3000 };

// Name, phone and subject are single lines: no line breaks (they end up in email subjects and mailto links)
const oneLine = (v) => (typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim() : undefined);

// @desc   Submit contact message
// @route  POST /api/contact
exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ message: 'Please provide name, email and message' });
    for (const [field, max] of Object.entries(LIMITS)) {
      const v = req.body[field];
      if (v !== undefined && v !== '' && (typeof v !== 'string' || v.length > max)) {
        return res.status(400).json({ message: `${field} is invalid or too long (max ${max} characters)` });
      }
    }
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    if (!oneLine(name) || !message.trim()) return res.status(400).json({ message: 'Please provide name, email and message' });

    const clean = {
      name: oneLine(name),
      email: email.trim().toLowerCase(),
      phone: oneLine(phone) || undefined,
      subject: oneLine(subject) || undefined,
      message: message.trim(),
    };
    const msg = await ContactMessage.create(clean);

    // Tell the team (reply-to is the visitor). No auto-reply goes to the address typed into the
    // form, so the form cannot be used to send Driveaway emails to strangers.
    sendContactMessageEmail(clean).catch(err => console.error('Email send error:', err));

    res.status(201).json({ message: 'Message sent successfully', data: { _id: msg._id } });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Get all messages (Admin)
// @route  GET /api/contact
exports.getMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 }).limit(500).lean();
    res.json(messages);
  } catch (error) {
    handleError(res, error);
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
    handleError(res, error);
  }
};
