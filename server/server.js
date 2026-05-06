/**
 * DeepDetect — Server Entry Point
 * 2026 Security Standards
 */

require('dotenv').config();
const { validateEnvironment } = require('./services/startupValidator');
validateEnvironment();

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { logger } = require('./services/logger');

const authRoutes     = require('./routes/auth');
const sanitizeRoutes = require('./routes/sanitize');
const auditRoutes    = require('./routes/audit');
const userRoutes     = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'strict-dynamic'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ─── Global rate limiter ──────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
}));

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());
app.use(morgan('combined', {
  stream: { write: msg => logger.http(msg.trim()) },
  skip: req => req.url === '/api/health',
}));
app.disable('x-powered-by');

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational', version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth',     authRoutes);
app.use('/api/sanitize', sanitizeRoutes);
app.use('/api/audit',    auditRoutes);
app.use('/api/user',     userRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'An internal error occurred' : err.message;
  logger.error(`[${status}] ${err.message} — ${req.method} ${req.url}`);
  res.status(status).json({ error: message });
});

// ─── DB + start ───────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/deepdetect', {
  serverSelectionTimeoutMS: 5000,
}).then(() => {
  logger.info('MongoDB connected');
  const server = app.listen(PORT, () => {
    logger.info(`DeepDetect API on :${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  const shutdown = signal => {
    logger.info(`${signal} — shutting down`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}).catch(err => {
  logger.error(`MongoDB connection failed: ${err.message}`);
  process.exit(1);
});

module.exports = app;
