const express = require('express');
const {
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
} = require('../../controllers/visit.controller');
const authMiddleware = require('../../middleware/authMiddleware');
const roleGuard = require('../../middleware/roleGuard');
const validate = require('../../middleware/validate');
const { checkInSchema, walkInSchema, completeSchema } = require('../../validators/visit.validator');

const router = express.Router();

router.use(authMiddleware);

// Doctor Consultation Desk Routes (Must precede parameter routes like /:id)
router.get('/my-queue', roleGuard('DOCTOR'), getMyQueue);
router.put('/:id/start', roleGuard('DOCTOR'), startConsultation);
router.put('/:id/complete', roleGuard('DOCTOR'), validate(completeSchema), completeConsultation);

// Patient Check-In & Queue Routes
router.post('/check-in', validate(checkInSchema), checkIn);
router.get('/my-status', getMyStatus);
router.post('/cancel', cancelVisit);

// Reception Console & Staff Routes
router.get('/', roleGuard('RECEPTIONIST', 'DOCTOR'), getAllVisits);
router.get('/reception-kpi', roleGuard('RECEPTIONIST', 'DOCTOR'), getReceptionKPI);
router.post('/walk-in', roleGuard('RECEPTIONIST'), validate(walkInSchema), addWalkIn);
router.put('/:id/status', roleGuard('RECEPTIONIST', 'DOCTOR'), updateVisitStatus);
router.put('/:id/priority', roleGuard('RECEPTIONIST'), togglePriority);
router.post('/check-in/manual', roleGuard('RECEPTIONIST'), manualCheckIn);

module.exports = router;
