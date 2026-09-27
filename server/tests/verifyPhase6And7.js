const mongoose = require('mongoose');
const http = require('http');
const WebSocket = require('ws');
const app = require('../src/app');
const wsService = require('../src/services/wsService');
const User = require('../src/models/User');
const Clinic = require('../src/models/Clinic');
const Appointment = require('../src/models/Appointment');
const Visit = require('../src/models/Visit');
const { signJWT } = require('../src/services/sessionService');

async function runTests() {
  console.log('--- Starting Phase 6 & Phase 7 Verification Tests ---');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qureflow');
  }
  console.log('[Database] MongoDB Connected:', mongoose.connection.host);

  // Spin up test HTTP + WS server on free port
  const server = http.createServer(app);
  wsService.init(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const wsUrl = `ws://127.0.0.1:${port}`;

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentSlotTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. Get seed clinic and staff
    const clinic = await Clinic.findOne().lean();
    if (!clinic) throw new Error('Clinic not found. Seed first.');

    const doctor = await User.findOne({ role: 'DOCTOR' }).lean();
    if (!doctor) throw new Error('Doctor not found. Seed first.');

    const patient = await User.findOne({ role: 'PATIENT' }).lean();
    if (!patient) throw new Error('Patient not found. Seed first.');

    // Create 2nd patient for concurrency testing
    let patient2 = await User.findOne({ email: 'patient2.p6@example.com' }).lean();
    if (!patient2) {
      patient2 = await User.create({
        name: 'Patient Two',
        username: 'patienttwo',
        email: 'patient2.p6@example.com',
        role: 'PATIENT',
        passwordHash: 'dummyhash',
      });
    }

    const doctorToken = signJWT(doctor);
    const patientToken = signJWT(patient);

    // Clean up any stale CHECK_UP visits for doctor today
    await Visit.updateMany(
      { doctorId: doctor._id, visitDate: todayStr, status: 'CHECK_UP' },
      { status: 'DONE', consultEndedAt: new Date() }
    );

    // Setup 2 appointments and visits for today
    const appt1 = await Appointment.create({
      clinicId: clinic._id,
      patientId: patient._id,
      doctorId: doctor._id,
      appointmentDate: todayStr,
      appointmentTime: currentSlotTime,
      status: 'BOOKED',
    });

    const appt2 = await Appointment.create({
      clinicId: clinic._id,
      patientId: patient2._id,
      doctorId: doctor._id,
      appointmentDate: todayStr,
      appointmentTime: currentSlotTime,
      status: 'BOOKED',
    });

    const visit1 = await Visit.create({
      appointmentId: appt1._id,
      patientId: patient._id,
      doctorId: doctor._id,
      clinicId: clinic._id,
      visitDate: todayStr,
      tokenId: `P6-1`,
      status: 'IN_QUEUE',
      checkedInAt: new Date(Date.now() - 600000), // 10 mins ago
    });

    const visit2 = await Visit.create({
      appointmentId: appt2._id,
      patientId: patient2._id,
      doctorId: doctor._id,
      clinicId: clinic._id,
      visitDate: todayStr,
      tokenId: `P6-2`,
      status: 'IN_QUEUE',
      checkedInAt: new Date(Date.now() - 300000), // 5 mins ago
    });

    // Connect WebSocket client for patient 1 to verify real-time events
    const patientWs = new WebSocket(`${wsUrl}?token=${patientToken}`);
    const receivedEvents = [];

    await new Promise((resolve) => {
      patientWs.on('open', () => {
        patientWs.on('message', (msg) => {
          const parsed = JSON.parse(msg.toString());
          receivedEvents.push(parsed);
        });
        resolve();
      });
    });

    console.log('\n[1] Testing GET /api/v1/visits/my-queue (Doctor Desk Initial Queue)');
    const queueRes = await fetch(`${baseUrl}/visits/my-queue`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    const queueData = await queueRes.json();
    if (queueRes.status !== 200 || !queueData.data.upNext) {
      throw new Error(`Failed to get doctor queue: ${JSON.stringify(queueData)}`);
    }
    console.log(
      `✓ Doctor queue loaded: ${queueData.data.upNext.length} waiting, Active: ${
        queueData.data.activeVisit ? queueData.data.activeVisit.tokenId : 'None'
      }`
    );

    console.log('\n[2] Testing PUT /api/v1/visits/:id/start (Doctor Calls Patient)');
    const startRes = await fetch(`${baseUrl}/visits/${visit1._id}/start`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    const startData = await startRes.json();
    if (startRes.status !== 200 || startData.data.status !== 'CHECK_UP') {
      throw new Error(`Failed to start consultation: ${JSON.stringify(startData)}`);
    }
    console.log(`✓ Consultation started for Token #${startData.data.tokenId} (status: CHECK_UP)`);

    // Verify Patient WebSocket received VISIT_CALLED
    await new Promise((r) => setTimeout(r, 200));
    const callEvent = receivedEvents.find((e) => e.event === 'VISIT_CALLED');
    if (!callEvent) {
      throw new Error('Patient WebSocket did not receive VISIT_CALLED event!');
    }
    console.log(`✓ Real-time event VISIT_CALLED received by patient: Cabin=${callEvent.payload.cabin}`);

    console.log('\n[3] Testing Concurrency Guard (Doctor cannot call second patient simultaneously)');
    const conflictRes = await fetch(`${baseUrl}/visits/${visit2._id}/start`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    const conflictData = await conflictRes.json();
    if (conflictRes.status !== 400 || conflictData.code !== 'ACTIVE_ENCOUNTER_EXISTS') {
      throw new Error(
        `Concurrency guard failed: Expected 400 ACTIVE_ENCOUNTER_EXISTS, got ${conflictRes.status} ${JSON.stringify(
          conflictData
        )}`
      );
    }
    console.log(
      `✓ Concurrency guard successfully blocked second active consultation (Code: ${conflictData.code})`
    );

    console.log('\n[4] Testing PUT /api/v1/visits/:id/complete (Doctor Records Vitals & Finishes)');
    const vitalsPayload = {
      vitals: {
        bp: '124/82',
        sugar: 98,
        weight: 72.5,
      },
      notes: 'Patient presented with mild pharyngitis. Prescribed paracetamol and warm hydration.',
    };

    const completeRes = await fetch(`${baseUrl}/visits/${visit1._id}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify(vitalsPayload),
    });
    const completeData = await completeRes.json();
    if (completeRes.status !== 200 || completeData.data.status !== 'DONE') {
      throw new Error(`Failed to complete consultation: ${JSON.stringify(completeData)}`);
    }
    if (
      completeData.data.vitals.bp !== '124/82' ||
      completeData.data.vitals.sugar !== 98 ||
      completeData.data.vitals.weight !== 72.5
    ) {
      throw new Error(`Vitals not recorded properly: ${JSON.stringify(completeData.data.vitals)}`);
    }
    console.log(
      `✓ Consultation marked DONE. Vitals recorded: BP=${completeData.data.vitals.bp}, Sugar=${completeData.data.vitals.sugar}, Duration=${completeData.data.durationMinutes}m`
    );

    // Verify Patient WebSocket received VISIT_COMPLETED
    await new Promise((r) => setTimeout(r, 200));
    const completedEvent = receivedEvents.find((e) => e.event === 'VISIT_COMPLETED');
    if (!completedEvent) {
      throw new Error('Patient WebSocket did not receive VISIT_COMPLETED event!');
    }
    console.log(`✓ Real-time event VISIT_COMPLETED received by patient`);

    console.log('\n[5] Testing PUT /api/v1/doctors/status (Toggle Break Mode)');
    const breakRes = await fetch(`${baseUrl}/doctors/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({ status: 'ON_BREAK', breakMinutes: 15 }),
    });
    const breakData = await breakRes.json();
    if (breakRes.status !== 200 || breakData.data.status !== 'ON_BREAK') {
      throw new Error(`Failed to set doctor on break: ${JSON.stringify(breakData)}`);
    }
    console.log(`✓ Doctor break mode activated until: ${breakData.data.breakUntil}`);

    // Restore doctor to available
    const resumeRes = await fetch(`${baseUrl}/doctors/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({ status: 'AVAILABLE' }),
    });
    const resumeData = await resumeRes.json();
    if (resumeRes.status !== 200 || resumeData.data.status !== 'AVAILABLE') {
      throw new Error(`Failed to restore doctor availability: ${JSON.stringify(resumeData)}`);
    }
    console.log(`✓ Doctor returned to ACTIVE/AVAILABLE status`);

    // Clean up
    patientWs.close();
    await Visit.deleteMany({ _id: { $in: [visit1._id, visit2._id] } });
    await Appointment.deleteMany({ _id: { $in: [appt1._id, appt2._id] } });

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 6 & PHASE 7 BACKEND API TESTS PASSED! 🎉');
    console.log('======================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
