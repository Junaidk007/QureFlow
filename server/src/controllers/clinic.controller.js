const Clinic = require('../models/Clinic');
const ApiResponse = require('../utils/apiResponse');
const wrapAsync = require('../utils/wrapAsync');

/**
 * Get all clinics (public for dropdown selector)
 */
const getAllClinics = wrapAsync(async (req, res) => {
  const clinics = await Clinic.find().select('_id name address checkInWindowStartMinutes checkInWindowEndMinutes').lean();
  return ApiResponse.success(res, clinics, 'Clinics retrieved successfully');
});

module.exports = {
  getAllClinics,
};
