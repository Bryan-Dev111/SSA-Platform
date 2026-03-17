/**
 * Users API: list users (Admin only). Link to Buyer/Supplier where applicable.
 */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);
router.use(requireRole(['Admin']));

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

export default router;
