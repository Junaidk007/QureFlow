const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const availabilitySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['AVAILABLE', 'ON_BREAK'],
      default: 'AVAILABLE',
    },
    breakUntil: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['PATIENT', 'DOCTOR', 'RECEPTIONIST'],
      required: [true, 'User role is required'],
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric and underscore only'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      default: null,
    },
    specialization: {
      type: String,
      trim: true,
      default: null,
    },
    availability: {
      type: availabilitySchema,
      default: () => ({ status: 'AVAILABLE', breakUntil: null }),
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

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ clinicId: 1 });

// Helper method to compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.passwordHash);
};

// Transform to remove sensitive passwordHash from JSON responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
