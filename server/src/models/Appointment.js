const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor ID is required'],
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: [true, 'Clinic ID is required'],
    },
    appointmentDate: {
      type: String,
      required: [true, 'Appointment date is required (YYYY-MM-DD)'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'],
    },
    appointmentTime: {
      type: String,
      required: [true, 'Appointment time is required (HH:mm)'],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Time format must be HH:mm (24-hour)'],
    },
    type: {
      type: String,
      enum: ['NEW', 'FOLLOW-UP'],
      default: 'NEW',
    },
    status: {
      type: String,
      enum: ['BOOKED', 'CANCELLED'],
      default: 'BOOKED',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound and individual indexes
appointmentSchema.index({ appointmentDate: 1, appointmentTime: 1, doctorId: 1 });
appointmentSchema.index({ patientId: 1 });
appointmentSchema.index({ clinicId: 1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
