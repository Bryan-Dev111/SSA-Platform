/**
 * Users API: list + create (Admin). Link to Buyer/Supplier where applicable.
 */
import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { API_PAGE_ROLES, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['Admin']));

/** Canonical server permission matrix (for Admin UI; Day 9.4) */
router.get(
  '/permission-matrix',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.json({
      apiPageRoles: API_PAGE_ROLES,
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

const ALLOWED_ROLE_NAMES = new Set([
  'Admin',
  'Viewer',
  'QualityEngineer',
  'Auditor',
  'Buyer',
  'Supplier',
]);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        userRoles: { include: { role: true } },
        supplier: { select: { id: true, code: true, name: true } },
        buyerSuppliers: { select: { supplierId: true } },
      },
      orderBy: { email: 'asc' },
    });
    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        roleNames: u.userRoles.map((ur) => ur.role.name),
        supplier: u.supplier ?? undefined,
        assignedSupplierIds: u.buyerSuppliers.map((b) => b.supplierId),
      }))
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() || null : null;
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
    for (const r of roleNames) {
      if (!ALLOWED_ROLE_NAMES.has(r)) {
        res.status(400).json({ error: `Invalid role: ${r}` });
        return;
      }
    }
    const existing = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (existing) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const roleRows = await prisma.role.findMany({ where: { name: { in: roleNames } } });
    if (roleRows.length !== roleNames.length) {
      res.status(400).json({ error: 'One or more role names are invalid' });
      return;
    }
    const user = await prisma.user.create({
      data: {
        email: emailRaw,
        passwordHash,
        name,
        userRoles: {
          create: roleRows.map((r) => ({ roleId: r.id })),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        userRoles: { include: { role: true } },
        supplier: { select: { id: true, code: true, name: true } },
        buyerSuppliers: { select: { supplierId: true } },
      },
    });
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      roleNames: user.userRoles.map((ur) => ur.role.name),
      supplier: user.supplier ?? undefined,
      assignedSupplierIds: user.buyerSuppliers.map((b) => b.supplierId),
    });
  })
);

export default router;
