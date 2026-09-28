const Appointment = require('../models/Appointment');
const Clinic = require('../models/Clinic');
const User = require('../models/User');
const Visit = require('../models/Visit');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const wrapAsync = require('../utils/wrapAsync');
const wsService = require('../services/wsService');

// Helper to generate clinic daily slots (09:00 - 17:00, 15-min intervals)
const generateDailyTimeSlots = () => {
  const slots = [];
  // Morning session: 09:00 - 12:45
  for (let h = 9; h <= 12; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 12 && m > 45) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      slots.push({ time: `${hh}:${mm}`, period: 'morning' });
    }
  }
  // Afternoon session: 13:30 - 17:00
  for (let h = 13; h <= 17; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 13 && m < 30) continue;
      if (h === 17 && m > 0) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      slots.push({ time: `${hh}:${mm}`, period: 'afternoon' });
    }
  }
  return slots;
};

/**
 * Get available vs booked slots for a doctor on a specific date (legacy support)
 * GET /api/v1/appointments/slots?doctorId=&date=YYYY-MM-DD
 */
const getAvailableSlots = wrapAsync(async (req, res) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    throw ApiError.badRequest('doctorId and date (YYYY-MM-DD) query parameters are required', 'PARAMS_MISSING');
  }

  // Fetch booked appointments for this doctor on this date
  const bookedAppointments = await Appointment.find({
    doctorId,
    appointmentDate: date,
    status: 'BOOKED',
  })
    .select('appointmentTime')
    .lean();

  const bookedSet = new Set(bookedAppointments.map((a) => a.appointmentTime).filter(Boolean));

  const allSlots = generateDailyTimeSlots();
  const slotsWithStatus = allSlots.map((slot) => ({
    time: slot.time,
    period: slot.period,
    isBooked: bookedSet.has(slot.time),
  }));

  return ApiResponse.success(
    res,
    {
      doctorId,
      date,
      totalSlots: slotsWithStatus.length,
      availableSlots: slotsWithStatus.filter((s) => !s.isBooked).length,
      slots: slotsWithStatus,
    },
    'Slots retrieved successfully'
  );
});

/**
 * Book an appointment (No time slot selection needed)
 * POST /api/v1/appointments
 */
const bookAppointment = wrapAsync(async (req, res) => {
  const patientId = req.user.sub;
  const { doctorId, clinicId, appointmentDate, appointmentTime, type = 'NEW' } = req.body;

  // 1. Verify doctor exists
  const doctor = await User.findOne({ _id: doctorId, role: 'DOCTOR' }).select('name specialization').lean();
  if (!doctor) {
    throw ApiError.notFound('Doctor not found', 'DOCTOR_NOT_FOUND');
  }

  // 2. Verify clinic exists
  const clinic = await Clinic.findById(clinicId).lean();
  if (!clinic) {
    throw ApiError.notFound('Clinic not found', 'CLINIC_NOT_FOUND');
  }

  // 3. Prevent past date booking
  const todayStr = new Date().toISOString().split('T')[0];
  if (appointmentDate < todayStr) {
    throw ApiError.badRequest('Cannot book an appointment for a past date', 'PAST_DATE_INVALID');
  }

  // 4. Duplicate booking check for this patient on the same day with this doctor
  const existingPatientBooking = await Appointment.findOne({
    patientId,
    doctorId,
    appointmentDate,
    status: 'BOOKED',
  });

  if (existingPatientBooking) {
    throw ApiError.conflict(
      `You already have an active appointment booked with Dr. ${doctor.name} on ${appointmentDate}.`,
      'APPOINTMENT_ALREADY_EXISTS'
    );
  }

  // 5. Create Appointment
  const appointment = await Appointment.create({
    patientId,
    doctorId,
    clinicId,
    appointmentDate,
    appointmentTime: appointmentTime || null,
    type,
    status: 'BOOKED',
  });

  // Calculate check-in window from clinic settings
  const startTime = clinic.checkInStartTime || '09:00';
  const endTime = clinic.checkInEndTime || '12:00';

  return ApiResponse.created(
    res,
    {
      appointmentId: appointment._id,
      status: appointment.status,
      appointmentDate,
      appointmentTime: appointment.appointmentTime,
      type,
      details: {
        doctorName: doctor.name,
        specialization: doctor.specialization,
        clinicName: clinic.name,
        checkInWindow: {
          startTime,
          endTime,
          notice: `Please check in between ${startTime} and ${endTime} on your appointment date at the clinic OPD, otherwise your appointment will be invalid.`,
        },
      },
    },
    'Appointment successfully booked'
  );
});

/**
 * Get all appointments for the logged-in patient
 * GET /api/v1/appointments/my-appointments
 */
const getMyAppointments = wrapAsync(async (req, res) => {
  const patientId = req.user.sub;

  const appointments = await Appointment.find({ patientId })
    .sort({ appointmentDate: -1, createdAt: -1 })
    .populate('doctorId', 'name specialization')
    .populate('clinicId', 'name address checkInStartTime checkInEndTime')
    .lean();

  // Find any visits corresponding to these appointments
  const apptIds = appointments.map((a) => a._id);
  const visits = await Visit.find({ appointmentId: { $in: apptIds } })
    .select('appointmentId tokenId status checkedInAt')
    .lean();

  const visitMap = new Map();
  visits.forEach((v) => {
    visitMap.set(v.appointmentId.toString(), v);
  });

  const enrichedAppointments = appointments.map((appt) => {
    const visit = visitMap.get(appt._id.toString());
    const clinic = appt.clinicId;
    const checkInStartTime = clinic?.checkInStartTime || '09:00';
    const checkInEndTime = clinic?.checkInEndTime || '12:00';

    return {
      ...appt,
      visit: visit || null,
      checkInWindow: {
        startTime: checkInStartTime,
        endTime: checkInEndTime,
        notice: `Check in between ${checkInStartTime} and ${checkInEndTime} on the appointment date, otherwise your appointment will be invalid.`,
      },
    };
  });

  return ApiResponse.success(res, enrichedAppointments, 'Appointments retrieved successfully');
});

/**
 * Cancel an appointment
 * PUT /api/v1/appointments/:id/cancel
 */
const cancelAppointment = wrapAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.sub;
  const userRole = req.user.role;

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw ApiError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  }

  // Verify ownership or receptionist role
  if (userRole !== 'RECEPTIONIST' && appointment.patientId.toString() !== userId) {
    throw ApiError.forbidden('You are not authorized to cancel this appointment', 'FORBIDDEN');
  }

  if (appointment.status === 'CANCELLED') {
    throw ApiError.badRequest('This appointment is already cancelled', 'ALREADY_CANCELLED');
  }

  appointment.status = 'CANCELLED';
  await appointment.save();

  // If there's an active visit for this appointment, cancel it too
  const activeVisit = await Visit.findOne({
    appointmentId: appointment._id,
    status: { $in: ['CHECKED_IN', 'IN_QUEUE'] },
  });

  if (activeVisit) {
    activeVisit.status = 'CANCELLED';
    await activeVisit.save();
  }

  // Broadcast WebSocket update
  wsService.broadcastQueueUpdate(appointment.clinicId, appointment.doctorId, {
    action: 'APPOINTMENT_CANCELLED',
    appointmentId: appointment._id,
  });

  return ApiResponse.success(
    res,
    {
      appointmentId: appointment._id,
      status: appointment.status,
    },
    'Appointment successfully cancelled'
  );
});

/**
 * Get patient's upcoming booked appointments
 * GET /api/v1/appointments/my-upcoming
 */
const getMyUpcomingAppointment = wrapAsync(async (req, res) => {
  const patientId = req.user.sub;
  const todayStr = new Date().toISOString().split('T')[0];

  const appointment = await Appointment.findOne({
    patientId,
    appointmentDate: { $gte: todayStr },
    status: 'BOOKED',
  })
    .sort({ appointmentDate: 1, createdAt: 1 })
    .populate('doctorId', 'name specialization')
    .populate('clinicId', 'name address checkInStartTime checkInEndTime')
    .lean();

  if (appointment && appointment.clinicId) {
    const startTime = appointment.clinicId.checkInStartTime || '09:00';
    const endTime = appointment.clinicId.checkInEndTime || '12:00';
    appointment.checkInWindow = {
      startTime,
      endTime,
      notice: `You have to check in between ${startTime} and ${endTime}, else your appointment will be invalid.`,
    };
  }

  return ApiResponse.success(res, appointment || null, 'Upcoming appointment retrieved');
});

module.exports = {
  getAvailableSlots,
  bookAppointment,
  getMyAppointments,
  cancelAppointment,
  getMyUpcomingAppointment,
};
