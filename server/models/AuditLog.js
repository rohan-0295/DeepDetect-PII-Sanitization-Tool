/**
 * DeepDetect — Audit Log Model
 * GDPR/CCPA compliant — stores metadata ONLY, never actual PII values
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const piiTypeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'IP_ADDRESS',
        'PERSON_NAME', 'DATE_OF_BIRTH', 'PASSPORT', 'DRIVERS_LICENSE',
        'IBAN', 'ADDRESS', 'ZIPCODE', 'API_KEY', 'OTHER',
      ],
    },
    count: { type: Number, default: 0 },
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    },
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    scanId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    // Input metadata — NO actual content stored
    inputType: {
      type: String,
      enum: ['TEXT', 'JSON', 'CSV', 'FILE'],
      required: true,
    },
    inputSizeBytes: {
      type: Number,
      required: true,
    },
    inputLineCount: {
      type: Number,
    },
    // Detection results — counts and types only
    piiTypesFound: [piiTypeSchema],
    totalPIIFound: {
      type: Number,
      default: 0,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    riskLevel: {
      type: String,
      enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    },
    // Sanitization details
    sanitizationMode: {
      type: String,
      enum: ['REDACTION', 'MASKING', 'HASHING', 'PSEUDONYMIZATION', 'NONE'],
      required: true,
    },
    sanitizedSuccessfully: {
      type: Boolean,
      default: false,
    },
    processingTimeMs: {
      type: Number,
    },
    dataMinimizationScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    // GDPR Compliance fields
    legalBasis: {
      type: String,
      enum: ['consent', 'legitimate_interest', 'legal_obligation', 'vital_interest', 'public_task', 'contract'],
    },
    purposeOfProcessing: {
      type: String,
      maxlength: 500,
    },
    dataSubjectJurisdiction: {
      type: String,
    },
    // Request metadata
    ipAddress: {
      type: String, // Hashed for GDPR compliance
    },
    userAgent: {
      type: String,
    },
    apiVersion: {
      type: String,
      default: 'v1',
    },
    // Status
    status: {
      type: String,
      enum: ['SUCCESS', 'PARTIAL', 'FAILED', 'PENDING'],
      default: 'PENDING',
    },
    errorCode: {
      type: String,
    },
  },
  {
    timestamps: true,
    // Automatic TTL — comply with data retention policies (2 years)
    // Remove index below if you want permanent audit logs
  }
);

// ─── Indices ──────────────────────────────────────────────────────────────────
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ riskLevel: 1, createdAt: -1 });
auditLogSchema.index({ sanitizationMode: 1 });

// ─── Virtual: Risk Level from Score ──────────────────────────────────────────
auditLogSchema.pre('save', function (next) {
  if (this.riskScore !== undefined) {
    if (this.riskScore === 0) this.riskLevel = 'NONE';
    else if (this.riskScore <= 20) this.riskLevel = 'LOW';
    else if (this.riskScore <= 50) this.riskLevel = 'MEDIUM';
    else if (this.riskScore <= 75) this.riskLevel = 'HIGH';
    else this.riskLevel = 'CRITICAL';
  }
  next();
});

// ─── Static: Aggregate Stats for Dashboard ───────────────────────────────────
auditLogSchema.statics.getUserStats = async function (userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [stats] = await this.aggregate([
    { $match: { userId, createdAt: { $gte: since }, status: 'SUCCESS' } },
    {
      $group: {
        _id: null,
        totalScans: { $sum: 1 },
        totalPIIFound: { $sum: '$totalPIIFound' },
        avgRiskScore: { $avg: '$riskScore' },
        maxRiskScore: { $max: '$riskScore' },
        totalBytesProcessed: { $sum: '$inputSizeBytes' },
      },
    },
  ]);

  return stats || {
    totalScans: 0,
    totalPIIFound: 0,
    avgRiskScore: 0,
    maxRiskScore: 0,
    totalBytesProcessed: 0,
  };
};

auditLogSchema.statics.getPIIBreakdown = async function (userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { userId, createdAt: { $gte: since }, status: 'SUCCESS' } },
    { $unwind: '$piiTypesFound' },
    {
      $group: {
        _id: '$piiTypesFound.type',
        totalCount: { $sum: '$piiTypesFound.count' },
        occurrences: { $sum: 1 },
        severity: { $first: '$piiTypesFound.severity' },
      },
    },
    { $sort: { totalCount: -1 } },
  ]);
};

auditLogSchema.statics.getScanTimeline = async function (userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { userId, createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        scans: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
        totalPII: { $sum: '$totalPIIFound' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
