const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const clinicRoutes = require('./clinic.routes');
const doctorRoutes = require('./doctor.routes');
const appointmentRoutes = require('./appointment.routes');
const visitRoutes = require('./visit.routes');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/clinics', clinicRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/visits', visitRoutes);

module.exports = router;
