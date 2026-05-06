/**
 * DeepDetect — Auth Middleware
 * JWT verification via httpOnly cookies or Bearer token
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger } = require('../services/logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}

// ─── Token Extraction ─────────────────────────────────────────────────────────
function extractToken(req) {
  // 1. httpOnly cookie (preferred — immune to XSS)
  if (req.cookies?.token) return req.cookies.token;

  // 2. Authorization header (for API clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);

  return null;
}

// ─── Main Auth Middleware ─────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET || 'dev-secret-change-in-production', {
      algorithms: ['HS256'],
      issuer: 'deepdetect',
      audience: 'deepdetect-api',
    });

    // Load fresh user from DB (validates account still exists and is active)
    const user = await User.findOne({ userId: decoded.userId, isActive: true });
    if (!user) {
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }

    // Attach user context to request
    req.user = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      organization: user.organization,
    };

    // Log access (without sensitive data)
    logger.debug(`Authenticated: ${user.userId} — ${req.method} ${req.path}`);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    if (err.name === 'JsonWebTokenError') {
      logger.warn(`Invalid token attempt from ${req.ip}`);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    logger.error(`Auth middleware error: ${err.message}`);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// ─── Role-Based Access Control ────────────────────────────────────────────────
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt: ${req.user.userId} tried to access ${req.path} (role: ${req.user.role})`);
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role,
      });
    }
    next();
  };
};

// ─── Optional Auth (doesn't fail if no token) ────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET || 'dev-secret-change-in-production');
    const user = await User.findOne({ userId: decoded.userId, isActive: true });
    if (user) {
      req.user = {
        userId: user.userId,
        email: user.email,
        role: user.role,
      };
    }
    next();
  } catch {
    next(); // Continue without auth
  }
};

module.exports = { authenticate, authorize, optionalAuth };
