require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

async function seedUsers() {
  await connectDB();

  let clinic = await Clinic.findOne({ name: 'City Central Health Clinic' });
  if (!clinic) {
    clinic = await Clinic.create({
      name: 'City Central Health Clinic',
      address: '104 Healthcare Boulevard, Suite 300, Metro City',
      checkInWindowStartMinutes: 15,
      checkInWindowEndMinutes: 15,
    });
  }

  const defaultPassword = 'password123';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  // 1. Doctor: Dr. Sarah Jenkins (Cardiology)
  const doctorExists = await User.findOne({ email: { $in: ['sarah.jenkins@qureflow.com', 'doctor@qureflow.com'] } });
  if (!doctorExists) {
    const doctor = await User.create({
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.jenkins@qureflow.com',
      passwordHash,
      role: 'DOCTOR',
      clinicId: clinic._id,
      specialization: 'Cardiology & General Medicine',
      availability: { status: 'AVAILABLE', breakUntil: null },
    });
    console.log(`[Seed] Created Doctor: ${doctor.name} (${doctor.email})`);
  } else if (doctorExists.email !== 'sarah.jenkins@qureflow.com') {
    // Keep an alias or create sarah.jenkins
    const sarah = await User.findOne({ email: 'sarah.jenkins@qureflow.com' });
    if (!sarah) {
      await User.create({
        name: 'Dr. Sarah Jenkins',
        email: 'sarah.jenkins@qureflow.com',
        passwordHash,
        role: 'DOCTOR',
        clinicId: clinic._id,
        specialization: 'Cardiology & General Medicine',
        availability: { status: 'AVAILABLE', breakUntil: null },
      });
      console.log(`[Seed] Created Doctor: Dr. Sarah Jenkins (sarah.jenkins@qureflow.com)`);
    }
  }

  // 2. Doctor: Dr. Michael Chen (Pediatrics)
  const doctor2Exists = await User.findOne({ email: 'chen@qureflow.com' });
  if (!doctor2Exists) {
    const doctor2 = await User.create({
      name: 'Dr. Michael Chen',
      email: 'chen@qureflow.com',
      passwordHash,
      role: 'DOCTOR',
      clinicId: clinic._id,
      specialization: 'Pediatrics & Family Medicine',
      availability: { status: 'AVAILABLE', breakUntil: null },
    });
    console.log(`[Seed] Created Doctor: ${doctor2.name} (${doctor2.email})`);
  }

  // 3. Receptionist: Mark Davies
  const receptionExists = await User.findOne({ email: 'reception@qureflow.com' });
  if (!receptionExists) {
    const reception = await User.create({
      name: 'Mark Davies',
      email: 'reception@qureflow.com',
      passwordHash,
      role: 'RECEPTIONIST',
      clinicId: clinic._id,
    });
    console.log(`[Seed] Created Receptionist: ${reception.name} (${reception.email})`);
  }

  // 4. Test Patient: John Doe / patient@qureflow.com
  const patientExists = await User.findOne({ email: 'patient@qureflow.com' });
  if (!patientExists) {
    const patient = await User.create({
      name: 'Test Patient',
      username: 'testpatient',
      email: 'patient@qureflow.com',
      passwordHash,
      role: 'PATIENT',
    });
    console.log(`[Seed] Created Patient: ${patient.name} (${patient.email}, username: ${patient.username})`);
  }

  console.log('[Seed] Users seeded successfully with password: "password123"');
  await mongoose.connection.close();
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error('[Seed Users Error]', err);
  process.exit(1);
});
