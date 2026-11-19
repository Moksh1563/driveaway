const handleError = require('../utils/handleError');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { isValidEmail, clientUrl } = require('../middleware/securityMiddleware');
const emailService = require('../utils/emailService');

const isStr = (v) => typeof v === 'string';
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const PASSWORD_MSG = 'Password must be 8 to 128 characters and include at least one letter and one number';

const RESET_TOKEN_MINUTES = 30;
const RESET_RESEND_GAP_MS = 60 * 1000; // at most one reset email per account per minute
const FORGOT_MESSAGE = 'If an account exists for that email, a reset link is on its way.';
// The code lets the reset page offer a new link only when the link itself is the problem
const RESET_INVALID = { code: 'RESET_LINK_INVALID', message: 'This reset link is invalid or has expired. Please request a new one.' };

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d', algorithm: 'HS256' });
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// @desc   Register user
// @route  POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { username, name, email, phone, password } = req.body;
    if (![username, name, email, password].every(isStr) || !username.trim() || !name.trim() || !email.trim() || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username.trim())) {
      return res.status(400).json({ message: 'Username must be 3-30 characters (letters, numbers, _ or .)' });
    }
    if (name.trim().length > 80) return res.status(400).json({ message: 'Name is too long' });
    if (phone !== undefined && (!isStr(phone) || phone.length > 20)) return res.status(400).json({ message: 'Invalid phone number' });
    if (!PASSWORD_RULE.test(password)) return res.status(400).json({ message: PASSWORD_MSG });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const userExists = await User.findOne({ 
      $or: [
        { email: normalizedEmail }, 
        { username: normalizedUsername }
      ] 
    });
    if (userExists) return res.status(400).json({ message: 'User with this email or username already exists' });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ 
      username: normalizedUsername, 
      name: name.trim(), 
      email: normalizedEmail, 
      phone: phone ? phone.trim() : '', 
      password: hashedPassword 
    });
    
    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({ token: generateToken(user._id), user: userObj });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Login user
// @route  POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!isStr(email) || !isStr(password) || !email.trim() || !password) {
      return res.status(400).json({ message: 'Please provide email/username and password' });
    }

    const identifier = email.trim();
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() }
      ]
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const userObj = user.toObject();
      delete userObj.password;
      res.json({ token: generateToken(user._id), user: userObj });
    } else {
      // Same message whether the user exists or not (no account enumeration)
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Get current user
// @route  GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Update user profile
// @route  PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const textFields = ['name', 'phone', 'address', 'licenseNumber', 'emergencyContact', 'emergencyPhone', 'idProofType', 'idProofNumber'];
    for (const f of textFields) {
      if (req.body[f] !== undefined && (!isStr(req.body[f]) || req.body[f].length > 300)) {
        return res.status(400).json({ message: `Invalid value for ${f}` });
      }
    }
    if (req.body.name !== undefined && !req.body.name.trim()) return res.status(400).json({ message: 'Name cannot be empty' });
    if (req.body.marketingOptOut !== undefined && typeof req.body.marketingOptOut !== 'boolean') {
      return res.status(400).json({ message: 'Invalid value for marketingOptOut' });
    }
    const allowed = ['name', 'phone', 'address', 'licenseNumber', 'dateOfBirth',
      'drivingExperience', 'emergencyContact', 'emergencyPhone', 'idProofType', 'idProofNumber', 'marketingOptOut'];
    const updateData = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });
    const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true, runValidators: true }).select('-password');
    res.json(user);
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Change password
// @route  PUT /api/auth/password
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!isStr(oldPassword) || !isStr(newPassword) || !oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide both old and new password' });
    }
    if (!PASSWORD_RULE.test(newPassword)) return res.status(400).json({ message: PASSWORD_MSG });

    const user = await User.findById(req.user.id);
    if (!(await bcrypt.compare(oldPassword, user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    // Signs out every other session: tokens issued before this moment are rejected by protect()
    user.passwordChangedAt = new Date();
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    // A fresh token so this tab stays signed in
    res.json({ message: 'Password updated successfully', token: generateToken(user._id) });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Email a password reset link
// @route  POST /api/auth/forgot-password
// @access Public (rate limited)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    // Same answer whether or not the account exists (no account enumeration)
    if (!isValidEmail(email)) return res.json({ message: FORGOT_MESSAGE });

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordResetExpires');
    if (!user) return res.json({ message: FORGOT_MESSAGE });

    // A link was sent less than a minute ago: don't flood the inbox
    const lastIssuedAt = user.passwordResetExpires ? user.passwordResetExpires.getTime() - RESET_TOKEN_MINUTES * 60 * 1000 : 0;
    if (Date.now() - lastIssuedAt < RESET_RESEND_GAP_MS) return res.json({ message: FORGOT_MESSAGE });

    const token = crypto.randomBytes(32).toString('hex');
    await User.updateOne(
      { _id: user._id },
      { $set: { passwordResetTokenHash: sha256(token), passwordResetExpires: new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000) } }
    );

    const resetUrl = `${clientUrl()}/reset-password/${token}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔑 Password reset link for ${user.email} (shown outside production only): ${resetUrl}`);
    }

    // Not awaited: the response time must not reveal whether the account exists
    if (typeof emailService.sendPasswordResetEmail === 'function') {
      Promise.resolve(emailService.sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }))
        .then((result) => {
          if (result && result.sent === false) console.warn(`⚠️ Password reset email not sent: ${result.error || 'email is not configured'}`);
        })
        .catch((err) => console.error('❌ Password reset email failed:', err.message));
    } else {
      console.warn('⚠️ Password reset email not sent: emailService.sendPasswordResetEmail is missing');
    }

    res.json({ message: FORGOT_MESSAGE });
  } catch (error) {
    handleError(res, error);
  }
};

// @desc   Set a new password with the emailed reset token
// @route  POST /api/auth/reset-password/:token
// @access Public (rate limited)
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!isStr(token) || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json(RESET_INVALID);
    if (!isStr(password) || !PASSWORD_RULE.test(password)) return res.status(400).json({ message: PASSWORD_MSG });

    const tokenHash = sha256(token);
    const valid = { passwordResetTokenHash: tokenHash, passwordResetExpires: { $gt: new Date() } };
    if (!(await User.exists(valid))) return res.status(400).json(RESET_INVALID);

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Guarded on the token again, so one link can only ever be used once
    const user = await User.findOneAndUpdate(
      valid,
      {
        $set: { password: hashedPassword, passwordChangedAt: new Date() },
        $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 },
      },
      { new: true }
    );
    if (!user) return res.status(400).json(RESET_INVALID);

    res.json({ message: 'Your password has been reset. You can sign in with the new password now.' });
  } catch (error) {
    handleError(res, error);
  }
};
