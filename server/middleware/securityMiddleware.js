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

/* ───────────────── Allowed website origins (CORS + links in emails) ─────────────────
 *  - CLIENT_URL: the website, or a comma-separated list of them. Matched exactly.
 *  - https://<VERCEL_PROJECT_PREFIX>.vercel.app (default prefix: driveaway). Matched exactly.
 *  - Vercel preview deployments only when VERCEL_PREVIEW_SUFFIX is set (e.g. "-myteam.vercel.app"),
 *    matching ^https://<prefix>-[a-z0-9-]+<suffix>$ exactly. Opt-in, because anyone can name a
 *    Vercel project to imitate a hostname pattern; exact CLIENT_URL entries are the safe choice.
 *  - http://localhost:5173 and :3000 for local development.
 */
const LOCAL_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];
const escapeForRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toOrigin = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return String(value).replace(/\/+$/, '');
  }
};

const vercelPrefix = () => (process.env.VERCEL_PROJECT_PREFIX || 'driveaway').trim().toLowerCase();

const clientUrls = () =>
  String(process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(toOrigin);

// Ordered: CLIENT_URL first, then the likeliest website for this environment
const allowedOrigins = () => {
  const vercelSite = /^[a-z0-9-]+$/.test(vercelPrefix()) ? [`https://${vercelPrefix()}.vercel.app`] : [];
  const rest = process.env.NODE_ENV === 'production' ? [...vercelSite, ...LOCAL_ORIGINS] : [...LOCAL_ORIGINS, ...vercelSite];
  return [...new Set([...clientUrls(), ...rest])];
};

let warnedSuffix = false;
const previewPattern = () => {
  const suffix = (process.env.VERCEL_PREVIEW_SUFFIX || '').trim().toLowerCase();
  if (!suffix) return null;
  // Must name the team ("-myteam.vercel.app"); a bare ".vercel.app" would let any project in
  if (!/^-[a-z0-9-]+\.vercel\.app$/.test(suffix) || !/^[a-z0-9-]+$/.test(vercelPrefix())) {
    if (!warnedSuffix) {
      console.warn(`⚠️ VERCEL_PREVIEW_SUFFIX "${suffix}" ignored: use the form "-<team-slug>.vercel.app"`);
      warnedSuffix = true;
    }
    return null;
  }
  return new RegExp(`^https://${escapeForRegex(vercelPrefix())}-[a-z0-9-]+${escapeForRegex(suffix)}$`);
};

const isAllowedOrigin = (origin) => {
  if (allowedOrigins().includes(origin)) return true;
  const preview = previewPattern();
  return Boolean(preview && preview.test(origin));
};

// Base URL of the website for links in emails (password reset, availability alerts, offers)
const clientUrl = () => allowedOrigins()[0] || 'http://localhost:5173';

module.exports = { sanitizeInput, escapeRegex, escapeHtml, isValidEmail, allowedOrigins, isAllowedOrigin, clientUrl };
