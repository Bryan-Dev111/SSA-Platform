/**
 * Current user / profile — GET /me (auth required)
 */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      userRoles: { include: { role: true } },
      supplier: { select: { id: true, code: true, name: true } },
      buyerSuppliers: { select: { supplierId: true } },
    },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    roleNames: user.userRoles.map((ur) => ur.role.name),
    supplier: user.supplier ?? undefined,
    assignedSupplierIds: user.buyerSuppliers.map((b) => b.supplierId),
  });
  })
);

export default router;
