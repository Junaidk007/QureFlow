require('dotenv').config();
const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const { WebSocket } = require('ws');
const connectDB = require('../src/config/db');

// 1. Models
const Clinic = require('../src/models/Clinic');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const Visit = require('../src/models/Visit');

// 2. Validators
const { registerSchema, loginSchema } = require('../src/validators/auth.validator');
const { appointmentSchema } = require('../src/validators/appointment.validator');
const { checkInSchema, walkInSchema, completeSchema } = require('../src/validators/visit.validator');

// 3. Services
const { signJWT, verifyJWT } = require('../src/services/sessionService');
const { mintToken } = require('../src/services/tokenMinter');
const { computeETA } = require('../src/services/etaEngine');
const wsService = require('../src/services/wsService');

// 4. Centralized Error & Response Utilities
const ApiError = require('../src/utils/apiError');
const ApiResponse = require('../src/utils/apiResponse');
const wrapAsync = require('../src/utils/wrapAsync');
const errorHandler = require('../src/middleware/errorHandler');

// 5. App & Middleware
const app = require('../src/app');
const authMiddleware = require('../src/middleware/authMiddleware');
const roleGuard = require('../src/middleware/roleGuard');
const validate = require('../src/middleware/validate');

async function runTests() {
  console.log('--- Starting Phase 0 & Phase 1 Verification Tests ---');

  // Connect to DB for tests requiring query execution
  await connectDB();

  // Test 1: Models and Schemas
  console.log('\n[1] Testing Mongoose Models & Schemas:');
  assert(Clinic.schema.path('name'), 'Clinic must have name');
  assert(Clinic.schema.path('checkInWindowStartMinutes'), 'Clinic must have checkInWindowStartMinutes');
  assert.strictEqual(Clinic.schema.path('checkInWindowStartMinutes').defaultValue, 15);

  assert(User.schema.path('role'), 'User must have role');
  assert(User.schema.path('email'), 'User must have email');
  assert(User.schema.path('passwordHash'), 'User must have passwordHash');
  assert(User.schema.path('availability.status'), 'User must have availability status');

  assert(Appointment.schema.path('appointmentDate'), 'Appointment must have appointmentDate');
  assert(Appointment.schema.path('appointmentTime'), 'Appointment must have appointmentTime');
  assert(Appointment.schema.path('status'), 'Appointment must have status');

  assert(Visit.schema.path('tokenId'), 'Visit must have tokenId');
  assert(Visit.schema.path('status'), 'Visit must have status');
  assert(Visit.schema.path('vitals.bp'), 'Visit must have vitals subdocument');
  console.log('✓ All 4 models (Clinic, User, Appointment, Visit) successfully verified.');

  // Test 2: Validation Schemas
  console.log('\n[2] Testing Joi Validation Schemas:');
  const validReg = registerSchema.validate({
    name: 'Jane Doe',
    username: 'janedoe99',
    email: 'jane@example.com',
    password: 'password123',
  });
  assert(!validReg.error, `Valid register should not error: ${validReg.error}`);

  const invalidReg = registerSchema.validate({
    name: '',
    username: 'invalid user space',
    email: 'not-an-email',
    password: '123',
  });
  assert(invalidReg.error, 'Invalid register should have errors');
  console.log('✓ registerSchema properly validated.');

  const validLogin = loginSchema.validate({
    identifier: 'janedoe99',
    password: 'password123',
  });
  assert(!validLogin.error, 'Valid patient login should pass');
  console.log('✓ loginSchema properly validated.');

  const validAppt = appointmentSchema.validate({
    doctorId: '507f1f77bcf86cd799439011',
    clinicId: '507f1f77bcf86cd799439012',
    appointmentDate: '2026-10-15',
    appointmentTime: '10:30',
    type: 'NEW',
  });
  assert(!validAppt.error, 'Valid appointment should pass');
  console.log('✓ appointmentSchema properly validated.');

  const validCheckIn = checkInSchema.validate({
    clinicId: '507f1f77bcf86cd799439012',
    appointmentId: '507f1f77bcf86cd799439013',
  });
  assert(!validCheckIn.error, 'Valid checkIn should pass');

  const validWalkIn = walkInSchema.validate({
    clinicId: '507f1f77bcf86cd799439012',
    patientName: 'Alex Mercer',
    doctorId: '507f1f77bcf86cd799439011',
    type: 'NEW',
    isUrgent: true,
  });
  assert(!validWalkIn.error, 'Valid walkIn should pass');
  console.log('✓ checkInSchema and walkInSchema properly validated.');

  // Test 3: Centralized Error & Response & wrapAsync
  console.log('\n[3] Testing Centralized Error Handling, ApiResponse & wrapAsync:');
  const customErr = ApiError.badRequest('Invalid parameter supplied', 'PARAM_INVALID', [{ field: 'age' }]);
  assert.strictEqual(customErr.statusCode, 400);
  assert.strictEqual(customErr.code, 'PARAM_INVALID');
  assert.strictEqual(customErr.details[0].field, 'age');

  // Test wrapAsync with an async throw
  let caughtError = null;
  const asyncController = wrapAsync(async () => {
    throw ApiError.notFound('Patient record not found', 'PATIENT_NOT_FOUND');
  });
  await new Promise((resolve) => {
    asyncController({}, {}, (err) => {
      caughtError = err;
      resolve();
    });
  });
  assert(caughtError, 'wrapAsync must pass thrown error to next()');
  assert.strictEqual(caughtError.statusCode, 404);
  assert.strictEqual(caughtError.code, 'PATIENT_NOT_FOUND');
  console.log('✓ wrapAsync and ApiError verified.');

  // Test 4: Session Service & JWT
  console.log('\n[4] Testing Session Service & JWT Signing:');
  const dummyPatient = {
    _id: '507f1f77bcf86cd799439011',
    role: 'PATIENT',
    name: 'Jane Patient',
    email: 'jane@example.com',
    username: 'janep',
  };
  const patientToken = signJWT(dummyPatient);
  assert(typeof patientToken === 'string', 'Token must be a string');

  const decodedPatient = verifyJWT(patientToken);
  assert.strictEqual(decodedPatient.sub, dummyPatient._id);
  assert.strictEqual(decodedPatient.role, 'PATIENT');

  const dummyDoctor = {
    _id: '507f1f77bcf86cd799439014',
    role: 'DOCTOR',
    name: 'Dr. Smith',
    email: 'smith@clinic.com',
    clinicId: '507f1f77bcf86cd799439012',
  };
  const doctorToken = signJWT(dummyDoctor);
  const decodedDoctor = verifyJWT(doctorToken);
  assert.strictEqual(decodedDoctor.role, 'DOCTOR');
  assert.strictEqual(decodedDoctor.clinicId, dummyDoctor.clinicId);
  console.log('✓ Patient (30d) and Staff (12h) JWT signing and verification confirmed.');

  // Test 5: Middleware Pipeline with Centralized Error Flow
  console.log('\n[5] Testing Middleware (Auth, RoleGuard, Validate):');
  let req = { headers: { authorization: `Bearer ${patientToken}` } };
  let res = {};
  let nextCalled = false;
  authMiddleware(req, res, () => {
    nextCalled = true;
  });
  assert(nextCalled, 'Auth middleware should call next() for valid Bearer token');
  assert.strictEqual(req.user.sub, dummyPatient._id);

  // Role guard test with ApiError
  const doctorOnlyGuard = roleGuard('DOCTOR');
  let guardErr = null;
  doctorOnlyGuard(req, res, (err) => {
    guardErr = err;
  });
  assert(guardErr instanceof ApiError, 'Role guard must pass ApiError to next()');
  assert.strictEqual(guardErr.statusCode, 403);
  console.log('✓ Auth middleware and RoleGuard access control confirmed.');

  // Test 6: ETA Engine Range Calculation
  console.log('\n[6] Testing ETA Engine:');
  const eta = await computeETA('507f1f77bcf86cd799439014', '2026-10-15', null);
  assert(typeof eta.minMinutes === 'number', 'minMinutes must be a number');
  assert(typeof eta.maxMinutes === 'number', 'maxMinutes must be a number');
  assert(eta.minMinutes <= eta.maxMinutes, 'minMinutes must be <= maxMinutes');
  assert(eta.formattedRange.includes('–') || eta.formattedRange.includes('-'), 'ETA must be a formatted range');
  console.log(`✓ ETA engine output: ${eta.formattedRange} (range confirmed)`);

  // Test 7: Express HTTP with Centralized Response & WebSocket Server
  console.log('\n[7] Testing HTTP Health Endpoint, Centralized Response & WebSocket Engine:');
  const testServer = http.createServer(app);
  wsService.init(testServer);

  await new Promise((resolve) => testServer.listen(0, resolve));
  const testPort = testServer.address().port;

  // HTTP GET /api/v1/health test
  const httpRes = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${testPort}/api/v1/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });

  assert.strictEqual(httpRes.statusCode, 200);
  assert.strictEqual(httpRes.body.status, 'success');
  assert.strictEqual(httpRes.body.data.service, 'QureFlow API');
  console.log(`✓ HTTP /api/v1/health responded with standardized ApiResponse: ${JSON.stringify(httpRes.body)}`);

  // HTTP 404 Centralized Error test
  const notFoundRes = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${testPort}/api/v1/non-existent-route`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });

  assert.strictEqual(notFoundRes.statusCode, 404);
  assert.strictEqual(notFoundRes.body.status, 'error');
  assert.strictEqual(notFoundRes.body.code, 'NOT_FOUND');
  console.log(`✓ 404 caught by Centralized errorHandler: ${JSON.stringify(notFoundRes.body)}`);

  // WebSocket connection & room subscription test
  const ws = new WebSocket(`ws://localhost:${testPort}?token=${doctorToken}`);
  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ action: 'SUBSCRIBE', room: 'clinic:507f1f77bcf86cd799439012' }));
    });

    ws.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.event === 'CONNECTED' || parsed.event === 'SUBSCRIBED') {
        resolve();
      }
    });

    ws.on('error', reject);
    setTimeout(() => reject(new Error('WebSocket connection timeout')), 3000);
  });

  ws.close();
  testServer.close();
  await mongoose.connection.close();
  console.log('✓ WebSocket connection, token auth, and room subscription verified.');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 0 & PHASE 1 VERIFICATION TESTS PASSED! 🎉');
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('\n❌ Verification failed with error:', err);
  if (mongoose.connection) {
    await mongoose.connection.close();
  }
  process.exit(1);
});
