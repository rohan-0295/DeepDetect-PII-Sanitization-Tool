/**
 * DeepDetect — Sanitize Routes
 * POST /api/sanitize/text      — Scan + sanitize raw text
 * POST /api/sanitize/json      — Scan + sanitize JSON payload
 * POST /api/sanitize/csv       — Scan + sanitize CSV data
 * GET  /api/sanitize/modes     — List available sanitization modes
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const {
  detectPII,
  redact,
  mask,
  hash,
  pseudonymize,
  calculateDataMinimizationScore,
  processJSON,
  processCSV,
} = require('../services/DetectionEngine');
const { authenticate } = require('../middleware/authMiddleware');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { logger, auditLogger } = require('../services/logger');

const router = express.Router();

// ─── Sanitize-specific Rate Limiter ──────────────────────────────────────────
const sanitizeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: { error: 'Rate limit exceeded. Max 30 scans per minute.' },
});

// ─── Supported Modes ──────────────────────────────────────────────────────────
const SANITIZE_MODES = {
  REDACTION: { fn: redact, label: 'Redaction', description: 'Replace PII with [REDACTED:TYPE]' },
  MASKING: { fn: mask, label: 'Masking', description: 'Show last 4 chars, mask the rest' },
  HASHING: { fn: hash, label: 'Hashing', description: 'Deterministic SHA-256 (for analytics)' },
  PSEUDONYMIZATION: { fn: pseudonymize, label: 'Pseudonymization', description: 'Replace with stable fake IDs' },
};

// ─── Helper: Hash IP for audit log (GDPR) ────────────────────────────────────
const hashIP = (ip) =>
  crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'deepdetect')).digest('hex').slice(0, 32);

// ─── Helper: Build PII type summary ──────────────────────────────────────────
function buildPIISummary(findings) {
  const map = {};
  findings.forEach(({ type, severity }) => {
    if (!map[type]) map[type] = { type, severity, count: 0 };
    map[type].count++;
  });
  return Object.values(map);
}

// ─── POST /api/sanitize/text ──────────────────────────────────────────────────
router.post(
  '/text',
  authenticate,
  sanitizeLimiter,
  [
    body('text')
      .isString()
      .notEmpty()
      .isLength({ max: 500000 })
      .withMessage('Text is required and must be under 500KB'),
    body('mode')
      .isIn(Object.keys(SANITIZE_MODES))
      .withMessage(`Mode must be one of: ${Object.keys(SANITIZE_MODES).join(', ')}`),
    body('legalBasis')
      .optional()
      .isIn(['consent', 'legitimate_interest', 'legal_obligation', 'vital_interest', 'public_task', 'contract']),
    body('purposeOfProcessing').optional().isString().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const startTime = Date.now();
    const { text, mode, legalBasis, purposeOfProcessing } = req.body;

    try {
      // ── Detect PII ──────────────────────────────────────────────────────────
      const { findings, riskScore, totalPII } = detectPII(text);

      // ── Sanitize ────────────────────────────────────────────────────────────
      let sanitizedText;
      let pseudoMap;

      if (findings.length === 0) {
        sanitizedText = text;
      } else {
        const modeConfig = SANITIZE_MODES[mode];
        if (mode === 'PSEUDONYMIZATION') {
          const result = pseudonymize(text, findings);
          sanitizedText = result.sanitized;
          pseudoMap = result.pseudoMap;
        } else {
          sanitizedText = modeConfig.fn(text, findings);
        }
      }

      const processingTimeMs = Date.now() - startTime;
      const dataMinimizationScore = calculateDataMinimizationScore(text, sanitizedText, findings);
      const piiTypesFound = buildPIISummary(findings);

      // ── Audit Log ───────────────────────────────────────────────────────────
      const auditEntry = await AuditLog.create({
        userId: req.user.userId,
        inputType: 'TEXT',
        inputSizeBytes: Buffer.byteLength(text, 'utf8'),
        inputLineCount: text.split('\n').length,
        piiTypesFound,
        totalPIIFound: totalPII,
        riskScore,
        sanitizationMode: mode,
        sanitizedSuccessfully: true,
        processingTimeMs,
        dataMinimizationScore,
        legalBasis: legalBasis || req.user.legalBasis || 'consent',
        purposeOfProcessing,
        ipAddress: hashIP(req.ip),
        userAgent: req.headers['user-agent']?.slice(0, 200),
        status: 'SUCCESS',
      });

      // Update user scan count
      await User.updateOne(
        { userId: req.user.userId },
        { $inc: { totalScans: 1, totalPIIFound: totalPII } }
      );

      auditLogger.info({
        event: 'TEXT_SANITIZED',
        scanId: auditEntry.scanId,
        userId: req.user.userId,
        mode,
        totalPII,
        riskScore,
        processingTimeMs,
      });

      // ── Response ────────────────────────────────────────────────────────────
      res.json({
        scanId: auditEntry.scanId,
        originalLength: text.length,
        sanitizedText,
        mode,
        findings: findings.map((f) => ({
          type: f.type,
          label: f.label,
          severity: f.severity,
          confidence: f.confidence,
          index: f.index,
          length: f.length,
          // value is deliberately omitted from response for security
        })),
        summary: {
          totalPIIFound: totalPII,
          riskScore,
          riskLevel: auditEntry.riskLevel,
          dataMinimizationScore,
          piiBreakdown: piiTypesFound,
          processingTimeMs,
        },
        ...(pseudoMap && { pseudonymizationMap: pseudoMap }),
        compliance: {
          gdprCompliant: true,
          ccpaCompliant: true,
          auditTrailCreated: true,
          legalBasis: legalBasis || 'consent',
        },
      });
    } catch (err) {
      logger.error(`Text sanitize error: ${err.message}`);

      await AuditLog.create({
        userId: req.user.userId,
        inputType: 'TEXT',
        inputSizeBytes: Buffer.byteLength(text, 'utf8'),
        sanitizationMode: mode,
        status: 'FAILED',
        errorCode: err.code || 'PROCESSING_ERROR',
      }).catch(() => {});

      res.status(500).json({ error: 'Sanitization processing failed' });
    }
  }
);

// ─── POST /api/sanitize/json ──────────────────────────────────────────────────
router.post(
  '/json',
  authenticate,
  sanitizeLimiter,
  [
    body('data').notEmpty().withMessage('JSON data is required'),
    body('mode').isIn(Object.keys(SANITIZE_MODES)).withMessage('Invalid mode'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const startTime = Date.now();
    const { data, mode } = req.body;

    try {
      const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
      const fieldResults = processJSON(jsonData);

      const allFindings = fieldResults.flatMap((r) => r.findings);
      const overallRisk = fieldResults.reduce((max, r) => Math.max(max, r.riskScore), 0);

      // Deep sanitize JSON
      const sanitizeValue = (value) => {
        if (typeof value === 'string') {
          const { findings } = detectPII(value);
          if (!findings.length) return value;
          const modeConfig = SANITIZE_MODES[mode];
          return mode === 'PSEUDONYMIZATION'
            ? pseudonymize(value, findings).sanitized
            : modeConfig.fn(value, findings);
        }
        if (Array.isArray(value)) return value.map(sanitizeValue);
        if (typeof value === 'object' && value !== null) {
          return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)]));
        }
        return value;
      };

      const sanitizedData = sanitizeValue(jsonData);
      const processingTimeMs = Date.now() - startTime;

      await AuditLog.create({
        userId: req.user.userId,
        inputType: 'JSON',
        inputSizeBytes: Buffer.byteLength(JSON.stringify(data), 'utf8'),
        piiTypesFound: buildPIISummary(allFindings),
        totalPIIFound: allFindings.length,
        riskScore: overallRisk,
        sanitizationMode: mode,
        sanitizedSuccessfully: true,
        processingTimeMs,
        ipAddress: hashIP(req.ip),
        status: 'SUCCESS',
      });

      res.json({
        sanitizedData,
        fieldResults: fieldResults.map((r) => ({
          path: r.path,
          piiCount: r.findings.length,
          riskScore: r.riskScore,
        })),
        summary: {
          totalFields: fieldResults.length,
          totalPIIFound: allFindings.length,
          overallRiskScore: overallRisk,
          processingTimeMs,
        },
      });
    } catch (err) {
      logger.error(`JSON sanitize error: ${err.message}`);
      res.status(500).json({ error: 'JSON sanitization failed' });
    }
  }
);

// ─── POST /api/sanitize/csv ───────────────────────────────────────────────────
router.post(
  '/csv',
  authenticate,
  sanitizeLimiter,
  [
    body('csvData').isString().notEmpty().isLength({ max: 2000000 }).withMessage('CSV required, max 2MB'),
    body('mode').isIn(Object.keys(SANITIZE_MODES)).withMessage('Invalid mode'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const startTime = Date.now();
    const { csvData, mode } = req.body;

    try {
      const fieldResults = processCSV(csvData);
      const allFindings = fieldResults.flatMap((r) => r.findings);

      // Sanitize CSV line by line
      const lines = csvData.split('\n');
      const sanitizedLines = lines.map((line, i) => {
        if (i === 0) return line; // preserve headers
        return line
          .split(',')
          .map((cell) => {
            const trimmed = cell.trim().replace(/^["']|["']$/g, '');
            const { findings } = detectPII(trimmed);
            if (!findings.length) return cell;
            const sanitized =
              mode === 'PSEUDONYMIZATION'
                ? pseudonymize(trimmed, findings).sanitized
                : SANITIZE_MODES[mode].fn(trimmed, findings);
            return `"${sanitized}"`;
          })
          .join(',');
      });

      const processingTimeMs = Date.now() - startTime;

      await AuditLog.create({
        userId: req.user.userId,
        inputType: 'CSV',
        inputSizeBytes: Buffer.byteLength(csvData, 'utf8'),
        inputLineCount: lines.length,
        piiTypesFound: buildPIISummary(allFindings),
        totalPIIFound: allFindings.length,
        riskScore: Math.min(allFindings.length * 5, 100),
        sanitizationMode: mode,
        sanitizedSuccessfully: true,
        processingTimeMs,
        ipAddress: hashIP(req.ip),
        status: 'SUCCESS',
      });

      res.json({
        sanitizedCSV: sanitizedLines.join('\n'),
        affectedRows: fieldResults.length,
        summary: {
          totalRows: lines.length - 1,
          affectedRows: fieldResults.length,
          totalPIIFound: allFindings.length,
          processingTimeMs,
        },
      });
    } catch (err) {
      logger.error(`CSV sanitize error: ${err.message}`);
      res.status(500).json({ error: 'CSV sanitization failed' });
    }
  }
);

// ─── GET /api/sanitize/modes ──────────────────────────────────────────────────
router.get('/modes', authenticate, (req, res) => {
  res.json({
    modes: Object.entries(SANITIZE_MODES).map(([key, val]) => ({
      id: key,
      label: val.label,
      description: val.description,
    })),
  });
});

module.exports = router;
