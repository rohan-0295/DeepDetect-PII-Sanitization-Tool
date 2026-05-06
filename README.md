# DeepDetect — PII Detection & Sanitization Platform

> Enterprise-grade PII detection, sanitization, and compliance reporting built on the MERN stack. GDPR, CCPA, and ISO 27001 ready out of the box.

---

## Architecture Overview

```
DeepDetect/
├── client/                          # React 18 + Tailwind CSS
│   └── src/
│       ├── App.js                   # Router + Auth context
│       ├── components/
│       │   ├── Layout.js            # Sidebar shell
│       │   ├── Dashboard.js         # Recharts analytics
│       │   ├── RiskMeter.js         # Animated SVG arc gauge
│       │   └── FileUpload.js        # Drag-and-drop JSON/CSV
│       ├── pages/
│       │   ├── ScanPage.js          # Core scan + sanitize UI
│       │   ├── DashboardPage.js     # Analytics wrapper
│       │   ├── AuditPage.js         # Paginated audit log
│       │   ├── LoginPage.js         # JWT auth login
│       │   └── RegisterPage.js      # GDPR-consent registration
│       └── utils/
│           └── SanitizationHelpers.js  # API wrapper + client PII utils
│
└── server/                          # Node.js + Express
    ├── server.js                    # Entry: Helmet, CORS, rate-limit
    ├── models/
    │   ├── User.js                  # bcrypt hashing, login-lockout
    │   └── AuditLog.js              # Metadata-only, never stores PII
    ├── routes/
    │   ├── auth.js                  # /api/auth — JWT httpOnly cookies
    │   ├── sanitize.js              # /api/sanitize — core endpoint
    │   └── audit.js                 # /api/audit — logs + PDF export
    ├── services/
    │   ├── DetectionEngine.js       # Regex + NLP + Luhn algorithm
    │   └── logger.js                # Winston + PII redaction in logs
    └── middleware/
        └── authMiddleware.js        # JWT verify + RBAC
```

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Configure environment
```bash
cp server/.env.example server/.env
# Edit server/.env with your MongoDB URI and generated secrets
```

Generate secure secrets:
```bash
# JWT Secret (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Hash Secret (32 bytes)  
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run in development
```bash
npm run dev
# Client: http://localhost:3000
# Server: http://localhost:5000
```

---

## API Reference

### Authentication
All endpoints (except health) require a valid JWT. Tokens are issued as `httpOnly` cookies (XSS-immune) on login.

#### `POST /api/auth/register`
```json
{
  "email": "user@company.com",
  "password": "Str0ng@Pass!",
  "displayName": "Jane Smith",
  "organization": "Acme Corp",
  "dataProcessingConsent": true
}
```

#### `POST /api/auth/login`
```json
{ "email": "user@company.com", "password": "Str0ng@Pass!" }
```

### Sanitize

#### `POST /api/sanitize/text`
```json
{
  "text": "Contact Sarah at sarah@acme.com or 415-823-9012",
  "mode": "REDACTION",
  "legalBasis": "legitimate_interest",
  "purposeOfProcessing": "Customer support PII audit"
}
```

**Response:**
```json
{
  "scanId": "uuid-v4",
  "sanitizedText": "Contact [REDACTED:PERSON_NAME] at [REDACTED:EMAIL] or [REDACTED:PHONE]",
  "mode": "REDACTION",
  "findings": [
    { "type": "EMAIL", "label": "Email Address", "severity": "HIGH", "confidence": "HIGH" }
  ],
  "summary": {
    "totalPIIFound": 3,
    "riskScore": 45,
    "riskLevel": "MEDIUM",
    "dataMinimizationScore": 78,
    "processingTimeMs": 12
  },
  "compliance": {
    "gdprCompliant": true,
    "ccpaCompliant": true,
    "auditTrailCreated": true,
    "legalBasis": "legitimate_interest"
  }
}
```

**Sanitization modes:**

| Mode | Description | Example output |
|------|-------------|----------------|
| `REDACTION` | Replace with type tag | `[REDACTED:EMAIL]` |
| `MASKING` | Partial reveal | `s***@acme.com` |
| `HASHING` | Deterministic SHA-256 | `[EMAIL:3a7f2b1c]` |
| `PSEUDONYMIZATION` | Stable fake IDs | `User_0001` |

#### `POST /api/sanitize/json`
```json
{ "data": { "user": { "email": "test@example.com" } }, "mode": "MASKING" }
```

#### `POST /api/sanitize/csv`
```json
{ "csvData": "name,email\nJohn Doe,john@test.com", "mode": "HASHING" }
```

### Audit

#### `GET /api/audit/logs?page=1&limit=20&mode=REDACTION&riskLevel=HIGH`
#### `GET /api/audit/stats?days=30`
#### `GET /api/audit/report/pdf?days=90` — Returns binary PDF download

---

## PII Detection Capabilities

| Type | Method | Severity |
|------|--------|----------|
| Email addresses | Regex | HIGH |
| US phone numbers | Regex | HIGH |
| Social Security Numbers | Regex + format validation | CRITICAL |
| Credit card numbers | Regex + **Luhn algorithm** | CRITICAL |
| IPv4 / IPv6 addresses | Regex | MEDIUM |
| Person names | **NLP context analysis** | HIGH |
| Dates of birth | Contextual regex | HIGH |
| Passport numbers | Regex | CRITICAL |
| Driver's licenses | Contextual regex | HIGH |
| IBAN numbers | Regex | HIGH |
| API keys / secrets | Contextual regex | CRITICAL |
| Street addresses | Regex | MEDIUM |

---

## Security Implementation

### 2026 Best Practices Checklist

- [x] **Helmet.js** — 15+ security headers including strict CSP
- [x] **httpOnly cookies** — JWT tokens immune to XSS
- [x] **bcrypt** — cost factor 12 for password hashing
- [x] **express-rate-limit** — 200 req/15min global, 10 req/15min auth
- [x] **express-validator** — All inputs sanitized and validated
- [x] **SHA-256 HMAC** — Deterministic hashing with server-side secret
- [x] **Login lockout** — 5 failed attempts → 2-hour lock
- [x] **User enumeration prevention** — Constant-time responses
- [x] **IP anonymization** — One-way hashed with daily salt (GDPR)
- [x] **Winston PII redaction** — Logs auto-scrub PII before writing
- [x] **Zero PII in audit logs** — Only counts, types, scores stored
- [x] **Content Security Policy** — Strict CSP via Helmet

### CSP Headers Applied
```
default-src 'self'
script-src 'self' 'strict-dynamic'
object-src 'none'
base-uri 'self'
frame-src 'none'
upgrade-insecure-requests
```

---

## Compliance Features

### GDPR (EU 2016/679)
- **Article 5(1)(c)** — Data minimization score tracked per scan
- **Article 30** — Records of processing in AuditLog collection
- **Article 17** — Data retention: audit logs auto-expire after 365 days

### CCPA (Cal. Civ. Code §1798.100)
- Consumer consent captured and stored with timestamp
- Legal basis tracked per user and per scan
- Export PDF provides evidence of compliance controls

### ISO/IEC 27001:2022
- Structured audit trail for all processing activities
- Incident-ready log files with 90-day error retention
- Role-based access control (user / analyst / admin / compliance_officer)

---

## PDF Compliance Report

Generated via `GET /api/audit/report/pdf`:
1. **Executive Summary** — scan totals, PII counts, risk scores
2. **PII Type Breakdown** — by type, count, severity
3. **Sanitization Mode Usage** — which modes used and how often
4. **Recent Activity** — last 30 scan entries (metadata only)
5. **Technical Controls Declaration** — signed with SHA-256 report hash
6. **GDPR/CCPA/ISO 27001 attestation**

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | 64-byte hex secret for JWT signing |
| `HASH_SECRET` | Yes | 32-byte hex secret for PII hashing mode |
| `IP_SALT` | Yes | Salt for IP address anonymization |
| `PORT` | No | Server port (default: 5000) |
| `CLIENT_URL` | No | Frontend URL for CORS (default: localhost:3000) |
| `NODE_ENV` | No | `development` or `production` |
| `LOG_LEVEL` | No | Winston log level (default: `info`) |

---

## License

MIT © 2026 DeepDetect
