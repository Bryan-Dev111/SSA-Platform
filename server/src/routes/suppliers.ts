/**
 * Suppliers API: list and get one. Scope: Admin all; Buyer assigned; Supplier own.
 */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { getAllowedSupplierIds } from '../services/scope';
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
    const allowedIds = await getAllowedSupplierIds(req.user);
    const where = allowedIds === null ? {} : { id: { in: allowedIds } };
    const suppliers = await prisma.supplier.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        commodityTypeId: true,
      },
      orderBy: { code: 'asc' },
    });
    res.json(suppliers);
  })
);

router.get(
  '/:idOrCode',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const idOrCode = req.params.idOrCode;
    // Support lookup by id (cuid) or by code (e.g. SUP-TEST01)
    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        commodityTypeId: true,
        createdAt: true,
      },
    });
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(supplier.id)) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    res.json(supplier);
  })
);

export default router;
