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
