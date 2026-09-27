const ApiError = require('../utils/apiError');
const { verifyJWT } = require('../services/sessionService');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Authorization token is required (Format: Bearer <token>)', 'UNAUTHORIZED'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyJWT(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Session expired. Please log in again.', 'TOKEN_EXPIRED'));
    }

    return next(new ApiError(401, 'Invalid or malformed authorization token', 'INVALID_TOKEN'));
  }
};

module.exports = authMiddleware;
