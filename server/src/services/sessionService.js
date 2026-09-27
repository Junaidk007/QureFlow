const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'qureflow_super_secret_jwt_key_2026_dev_env';

/**
 * Sign JWT for user based on role
 * Patients: 30 days
 * Staff (Doctors, Receptionists): 12 hours
 */
const signJWT = (user) => {
  const isPatient = user.role === 'PATIENT';
  const expiresIn = isPatient ? '30d' : '12h';

  const payload = {
    sub: user._id.toString(),
    role: user.role,
    clinicId: user.clinicId ? user.clinicId.toString() : null,
    email: user.email,
    name: user.name,
    username: user.username || null,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Verify JWT token
 */
const verifyJWT = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  signJWT,
  verifyJWT,
};
