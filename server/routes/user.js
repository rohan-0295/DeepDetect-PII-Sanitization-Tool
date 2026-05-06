/**
 * DeepDetect — User / Profile routes
 * GET  /api/user/stats          — personal usage stats
 * GET  /api/user/export-data    — GDPR data export (Art. 20)
 */

const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../services/logger');

const router = express.Router();

// ─── GET /api/user/stats ──────────────────────────────────────────────────────
router.get('/stats', authenticate, async (req, res) => {
  try {
    const days = Math.min(365, parseInt(req.query.days) || 30);
    const [stats, breakdown, timeline] = await Promise.all([
      AuditLog.getUserStats(req.user.userId, days),
      AuditLog.getPIIBreakdown(req.user.userId, days),
      AuditLog.getScanTimeline(req.user.userId, days),
    ]);
    res.json({ stats, breakdown, timeline, period: days });
  } catch (err) {
    logger.error(`User stats error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /api/user/export-data (GDPR Article 20 — Portability) ───────────────
router.get('/export-data', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const auditLogs = await AuditLog.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .select('-ipAddress -userAgent -__v')
      .limit(1000)
      .lean();

    const exportData = {
      exportedAt: new Date().toISOString(),
      gdprNote: 'This export fulfills your right to data portability under GDPR Article 20. No actual PII from your scans is stored or included.',
      account: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        organization: user.organization,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        isEmailVerified: user.isEmailVerified,
        dataProcessingConsent: user.dataProcessingConsent,
        consentTimestamp: user.consentTimestamp,
        legalBasis: user.legalBasis,
        totalScans: user.totalScans,
        totalPIIFound: user.totalPIIFound,
      },
      auditLogs: auditLogs.map(log => ({
        scanId: log.scanId,
        inputType: log.inputType,
        inputSizeBytes: log.inputSizeBytes,
        sanitizationMode: log.sanitizationMode,
        piiTypesFound: log.piiTypesFound,
        totalPIIFound: log.totalPIIFound,
        riskScore: log.riskScore,
        riskLevel: log.riskLevel,
        dataMinimizationScore: log.dataMinimizationScore,
        status: log.status,
        createdAt: log.createdAt,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="deepdetect-data-export-${Date.now()}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.json(exportData);
  } catch (err) {
    logger.error(`Data export error: ${err.message}`);
    res.status(500).json({ error: 'Data export failed' });
  }
});

module.exports = router;
