require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Clinic = require('../models/Clinic');

async function seedClinic() {
  await connectDB();

  const existing = await Clinic.findOne({ name: 'City Central Health Clinic' });
  if (existing) {
    if (!existing.checkInStartTime || !existing.checkInEndTime) {
      existing.checkInStartTime = '09:00';
      existing.checkInEndTime = '12:00';
      await existing.save();
      console.log(`[Seed] Updated clinic check-in window to 09:00 - 12:00`);
    }
    console.log(`[Seed] Clinic already exists with ID: ${existing._id}`);
  } else {
    const clinic = await Clinic.create({
      name: 'City Central Health Clinic',
      address: '104 Healthcare Boulevard, Suite 300, Metro City',
      checkInStartTime: '09:00',
      checkInEndTime: '12:00',
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
