/**
 * DeepDetect — Client-Side Sanitization Helpers
 * Pre-flight checks, API wrappers, and local PII preview utilities
 */

import axios from 'axios';

// ─── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send httpOnly cookies
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: Auto-handle 401 → redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear any cached user state and redirect
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(error);
  }
);

// ─── Client-side PII Patterns (Preview Only — NOT for production detection) ───
// Used to give instant visual feedback before the server processes the request
const CLIENT_PATTERNS = {
  EMAIL: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
  PHONE: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  SSN: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
  CREDIT_CARD: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * Quick client-side PII scan for instant UI feedback
 * Full authoritative detection happens server-side
 */
export function quickScan(text) {
  if (!text?.trim()) return { hasPII: false, types: [], previewScore: 0 };

  const found = {};
  let total = 0;

  for (const [type, pattern] of Object.entries(CLIENT_PATTERNS)) {
    const regex = new RegExp(pattern.source, 'g');
    const matches = text.match(regex) || [];
    if (matches.length > 0) {
      found[type] = matches.length;
      total += matches.length;
    }
  }

  const SEVERITY_WEIGHTS = { EMAIL: 15, PHONE: 15, SSN: 25, CREDIT_CARD: 25, IP_ADDRESS: 8 };
  let score = 0;
  Object.entries(found).forEach(([type, count]) => {
    score += (SEVERITY_WEIGHTS[type] || 5) * Math.min(count, 3);
  });

  return {
    hasPII: total > 0,
    types: Object.keys(found),
    counts: found,
    total,
    previewScore: Math.min(score, 100),
  };
}

/**
 * Highlight PII in text for preview display
 */
export function highlightPII(text) {
  if (!text) return '';

  const TYPE_COLORS = {
    EMAIL: 'bg-orange-100 text-orange-800 border border-orange-300',
    PHONE: 'bg-blue-100 text-blue-800 border border-blue-300',
    SSN: 'bg-red-100 text-red-800 border border-red-300',
    CREDIT_CARD: 'bg-red-100 text-red-800 border border-red-300',
    IP_ADDRESS: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  };

  // Return segments for React rendering
  const segments = [];
  let lastIndex = 0;
  const matches = [];

  for (const [type, pattern] of Object.entries(CLIENT_PATTERNS)) {
    const regex = new RegExp(pattern.source, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({ start: match.index, end: match.index + match[0].length, value: match[0], type });
    }
  }

  // Sort by position, remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const filtered = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  filtered.forEach(({ start, end, value, type }) => {
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }
    segments.push({
      type: 'pii',
      value,
      piiType: type,
      className: TYPE_COLORS[type] || 'bg-gray-100',
    });
    lastIndex = end;
  });

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Sanitize text via API
 */
export async function sanitizeText({ text, mode, legalBasis, purposeOfProcessing }) {
  const { data } = await api.post('/sanitize/text', {
    text,
    mode,
    legalBasis,
    purposeOfProcessing,
  });
  return data;
}

/**
 * Sanitize JSON payload
 */
export async function sanitizeJSON({ data, mode }) {
  const response = await api.post('/sanitize/json', { data, mode });
  return response.data;
}

/**
 * Sanitize CSV data
 */
export async function sanitizeCSV({ csvData, mode }) {
  const { data } = await api.post('/sanitize/csv', { csvData, mode });
  return data;
}

/**
 * Fetch audit statistics
 */
export async function fetchAuditStats(days = 30) {
  const { data } = await api.get(`/audit/stats?days=${days}`);
  return data;
}

/**
 * Fetch paginated audit logs
 */
export async function fetchAuditLogs({ page = 1, limit = 20, mode, riskLevel } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (mode) params.set('mode', mode);
  if (riskLevel) params.set('riskLevel', riskLevel);
  const { data } = await api.get(`/audit/logs?${params}`);
  return data;
}

/**
 * Download compliance PDF report
 */
export async function downloadComplianceReport(days = 30) {
  const response = await api.get(`/audit/report/pdf?days=${days}`, {
    responseType: 'blob',
  });

  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `deepdetect-audit-${new Date().toISOString().split('T')[0]}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Auth API calls
 */
export const authAPI = {
  login:              (creds) => api.post('/auth/login', creds).then(r => r.data),
  register:           (data)  => api.post('/auth/register', data).then(r => r.data),
  logout:             ()      => api.post('/auth/logout').then(r => r.data),
  me:                 ()      => api.get('/auth/me').then(r => r.data),
  refresh:            ()      => api.post('/auth/refresh').then(r => r.data),
  forgotPassword:     (email) => api.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword:      (data)  => api.post('/auth/reset-password', data).then(r => r.data),
  changePassword:     (data)  => api.put('/auth/change-password', data).then(r => r.data),
  updateProfile:      (data)  => api.put('/auth/profile', data).then(r => r.data),
  deleteAccount:      (data)  => api.delete('/auth/account', { data }).then(r => r.data),
  resendVerification: ()      => api.post('/auth/resend-verification').then(r => r.data),
  verifyEmail:        (token) => api.get(`/auth/verify-email?token=${token}`).then(r => r.data),
  exportData:         ()      => api.get('/user/export-data', { responseType: 'blob' }),
};

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getRiskColor(score) {
  if (score === 0) return { text: 'text-emerald-400', bg: 'bg-emerald-500', label: 'NONE' };
  if (score <= 20) return { text: 'text-green-400', bg: 'bg-green-500', label: 'LOW' };
  if (score <= 50) return { text: 'text-yellow-400', bg: 'bg-yellow-500', label: 'MEDIUM' };
  if (score <= 75) return { text: 'text-orange-400', bg: 'bg-orange-500', label: 'HIGH' };
  return { text: 'text-red-400', bg: 'bg-red-500', label: 'CRITICAL' };
}

export function getSeverityColor(severity) {
  const map = {
    CRITICAL: 'text-red-400 bg-red-900/30 border-red-500/30',
    HIGH: 'text-orange-400 bg-orange-900/30 border-orange-500/30',
    MEDIUM: 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30',
    LOW: 'text-green-400 bg-green-900/30 border-green-500/30',
  };
  return map[severity] || 'text-gray-400 bg-gray-900/30 border-gray-500/30';
}

export const SANITIZE_MODES = [
  {
    id: 'REDACTION',
    label: 'Redaction',
    description: 'Replace PII with [REDACTED:TYPE]',
    icon: '🚫',
    color: 'red',
  },
  {
    id: 'MASKING',
    label: 'Masking',
    description: 'Show only last 4 chars (xxxx-1234)',
    icon: '🎭',
    color: 'blue',
  },
  {
    id: 'HASHING',
    label: 'Hashing',
    description: 'SHA-256 hash for safe analytics',
    icon: '#',
    color: 'purple',
  },
  {
    id: 'PSEUDONYMIZATION',
    label: 'Pseudonymization',
    description: 'Replace with stable fake IDs',
    icon: '🔄',
    color: 'cyan',
  },
];

export default api;
