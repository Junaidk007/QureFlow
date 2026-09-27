const Visit = require('../models/Visit');
const Appointment = require('../models/Appointment');
const Clinic = require('../models/Clinic');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const wrapAsync = require('../utils/wrapAsync');
const { computeETA } = require('../services/etaEngine');
const { mintToken } = require('../services/tokenMinter');
const wsService = require('../services/wsService');

/**
 * Patient Physical Arrival QR Check-In
 * POST /api/v1/visits/check-in
 */
const checkIn = wrapAsync(async (req, res) => {
  const patientId = req.user.sub;
  const { clinicId, appointmentId } = req.body;
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Verify appointment exists and belongs to this patient
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patientId,
    status: 'BOOKED',
  }).populate('doctorId', 'name specialization availability');

  if (!appointment) {
    throw ApiError.notFound('Booked appointment not found or does not belong to you', 'APPOINTMENT_NOT_FOUND');
  }

  // 2. Prevent duplicate check-in
  const existingVisit = await Visit.findOne({
    appointmentId,
    status: { $in: ['CHECKED_IN', 'IN_QUEUE', 'CHECK_UP', 'DONE'] },
  });

  if (existingVisit) {
    throw ApiError.badRequest(
      `You are already checked in with Token #${existingVisit.tokenId}`,
      'ALREADY_CHECKED_IN',
      { tokenId: existingVisit.tokenId, status: existingVisit.status }
    );
  }

  // 3. Verify clinic match
  if (appointment.clinicId.toString() !== clinicId) {
    throw ApiError.forbidden('QR code belongs to a different clinic facility', 'WRONG_CLINIC_QR');
  }

  // 4. Verify arrival window
  const clinic = await Clinic.findById(clinicId).lean();
  const windowStartMins = clinic?.checkInWindowStartMinutes || 15;
  const windowEndMins = clinic?.checkInWindowEndMinutes || 15;

  // Compare slot time with current time if appointment is today
  if (appointment.appointmentDate === todayStr) {
    const [slotH, slotM] = appointment.appointmentTime.split(':').map(Number);
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const slotMins = slotH * 60 + slotM;

    const earliestCheckIn = slotMins - windowStartMins;
    const latestCheckIn = slotMins + windowEndMins;

    if (currentMins < earliestCheckIn) {
      const waitRemaining = earliestCheckIn - currentMins;
      const windowOpenTime = `${String(Math.floor(earliestCheckIn / 60)).padStart(2, '0')}:${String(
        earliestCheckIn % 60
      ).padStart(2, '0')}`;
      throw ApiError.badRequest(
        `Check-in is too early. Window opens at ${windowOpenTime} (${waitRemaining} mins from now).`,
        'CHECKIN_TOO_EARLY',
        { windowOpenTime, minutesRemaining: waitRemaining }
      );
    }

    if (currentMins > latestCheckIn) {
      const windowCloseTime = `${String(Math.floor(latestCheckIn / 60)).padStart(2, '0')}:${String(
        latestCheckIn % 60
      ).padStart(2, '0')}`;
      throw ApiError.badRequest(
        `Check-in window closed at ${windowCloseTime}. Please approach the reception desk for manual triage.`,
        'CHECKIN_WINDOW_EXPIRED',
        { windowCloseTime, action: 'APPROACH_RECEPTION_DESK' }
      );
    }
  }

  // 5. Mint sequential daily token
  const tokenId = await mintToken(appointment.doctorId._id, todayStr);

  // 6. Create active Visit record in queue
  const visit = await Visit.create({
    appointmentId: appointment._id,
    patientId,
    doctorId: appointment.doctorId._id,
    clinicId,
    visitDate: todayStr,
    tokenId,
    status: 'IN_QUEUE',
    checkedInAt: new Date(),
  });

  // 7. Compute live dynamic ETA
  const eta = await computeETA(appointment.doctorId._id, todayStr, visit);

  // 8. Broadcast real-time queue update to clinic and doctor rooms
  wsService.broadcastQueueUpdate(clinicId, appointment.doctorId._id.toString(), {
    type: 'NEW_ARRIVAL',
    visitId: visit._id,
    tokenId,
    patientName: req.user.name,
    doctorName: appointment.doctorId.name,
  });

  return ApiResponse.created(
    res,
    {
      visitId: visit._id,
      tokenId,
      status: visit.status,
      checkedInAt: visit.checkedInAt,
      eta,
      doctor: {
        id: appointment.doctorId._id,
        name: appointment.doctorId.name,
        specialization: appointment.doctorId.specialization,
      },
    },
    `Check-in successful! Token #${tokenId} issued.`
  );
});

/**
 * Get active queue status for the current patient
 * GET /api/v1/visits/my-status
 */
const getMyStatus = wrapAsync(async (req, res) => {
  const patientId = req.user.sub;
  const todayStr = new Date().toISOString().split('T')[0];

  const activeVisit = await Visit.findOne({
    patientId,
    visitDate: todayStr,
    status: { $in: ['CHECKED_IN', 'IN_QUEUE', 'CHECK_UP'] },
  })
    .populate('doctorId', 'name specialization availability')
    .populate('clinicId', 'name address')
    .lean();

  if (!activeVisit) {
    return ApiResponse.success(
      res,
      {
        hasActiveVisit: false,
        visit: null,
        eta: null,
        currentlyServing: null,
      },
      'No active visit in queue today'
    );
  }

  // Find currently serving token for this doctor
  const currentServingVisit = await Visit.findOne({
    doctorId: activeVisit.doctorId._id,
    visitDate: todayStr,
    status: 'CHECK_UP',
  })
    .select('tokenId consultStartedAt')
    .lean();

  // Compute live ETA
  const eta = await computeETA(activeVisit.doctorId._id, todayStr, activeVisit);

  return ApiResponse.success(
    res,
    {
      hasActiveVisit: true,
      visit: activeVisit,
      eta,
      currentlyServing: currentServingVisit ? currentServingVisit.tokenId : 'None',
      doctorStatus: activeVisit.doctorId?.availability?.status || 'AVAILABLE',
    },
    'Active queue visit status retrieved'
  );
});

/**
 * Cancel or leave queue (Patient)
 * POST /api/v1/visits/cancel
 */
const cancelVisit = wrapAsync(async (req, res) => {
  const patientId = req.user.sub;
  const todayStr = new Date().toISOString().split('T')[0];

  const visit = await Visit.findOne({
    patientId,
    visitDate: todayStr,
    status: { $in: ['CHECKED_IN', 'IN_QUEUE'] },
  });

  if (!visit) {
    throw ApiError.notFound('No active queue visit found to cancel', 'VISIT_NOT_FOUND');
  }

  visit.status = 'CANCELLED';
  await visit.save();

  // Broadcast cancellation
  wsService.broadcastQueueUpdate(visit.clinicId.toString(), visit.doctorId.toString(), {
    type: 'VISIT_CANCELLED',
    tokenId: visit.tokenId,
  });

  return ApiResponse.success(res, { visitId: visit._id, status: visit.status }, 'Visit cancelled successfully');
});

/**
 * Get all visits for reception dashboard
 * GET /api/v1/visits
 */
const getAllVisits = wrapAsync(async (req, res) => {
  const { clinicId, date, doctorId } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const query = { visitDate: targetDate };
  if (clinicId) query.clinicId = clinicId;
  if (doctorId && doctorId !== 'ALL') query.doctorId = doctorId;

  const visits = await Visit.find(query)
    .sort({ isUrgent: -1, checkedInAt: 1 })
    .populate('patientId', 'name username email phone')
    .populate('doctorId', 'name specialization')
    .populate('appointmentId', 'appointmentTime type')
    .lean();

  return ApiResponse.success(res, visits, 'Visits retrieved successfully');
});

/**
 * Register walk-in patient at Reception desk
 * POST /api/v1/visits/walk-in
 */
const addWalkIn = wrapAsync(async (req, res) => {
  const { clinicId, patientName, phone, doctorId, type = 'NEW', isUrgent = false } = req.body;
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Resolve or create stub patient
  let patientUser = null;
  if (phone) {
    patientUser = await User.findOne({ email: `${phone.trim()}@walkin.qureflow.local` });
  }

  if (!patientUser) {
    const stubEmail = phone ? `${phone.trim()}@walkin.qureflow.local` : `walkin_${Date.now()}@qureflow.local`;
    patientUser = await User.create({
      name: patientName.trim(),
      email: stubEmail,
      role: 'PATIENT',
      passwordHash: 'WALK_IN_NO_PASSWORD',
    });
  }

  // 2. Mint token
  const tokenId = await mintToken(doctorId, todayStr);

  // 3. For urgent cases, prioritize arrival timestamp
  const checkedInAt = isUrgent ? new Date(Date.now() - 3600000 * 2) : new Date();

  // 4. Create visit
  const visit = await Visit.create({
    appointmentId: null, // Walk-in has no pre-booked appointment
    patientId: patientUser._id,
    doctorId,
    clinicId,
    visitDate: todayStr,
    tokenId,
    status: 'IN_QUEUE',
    isUrgent: Boolean(isUrgent),
    checkedInAt,
  });

  const populatedVisit = await Visit.findById(visit._id)
    .populate('patientId', 'name username email')
    .populate('doctorId', 'name specialization')
    .lean();

  // 5. Broadcast real-time event
  wsService.broadcastQueueUpdate(clinicId, doctorId, {
    type: 'WALK_IN_ADDED',
    tokenId,
    isUrgent,
    patientName,
  });

  return ApiResponse.created(res, populatedVisit, `Walk-in token #${tokenId} issued`);
});

/**
 * Update visit status (Reception / Doctor: NO_SHOW, CANCELLED, etc.)
 * PUT /api/v1/visits/:id/status
 */
const updateVisitStatus = wrapAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['CHECKED_IN', 'IN_QUEUE', 'CHECK_UP', 'DONE', 'NO_SHOW', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    throw ApiError.badRequest(`Invalid status '${status}'`, 'INVALID_STATUS');
  }

  const visit = await Visit.findById(id);
  if (!visit) {
    throw ApiError.notFound('Visit not found', 'VISIT_NOT_FOUND');
  }

  visit.status = status;
  if (status === 'DONE') {
    visit.consultEndedAt = new Date();
  }
  await visit.save();

  // Broadcast update
  wsService.broadcastQueueUpdate(visit.clinicId.toString(), visit.doctorId.toString(), {
    type: 'STATUS_UPDATED',
    visitId: visit._id,
    tokenId: visit.tokenId,
    newStatus: status,
  });

  return ApiResponse.success(res, { visitId: visit._id, status: visit.status }, `Visit status changed to ${status}`);
});

/**
 * Toggle urgent priority on visit
 * PUT /api/v1/visits/:id/priority
 */
const togglePriority = wrapAsync(async (req, res) => {
  const { id } = req.params;

  const visit = await Visit.findById(id);
  if (!visit) {
    throw ApiError.notFound('Visit not found', 'VISIT_NOT_FOUND');
  }

  visit.isUrgent = !visit.isUrgent;
  if (visit.isUrgent) {
    visit.checkedInAt = new Date(Date.now() - 3600000 * 2);
  } else {
    visit.checkedInAt = new Date();
  }

  await visit.save();

  wsService.broadcastQueueUpdate(visit.clinicId.toString(), visit.doctorId.toString(), {
    type: 'PRIORITY_CHANGED',
    tokenId: visit.tokenId,
    isUrgent: visit.isUrgent,
  });

  return ApiResponse.success(res, { visitId: visit._id, isUrgent: visit.isUrgent }, 'Priority updated');
});

/**
 * Manual Check-In by Receptionist (Overrides Camera/Time constraints)
 * POST /api/v1/visits/check-in/manual
 */
const manualCheckIn = wrapAsync(async (req, res) => {
  const { appointmentId, overrideReason = 'Patient mobile device unavailable' } = req.body;
  const todayStr = new Date().toISOString().split('T')[0];

  const appointment = await Appointment.findById(appointmentId).populate('doctorId', 'name specialization');
  if (!appointment) {
    throw ApiError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  }

  const existingVisit = await Visit.findOne({ appointmentId, status: { $ne: 'CANCELLED' } });
  if (existingVisit) {
    throw ApiError.badRequest(`Already checked in with Token #${existingVisit.tokenId}`, 'ALREADY_CHECKED_IN');
  }

  const tokenId = await mintToken(appointment.doctorId._id, todayStr);

  const visit = await Visit.create({
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId._id,
    clinicId: appointment.clinicId,
    visitDate: todayStr,
    tokenId,
    status: 'IN_QUEUE',
    checkedInAt: new Date(),
    notes: `Manual check-in: ${overrideReason}`,
  });

  wsService.broadcastQueueUpdate(appointment.clinicId.toString(), appointment.doctorId._id.toString(), {
    type: 'MANUAL_CHECKIN',
    tokenId,
  });

  return ApiResponse.created(res, { visitId: visit._id, tokenId, status: visit.status }, `Manual check-in completed. Token #${tokenId}`);
});

/**
 * Reception KPI Aggregates
 * GET /api/v1/visits/reception-kpi
 */
const getReceptionKPI = wrapAsync(async (req, res) => {
  const { clinicId, date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const query = { visitDate: targetDate };
  if (clinicId) query.clinicId = clinicId;

  const [waitingInLobby, inConsultation, completedToday, noShows, totalVisits] = await Promise.all([
    Visit.countDocuments({ ...query, status: 'IN_QUEUE' }),
    Visit.countDocuments({ ...query, status: 'CHECK_UP' }),
    Visit.countDocuments({ ...query, status: 'DONE' }),
    Visit.countDocuments({ ...query, status: 'NO_SHOW' }),
    Visit.countDocuments(query),
  ]);

  return ApiResponse.success(
    res,
    {
      waitingInLobby,
      inConsultation,
      completedToday,
      noShows,
      totalVisits,
    },
    'Reception KPIs calculated'
  );
});

/**
 * Doctor: Get live consultation desk queue for today
 * GET /api/v1/visits/my-queue
 */
const getMyQueue = wrapAsync(async (req, res) => {
  const doctorId = req.user.sub;
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Fetch currently active encounter (CHECK_UP)
  const activeVisit = await Visit.findOne({
    doctorId,
    visitDate: todayStr,
    status: 'CHECK_UP',
  })
    .populate('patientId', 'name username email phone')
    .populate('appointmentId', 'appointmentTime type notes')
    .lean();

  // 2. Fetch all waiting patients in queue (IN_QUEUE), ordered by priority then arrival
  const upNext = await Visit.find({
    doctorId,
    visitDate: todayStr,
    status: 'IN_QUEUE',
  })
    .sort({ isUrgent: -1, checkedInAt: 1 })
    .populate('patientId', 'name username email phone')
    .populate('appointmentId', 'appointmentTime type notes')
    .lean();

  // 3. Count completed visits today
  const completedCount = await Visit.countDocuments({
    doctorId,
    visitDate: todayStr,
    status: 'DONE',
  });

  // 4. Fetch doctor's availability status
  const doctorUser = await User.findById(doctorId).select('availability name').lean();

  return ApiResponse.success(
    res,
    {
      activeVisit,
      upNext,
      completedCount,
      doctorStatus: doctorUser?.availability?.status || 'AVAILABLE',
      breakUntil: doctorUser?.availability?.breakUntil || null,
      totalWaiting: upNext.length,
    },
    'Doctor queue retrieved successfully'
  );
});

/**
 * Doctor: Start consultation and call patient into cabin
 * PUT /api/v1/visits/:id/start
 */
const startConsultation = wrapAsync(async (req, res) => {
  const doctorId = req.user.sub;
  const { id } = req.params;
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Concurrency Guard: Check if another consultation is already active
  const existingActive = await Visit.findOne({
    doctorId,
    visitDate: todayStr,
    status: 'CHECK_UP',
    _id: { $ne: id },
  });

  if (existingActive) {
    throw ApiError.badRequest(
      `An active consultation is already in progress with Token #${existingActive.tokenId}. Please complete or pause it first.`,
      'ACTIVE_ENCOUNTER_EXISTS',
      { activeTokenId: existingActive.tokenId }
    );
  }

  // 2. Fetch and verify visit
  const visit = await Visit.findOne({ _id: id, doctorId }).populate('patientId', 'name email phone');
  if (!visit) {
    throw ApiError.notFound('Visit not found or does not belong to your schedule', 'VISIT_NOT_FOUND');
  }

  // 3. Update status to CHECK_UP
  visit.status = 'CHECK_UP';
  visit.consultStartedAt = new Date();
  await visit.save();

  // 4. Broadcast real-time call to patient and queue updates
  wsService.notifyPatientCall(visit.patientId._id.toString(), {
    visitId: visit._id,
    tokenId: visit.tokenId,
    doctorName: req.user.name,
    cabin: 'Cabin 02',
    timestamp: new Date().toISOString(),
  });

  wsService.broadcastQueueUpdate(visit.clinicId.toString(), doctorId.toString(), {
    type: 'CONSULT_STARTED',
    visitId: visit._id,
    tokenId: visit.tokenId,
    patientName: visit.patientId.name,
  });

  return ApiResponse.success(
    res,
    {
      visitId: visit._id,
      tokenId: visit.tokenId,
      status: visit.status,
      consultStartedAt: visit.consultStartedAt,
      patient: {
        id: visit.patientId._id,
        name: visit.patientId.name,
        phone: visit.patientId.phone,
      },
    },
    `Token #${visit.tokenId} called for consultation.`
  );
});

/**
 * Doctor: Complete consultation, record vitals and diagnosis notes
 * PUT /api/v1/visits/:id/complete
 */
const completeConsultation = wrapAsync(async (req, res) => {
  const doctorId = req.user.sub;
  const { id } = req.params;
  const { vitals, notes } = req.body;

  const visit = await Visit.findOne({ _id: id, doctorId }).populate('patientId', 'name email');
  if (!visit) {
    throw ApiError.notFound('Visit not found or does not belong to your schedule', 'VISIT_NOT_FOUND');
  }

  // 1. Mark as DONE and calculate duration
  visit.status = 'DONE';
  visit.consultEndedAt = new Date();

  const startedAt = visit.consultStartedAt || visit.checkedInAt || new Date();
  const durationMs = visit.consultEndedAt.getTime() - new Date(startedAt).getTime();
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

  // 2. Record vitals if provided
  if (vitals) {
    visit.vitals = {
      bp: vitals.bp ? String(vitals.bp).trim() : null,
      sugar: vitals.sugar != null && vitals.sugar !== '' ? Number(vitals.sugar) : null,
      weight: vitals.weight != null && vitals.weight !== '' ? Number(vitals.weight) : null,
    };
  }

  // 3. Record consultation notes
  if (notes !== undefined) {
    visit.notes = String(notes || '').trim();
  }

  await visit.save();

  // 4. Notify patient and broadcast queue update
  wsService.notifyPatientCompleted(visit.patientId._id.toString(), {
    visitId: visit._id,
    tokenId: visit.tokenId,
    durationMinutes,
  });

  wsService.broadcastQueueUpdate(visit.clinicId.toString(), doctorId.toString(), {
    type: 'CONSULT_COMPLETED',
    visitId: visit._id,
    tokenId: visit.tokenId,
    durationMinutes,
  });

  return ApiResponse.success(
    res,
    {
      visitId: visit._id,
      tokenId: visit.tokenId,
      status: visit.status,
      consultEndedAt: visit.consultEndedAt,
      durationMinutes,
      vitals: visit.vitals,
      notes: visit.notes,
    },
    `Consultation for Token #${visit.tokenId} completed successfully.`
  );
});

module.exports = {
  checkIn,
  getMyStatus,
  cancelVisit,
  getAllVisits,
  addWalkIn,
  updateVisitStatus,
  togglePriority,
  manualCheckIn,
  getReceptionKPI,
  getMyQueue,
  startConsultation,
  completeConsultation,
};
