require('dotenv').config();
const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const app = require('../src/app');
const wsService = require('../src/services/wsService');
const Clinic = require('../src/models/Clinic');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const Visit = require('../src/models/Visit');
const { signJWT } = require('../src/services/sessionService');

// Helper to make HTTP JSON requests against running test server
function makeRequest(serverPort, path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    if (token) headers['Authorization'] = `Bearer ${token}`;

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
            resolve({ statusCode: res.statusCode, body: JSON.parse(resData) });
          } catch {
            resolve({ statusCode: res.statusCode, raw: resData });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Phase 4 & Phase 5 Verification Tests ---');
  await connectDB();

  // Create isolated test HTTP server with WS engine
  const testServer = http.createServer(app);
  wsService.init(testServer);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;

  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Find test clinic & staff
    const clinic = await Clinic.findOne({ name: 'City Central Health Clinic' });
    assert(clinic, 'Test clinic must exist');

    const doctor = await User.findOne({ email: 'doctor@qureflow.com' });
    assert(doctor, 'Test doctor must exist');

    const receptionist = await User.findOne({ email: 'reception@qureflow.com' });
    assert(receptionist, 'Test receptionist must exist');

    const receptionistToken = signJWT(receptionist);

    // Create a fresh test patient
    const testPatient = await User.create({
      name: 'Bob QueueTester',
      email: `bob_${Date.now()}@example.com`,
      passwordHash: 'dummyhash',
      role: 'PATIENT',
    });
    const patientToken = signJWT(testPatient);

    const now = new Date();
    const currentSlotTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const appt = await Appointment.create({
      patientId: testPatient._id,
      doctorId: doctor._id,
      clinicId: clinic._id,
      appointmentDate: todayStr,
      appointmentTime: currentSlotTime,
      status: 'BOOKED',
    });
    console.log(`✓ Created test appointment: ${appt._id} for today at ${appt.appointmentTime}`);

    // 1. Patient QR Check-In POST /api/v1/visits/check-in
    console.log('\n[1] Testing POST /api/v1/visits/check-in');
    const checkInRes = await makeRequest(
      port,
      '/api/v1/visits/check-in',
      'POST',
      {
        clinicId: clinic._id.toString(),
        appointmentId: appt._id.toString(),
      },
      patientToken
    );
    assert.strictEqual(checkInRes.statusCode, 201);
    assert.strictEqual(checkInRes.body.status, 'success');
    assert(checkInRes.body.data.tokenId, 'Check-in must return minted tokenId');
    assert.strictEqual(checkInRes.body.data.status, 'IN_QUEUE');
    const mintedToken = checkInRes.body.data.tokenId;
    console.log(`✓ Check-in successful: Minted Token #${mintedToken}, ETA range: ${checkInRes.body.data.eta.formattedRange}`);

    // 2. Duplicate Check-in Prevention
    console.log('\n[2] Testing Duplicate Check-In Prevention');
    const dupCheckInRes = await makeRequest(
      port,
      '/api/v1/visits/check-in',
      'POST',
      {
        clinicId: clinic._id.toString(),
        appointmentId: appt._id.toString(),
      },
      patientToken
    );
    assert.strictEqual(dupCheckInRes.statusCode, 400);
    assert.strictEqual(dupCheckInRes.body.code, 'ALREADY_CHECKED_IN');
    console.log('✓ Duplicate check-in properly blocked with 400 ALREADY_CHECKED_IN');

    // 3. Patient Queue Status GET /api/v1/visits/my-status
    console.log('\n[3] Testing GET /api/v1/visits/my-status');
    const statusRes = await makeRequest(port, '/api/v1/visits/my-status', 'GET', null, patientToken);
    assert.strictEqual(statusRes.statusCode, 200);
    assert.strictEqual(statusRes.body.data.hasActiveVisit, true);
    assert.strictEqual(statusRes.body.data.visit.tokenId, mintedToken);
    assert.strictEqual(statusRes.body.data.visit.status, 'IN_QUEUE');
    console.log(`✓ Live status verified: Token #${mintedToken} is in queue with status ${statusRes.body.data.visit.status}`);

    // 4. Receptionist View All Visits GET /api/v1/visits
    console.log('\n[4] Testing GET /api/v1/visits (Receptionist Console)');
    const allVisitsRes = await makeRequest(
      port,
      `/api/v1/visits?clinicId=${clinic._id}&date=${todayStr}`,
      'GET',
      null,
      receptionistToken
    );
    assert.strictEqual(allVisitsRes.statusCode, 200);
    assert(Array.isArray(allVisitsRes.body.data), 'Must return array of visits');
    const foundVisit = allVisitsRes.body.data.find((v) => v.tokenId === mintedToken);
    assert(foundVisit, `Minted token #${mintedToken} must appear on reception dashboard`);
    console.log(`✓ Receptionist successfully listed ${allVisitsRes.body.data.length} visit(s) in clinic today`);

    // 5. Receptionist Adds Walk-In Patient POST /api/v1/visits/walk-in
    console.log('\n[5] Testing POST /api/v1/visits/walk-in (Receptionist Walk-In)');
    const walkInRes = await makeRequest(
      port,
      '/api/v1/visits/walk-in',
      'POST',
      {
        clinicId: clinic._id.toString(),
        patientName: 'Emma Walker',
        phone: '5551234567',
        doctorId: doctor._id.toString(),
        type: 'NEW',
        isUrgent: true,
      },
      receptionistToken
    );
    assert.strictEqual(walkInRes.statusCode, 201);
    assert(walkInRes.body.data.tokenId, 'Walk-in must be minted a tokenId');
    assert.strictEqual(walkInRes.body.data.isUrgent, true);
    const walkInToken = walkInRes.body.data.tokenId;
    console.log(`✓ Walk-in patient registered: Token #${walkInToken} (Urgent Priority: true)`);

    // 6. Receptionist Toggles Priority PUT /api/v1/visits/:id/priority
    console.log('\n[6] Testing PUT /api/v1/visits/:id/priority');
    const priorityRes = await makeRequest(
      port,
      `/api/v1/visits/${walkInRes.body.data._id}/priority`,
      'PUT',
      null,
      receptionistToken
    );
    assert.strictEqual(priorityRes.statusCode, 200);
    assert.strictEqual(priorityRes.body.data.isUrgent, false);
    console.log('✓ Priority toggled successfully');

    // 7. Receptionist Updates Status PUT /api/v1/visits/:id/status (e.g. NO_SHOW)
    console.log('\n[7] Testing PUT /api/v1/visits/:id/status');
    const statusUpdateRes = await makeRequest(
      port,
      `/api/v1/visits/${walkInRes.body.data._id}/status`,
      'PUT',
      { status: 'NO_SHOW' },
      receptionistToken
    );
    assert.strictEqual(statusUpdateRes.statusCode, 200);
    assert.strictEqual(statusUpdateRes.body.data.status, 'NO_SHOW');
    console.log('✓ Status updated to NO_SHOW');

    // 8. Receptionist KPI Aggregates GET /api/v1/visits/reception-kpi
    console.log('\n[8] Testing GET /api/v1/visits/reception-kpi');
    const kpiRes = await makeRequest(
      port,
      `/api/v1/visits/reception-kpi?clinicId=${clinic._id}&date=${todayStr}`,
      'GET',
      null,
      receptionistToken
    );
    assert.strictEqual(kpiRes.statusCode, 200);
    assert(typeof kpiRes.body.data.waitingInLobby === 'number');
    assert(typeof kpiRes.body.data.noShows === 'number');
    assert(kpiRes.body.data.noShows >= 1, 'Should reflect at least 1 no-show');
    console.log(`✓ Reception KPIs: Waiting: ${kpiRes.body.data.waitingInLobby}, No-shows: ${kpiRes.body.data.noShows}, Total: ${kpiRes.body.data.totalVisits}`);

    // 9. Patient Leaves Queue POST /api/v1/visits/cancel
    console.log('\n[9] Testing POST /api/v1/visits/cancel (Patient Leaves Queue)');
    const cancelRes = await makeRequest(port, '/api/v1/visits/cancel', 'POST', null, patientToken);
    assert.strictEqual(cancelRes.statusCode, 200);
    assert.strictEqual(cancelRes.body.data.status, 'CANCELLED');
    console.log('✓ Patient successfully cancelled queue visit');

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 4 & PHASE 5 BACKEND API TESTS PASSED! 🎉');
    console.log('======================================================\n');
  } finally {
    testServer.close();
    await mongoose.connection.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Phase 4 & 5 verification failed:', err);
  process.exit(1);
});
