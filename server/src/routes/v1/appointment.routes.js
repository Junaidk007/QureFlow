const express = require('express');
const {
  getAvailableSlots,
  bookAppointment,
  getMyUpcomingAppointment,
} = require('../../controllers/appointment.controller');
const authMiddleware = require('../../middleware/authMiddleware');
const validate = require('../../middleware/validate');
const { appointmentSchema } = require('../../validators/appointment.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/slots', getAvailableSlots);
router.post('/', validate(appointmentSchema), bookAppointment);
router.get('/my-upcoming', getMyUpcomingAppointment);

module.exports = router;
