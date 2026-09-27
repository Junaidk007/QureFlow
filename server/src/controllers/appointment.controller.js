const Appointment = require('../models/Appointment');
const Clinic = require('../models/Clinic');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const wrapAsync = require('../utils/wrapAsync');

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
 * Get available vs booked slots for a doctor on a specific date
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

  const bookedSet = new Set(bookedAppointments.map((a) => a.appointmentTime));

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
 * Book an appointment slot
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

  // 4. Atomic collision check
  const existingBooking = await Appointment.findOne({
    doctorId,
    appointmentDate,
    appointmentTime,
    status: 'BOOKED',
  });

  if (existingBooking) {
    // Find next available slot for this doctor on this day
    const allSlots = generateDailyTimeSlots();
    const otherBookings = await Appointment.find({
      doctorId,
      appointmentDate,
      status: 'BOOKED',
    })
      .select('appointmentTime')
      .lean();
    const bookedTimes = new Set(otherBookings.map((b) => b.appointmentTime));
    const nextSlot = allSlots.find((s) => s.time > appointmentTime && !bookedTimes.has(s.time));

    throw ApiError.conflict(
      `Slot at ${appointmentTime} is already booked.`,
      'SLOT_ALREADY_TAKEN',
      nextSlot ? { nextAvailableSlot: nextSlot.time } : null
    );
  }

  // 5. Create Appointment
  const appointment = await Appointment.create({
    patientId,
    doctorId,
    clinicId,
    appointmentDate,
    appointmentTime,
    type,
    status: 'BOOKED',
  });

  // Calculate check-in window
  const windowStartMinutes = clinic.checkInWindowStartMinutes || 15;
  const windowEndMinutes = clinic.checkInWindowEndMinutes || 15;

  return ApiResponse.created(
    res,
    {
      appointmentId: appointment._id,
      status: appointment.status,
      appointmentDate,
      appointmentTime,
      type,
      details: {
        doctorName: doctor.name,
        specialization: doctor.specialization,
        clinicName: clinic.name,
        checkInWindow: {
          startMinutesBefore: windowStartMinutes,
          endMinutesAfter: windowEndMinutes,
          notice: `Please check in between ${windowStartMinutes} mins before and ${windowEndMinutes} mins after your slot.`,
        },
      },
    },
    'Appointment successfully booked'
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
    .sort({ appointmentDate: 1, appointmentTime: 1 })
    .populate('doctorId', 'name specialization')
    .populate('clinicId', 'name address')
    .lean();

  return ApiResponse.success(res, appointment || null, 'Upcoming appointment retrieved');
});

module.exports = {
  getAvailableSlots,
  bookAppointment,
  getMyUpcomingAppointment,
};
