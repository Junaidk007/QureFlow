const Visit = require('../models/Visit');
const User = require('../models/User');

const DEFAULT_AVG_CONSULT_MINUTES = 10;

/**
 * Compute dynamic estimated wait time range for a patient in queue.
 *
 * Rules:
 * 1. Rolling average of last 5 DONE visits for this doctor.
 * 2. Count active patients ahead in queue (status: IN_QUEUE, CHECKED_IN).
 * 3. Add estimated remaining time of the ongoing active consult (CHECK_UP).
 * 4. ETA is strictly a range (minMinutes - maxMinutes), never a single static timestamp.
 *
 * @param {string|ObjectId} doctorId
 * @param {string} visitDate - YYYY-MM-DD
 * @param {Object} currentVisit - The visit document or { _id, checkedInAt }
 * @returns {Promise<{ minMinutes: number, maxMinutes: number, formattedRange: string, patientsAhead: number, avgConsultMinutes: number }>}
 */
const computeETA = async (doctorId, visitDate, currentVisit) => {
  if (!doctorId || !visitDate) {
    return {
      minMinutes: 0,
      maxMinutes: 10,
      formattedRange: '0–10 mins',
      patientsAhead: 0,
      avgConsultMinutes: DEFAULT_AVG_CONSULT_MINUTES,
    };
  }

  // 1. Calculate rolling average duration from last 5 completed visits
  const lastCompletedVisits = await Visit.find({
    doctorId,
    status: 'DONE',
    consultStartedAt: { $ne: null },
    consultEndedAt: { $ne: null },
  })
    .sort({ consultEndedAt: -1 })
    .limit(5)
    .lean();

  let avgConsultMinutes = DEFAULT_AVG_CONSULT_MINUTES;

  if (lastCompletedVisits.length > 0) {
    const totalMinutes = lastCompletedVisits.reduce((acc, v) => {
      const durationMs = new Date(v.consultEndedAt) - new Date(v.consultStartedAt);
      const minutes = Math.max(2, Math.round(durationMs / 60000));
      return acc + minutes;
    }, 0);
    avgConsultMinutes = Math.round(totalMinutes / lastCompletedVisits.length);
    // Clamp reasonable doctor consultation average between 4 and 35 mins
    avgConsultMinutes = Math.max(4, Math.min(avgConsultMinutes, 35));
  }

  // 2. Check if doctor currently has a patient in CHECK_UP
  const activeConsult = await Visit.findOne({
    doctorId,
    visitDate,
    status: 'CHECK_UP',
  }).lean();

  let remainingActiveMinutes = 0;
  if (activeConsult && activeConsult.consultStartedAt) {
    const elapsedMinutes = (Date.now() - new Date(activeConsult.consultStartedAt).getTime()) / 60000;
    remainingActiveMinutes = Math.max(1, Math.round(avgConsultMinutes - elapsedMinutes));
  }

  // 3. Count patients ahead in queue
  let patientsAhead = 0;
  if (currentVisit && currentVisit._id) {
    const query = {
      doctorId,
      visitDate,
      status: { $in: ['IN_QUEUE', 'CHECKED_IN'] },
      _id: { $ne: currentVisit._id },
    };

    if (currentVisit.checkedInAt) {
      query.checkedInAt = { $lt: new Date(currentVisit.checkedInAt) };
    }

    patientsAhead = await Visit.countDocuments(query);
  }

  // Check if doctor is on break
  const doctor = await User.findById(doctorId).select('availability').lean();
  let breakMinutes = 0;
  if (doctor && doctor.availability && doctor.availability.status === 'ON_BREAK' && doctor.availability.breakUntil) {
    const breakRemaining = Math.round((new Date(doctor.availability.breakUntil).getTime() - Date.now()) / 60000);
    if (breakRemaining > 0) {
      breakMinutes = breakRemaining;
    }
  }

  // 4. Calculate range
  // Minimum estimation: quick consultation pace (80% of average)
  const minPace = Math.max(3, Math.floor(avgConsultMinutes * 0.8));
  // Maximum estimation: thorough consultation pace (125% of average)
  const maxPace = Math.ceil(avgConsultMinutes * 1.25);

  let minMinutes = breakMinutes + remainingActiveMinutes + patientsAhead * minPace;
  let maxMinutes = breakMinutes + remainingActiveMinutes + patientsAhead * maxPace;

  // If next up or active
  if (patientsAhead === 0 && !activeConsult && breakMinutes === 0) {
    minMinutes = 0;
    maxMinutes = 5;
  } else if (patientsAhead === 0 && activeConsult) {
    minMinutes = Math.max(1, remainingActiveMinutes);
    maxMinutes = Math.max(minMinutes + 3, remainingActiveMinutes + 5);
  } else {
    // Ensure minimum reasonable spread of at least 5 minutes
    if (maxMinutes - minMinutes < 5) {
      maxMinutes = minMinutes + 5;
    }
  }

  return {
    minMinutes,
    maxMinutes,
    formattedRange: `${minMinutes}–${maxMinutes} mins`,
    patientsAhead,
    avgConsultMinutes,
  };
};

module.exports = {
  computeETA,
};
