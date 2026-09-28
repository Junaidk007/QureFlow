const express = require('express');
const {
  getAllClinics,
  getClinicById,
  updateCheckInWindow,
} = require('../../controllers/clinic.controller');
const authMiddleware = require('../../middleware/authMiddleware');

const router = express.Router();

router.get('/', getAllClinics);
router.get('/:id', authMiddleware, getClinicById);
router.put('/:id/checkin-window', authMiddleware, updateCheckInWindow);

module.exports = router;
