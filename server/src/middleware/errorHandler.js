const ApiError = require('../utils/apiError');

/**
 * Centralized Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // If error is not an instance of ApiError, normalize it
  if (!(error instanceof ApiError)) {
    // 1. Mongoose Validation Error
    if (err.name === 'ValidationError') {
      const details = Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      error = new ApiError(400, 'Validation Error', 'VALIDATION_ERROR', details);
    }
    // 2. Mongoose Invalid ObjectId Cast Error
    else if (err.name === 'CastError') {
      error = new ApiError(400, `Invalid value '${err.value}' for field '${err.path}'`, 'INVALID_ID');
    }
    // 3. MongoDB Duplicate Key (E11000)
    else if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'field';
      error = new ApiError(409, `${field} already exists and must be unique`, 'DUPLICATE_ENTRY');
    }
    // 4. JWT Token Expired
    else if (err.name === 'TokenExpiredError') {
      error = new ApiError(401, 'Authentication token has expired', 'TOKEN_EXPIRED');
    }
    // 5. JWT Invalid Signature / Malformed
    else if (err.name === 'JsonWebTokenError') {
      error = new ApiError(401, 'Invalid authentication token', 'INVALID_TOKEN');
    }
    // 6. Generic Internal Server Error
    else {
      const statusCode = err.statusCode || 500;
      const message = err.message || 'Internal Server Error';
      error = new ApiError(statusCode, message, err.code || 'SERVER_ERROR');
    }
  }

  // Log server errors (5xx)
  if (error.statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  }

  const responsePayload = {
    status: 'error',
    code: error.code || 'ERROR',
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  };

  return res.status(error.statusCode || 500).json(responsePayload);
};

module.exports = errorHandler;
