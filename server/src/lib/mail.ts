import nodemailer from 'nodemailer';

function getSmtpConfig(): {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
} | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || pass === undefined || pass === '') return null;
  const port = Number(process.env.SMTP_PORT || '587') || 587;
  const secure =
    process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1' || port === 465;
  return { host, port, secure, auth: { user, pass } };
}

function buildSmtpTransport() {
  const cfg = getSmtpConfig();
  if (!cfg) return null;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    ...(!cfg.secure && cfg.port === 587 ? { requireTLS: true } : {}),
    tls: { minVersion: 'TLSv1.2' as const },
  });
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

function defaultFrom(appName: string): string {
  return (
    process.env.SMTP_FROM?.trim() || `"${appName}" <${process.env.SMTP_USER || 'noreply@localhost'}>`
  );
}

/**
 * Send transactional email. If SMTP is not configured, logs the reset URL in development only.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  appName?: string;
}): Promise<{ sent: boolean; devLogged?: boolean }> {
  const { to, resetUrl } = params;
  const appName = params.appName ?? 'Sentinel Supplier Assurance';
  const from = defaultFrom(appName);

  const transporter = buildSmtpTransport();
  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[mail] SMTP not configured. Password reset link for ${to}:\n${resetUrl}`);
      return { sent: false, devLogged: true };
    }
    // eslint-disable-next-line no-console
    console.error('[mail] SMTP not configured; cannot send password reset email in production');
    return { sent: false };
  }

  await transporter.sendMail({
    from,
    to,
    subject: `Reset your ${appName} password`,
    text: `You requested a password reset.\n\nOpen this link (valid for one hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<p>You requested a password reset for <strong>${appName}</strong>.</p><p><a href="${resetUrl}">Set a new password</a></p><p>This link expires in one hour.</p><p>If you did not request this, you can ignore this email.</p>`,
  });

  return { sent: true };
}

export type AccessRequestMailPayload = {
  email: string;
  fullName: string;
  organization: string | null;
  message: string | null;
};

/**
 * Notify administrators of a new access request. Recipients from ACCESS_REQUEST_NOTIFY_EMAIL (comma-separated).
 */
export async function sendAccessRequestNotification(params: {
  recipients: string[];
  request: AccessRequestMailPayload;
  appName?: string;
}): Promise<{ sent: boolean; devLogged?: boolean }> {
  const { recipients, request: r } = params;
  const appName = params.appName ?? 'Sentinel Supplier Assurance';
  const from = defaultFrom(appName);
  const to = recipients.filter(Boolean);
  if (to.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `[mail] No ACCESS_REQUEST_NOTIFY_EMAIL; access request logged only.\n` +
          `Email: ${r.email}\nName: ${r.fullName}\nOrg: ${r.organization ?? '—'}\nMessage: ${r.message ?? '—'}`
      );
      return { sent: false, devLogged: true };
    }
    // eslint-disable-next-line no-console
    console.error('[mail] ACCESS_REQUEST_NOTIFY_EMAIL not set; cannot notify admins in production');
    return { sent: false };
  }

  const transporter = buildSmtpTransport();
  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `[mail] SMTP not configured. Access request (notify admins):\n` +
          `To: ${to.join(', ')}\nEmail: ${r.email}\nName: ${r.fullName}\nOrg: ${r.organization ?? '—'}\nMessage: ${r.message ?? '—'}`
      );
      return { sent: false, devLogged: true };
    }
    // eslint-disable-next-line no-console
    console.error('[mail] SMTP not configured; cannot send access-request notification in production');
    return { sent: false };
  }

  const lines = [
    `A new Sentinel access request was submitted.`,
    ``,
    `Email: ${r.email}`,
    `Name: ${r.fullName}`,
    `Organization: ${r.organization ?? '—'}`,
    `Message: ${r.message ?? '—'}`,
    ``,
    `Review pending requests in your admin tools or database (AccessRequest table).`,
  ];

  await transporter.sendMail({
    from,
    to: to.join(', '),
    subject: `[${appName}] New access request: ${r.fullName}`,
    text: lines.join('\n'),
    html: `<p><strong>New access request</strong> for ${appName}</p>
<ul>
<li><strong>Email:</strong> ${escapeHtml(r.email)}</li>
<li><strong>Name:</strong> ${escapeHtml(r.fullName)}</li>
<li><strong>Organization:</strong> ${escapeHtml(r.organization ?? '—')}</li>
</ul>
<p><strong>Message:</strong></p>
<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(r.message ?? '—')}</pre>`,
  });

  return { sent: true };
}

/**
 * Generic transactional email (Global Supply PO notifications, etc.).
 */
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  appName?: string;
}): Promise<{ sent: boolean; devLogged?: boolean }> {
  const { to, subject, text, html } = params;
  const appName = params.appName ?? 'Sentinel Supplier Assurance';
  const from = defaultFrom(appName);

  const transporter = buildSmtpTransport();
  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `[mail] SMTP not configured. Transactional email not sent.\nTo: ${to}\nSubject: ${subject}\n${text}`
      );
      return { sent: false, devLogged: true };
    }
    // eslint-disable-next-line no-console
    console.error('[mail] SMTP not configured; cannot send transactional email in production');
    return { sent: false };
  }

  await transporter.sendMail({ from, to, subject, text, html });
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
