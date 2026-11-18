const handleError = require('../utils/handleError');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isValidEmail } = require('../middleware/securityMiddleware');

const isStr = (v) => typeof v === 'string';
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const PASSWORD_MSG = 'Password must be 8+ characters and include at least one letter and one number';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d', algorithm: 'HS256' });
};

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
    const allowed = ['name', 'phone', 'address', 'licenseNumber', 'dateOfBirth',
      'drivingExperience', 'emergencyContact', 'emergencyPhone', 'idProofType', 'idProofNumber'];
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
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    handleError(res, error);
  }
};
