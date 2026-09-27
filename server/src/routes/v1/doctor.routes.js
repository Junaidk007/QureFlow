const express = require('express');
const { getActiveDoctors, updateDoctorStatus } = require('../../controllers/doctor.controller');
const authMiddleware = require('../../middleware/authMiddleware');
const roleGuard = require('../../middleware/roleGuard');
const validate = require('../../middleware/validate');
const { doctorStatusSchema } = require('../../validators/doctor.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/active', getActiveDoctors);
router.put('/status', roleGuard('DOCTOR'), validate(doctorStatusSchema), updateDoctorStatus);

module.exports = router;
