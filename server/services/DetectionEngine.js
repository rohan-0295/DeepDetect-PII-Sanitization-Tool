/**
 * DeepDetect — Detection Engine
 * Multi-layered PII identification using Regex + NLP context analysis
 * Implements: Names, Emails, Phones, SSNs, Credit Cards (Luhn), IPs, Dates of Birth
 */

const crypto = require('crypto');
const natural = require('natural');

// ─── NLP Setup ────────────────────────────────────────────────────────────────
const tokenizer = new natural.WordTokenizer();
const NGrams = natural.NGrams;

// ─── PII Pattern Definitions ──────────────────────────────────────────────────
const PATTERNS = {
  EMAIL: {
    regex: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    type: 'EMAIL',
    severity: 'HIGH',
    label: 'Email Address',
  },
  PHONE_US: {
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    type: 'PHONE',
    severity: 'HIGH',
    label: 'Phone Number',
  },
  SSN: {
    regex: /\b(?!000|666|9\d\d)\d{3}[-\s](?!00)\d{2}[-\s](?!0000)\d{4}\b/g,
    type: 'SSN',
    severity: 'CRITICAL',
    label: 'Social Security Number',
  },
  CREDIT_CARD: {
    // Matches Visa, MC, Amex, Discover — validated by Luhn below
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    type: 'CREDIT_CARD',
    severity: 'CRITICAL',
    label: 'Credit Card Number',
    validate: luhnCheck,
  },
  CREDIT_CARD_FORMATTED: {
    regex: /\b(?:\d{4}[- ]){3}\d{4}\b/g,
    type: 'CREDIT_CARD',
    severity: 'CRITICAL',
    label: 'Credit Card Number (Formatted)',
    validate: (v) => luhnCheck(v.replace(/[- ]/g, '')),
  },
  IP_V4: {
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    type: 'IP_ADDRESS',
    severity: 'MEDIUM',
    label: 'IPv4 Address',
  },
  IP_V6: {
    regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|(?:[0-9a-fA-F]{1,4}:){1,7}:|:(?::[0-9a-fA-F]{1,4}){1,7}\b/g,
    type: 'IP_ADDRESS',
    severity: 'MEDIUM',
    label: 'IPv6 Address',
  },
  DATE_OF_BIRTH: {
    regex: /\b(?:dob|date of birth|born on|birthdate)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi,
    type: 'DATE_OF_BIRTH',
    severity: 'HIGH',
    label: 'Date of Birth',
  },
  PASSPORT: {
    regex: /\b[A-Z]{1,2}\d{6,9}\b/g,
    type: 'PASSPORT',
    severity: 'CRITICAL',
    label: 'Passport Number',
  },
  DRIVERS_LICENSE: {
    regex: /\b(?:DL|driver'?s?\s*lic(?:ense)?)[:\s#]*([A-Z0-9]{6,15})\b/gi,
    type: 'DRIVERS_LICENSE',
    severity: 'HIGH',
    label: "Driver's License",
  },
  IBAN: {
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b/g,
    type: 'IBAN',
    severity: 'HIGH',
    label: 'IBAN',
  },
  API_KEY: {
    regex: /\b(?:api[_-]?key|secret|token|bearer)\s*[=:]\s*['"]?([A-Za-z0-9\-_]{20,})/gi,
    type: 'API_KEY',
    severity: 'CRITICAL',
    label: 'API Key / Secret',
  },
  US_ADDRESS: {
    regex: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way)\b/g,
    type: 'ADDRESS',
    severity: 'MEDIUM',
    label: 'Street Address',
  },
  ZIPCODE: {
    regex: /\b\d{5}(?:-\d{4})?\b/g,
    type: 'ZIPCODE',
    severity: 'LOW',
    label: 'ZIP Code',
  },
};

// ─── Common Names Dictionary (NLP Context) ────────────────────────────────────
const COMMON_FIRST_NAMES = new Set([
  'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph',
  'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark',
  'donald', 'steven', 'paul', 'andrew', 'kenneth', 'mary', 'patricia', 'jennifer',
  'linda', 'barbara', 'elizabeth', 'susan', 'jessica', 'sarah', 'karen', 'lisa',
  'nancy', 'betty', 'margaret', 'sandra', 'ashley', 'emily', 'kimberly', 'donna',
  'carol', 'michelle', 'amanda', 'melissa', 'deborah', 'stephanie', 'dorothy',
  'alice', 'helen', 'emma', 'olivia', 'noah', 'liam', 'sophia', 'ava', 'isabella',
  'mia', 'charlotte', 'amelia', 'harper', 'evelyn', 'abigail', 'emily', 'ella',
  'elizabeth', 'camila', 'luna', 'sofia', 'avery', 'mila', 'aria', 'scarlett',
]);

const NAME_CONTEXT_TOKENS = new Set([
  'name', 'named', 'called', 'patient', 'client', 'user', 'customer',
  'employee', 'mr', 'mrs', 'ms', 'dr', 'prof', 'sir', 'madam', 'dear',
  'signed', 'by', 'from', 'to', 'sender', 'recipient', 'author',
]);

// ─── Luhn Algorithm ───────────────────────────────────────────────────────────
function luhnCheck(num) {
  const digits = String(num).replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ─── Context-Aware Name Detection (NLP) ──────────────────────────────────────
function detectNames(text) {
  const findings = [];
  const tokens = tokenizer.tokenize(text.toLowerCase()) || [];
  const lines = text.split(/\n/);

  lines.forEach((line) => {
    const lineTokens = tokenizer.tokenize(line.toLowerCase()) || [];

    // Check for name context keywords nearby
    const hasNameContext = lineTokens.some((t) => NAME_CONTEXT_TOKENS.has(t));

    // Detect capitalized word sequences (likely proper names)
    const properNounRegex = /\b([A-Z][a-z]{1,20})(?:\s+[A-Z][a-z]{1,20}){1,3}\b/g;
    let match;

    while ((match = properNounRegex.exec(line)) !== null) {
      const candidate = match[0];
      const words = candidate.split(/\s+/);
      const isLikelyName =
        hasNameContext ||
        COMMON_FIRST_NAMES.has(words[0].toLowerCase()) ||
        COMMON_FIRST_NAMES.has(words[words.length - 1].toLowerCase());

      // Avoid flagging company names, place names with common stopwords
      const stopWords = new Set(['The', 'And', 'For', 'Inc', 'Ltd', 'Corp', 'Street', 'Avenue']);
      const hasStopWord = words.some((w) => stopWords.has(w));

      if (isLikelyName && !hasStopWord && words.length <= 4) {
        findings.push({
          type: 'PERSON_NAME',
          value: candidate,
          severity: 'HIGH',
          label: 'Person Name',
          index: match.index,
          confidence: hasNameContext ? 'HIGH' : 'MEDIUM',
        });
      }
    }
  });

  return findings;
}

// ─── Main Detection Function ──────────────────────────────────────────────────
function detectPII(text) {
  if (!text || typeof text !== 'string') return { findings: [], riskScore: 0 };

  const findings = [];
  const seenPositions = new Set();

  // Pattern-based detection
  for (const [key, config] of Object.entries(PATTERNS)) {
    const regex = new RegExp(config.regex.source, config.regex.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const value = match[0];
      const index = match.index;
      const posKey = `${index}-${index + value.length}`;

      // Skip overlapping matches
      if (seenPositions.has(posKey)) continue;

      // Validate if validator exists (e.g. Luhn for credit cards)
      if (config.validate && !config.validate(value)) continue;

      seenPositions.add(posKey);
      findings.push({
        type: config.type,
        value,
        severity: config.severity,
        label: config.label,
        index,
        length: value.length,
        confidence: 'HIGH',
      });
    }
  }

  // NLP-based name detection
  const nameFindings = detectNames(text);
  findings.push(...nameFindings);

  // Sort by position for deterministic output
  findings.sort((a, b) => (a.index || 0) - (b.index || 0));

  // Calculate risk score
  const riskScore = calculateRiskScore(findings);

  return { findings, riskScore, totalPII: findings.length };
}

// ─── Risk Score Calculator ────────────────────────────────────────────────────
function calculateRiskScore(findings) {
  if (!findings.length) return 0;

  const SEVERITY_WEIGHTS = {
    CRITICAL: 25,
    HIGH: 15,
    MEDIUM: 8,
    LOW: 3,
  };

  let score = 0;
  const typeCounts = {};

  findings.forEach(({ severity, type }) => {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    score += SEVERITY_WEIGHTS[severity] || 5;

    // Diminishing returns for repeated same-type PII
    if (typeCounts[type] > 3) {
      score += (SEVERITY_WEIGHTS[severity] || 5) * 0.3;
    }
  });

  // Combination bonus — multiple PII types = higher risk
  const uniqueTypes = Object.keys(typeCounts).length;
  if (uniqueTypes >= 3) score *= 1.2;
  if (uniqueTypes >= 5) score *= 1.4;

  return Math.min(Math.round(score), 100);
}

// ─── Sanitization Functions ───────────────────────────────────────────────────

/**
 * REDACTION: Replace PII with [REDACTED]
 */
function redact(text, findings) {
  // Process in reverse to preserve indices
  const sorted = [...findings].sort((a, b) => (b.index || 0) - (a.index || 0));
  let sanitized = text;

  sorted.forEach(({ value, type }) => {
    if (value) {
      sanitized = sanitized.replace(new RegExp(escapeRegex(value), 'g'), `[REDACTED:${type}]`);
    }
  });

  return sanitized;
}

/**
 * MASKING: Show last 4 chars, mask the rest
 */
function mask(text, findings) {
  const sorted = [...findings].sort((a, b) => (b.index || 0) - (a.index || 0));
  let sanitized = text;

  sorted.forEach(({ value, type }) => {
    if (!value) return;
    const clean = value.replace(/\D/g, '');
    let masked;

    if (type === 'CREDIT_CARD') {
      masked = `xxxx-xxxx-xxxx-${clean.slice(-4)}`;
    } else if (type === 'SSN') {
      masked = `***-**-${clean.slice(-4)}`;
    } else if (type === 'PHONE') {
      masked = `(***) ***-${clean.slice(-4)}`;
    } else if (type === 'EMAIL') {
      const [local, domain] = value.split('@');
      masked = `${local[0]}***@${domain}`;
    } else if (type === 'PERSON_NAME') {
      const parts = value.split(' ');
      masked = parts.map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(' ');
    } else {
      const visibleChars = Math.min(4, Math.floor(value.length * 0.2));
      masked = '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
    }

    sanitized = sanitized.replace(new RegExp(escapeRegex(value), 'g'), masked);
  });

  return sanitized;
}

/**
 * HASHING: Deterministic SHA-256 for data analysis without exposure
 */
function hash(text, findings) {
  const sorted = [...findings].sort((a, b) => (b.index || 0) - (a.index || 0));
  let sanitized = text;
  const hashMap = {};

  sorted.forEach(({ value, type }) => {
    if (!value) return;
    if (!hashMap[value]) {
      const hmac = crypto.createHmac('sha256', process.env.HASH_SECRET || 'deepdetect-secret');
      hmac.update(value);
      hashMap[value] = `[${type}:${hmac.digest('hex').slice(0, 16)}]`;
    }
    sanitized = sanitized.replace(new RegExp(escapeRegex(value), 'g'), hashMap[value]);
  });

  return sanitized;
}

/**
 * PSEUDONYMIZATION: Replace names/IDs with consistent fake identifiers
 */
function pseudonymize(text, findings) {
  const sorted = [...findings].sort((a, b) => (b.index || 0) - (a.index || 0));
  let sanitized = text;
  const pseudoMap = {};
  let nameCounter = 1;
  let entityCounter = 1;

  sorted.forEach(({ value, type }) => {
    if (!value) return;
    if (!pseudoMap[value]) {
      if (type === 'PERSON_NAME') {
        pseudoMap[value] = `User_${String(nameCounter++).padStart(4, '0')}`;
      } else {
        pseudoMap[value] = `ENTITY_${type}_${String(entityCounter++).padStart(4, '0')}`;
      }
    }
    sanitized = sanitized.replace(new RegExp(escapeRegex(value), 'g'), pseudoMap[value]);
  });

  return { sanitized, pseudoMap };
}

// ─── Helper: Escape Regex Special Characters ──────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Data Minimization Score ──────────────────────────────────────────────────
function calculateDataMinimizationScore(originalText, sanitizedText, findings) {
  if (!findings.length) return 100;

  const piiCharCount = findings.reduce((sum, f) => sum + (f.value?.length || 0), 0);
  const totalChars = originalText.length;
  const removalRatio = piiCharCount / totalChars;

  return Math.round((1 - removalRatio * 0.8) * 100);
}

// ─── Batch Processing ─────────────────────────────────────────────────────────
function processJSON(jsonData) {
  const results = [];
  const processValue = (value, path) => {
    if (typeof value === 'string') {
      const { findings, riskScore } = detectPII(value);
      if (findings.length > 0) {
        results.push({ path, findings, riskScore, originalValue: value });
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [k, v] of Object.entries(value)) {
        processValue(v, `${path}.${k}`);
      }
    }
  };

  processValue(jsonData, 'root');
  return results;
}

function processCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0]?.split(',').map((h) => h.trim()) || [];
  const results = [];

  lines.slice(1).forEach((line, rowIndex) => {
    const values = line.split(',');
    values.forEach((value, colIndex) => {
      const trimmed = value.trim().replace(/^["']|["']$/g, '');
      if (trimmed) {
        const { findings, riskScore } = detectPII(trimmed);
        if (findings.length > 0) {
          results.push({
            row: rowIndex + 2,
            column: headers[colIndex] || `col_${colIndex}`,
            findings,
            riskScore,
          });
        }
      }
    });
  });

  return results;
}

module.exports = {
  detectPII,
  redact,
  mask,
  hash,
  pseudonymize,
  luhnCheck,
  calculateRiskScore,
  calculateDataMinimizationScore,
  processJSON,
  processCSV,
  PATTERNS,
};
