/**
 * Consistent error responses for controllers.
 * Maps Mongoose errors to 4xx codes, a lost database connection to 503,
 * and hides internal details in production.
 */
const DB_DOWN_ERRORS = new Set([
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
  'MongoPoolClearedError',
]);

// True when the error means "the database cannot be reached right now" rather than "bad request"
const isDbUnavailable = (error) =>
  Boolean(error) && (
    DB_DOWN_ERRORS.has(error.name) ||
    (error.name === 'MongooseError' && /buffering timed out|not connected/i.test(error.message || ''))
  );

const DB_DOWN_MESSAGE = 'The database is temporarily unavailable. Please try again in a moment.';

function handleError(res, error) {
  if (error && error.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
  if (error && error.name === 'ValidationError') {
    const first = Object.values(error.errors || {})[0];
    return res.status(400).json({ message: first ? first.message : 'Invalid data' });
  }
  if (error && error.code === 11000) return res.status(409).json({ message: 'A record with these details already exists' });
  if (isDbUnavailable(error)) {
    console.error('Database unavailable:', error.message);
    return res.status(503).json({ message: DB_DOWN_MESSAGE });
  }
  console.error(error);
  const isProd = process.env.NODE_ENV === 'production';
  return res.status(500).json({ message: isProd ? 'Something went wrong. Please try again.' : error.message });
}

module.exports = handleError;
module.exports.isDbUnavailable = isDbUnavailable;
module.exports.DB_DOWN_MESSAGE = DB_DOWN_MESSAGE;
