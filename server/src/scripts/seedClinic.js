require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Clinic = require('../models/Clinic');

async function seedClinic() {
  await connectDB();

  const existing = await Clinic.findOne({ name: 'City Central Health Clinic' });
  if (existing) {
    console.log(`[Seed] Clinic already exists with ID: ${existing._id}`);
  } else {
    const clinic = await Clinic.create({
      name: 'City Central Health Clinic',
      address: '104 Healthcare Boulevard, Suite 300, Metro City',
      checkInWindowStartMinutes: 15,
      checkInWindowEndMinutes: 15,
    });
    console.log(`[Seed] Successfully created test clinic with ID: ${clinic._id}`);
  }

  await mongoose.connection.close();
  process.exit(0);
}

seedClinic().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
