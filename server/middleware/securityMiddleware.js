/**
 * Security helpers shared across the API.
 *  - sanitizeInput: strips MongoDB operator keys ($gt, $ne, a.b) from body/query/params
 *    so attackers cannot inject query operators (NoSQL injection).
 *  - escapeRegex: makes user search text safe to use inside a RegExp (prevents ReDoS / regex injection).
 *  - escapeHtml: escapes user text before it is embedded in HTML emails.
 */

const stripOperators = (value, depth = 0) => {
  if (depth > 10 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripOperators(v, depth + 1));
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
    } else {
      value[key] = stripOperators(value[key], depth + 1);
    }
  }
  return value;
};

const sanitizeInput = (req, res, next) => {
  if (req.body) stripOperators(req.body);
  if (req.params) stripOperators(req.params);
  if (req.query) {
    // Query values must be plain strings — reject nested objects like ?status[$ne]=x
    for (const key of Object.keys(req.query)) {
      const v = req.query[key];
      if (typeof v !== 'string') delete req.query[key];
    }
  }
  next();
};

const escapeRegex = (str = '') => String(str).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isValidEmail = (email) =>
  typeof email === 'string' && email.length <= 254 && /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/.test(email.trim());

module.exports = { sanitizeInput, escapeRegex, escapeHtml, isValidEmail };
