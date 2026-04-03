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

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
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
  const from = process.env.SMTP_FROM?.trim() || `"${appName}" <${process.env.SMTP_USER || 'noreply@localhost'}>`;

  const cfg = getSmtpConfig();
  if (!cfg) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[mail] SMTP not configured. Password reset link for ${to}:\n${resetUrl}`);
      return { sent: false, devLogged: true };
    }
    // eslint-disable-next-line no-console
    console.error('[mail] SMTP not configured; cannot send password reset email in production');
    return { sent: false };
  }

  // Port 587: STARTTLS (e.g. Microsoft 365 / smtp.office365.com). Port 465: implicit TLS (secure: true).
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    ...(!cfg.secure && cfg.port === 587 ? { requireTLS: true } : {}),
    tls: { minVersion: 'TLSv1.2' as const },
  });

  await transporter.sendMail({
    from,
    to,
    subject: `Reset your ${appName} password`,
    text: `You requested a password reset.\n\nOpen this link (valid for one hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<p>You requested a password reset for <strong>${appName}</strong>.</p><p><a href="${resetUrl}">Set a new password</a></p><p>This link expires in one hour.</p><p>If you did not request this, you can ignore this email.</p>`,
  });

  return { sent: true };
}
