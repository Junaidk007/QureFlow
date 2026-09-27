const express = require('express');
const { register, login, getMe } = require('../../controllers/auth.controller');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/authMiddleware');
const { registerSchema, loginSchema } = require('../../validators/auth.validator');

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authMiddleware, getMe);

module.exports = router;
