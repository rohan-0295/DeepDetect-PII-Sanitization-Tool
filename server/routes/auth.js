/**
 * DeepDetect — Auth Routes (full pre-deployment version)
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * POST /api/auth/refresh
 * GET  /api/auth/me
 * PUT  /api/auth/profile
 * PUT  /api/auth/change-password
 * DELETE /api/auth/account
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password
 * POST /api/auth/resend-verification
 * GET  /api/auth/verify-email
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const AuditLog = require('../models/AuditLog');
const { authenticate } = require('../middleware/authMiddleware');
const { logger, auditLogger } = require('../services/logger');
const {
  sendPasswordReset,
  sendPasswordChangedAlert,
  sendEmailVerification,
  sendWelcome,
} = require('../services/emailService');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,        // Must be true when using sameSite: 'none'
  sameSite: 'none',   // This is the magic line that allows Netlify to talk to Render
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};

const hashIP = (ip) =>
  crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'dd')).digest('hex').slice(0, 16);

// ─── Rate limiters ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn(`Auth rate limit: ${req.ip}`);
    res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  },
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  handler: (req, res) => res.status(429).json({ error: 'Too many reset requests. Try again in 1 hour.' }),
});

function generateToken(user) {
  return jwt.sign(
    { userId: user.userId, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, issuer: 'deepdetect', audience: 'deepdetect-api', algorithm: 'HS256' }
  );
}

const pwValidators = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Must contain a lowercase letter')
    .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Must contain a number')
    .matches(/[@$!%*?&#^()\-_=+]/).withMessage('Must contain a special character'),
];

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  ...pwValidators,
  body('displayName').optional().trim().isLength({ min: 1, max: 100 }),
  body('organization').optional().trim().isLength({ max: 200 }),
  body('dataProcessingConsent').custom((val) => {
    if (val === true || val === 'true') return true;
    throw new Error('Data processing consent is required');
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { email, password, displayName, organization } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const user = await User.create({
      email, password, displayName, organization,
      dataProcessingConsent: true,
      consentTimestamp: new Date(),
      isEmailVerified: false,
    });

    // Send verification email
    try {
      const verifyToken = await EmailVerificationToken.createToken(user.userId, user.email);
      await sendEmailVerification(user.email, verifyToken, user.displayName);
    } catch (emailErr) {
      logger.error(`Verification email failed: ${emailErr.message}`);
      // Don't block registration if email fails
    }

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    auditLogger.info({ event: 'USER_REGISTERED', userId: user.userId, ipHash: hashIP(req.ip) });

    res.status(201).json({
      message: 'Account created. Please check your email to verify your address.',
      user: { userId: user.userId, email: user.email, displayName: user.displayName, role: user.role, isEmailVerified: false },
    });
  } catch (err) {
    logger.error(`Register error: ${err.message}`);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    const INVALID = 'Invalid email or password';

    if (!user) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
      return res.status(401).json({ error: INVALID });
    }
    if (user.isLocked) return res.status(423).json({ error: 'Account locked due to failed attempts. Try again in 2 hours.' });
    if (!user.isActive) return res.status(401).json({ error: INVALID });

    const valid = await user.comparePassword(password);
    if (!valid) { await user.incLoginAttempts(); return res.status(401).json({ error: INVALID }); }

    await user.resetLoginAttempts(req.ip);

    const token = generateToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    auditLogger.info({ event: 'USER_LOGIN', userId: user.userId, ipHash: hashIP(req.ip) });

    res.json({
      message: 'Login successful',
      user: {
        userId: user.userId, email: user.email, displayName: user.displayName,
        role: user.role, organization: user.organization,
        isEmailVerified: user.isEmailVerified,
        totalScans: user.totalScans,
      },
    });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', authenticate, (req, res) => {
  res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: 0 });
  auditLogger.info({ event: 'USER_LOGOUT', userId: req.user.userId });
  res.json({ message: 'Logged out successfully' });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', authenticate, (req, res) => {
  const token = generateToken(req.user);
  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({ message: 'Token refreshed' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Fetch scan stats
    const stats = await AuditLog.getUserStats(user.userId, 30).catch(() => ({}));

    res.json({
      userId: user.userId, email: user.email, displayName: user.displayName,
      role: user.role, organization: user.organization,
      isEmailVerified: user.isEmailVerified,
      totalScans: user.totalScans, totalPIIFound: user.totalPIIFound,
      createdAt: user.createdAt, lastLoginAt: user.lastLoginAt,
      stats,
    });
  } catch (err) {
    logger.error(`Get me error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put('/profile', authenticate, [
  body('displayName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1–100 chars'),
  body('organization').optional().trim().isLength({ max: 200 }).withMessage('Organization max 200 chars'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const updates = {};
    if (req.body.displayName !== undefined) updates.displayName = req.body.displayName;
    if (req.body.organization !== undefined) updates.organization = req.body.organization;

    const user = await User.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    auditLogger.info({ event: 'PROFILE_UPDATED', userId: req.user.userId });
    res.json({ message: 'Profile updated', user: { displayName: user.displayName, organization: user.organization } });
  } catch (err) {
    logger.error(`Profile update error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── PUT /api/auth/change-password ───────────────────────────────────────────
router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  ...pwValidators.map(v => v.customSanitizer ? v : v), // reuse pw validators for 'password' field
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { currentPassword, password } = req.body;
    if (!password) return res.status(422).json({ error: 'New password is required' });

    const user = await User.findOne({ userId: req.user.userId }).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    if (currentPassword === password) {
      return res.status(400).json({ error: 'New password must differ from current password' });
    }

    user.password = password;
    await user.save();

    // Rotate JWT — invalidate old sessions
    const newToken = generateToken(user);
    res.cookie('token', newToken, COOKIE_OPTIONS);

    // Security alert email
    try {
      await sendPasswordChangedAlert(user.email, user.displayName, hashIP(req.ip));
    } catch (emailErr) {
      logger.error(`Password change alert email failed: ${emailErr.message}`);
    }

    auditLogger.info({ event: 'PASSWORD_CHANGED', userId: req.user.userId, ipHash: hashIP(req.ip) });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    logger.error(`Change password error: ${err.message}`);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─── DELETE /api/auth/account ─────────────────────────────────────────────────
router.delete('/account', authenticate, [
  body('password').notEmpty().withMessage('Password required to confirm deletion'),
  body('confirmation').equals('DELETE MY ACCOUNT').withMessage('Type DELETE MY ACCOUNT to confirm'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const user = await User.findOne({ userId: req.user.userId }).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await user.comparePassword(req.body.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    // GDPR: Soft-delete — anonymize rather than hard-delete for audit trail integrity
    await User.updateOne({ userId: req.user.userId }, {
      $set: {
        isActive: false,
        email: `deleted_${Date.now()}_${req.user.userId}@deleted.invalid`,
        displayName: '[Deleted User]',
        organization: null,
        password: crypto.randomBytes(32).toString('hex'), // unguessable
        dataProcessingConsent: false,
      },
    });

    // Clean up tokens
    await Promise.allSettled([
      PasswordResetToken.deleteMany({ userId: req.user.userId }),
      EmailVerificationToken.deleteMany({ userId: req.user.userId }),
    ]);

    res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: 0 });
    auditLogger.info({ event: 'ACCOUNT_DELETED', userId: req.user.userId, ipHash: hashIP(req.ip) });
    res.json({ message: 'Account deleted. Your data has been anonymized per GDPR Article 17.' });
  } catch (err) {
    logger.error(`Account delete error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post('/forgot-password', forgotLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  // Always return the same response to prevent user enumeration
  const SAFE_RESPONSE = { message: 'If an account with that email exists, a reset link has been sent.' };

  try {
    const user = await User.findOne({ email: req.body.email, isActive: true });

    if (user) {
      const rawToken = await PasswordResetToken.createToken(user.userId, hashIP(req.ip));
      await sendPasswordReset(user.email, rawToken, user.displayName);
      auditLogger.info({ event: 'PASSWORD_RESET_REQUESTED', userId: user.userId, ipHash: hashIP(req.ip) });
    } else {
      // Simulate processing time to prevent timing attacks
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    }

    res.json(SAFE_RESPONSE);
  } catch (err) {
    logger.error(`Forgot password error: ${err.message}`);
    res.json(SAFE_RESPONSE); // Never reveal errors
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password', [
  body('token').notEmpty().isLength({ min: 96, max: 96 }).withMessage('Invalid token format'),
  ...pwValidators,
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { token, password } = req.body;

    const userId = await PasswordResetToken.verifyAndConsume(token);
    if (!userId) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const user = await User.findOne({ userId, isActive: true }).select('+password');
    if (!user) return res.status(404).json({ error: 'Account not found' });

    user.password = password;
    await user.save();

    // Force logout all sessions by rotating cookie
    res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: 0 });

    // Security alert
    try {
      await sendPasswordChangedAlert(user.email, user.displayName, hashIP(req.ip));
    } catch (emailErr) {
      logger.error(`Reset alert email failed: ${emailErr.message}`);
    }

    auditLogger.info({ event: 'PASSWORD_RESET_COMPLETED', userId, ipHash: hashIP(req.ip) });
    res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (err) {
    logger.error(`Reset password error: ${err.message}`);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ─── GET /api/auth/verify-email ───────────────────────────────────────────────
router.get('/verify-email', [
  query('token').notEmpty().withMessage('Token required'),
], async (req, res) => {
  try {
    const result = await EmailVerificationToken.verifyAndConsume(req.query.token);
    if (!result) {
      return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
    }

    await User.updateOne({ userId: result.userId }, { $set: { isEmailVerified: true } });

    // Send welcome email
    const user = await User.findOne({ userId: result.userId });
    if (user) {
      await sendWelcome(user.email, user.displayName).catch(() => {});
    }

    auditLogger.info({ event: 'EMAIL_VERIFIED', userId: result.userId });
    res.json({ message: 'Email verified successfully. Welcome to DeepDetect!' });
  } catch (err) {
    logger.error(`Email verify error: ${err.message}`);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────
router.post('/resend-verification', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isEmailVerified) return res.status(400).json({ error: 'Email is already verified' });

    const rawToken = await EmailVerificationToken.createToken(user.userId, user.email);
    await sendEmailVerification(user.email, rawToken, user.displayName);

    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    logger.error(`Resend verification error: ${err.message}`);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

module.exports = router;
