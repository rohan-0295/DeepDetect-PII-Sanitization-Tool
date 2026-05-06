/**
 * DeepDetect — Structured Logger Service
 * Uses Winston with daily file rotation and redaction of sensitive fields
 */

const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// ─── PII Redaction from Log Messages ─────────────────────────────────────────
// Prevent any accidental PII from leaking into log files
const PII_PATTERNS = [
  { pattern: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/g, replacement: '[EMAIL]' },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  { pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g, replacement: '[CARD]' },
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP]' },
];

const redactPII = winston.format((info) => {
  if (typeof info.message === 'string') {
    let msg = info.message;
    PII_PATTERNS.forEach(({ pattern, replacement }) => {
      msg = msg.replace(pattern, replacement);
    });
    info.message = msg;
  }
  return info;
});

// ─── Log Format ───────────────────────────────────────────────────────────────
const logFormat = winston.format.combine(
  redactPII(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  redactPII(),
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// ─── Transports ───────────────────────────────────────────────────────────────
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  }),
  new winston.transports.DailyRotateFile({
    filename: path.join('logs', 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'info',
    format: logFormat,
  }),
  new winston.transports.DailyRotateFile({
    filename: path.join('logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '90d',
    level: 'error',
    format: logFormat,
  }),
];

// ─── Security Audit Transport ─────────────────────────────────────────────────
const auditTransport = new winston.transports.DailyRotateFile({
  filename: path.join('logs', 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '50m',
  maxFiles: '365d', // GDPR: 1-year retention
  format: logFormat,
});

// ─── Logger Instance ──────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'deepdetect', pid: process.pid },
  transports,
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
    }),
  ],
});

// ─── Audit Logger (GDPR/CCPA Events Only) ────────────────────────────────────
const auditLogger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'deepdetect-audit' },
  transports: [auditTransport],
});

module.exports = { logger, auditLogger };
