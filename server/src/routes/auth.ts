/**
 * Auth: login, register, forgot/reset password — JWT + bcrypt
 */
import { createHash, randomBytes } from 'crypto';
import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { signToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma, prismaBase } from '../lib/prisma';
import { getPathRolesMatrix } from '../lib/permissions';
import { encryptPassword } from '../lib/passwordCrypto';
import { sendPasswordResetEmail, sendAccessRequestNotification } from '../lib/mail';
import {
  buildSuperAuthUser,
  isSuperUserEmail,
  validateSuperCredentials,
} from '../lib/superUser';
import { isDatabaseConnected } from '../lib/databaseConnection';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Comma/semicolon-separated ACCESS_REQUEST_NOTIFY_EMAIL, else SMTP_USER if it looks like an email. */
function accessRequestNotifyRecipients(): string[] {
  const raw = process.env.ACCESS_REQUEST_NOTIFY_EMAIL?.trim();
  if (raw) {
    return raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => EMAIL_RE.test(s));
  }
  const fallback = process.env.SMTP_USER?.trim();
  if (fallback && EMAIL_RE.test(fallback)) return [fallback];
  return [];
}

const RESET_TOKEN_BYTES = 32;
const RESET_EXPIRY_MS = 60 * 60 * 1000;

function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function publicAppUrl(): string {
  const u = process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  return u.replace(/\/$/, '');
}

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (await validateSuperCredentials(normalizedEmail, password)) {
    const superUser = buildSuperAuthUser();
    const token = signToken({ userId: superUser.id, email: superUser.email });
    res.json({ token, user: superUser });
    return;
  }
  if (!isDatabaseConnected()) {
    res.status(503).json({
      error: 'Database disconnected. Sign in as Super to reconnect.',
      code: 'DATABASE_DISCONNECTED',
    });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      userRoles: { include: { role: true } },
      supplier: true,
      buyerSuppliers: true,
    },
  });
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const roleNames = user.userRoles.map((ur) => ur.role.name);
  const pathRoles = await getPathRolesMatrix();
  const supplierId = user.supplier?.id ?? null;
  const buyerId = user.buyerSuppliers.length ? user.id : null;
  const token = signToken({ userId: user.id, email: user.email });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleNames,
      pathRoles,
      supplierId,
      buyerId: buyerId ?? undefined,
    },
  });
  })
);

router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (isSuperUserEmail(normalizedEmail)) {
    res.status(400).json({ error: 'Email already registered' });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    res.status(400).json({ error: 'Email already registered' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: name?.trim() || null,
    },
    include: {
      userRoles: { include: { role: true } },
      supplier: true,
      buyerSuppliers: true,
    },
  });
  const roleNames = user.userRoles.map((ur) => ur.role.name);
  const pathRoles = await getPathRolesMatrix();
  const token = signToken({ userId: user.id, email: user.email });
  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleNames,
      pathRoles,
      supplierId: user.supplier?.id ?? undefined,
      buyerId: user.buyerSuppliers.length ? user.id : undefined,
    },
  });
  })
);

router.post(
  '/forgot-password',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const generic = {
      ok: true,
      message: 'If an account exists for that email, you will receive reset instructions shortly.',
    };
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      res.status(400).json({ error: 'A valid email address is required' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (user) {
      const raw = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
      const tokenHash = hashResetToken(raw);
      const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
      const resetUrl = `${publicAppUrl()}/reset-password?token=${encodeURIComponent(raw)}`;
      try {
        await sendPasswordResetEmail({ to: user.email, resetUrl });
      } catch (err) {
        // Same JSON response either way; roll back token so the user can retry.
        // eslint-disable-next-line no-console
        console.error('[auth/forgot-password] email send failed:', err);
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      }
    }
    res.json(generic);
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }
    const tokenHash = hashResetToken(token);
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!row || row.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: 'Invalid or expired reset link. Please request a new password reset.' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const passwordEncrypted = encryptPassword(password);
    await prismaBase.$transaction([
      prismaBase.user.update({
        where: { id: row.userId },
        data: { passwordHash, passwordEncrypted },
      }),
      prismaBase.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
    ]);
    res.json({ ok: true, message: 'Your password has been updated. You can sign in now.' });
  })
);

router.post(
  '/request-access',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = req.body as {
      email?: string;
      fullName?: string;
      name?: string;
      organization?: string;
      company?: string;
      message?: string;
    };
    const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullNameRaw = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const nameRaw = typeof body.name === 'string' ? body.name.trim() : '';
    const fullName = (fullNameRaw || nameRaw).trim();
    const organization =
      typeof body.organization === 'string'
        ? body.organization.trim().slice(0, 200)
        : typeof body.company === 'string'
          ? body.company.trim().slice(0, 200)
          : '';
    const message =
      typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';

    if (!emailRaw || !EMAIL_RE.test(emailRaw)) {
      res.status(400).json({ error: 'A valid email address is required' });
      return;
    }
    if (!fullName || fullName.length > 200) {
      res.status(400).json({ error: 'Your name is required (max 200 characters)' });
      return;
    }

    const orgNull = organization.length > 0 ? organization : null;
    const msgNull = message.length > 0 ? message : null;

    await prismaBase.accessRequest.create({
      data: {
        email: emailRaw,
        fullName,
        organization: orgNull,
        message: msgNull,
      },
    });

    try {
      await sendAccessRequestNotification({
        recipients: accessRequestNotifyRecipients(),
        request: {
          email: emailRaw,
          fullName,
          organization: orgNull,
          message: msgNull,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth/request-access] notification email failed:', err);
    }

    res.json({
      ok: true,
      message:
        'Thank you. Your request has been submitted. An administrator will contact you if your access is approved.',
    });
  })
);

export default router;
