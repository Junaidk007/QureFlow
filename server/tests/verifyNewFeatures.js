require('dotenv').config();
const http = require('http');
const assert = require('assert');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Clinic = require('../src/models/Clinic');
const Appointment = require('../src/models/Appointment');
const connectDB = require('../src/config/db');

const makeRequest = (port, path, method = 'GET', data = null, token = null) => {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
          } catch {
            resolve({ statusCode: res.statusCode, body });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

async function testNewFeatures() {
  await connectDB();

  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const port = server.address().port;

  try {
    // 1. Find or create a test clinic and doctor
    let clinic = await Clinic.findOne({ name: 'City Central Health Clinic' });
    if (!clinic) {
      clinic = await Clinic.create({
        name: 'City Central Health Clinic',
        address: '104 Healthcare Boulevard',
        checkInStartTime: '09:00',
        checkInEndTime: '12:00',
      });
    }

    const doctor = await User.findOne({ role: 'DOCTOR' });
    assert(doctor, 'Doctor must exist');

    const { signJWT } = require('../src/services/sessionService');
    const receptionist = await User.findOne({ email: 'reception@qureflow.com' });
    assert(receptionist, 'Receptionist must exist');
    const recepToken = signJWT(receptionist);

    const patient = await User.findOne({ role: 'PATIENT' });
    assert(patient, 'Patient must exist');
    const patientToken = signJWT(patient);

    console.log('\n[1] Testing Receptionist Updating Check-In Window:');
    const updateWindowRes = await makeRequest(
      port,
      `/api/v1/clinics/${clinic._id}/checkin-window`,
      'PUT',
      { checkInStartTime: '08:30', checkInEndTime: '11:45' },
      recepToken
    );
    assert.strictEqual(updateWindowRes.statusCode, 200);
    assert.strictEqual(updateWindowRes.body.data.checkInStartTime, '08:30');
    assert.strictEqual(updateWindowRes.body.data.checkInEndTime, '11:45');
    console.log('✓ Receptionist successfully updated check-in window to 08:30 - 11:45');

    console.log('\n[2] Testing Booking Appointment WITHOUT time slot:');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const apptDate = tomorrow.toISOString().split('T')[0];

    // Clean up any existing appointment for that date
    await Appointment.deleteMany({ patientId: patient._id, appointmentDate: apptDate });

    const bookRes = await makeRequest(
      port,
      '/api/v1/appointments',
      'POST',
      {
        doctorId: doctor._id.toString(),
        clinicId: clinic._id.toString(),
        appointmentDate: apptDate,
        type: 'NEW',
        // Note: NO appointmentTime provided!
      },
      patientToken
    );
    assert.strictEqual(bookRes.statusCode, 201, `Booking should succeed without time slot: ${JSON.stringify(bookRes.body)}`);
    assert(bookRes.body.data.appointmentId, 'Should have appointmentId');
    assert.strictEqual(bookRes.body.data.details.checkInWindow.startTime, '08:30');
    assert.strictEqual(bookRes.body.data.details.checkInWindow.endTime, '11:45');
    console.log('✓ Successfully booked appointment without time slot selection!');
    console.log(`✓ Notice provided: "${bookRes.body.data.details.checkInWindow.notice}"`);

    const apptId = bookRes.body.data.appointmentId;

    console.log('\n[3] Testing GET /api/v1/appointments/my-appointments:');
    const myApptsRes = await makeRequest(port, '/api/v1/appointments/my-appointments', 'GET', null, patientToken);
    assert.strictEqual(myApptsRes.statusCode, 200);
    assert(Array.isArray(myApptsRes.body.data), 'my-appointments should return an array');
    const bookedAppt = myApptsRes.body.data.find((a) => a._id === apptId);
    assert(bookedAppt, 'Created appointment must be in my-appointments');
    assert.strictEqual(bookedAppt.status, 'BOOKED');
    assert.strictEqual(bookedAppt.checkInWindow.startTime, '08:30');
    assert.strictEqual(bookedAppt.checkInWindow.endTime, '11:45');
    console.log(`✓ Retrieved ${myApptsRes.body.data.length} appointments for user, including new booking.`);

    console.log('\n[4] Testing Cancellation Feature PUT /api/v1/appointments/:id/cancel:');
    const cancelRes = await makeRequest(port, `/api/v1/appointments/${apptId}/cancel`, 'PUT', null, patientToken);
    assert.strictEqual(cancelRes.statusCode, 200);
    assert.strictEqual(cancelRes.body.data.status, 'CANCELLED');
    console.log('✓ Appointment successfully cancelled.');

    // Verify it is now cancelled in my-appointments
    const myApptsAfterCancel = await makeRequest(port, '/api/v1/appointments/my-appointments', 'GET', null, patientToken);
    const cancelledAppt = myApptsAfterCancel.body.data.find((a) => a._id === apptId);
    assert.strictEqual(cancelledAppt.status, 'CANCELLED');
    console.log('✓ Cancellation confirmed in my-appointments list.');

    // Reset clinic window back to 09:00 - 12:00
    await makeRequest(
      port,
      `/api/v1/clinics/${clinic._id}/checkin-window`,
      'PUT',
      { checkInStartTime: '09:00', checkInEndTime: '12:00' },
      recepToken
    );

    console.log('\n======================================================');
    console.log('🎉 ALL NEW MVP FEATURES VERIFIED SUCCESSFULLY! 🎉');
    console.log('======================================================\n');
  } finally {
    server.close();
    await mongoose.connection.close();
  }
}

testNewFeatures().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
