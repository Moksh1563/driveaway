/**
 * Consistent error responses for controllers.
 * Maps Mongoose errors to 4xx codes and hides internal details in production.
 */
module.exports = function handleError(res, error) {
  if (error && error.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format' });
  if (error && error.name === 'ValidationError') {
    const first = Object.values(error.errors || {})[0];
    return res.status(400).json({ message: first ? first.message : 'Invalid data' });
  }
  if (error && error.code === 11000) return res.status(409).json({ message: 'A record with these details already exists' });
  console.error(error);
  const isProd = process.env.NODE_ENV === 'production';
  return res.status(500).json({ message: isProd ? 'Something went wrong. Please try again.' : error.message });
};
