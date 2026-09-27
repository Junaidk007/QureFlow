const express = require('express');
const mongoose = require('mongoose');
const wrapAsync = require('../../utils/wrapAsync');
const ApiResponse = require('../../utils/apiResponse');

const router = express.Router();

router.get(
  '/health',
  wrapAsync(async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    return ApiResponse.success(
      res,
      {
        service: 'QureFlow API',
        uptime: Math.round(process.uptime()),
        database: dbStatus,
        timestamp: new Date().toISOString(),
      },
      'QureFlow backend service is healthy'
    );
  })
);

module.exports = router;
