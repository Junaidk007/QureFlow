const express = require('express');
const { getAllClinics } = require('../../controllers/clinic.controller');

const router = express.Router();

router.get('/', getAllClinics);

module.exports = router;
