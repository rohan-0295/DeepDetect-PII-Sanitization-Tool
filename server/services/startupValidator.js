/**
 * DeepDetect — Startup Environment Validator
 * Validates all required env vars and configs before the server starts
 * Prevents silent failures in production
 */

const { logger } = require('./logger');

const REQUIRED_IN_PRODUCTION = [
  { key: 'MONGODB_URI',  desc: 'MongoDB connection string' },
  { key: 'JWT_SECRET',   desc: '64-byte hex JWT signing secret', minLen: 32 },
  { key: 'HASH_SECRET',  desc: '32-byte hex PII hashing secret', minLen: 16 },
  { key: 'CLIENT_URL',   desc: 'Frontend URL for CORS' },
];

const RECOMMENDED = [
  { key: 'IP_SALT',      desc: 'Salt for IP anonymization' },
  { key: 'SMTP_HOST',    desc: 'SMTP host for transactional email' },
  { key: 'EMAIL_FROM',   desc: 'From address for outgoing email' },
];

function validateEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  // Required in production, warn in dev
  for (const { key, desc, minLen } of REQUIRED_IN_PRODUCTION) {
    const val = process.env[key];
    if (!val) {
      const msg = `Missing env var: ${key} (${desc})`;
      if (isProd) errors.push(msg);
      else warnings.push(msg);
    } else if (minLen && val.length < minLen) {
      const msg = `${key} is too short (${val.length} chars, min ${minLen}) — use a secure random value`;
      if (isProd) errors.push(msg);
      else warnings.push(msg);
    }
  }

  // Always warn about recommended
  for (const { key, desc } of RECOMMENDED) {
    if (!process.env[key]) {
      warnings.push(`Recommended env var not set: ${key} (${desc})`);
    }
  }

  // JWT_SECRET must not be the dev default in production
  if (isProd && process.env.JWT_SECRET === 'dev-secret-change-in-production') {
    errors.push('JWT_SECRET is still set to the development default — this is a critical security risk');
  }

  // Print results
  if (warnings.length) {
    warnings.forEach(w => logger.warn(`[ENV] ${w}`));
  }

  if (errors.length) {
    errors.forEach(e => logger.error(`[ENV FATAL] ${e}`));
    logger.error('Server startup aborted due to missing required configuration.');
    process.exit(1);
  }

  logger.info(`[ENV] Environment validated (${isProd ? 'production' : 'development'} mode)`);
}

module.exports = { validateEnvironment };
