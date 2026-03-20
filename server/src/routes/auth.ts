/**
 * Auth: login, register — JWT + bcrypt
 */
import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { signToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { getPathRolesMatrix } from '../lib/permissions';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
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

export default router;
