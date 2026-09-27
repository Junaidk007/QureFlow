const ApiError = require('../utils/apiError');

/**
 * Role-based access control guard factory
 * Usage: roleGuard('DOCTOR'), roleGuard('RECEPTIONIST', 'DOCTOR')
 */
const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required before role verification', 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Requires one of: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};

module.exports = roleGuard;
