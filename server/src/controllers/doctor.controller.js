const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const wrapAsync = require('../utils/wrapAsync');
const wsService = require('../services/wsService');

/**
 * Get all active doctors (for slot booking and doctor discovery)
 * GET /api/v1/doctors/active
 */
const getActiveDoctors = wrapAsync(async (req, res) => {
  const { clinicId } = req.query;
  const query = { role: 'DOCTOR' };

  if (clinicId) {
    query.clinicId = clinicId;
  }

  const doctors = await User.find(query)
    .select('_id name email specialization availability clinicId')
    .populate('clinicId', 'name address')
    .lean();

  return ApiResponse.success(res, doctors, 'Active doctors retrieved successfully');
});

/**
 * Update doctor availability / break status
 * PUT /api/v1/doctors/status
 */
const updateDoctorStatus = wrapAsync(async (req, res) => {
  const doctorId = req.user.sub;
  const { status, breakMinutes = 10 } = req.body;

  const breakUntil = status === 'ON_BREAK' ? new Date(Date.now() + breakMinutes * 60000) : null;

  const doctor = await User.findByIdAndUpdate(
    doctorId,
    {
      'availability.status': status,
      'availability.breakUntil': breakUntil,
    },
    { returnDocument: 'after' }
  ).select('_id name email specialization availability clinicId');

  if (!doctor) {
    throw ApiError.notFound('Doctor account not found', 'DOCTOR_NOT_FOUND');
  }

  // Broadcast to clinic and doctor rooms
  wsService.broadcastDoctorStatus(doctor.clinicId?.toString(), doctorId.toString(), {
    doctorId,
    doctorName: doctor.name,
    status: doctor.availability.status,
    breakUntil: doctor.availability.breakUntil,
  });

  return ApiResponse.success(
    res,
    {
      status: doctor.availability.status,
      breakUntil: doctor.availability.breakUntil,
    },
    `Doctor status updated to ${status}`
  );
});

module.exports = {
  getActiveDoctors,
  updateDoctorStatus,
};
