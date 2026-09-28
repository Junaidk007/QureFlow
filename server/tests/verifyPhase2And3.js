require('dotenv').config();
const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const app = require('../src/app');
const Clinic = require('../src/models/Clinic');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');

// Helper to make HTTP JSON requests against running test server
function makeRequest(serverPort, path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: serverPort,
        path,
        method,
        headers,
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            const parsed = resData ? JSON.parse(resData) : {};
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (err) {
            resolve({ statusCode: res.statusCode, raw: resData });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Phase 2 & Phase 3 Verification Tests ---');
  await connectDB();

  // Create isolated test HTTP server
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;

  try {
    // 1. Clinics List
    console.log('\n[1] Testing GET /api/v1/clinics');
    const clinicsRes = await makeRequest(port, '/api/v1/clinics');
    assert.strictEqual(clinicsRes.statusCode, 200);
    assert.strictEqual(clinicsRes.body.status, 'success');
    assert(Array.isArray(clinicsRes.body.data) && clinicsRes.body.data.length > 0, 'Clinics array must not be empty');
    const testClinic = clinicsRes.body.data[0];
    console.log(`✓ Retrieved clinic: ${testClinic.name} (${testClinic._id})`);

    // 2. Patient Registration
    console.log('\n[2] Testing POST /api/v1/auth/register');
    const testUsername = `testuser_${Date.now()}`;
    const testEmail = `test_${Date.now()}@example.com`;
    const regRes = await makeRequest(port, '/api/v1/auth/register', 'POST', {
      name: 'Alice Johnson',
      username: testUsername,
      email: testEmail,
      password: 'password123',
    });
    assert.strictEqual(regRes.statusCode, 201);
    assert.strictEqual(regRes.body.status, 'success');
    assert(regRes.body.data.token, 'Registration must return JWT token');
    assert.strictEqual(regRes.body.data.user.role, 'PATIENT');
    const patientToken = regRes.body.data.token;
    console.log(`✓ Patient registered with token: ${patientToken.substring(0, 16)}...`);

    // Uniqueness validation check
    const dupRes = await makeRequest(port, '/api/v1/auth/register', 'POST', {
      name: 'Alice Johnson',
      username: testUsername,
      email: `other_${Date.now()}@example.com`,
      password: 'password123',
    });
    assert.strictEqual(dupRes.statusCode, 409);
    assert.strictEqual(dupRes.body.code, 'USERNAME_TAKEN');
    console.log('✓ Duplicate username properly rejected with 409 USERNAME_TAKEN');

    // 3. Patient Login (with username)
    console.log('\n[3] Testing POST /api/v1/auth/login (Patient with username)');
    const loginRes = await makeRequest(port, '/api/v1/auth/login', 'POST', {
      identifier: testUsername,
      password: 'password123',
    });
    assert.strictEqual(loginRes.statusCode, 200);
    assert.strictEqual(loginRes.body.status, 'success');
    assert.strictEqual(loginRes.body.data.user.username, testUsername);
    console.log('✓ Patient login verified with username identifier');

    // 4. Staff Login (Doctor with clinicId & role)
    console.log('\n[4] Testing POST /api/v1/auth/login (Staff: Doctor)');
    const staffLoginRes = await makeRequest(port, '/api/v1/auth/login', 'POST', {
      identifier: 'doctor@qureflow.com',
      password: 'password123',
      clinicId: testClinic._id.toString(),
      role: 'DOCTOR',
    });
    assert.strictEqual(staffLoginRes.statusCode, 200);
    assert.strictEqual(staffLoginRes.body.data.user.role, 'DOCTOR');
    const doctorToken = staffLoginRes.body.data.token;
    console.log(`✓ Doctor login successful with 12h staff token`);

    // 5. Protected Profile GET /api/v1/auth/me
    console.log('\n[5] Testing GET /api/v1/auth/me');
    const meRes = await makeRequest(port, '/api/v1/auth/me', 'GET', null, patientToken);
    assert.strictEqual(meRes.statusCode, 200);
    assert.strictEqual(meRes.body.data.email, testEmail);
    console.log('✓ Protected /auth/me profile verified');

    // 6. Active Doctors GET /api/v1/doctors/active
    console.log('\n[6] Testing GET /api/v1/doctors/active');
    const doctorsRes = await makeRequest(port, '/api/v1/doctors/active', 'GET', null, patientToken);
    assert.strictEqual(doctorsRes.statusCode, 200);
    assert(doctorsRes.body.data.length > 0, 'Active doctors list must not be empty');
    const testDoctor = doctorsRes.body.data[0];
    console.log(`✓ Retrieved active doctor: ${testDoctor.name} (${testDoctor.specialization})`);

    // 7. Slots Grid GET /api/v1/appointments/slots
    console.log('\n[7] Testing GET /api/v1/appointments/slots');
    const testDate = '2026-10-20';
    const slotsRes = await makeRequest(
      port,
      `/api/v1/appointments/slots?doctorId=${testDoctor._id}&date=${testDate}`,
      'GET',
      null,
      patientToken
    );
    assert.strictEqual(slotsRes.statusCode, 200);
    assert(slotsRes.body.data.slots.length > 0, 'Slots grid must return time slots');
    const firstAvailable = slotsRes.body.data.slots.find((s) => !s.isBooked);
    assert(firstAvailable, 'Must have at least one available slot');
    console.log(`✓ Slots grid loaded: ${slotsRes.body.data.slots.length} slots. First available: ${firstAvailable.time}`);

    // 8. Book Slot POST /api/v1/appointments
    console.log('\n[8] Testing POST /api/v1/appointments (Slot Booking)');
    const bookRes = await makeRequest(
      port,
      '/api/v1/appointments',
      'POST',
      {
        doctorId: testDoctor._id.toString(),
        clinicId: testClinic._id.toString(),
        appointmentDate: testDate,
        appointmentTime: firstAvailable.time,
        type: 'NEW',
      },
      patientToken
    );
    assert.strictEqual(bookRes.statusCode, 201);
    assert.strictEqual(bookRes.body.status, 'success');
    assert(bookRes.body.data.appointmentId, 'Must return appointmentId');
    assert(bookRes.body.data.details.checkInWindow, 'Must return check-in window metadata');
    console.log(`✓ Booked slot ${firstAvailable.time}. Check-in notice: "${bookRes.body.data.details.checkInWindow.notice}"`);

    // 9. Atomic Slot Collision Check (Double booking same slot)
    console.log('\n[9] Testing Slot Collision (Double-booking prevention)');
    const collisionRes = await makeRequest(
      port,
      '/api/v1/appointments',
      'POST',
      {
        doctorId: testDoctor._id.toString(),
        clinicId: testClinic._id.toString(),
        appointmentDate: testDate,
        appointmentTime: firstAvailable.time,
        type: 'FOLLOW-UP',
      },
      patientToken
    );
    assert.strictEqual(collisionRes.statusCode, 409);
    assert(
      collisionRes.body.code === 'APPOINTMENT_ALREADY_EXISTS' || collisionRes.body.code === 'SLOT_ALREADY_TAKEN',
      'Should return duplicate booking error code'
    );
    console.log(`✓ Duplicate booking properly prevented with 409 ${collisionRes.body.code}`);

    // 10. Patient's Upcoming Appointment GET /api/v1/appointments/my-upcoming
    console.log('\n[10] Testing GET /api/v1/appointments/my-upcoming');
    const upcomingRes = await makeRequest(port, '/api/v1/appointments/my-upcoming', 'GET', null, patientToken);
    assert.strictEqual(upcomingRes.statusCode, 200);
    assert(upcomingRes.body.data, 'Upcoming appointment must be present');
    assert.strictEqual(upcomingRes.body.data.appointmentTime, firstAvailable.time);
    console.log(`✓ Upcoming appointment verified for ${upcomingRes.body.data.appointmentDate} at ${upcomingRes.body.data.appointmentTime}`);

    // 11. Patient Visit/Queue Status GET /api/v1/visits/my-status
    console.log('\n[11] Testing GET /api/v1/visits/my-status');
    const statusRes = await makeRequest(port, '/api/v1/visits/my-status', 'GET', null, patientToken);
    assert.strictEqual(statusRes.statusCode, 200);
    assert.strictEqual(statusRes.body.data.hasActiveVisit, false);
    console.log('✓ Visit status correctly returns hasActiveVisit: false when not checked in yet');

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 2 & PHASE 3 BACKEND API TESTS PASSED! 🎉');
    console.log('======================================================\n');
  } finally {
    testServer.close();
    await mongoose.connection.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Phase 2 & 3 verification failed:', err);
  process.exit(1);
});
