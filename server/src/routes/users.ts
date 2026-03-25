/**
 * Users API: list + create (Admin). Link to Buyer/Supplier where applicable.
 */
import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { API_PAGE_ROLES, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { DEFAULT_PATH_ROLES, PAGE_DEFINITIONS } from '../lib/permissions';

const router = Router();

function parseIsEmployee(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === '1';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

function getPasswordEncryptionKey(): Buffer {
  const raw = process.env.PASSWORD_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) {
    // Fallback: derive an AES key from JWT_SECRET if no dedicated key is configured.
    // This keeps the feature functional without extra env configuration.
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || !jwtSecret.trim()) {
      throw new Error('Either PASSWORD_ENCRYPTION_KEY or JWT_SECRET must be set');
    }
    return createHash('sha256').update(jwtSecret, 'utf8').digest(); // 32 bytes
  }
  const trimmed = raw.trim();

  // Accept 64-hex (32 bytes) or base64 (32 bytes).
  const isHex = /^[0-9a-fA-F]+$/.test(trimmed);
  if (isHex) {
    const buf = Buffer.from(trimmed, 'hex');
    if (buf.length !== 32) throw new Error('PASSWORD_ENCRYPTION_KEY hex must decode to 32 bytes');
    return buf;
  }
  const buf = Buffer.from(trimmed, 'base64');
  if (buf.length !== 32) throw new Error('PASSWORD_ENCRYPTION_KEY base64 must decode to 32 bytes');
  return buf;
}

function encryptPassword(plain: string): string {
  const key = getPasswordEncryptionKey();
  // AES-256-GCM standard: 12-byte IV + 16-byte auth tag.
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decryptPassword(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    const key = getPasswordEncryptionKey();
    const buf = Buffer.from(encrypted, 'base64');
    if (buf.length < 12 + 16) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(tag));
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return plain;
  } catch {
    return null;
  }
}

router.use(authMiddleware);
router.use(requireRole(['Admin']));

/** Canonical server permission matrix (for Admin UI; Day 9.4) */
router.get(
  '/permission-matrix',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const roles = await prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const perms = await prisma.rolePagePermission.findMany({
      where: { pageKey: { in: PAGE_DEFINITIONS.map((p) => p.key) } },
      select: { roleId: true, pageKey: true, canAccess: true },
    });
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const role of roles) {
      matrix[role.name] = {};
      for (const page of PAGE_DEFINITIONS) {
        const row = perms.find((p) => p.roleId === role.id && p.pageKey === page.key);
        if (perms.length === 0) {
          matrix[role.name][page.key] = (DEFAULT_PATH_ROLES[page.path] ?? []).includes(role.name);
        } else {
          matrix[role.name][page.key] = row?.canAccess ?? false;
        }
      }
    }
    res.json({
      apiPageRoles: API_PAGE_ROLES,
      pages: PAGE_DEFINITIONS,
      roles: roles.map((r) => r.name),
      matrix,
      adminOnlyDeletes: [
        { entity: 'Finding', method: 'DELETE', path: '/findings/:id' },
        { entity: 'Audit', method: 'DELETE', path: '/audits/:id' },
        { entity: 'CAR (CorrectiveAction)', method: 'DELETE', path: '/cars/:id' },
        { entity: 'Risk snapshot', method: 'DELETE', path: '/risk-snapshots/:id' },
        { entity: 'Opportunity', method: 'DELETE', path: '/opportunities/:id' },
        { entity: 'Supplier', method: 'DELETE', path: '/suppliers/:idOrCode' },
      ],
    });
  })
);

router.post(
  '/roles',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Role name is required' });
      return;
    }
    const created = await prisma.role.create({ data: { name } });
    res.status(201).json(created);
  })
);

router.put(
  '/permission-matrix',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const matrixRaw = req.body?.matrix as Record<string, Record<string, boolean>> | undefined;
    if (!matrixRaw || typeof matrixRaw !== 'object') {
      res.status(400).json({ error: 'matrix is required' });
      return;
    }
    const roles = await prisma.role.findMany({ select: { id: true, name: true } });
    const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
    const ops: ReturnType<typeof prisma.rolePagePermission.upsert>[] = [];
    for (const roleName of Object.keys(matrixRaw)) {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) continue;
      const row = matrixRaw[roleName] ?? {};
      for (const page of PAGE_DEFINITIONS) {
        const canAccess = Boolean(row[page.key]);
        ops.push(
          prisma.rolePagePermission.upsert({
            where: { roleId_pageKey: { roleId, pageKey: page.key } },
            create: { roleId, pageKey: page.key, canAccess },
            update: { canAccess },
          })
        );
      }
    }
    if (ops.length) {
      await prisma.$transaction(ops);
    }
    res.json({ ok: true });
  })
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        passwordEncrypted: true,
        isEmployee: true,
        createdAt: true,
        userRoles: { include: { role: true } },
        supplier: { select: { id: true, code: true, name: true } },
        buyerSuppliers: { select: { supplierId: true } },
        qeSuppliers: { select: { supplierId: true } },
      },
      orderBy: { email: 'asc' },
    });
    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        isEmployee: u.isEmployee,
        createdAt: u.createdAt,
        passwordPlain: decryptPassword(u.passwordEncrypted),
        roleNames: u.userRoles.map((ur) => ur.role.name),
        supplier: u.supplier ?? undefined,
        assignedSupplierIds: u.buyerSuppliers.map((b) => b.supplierId),
        qeAssignedSupplierIds: u.qeSuppliers.map((q) => q.supplierId),
      }))
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
    const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
    const nameFromParts = [firstName, lastName].filter(Boolean).join(' ').trim();
    const nameLegacy = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const name = nameFromParts || nameLegacy || null;
    const isEmployee = parseIsEmployee(req.body?.isEmployee);
    const roleNamesRaw = Array.isArray(req.body?.roleNames) ? (req.body.roleNames as unknown[]).map(String) : [];
    const roleNames = [...new Set(roleNamesRaw)];
    if (!emailRaw || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    if (roleNames.length === 0) {
      res.status(400).json({ error: 'roleNames must include at least one role' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (existing) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const passwordEncrypted = encryptPassword(password);
    const roleRows = await prisma.role.findMany({ where: { name: { in: roleNames } } });
    if (roleRows.length !== roleNames.length) {
      res.status(400).json({ error: 'One or more role names are invalid' });
      return;
    }
    const user = await prisma.user.create({
      data: {
        email: emailRaw,
        passwordHash,
        passwordEncrypted,
        name,
        isEmployee,
        userRoles: {
          create: roleRows.map((r) => ({ roleId: r.id })),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        isEmployee: true,
        createdAt: true,
        userRoles: { include: { role: true } },
        supplier: { select: { id: true, code: true, name: true } },
        buyerSuppliers: { select: { supplierId: true } },
        qeSuppliers: { select: { supplierId: true } },
      },
    });
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      isEmployee: user.isEmployee,
      createdAt: user.createdAt,
      roleNames: user.userRoles.map((ur) => ur.role.name),
      supplier: user.supplier ?? undefined,
      assignedSupplierIds: user.buyerSuppliers.map((b) => b.supplierId),
      qeAssignedSupplierIds: user.qeSuppliers.map((q) => q.supplierId),
    });
  })
);

export default router;
