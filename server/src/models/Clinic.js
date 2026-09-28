const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Clinic name is required'],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    checkInStartTime: {
      type: String,
      default: '09:00',
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Time format must be HH:mm (24-hour)'],
    },
    checkInEndTime: {
      type: String,
      default: '12:00',
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Time format must be HH:mm (24-hour)'],
    },
    checkInWindowStartMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    checkInWindowEndMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

clinicSchema.index({ name: 1 });

module.exports = mongoose.model('Clinic', clinicSchema);
