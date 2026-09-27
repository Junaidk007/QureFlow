const mongoose = require('mongoose');

const vitalsSchema = new mongoose.Schema(
  {
    bp: {
      type: String,
      trim: true,
      default: null,
    },
    sugar: {
      type: Number,
      default: null,
    },
    weight: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const visitSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null, // Nullable for walk-ins
    },
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
    visitDate: {
      type: String,
      required: [true, 'Visit date is required (YYYY-MM-DD)'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'],
    },
    tokenId: {
      type: String,
      required: [true, 'Token ID is required (e.g. A-17)'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['CHECKED_IN', 'IN_QUEUE', 'CHECK_UP', 'DONE', 'NO_SHOW', 'CANCELLED'],
      default: 'CHECKED_IN',
    },
    isUrgent: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
      default: Date.now,
    },
    consultStartedAt: {
      type: Date,
      default: null,
    },
    consultEndedAt: {
      type: Date,
      default: null,
    },
    vitals: {
      type: vitalsSchema,
      default: () => ({ bp: null, sugar: null, weight: null }),
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for rapid queue lookup and daily stats
visitSchema.index({ doctorId: 1, visitDate: 1, status: 1 });
visitSchema.index({ clinicId: 1, visitDate: 1 });
visitSchema.index({ patientId: 1 });
visitSchema.index({ appointmentId: 1 });

module.exports = mongoose.model('Visit', visitSchema);
