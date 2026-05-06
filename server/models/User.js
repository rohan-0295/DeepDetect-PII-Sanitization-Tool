/**
 * DeepDetect — User Model
 * Secure user schema with bcrypt hashing and RBAC
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const ROLES = ['user', 'analyst', 'admin', 'compliance_officer'];
const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
      maxlength: [254, 'Email too long'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned in queries by default
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: [100, 'Display name too long'],
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'user',
    },
    organization: {
      type: String,
      trim: true,
      maxlength: [200, 'Organization name too long'],
    },
    // Security tracking
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    lastLoginAt: {
      type: Date,
    },
    lastLoginIp: {
      type: String,
    },
    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // API usage stats
    totalScans: {
      type: Number,
      default: 0,
    },
    totalPIIFound: {
      type: Number,
      default: 0,
    },
    // Compliance
    dataProcessingConsent: {
      type: Boolean,
      default: false,
    },
    consentTimestamp: {
      type: Date,
    },
    legalBasis: {
      type: String,
      enum: ['consent', 'legitimate_interest', 'legal_obligation', 'vital_interest', 'public_task', 'contract'],
      default: 'consent',
    },
    // 2FA (future)
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.loginAttempts;
        delete ret.lockUntil;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indices ──────────────────────────────────────────────────────────────────
// NOTE: email and userId indexes are created automatically by unique:true above.
// Only add compound/non-unique indexes here to avoid duplicate index warnings.
userSchema.index({ role: 1, isActive: 1 });

// ─── Virtual: isLocked ────────────────────────────────────────────────────────
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ─── Pre-save: Hash Password ──────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Method: Compare Password ─────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Method: Increment Login Attempts ────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

userSchema.methods.incLoginAttempts = async function () {
  // If previous lock has expired, restart the counter
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  if (this.loginAttempts + 1 >= MAX_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }

  return this.updateOne(updates);
};

// ─── Method: Reset Login Attempts ────────────────────────────────────────────
userSchema.methods.resetLoginAttempts = async function (ip) {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLoginAt: new Date(), lastLoginIp: ip },
    $unset: { lockUntil: 1 },
  });
};

// ─── Static: Safe Find ───────────────────────────────────────────────────────
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() }).select('+password');
};

const User = mongoose.model('User', userSchema);
module.exports = User;
