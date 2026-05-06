/**
 * DeepDetect — Email Verification Token Model
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const emailVerificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  email:  { type: String, required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
  used: { type: Boolean, default: false },
});

emailVerificationSchema.statics.createToken = async function (userId, email) {
  await this.deleteMany({ userId });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await this.create({
    userId, email, tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });
  return rawToken;
};

emailVerificationSchema.statics.verifyAndConsume = async function (rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const doc = await this.findOne({ tokenHash, used: false, expiresAt: { $gt: new Date() } });
  if (!doc) return null;
  await this.updateOne({ _id: doc._id }, { $set: { used: true } });
  return { userId: doc.userId, email: doc.email };
};

module.exports = mongoose.model('EmailVerificationToken', emailVerificationSchema);
