const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isDbUnavailable, DB_DOWN_MESSAGE } = require('../utils/handleError');

const bearerToken = (req) => {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
};

/**
 * Resolves the signed-in user from a JWT.
 * Returns { user } on success, or { status, message } on failure:
 *  - 401 only when the token itself is bad (invalid, expired, issued before the last password change,
 *    or the account is gone). The client signs the user out on a 401.
 *  - 503 when the database cannot be reached, so a brief outage never signs anyone out.
 */
const resolveUser = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return { status: 401, message: 'Not authorized, token failed' };
  }

  let user;
  try {
    user = await User.findById(decoded.id).select('-password').lean();
  } catch (error) {
    if (isDbUnavailable(error)) return { status: 503, message: DB_DOWN_MESSAGE };
    if (error.name === 'CastError') return { status: 401, message: 'Not authorized, token failed' };
    console.error('Auth lookup failed:', error.message);
    return { status: 503, message: 'Could not verify your session right now. Please try again.' };
  }
  if (!user) return { status: 401, message: 'User not found' };

  // Tokens issued before the last password change (or reset) no longer work.
  // Whole seconds on both sides, so the fresh token issued in that same request stays valid.
  if (user.passwordChangedAt) {
    const changedAt = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
    if (typeof decoded.iat !== 'number' || decoded.iat < changedAt) {
      return { status: 401, message: 'Your password was changed. Please sign in again.' };
    }
  }

  user.id = user._id.toString();
  return { user };
};

const protect = async (req, res, next) => {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  const result = await resolveUser(token);
  if (!result.user) return res.status(result.status).json({ message: result.message });
  req.user = result.user;
  next();
};

// Attaches req.user when a valid token is sent; otherwise carries on as a guest
const optionalProtect = async (req, res, next) => {
  const token = bearerToken(req);
  if (token) {
    const result = await resolveUser(token);
    if (result.user) req.user = result.user;
  }
  next();
};

module.exports = { protect, optionalProtect };
