/**
 * DeepDetect — Password Reset Token Model
 * Stores hashed tokens only — raw token is sent via email and never persisted
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    // TTL index — MongoDB auto-deletes expired documents
    index: { expireAfterSeconds: 0 },
  },
  used: {
    type: Boolean,
    default: false,
  },
  ipAddress: {
    type: String, // hashed
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ─── Static: Create a new token ───────────────────────────────────────────────
passwordResetTokenSchema.statics.createToken = async function (userId, ipHash) {
  // Invalidate any existing unused tokens for this user
  await this.deleteMany({ userId });

  // Generate 48-byte cryptographically secure raw token
  const rawToken = crypto.randomBytes(48).toString('hex');

  // Only store the SHA-256 hash
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await this.create({ userId, tokenHash, expiresAt: expires, ipAddress: ipHash });

  return rawToken; // Return raw token for email — never stored
};

// ─── Static: Verify + consume token ──────────────────────────────────────────
passwordResetTokenSchema.statics.verifyAndConsume = async function (rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const doc = await this.findOne({
    tokenHash,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!doc) return null;

  // Mark as used immediately (one-time use)
  await this.updateOne({ _id: doc._id }, { $set: { used: true } });

  return doc.userId;
};

const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
module.exports = PasswordResetToken;
