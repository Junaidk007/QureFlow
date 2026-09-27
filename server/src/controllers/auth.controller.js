const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const wrapAsync = require('../utils/wrapAsync');
const { signJWT } = require('../services/sessionService');

/**
 * Register a new patient account
 * POST /api/v1/auth/register
 */
const register = wrapAsync(async (req, res) => {
  const { name, username, email, password } = req.body;

  // Uniqueness check for email
  const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingEmail) {
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  // Uniqueness check for username
  const existingUsername = await User.findOne({ username: username.toLowerCase().trim() });
  if (existingUsername) {
    throw ApiError.conflict('This username is already taken. Please choose another.', 'USERNAME_TAKEN');
  }

  // Hash password with salt rounds = 12
  const passwordHash = await bcrypt.hash(password, 12);

  // Create Patient User
  const newUser = await User.create({
    name: name.trim(),
    username: username.toLowerCase().trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: 'PATIENT',
  });

  const token = signJWT(newUser);

  return ApiResponse.created(
    res,
    {
      token,
      user: newUser.toJSON(),
    },
    'Account registered successfully'
  );
});

/**
 * Login (Handles both Patient and Staff)
 * POST /api/v1/auth/login
 */
const login = wrapAsync(async (req, res) => {
  const { identifier, password, clinicId, role } = req.body;

  let user = null;

  // Staff Login Flow
  if (role && (role === 'DOCTOR' || role === 'RECEPTIONIST')) {
    if (!clinicId) {
      throw ApiError.badRequest('Clinic selection is required for staff login', 'CLINIC_REQUIRED');
    }

    user = await User.findOne({
      email: identifier.toLowerCase().trim(),
      clinicId,
      role,
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid staff credentials for this clinic', 'INVALID_CREDENTIALS');
    }
  } else {
    // Patient Login Flow (supports email OR username)
    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase().trim(), role: 'PATIENT' }
      : { username: identifier.toLowerCase().trim(), role: 'PATIENT' };

    user = await User.findOne(query);

    if (!user) {
      throw ApiError.unauthorized('Invalid email/username or password', 'INVALID_CREDENTIALS');
    }
  }

  // Verify Password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid credentials. Please verify your details.', 'INVALID_CREDENTIALS');
  }

  const token = signJWT(user);

  return ApiResponse.success(
    res,
    {
      token,
      user: user.toJSON(),
    },
    'Login successful'
  );
});

/**
 * Get current authenticated user profile
 * GET /api/v1/auth/me
 */
const getMe = wrapAsync(async (req, res) => {
  const user = await User.findById(req.user.sub).populate('clinicId', 'name address');
  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }

  return ApiResponse.success(res, user.toJSON(), 'User profile retrieved');
});

module.exports = {
  register,
  login,
  getMe,
};
