/**
 * DeepDetect — Email Service
 * Transactional email via Nodemailer (SMTP / AWS SES / SendGrid)
 * Gracefully degrades in development — logs links to console instead
 */

const nodemailer = require('nodemailer');
const { logger } = require('./logger');

// ─── Transport ─────────────────────────────────────────────────────────────
function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  // Production: real SMTP
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587'),
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    });
  }

  // Development: log to console, no actual send
  logger.warn('No SMTP config — emails will be logged to console only');
  return null;
}

const transport = createTransport();

const FROM = process.env.EMAIL_FROM || 'DeepDetect <noreply@deepdetect.io>';
const APP_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ─── Base HTML template ───────────────────────────────────────────────────
function baseTemplate(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:Inter,system-ui,sans-serif;color:#e4e4e7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#18181b;border-bottom:1px solid #27272a;padding:28px 36px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#2563eb;width:32px;height:32px;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:16px;font-weight:700;line-height:32px;">D</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="font-size:16px;font-weight:600;color:#f4f4f5;letter-spacing:-0.3px;">DeepDetect</span>
                    <span style="display:block;font-size:11px;color:#71717a;font-family:monospace;margin-top:1px;">PII Guard Platform</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#111113;border-top:1px solid #27272a;padding:20px 36px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#52525b;font-family:monospace;">GDPR · CCPA · ISO 27001 Compliant</p>
              <p style="margin:6px 0 0;font-size:11px;color:#3f3f46;">This email was sent by DeepDetect. If you didn't request this, you can safely ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function actionButton(href, label) {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:13px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:-0.2px;">${label}</a>`;
}

function infoBox(text) {
  return `<div style="margin-top:20px;padding:14px 16px;background:#1c1c1f;border:1px solid #3f3f46;border-radius:8px;font-family:monospace;font-size:12px;color:#a1a1aa;word-break:break-all;">${text}</div>`;
}

// ─── Send helper ──────────────────────────────────────────────────────────
async function send({ to, subject, html, text }) {
  if (!transport) {
    // Dev mode — print to console
    logger.info(`[EMAIL → ${to}] ${subject}`);
    if (text) logger.info(`[EMAIL BODY] ${text}`);
    return { messageId: 'dev-mode' };
  }
  try {
    const info = await transport.sendMail({ from: FROM, to, subject, html, text });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    throw err;
  }
}

// ─── Transactional Emails ─────────────────────────────────────────────────

/**
 * Forgot Password
 */
async function sendPasswordReset(to, rawToken, name) {
  const link = `${APP_URL}/reset-password?token=${rawToken}`;

  const html = baseTemplate('Reset your password', `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#f4f4f5;letter-spacing:-0.4px;">Reset your password</h1>
    <p style="margin:0 0 6px;font-size:15px;color:#a1a1aa;line-height:1.6;">Hi ${name || 'there'},</p>
    <p style="margin:0;font-size:14px;color:#71717a;line-height:1.7;">
      We received a request to reset your DeepDetect password. Click the button below to choose a new one.
      This link expires in <strong style="color:#e4e4e7;">1 hour</strong>.
    </p>
    ${actionButton(link, 'Reset Password')}
    <p style="margin:24px 0 8px;font-size:13px;color:#52525b;">Or paste this URL into your browser:</p>
    ${infoBox(link)}
    <p style="margin:24px 0 0;font-size:13px;color:#52525b;line-height:1.6;">
      If you didn't request a password reset, no action is needed — your account remains secure.
      Didn't request this? <a href="${APP_URL}/scan" style="color:#3b82f6;">Sign in here</a> to verify your account.
    </p>
  `);

  return send({
    to,
    subject: 'Reset your DeepDetect password',
    html,
    text: `Reset your DeepDetect password\n\nLink: ${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });
}

/**
 * Password Changed Confirmation
 */
async function sendPasswordChangedAlert(to, name, ipAddress) {
  const html = baseTemplate('Your password was changed', `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#f4f4f5;letter-spacing:-0.4px;">Password changed</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;line-height:1.7;">
      Hi ${name || 'there'}, your DeepDetect account password was successfully changed.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:#1c1c1f;border:1px solid #3f3f46;border-radius:8px;padding:16px;width:100%;">
      <tr>
        <td style="font-size:12px;color:#71717a;font-family:monospace;padding:3px 0;">
          <strong style="color:#a1a1aa;">Time:</strong> ${new Date().toUTCString()}
        </td>
      </tr>
      <tr>
        <td style="font-size:12px;color:#71717a;font-family:monospace;padding:3px 0;">
          <strong style="color:#a1a1aa;">IP (anonymized):</strong> ${ipAddress || 'unknown'}
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#52525b;">
      If you did not make this change, <strong style="color:#ef4444;">reset your password immediately</strong> at
      <a href="${APP_URL}/forgot-password" style="color:#3b82f6;">${APP_URL}/forgot-password</a>
    </p>
  `);

  return send({
    to,
    subject: '⚠ Your DeepDetect password was changed',
    html,
    text: `Your DeepDetect password was changed on ${new Date().toUTCString()}. If this wasn't you, reset immediately: ${APP_URL}/forgot-password`,
  });
}

/**
 * Email Verification
 */
async function sendEmailVerification(to, rawToken, name) {
  const link = `${APP_URL}/verify-email?token=${rawToken}`;

  const html = baseTemplate('Verify your email', `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#f4f4f5;letter-spacing:-0.4px;">Verify your email</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;line-height:1.7;">
      Hi ${name || 'there'}, thanks for signing up for DeepDetect. Click below to verify your email address.
      This link expires in <strong style="color:#e4e4e7;">24 hours</strong>.
    </p>
    ${actionButton(link, 'Verify Email Address')}
    ${infoBox(link)}
  `);

  return send({
    to,
    subject: 'Verify your DeepDetect email address',
    html,
    text: `Verify your email: ${link}`,
  });
}

/**
 * Welcome email (after verification)
 */
async function sendWelcome(to, name) {
  const html = baseTemplate('Welcome to DeepDetect', `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#f4f4f5;letter-spacing:-0.4px;">You're all set, ${name || 'there'}!</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#71717a;line-height:1.7;">
      Your DeepDetect account is verified and ready to use. Here's what you can do:
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#a1a1aa;line-height:2;">
      <li>Paste or upload text, JSON, or CSV to detect PII instantly</li>
      <li>Choose from Redaction, Masking, Hashing, or Pseudonymization</li>
      <li>Export GDPR/CCPA compliance PDF reports</li>
      <li>Review full audit logs with zero PII stored</li>
    </ul>
    ${actionButton(`${APP_URL}/scan`, 'Start Scanning')}
  `);

  return send({ to, subject: 'Welcome to DeepDetect', html, text: `Welcome to DeepDetect! Start scanning at ${APP_URL}/scan` });
}

module.exports = { sendPasswordReset, sendPasswordChangedAlert, sendEmailVerification, sendWelcome };
