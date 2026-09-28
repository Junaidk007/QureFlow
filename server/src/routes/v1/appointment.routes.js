const express = require('express');
const {
  getAvailableSlots,
  bookAppointment,
  getMyUpcomingAppointment,
  getMyAppointments,
  cancelAppointment,
} = require('../../controllers/appointment.controller');
const authMiddleware = require('../../middleware/authMiddleware');
const validate = require('../../middleware/validate');
const { appointmentSchema } = require('../../validators/appointment.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/slots', getAvailableSlots);
router.post('/', validate(appointmentSchema), bookAppointment);
router.get('/my-upcoming', getMyUpcomingAppointment);
router.get('/my-appointments', getMyAppointments);
router.put('/:id/cancel', cancelAppointment);

module.exports = router;
