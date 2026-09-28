const Clinic = require('../models/Clinic');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const wrapAsync = require('../utils/wrapAsync');
const wsService = require('../services/wsService');

/**
 * Get all clinics (public for dropdown selector)
 */
const getAllClinics = wrapAsync(async (req, res) => {
  const clinics = await Clinic.find()
    .select('_id name address checkInStartTime checkInEndTime checkInWindowStartMinutes checkInWindowEndMinutes')
    .lean();
  return ApiResponse.success(res, clinics, 'Clinics retrieved successfully');
});

/**
 * Get single clinic by ID
 * GET /api/v1/clinics/:id
 */
const getClinicById = wrapAsync(async (req, res) => {
  const { id } = req.params;
  const clinic = await Clinic.findById(id).lean();
  if (!clinic) {
    throw ApiError.notFound('Clinic not found', 'CLINIC_NOT_FOUND');
  }
  return ApiResponse.success(res, clinic, 'Clinic retrieved successfully');
});

/**
 * Update check-in start and end time window by receptionist
 * PUT /api/v1/clinics/:id/checkin-window
 */
const updateCheckInWindow = wrapAsync(async (req, res) => {
  const { id } = req.params;
  const { checkInStartTime, checkInEndTime } = req.body;

  if (!checkInStartTime || !checkInEndTime) {
    throw ApiError.badRequest('Both checkInStartTime and checkInEndTime are required (HH:mm)', 'TIME_PARAMS_MISSING');
  }

  // Validate HH:mm format
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(checkInStartTime) || !timeRegex.test(checkInEndTime)) {
    throw ApiError.badRequest('Times must be in 24-hour HH:mm format (e.g. 09:00)', 'INVALID_TIME_FORMAT');
  }

  const clinic = await Clinic.findByIdAndUpdate(
    id,
    { checkInStartTime, checkInEndTime },
    { new: true, runValidators: true }
  );

  if (!clinic) {
    throw ApiError.notFound('Clinic not found', 'CLINIC_NOT_FOUND');
  }

  // Broadcast clinic update event via WebSocket
  wsService.emit(`clinic:${id}`, 'CLINIC_CONFIG_UPDATED', {
    clinicId: id,
    checkInStartTime,
    checkInEndTime,
  });

  return ApiResponse.success(
    res,
    clinic,
    `Clinic check-in window successfully updated to ${checkInStartTime} - ${checkInEndTime}`
  );
});

module.exports = {
  getAllClinics,
  getClinicById,
  updateCheckInWindow,
};
