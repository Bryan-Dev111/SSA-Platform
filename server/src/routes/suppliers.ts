/**
 * Suppliers API: list and get one. Scope: Admin all; Buyer assigned; Supplier own.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

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
        commodityType: { select: { id: true, name: true } },
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
        commodityType: { select: { id: true, name: true } },
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

/** PATCH /suppliers/:id — Admin only; set commodityTypeId for classification */
router.patch(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const commodityTypeIdRaw = (req.body as { commodityTypeId?: unknown }).commodityTypeId;
    if (commodityTypeIdRaw === undefined) {
      res.status(400).json({ error: 'commodityTypeId is required (use null to clear)' });
      return;
    }
    const commodityTypeId =
      commodityTypeIdRaw === null || commodityTypeIdRaw === '' ? null : String(commodityTypeIdRaw);
    if (commodityTypeId !== null) {
      const ct = await prisma.commodityType.findUnique({ where: { id: commodityTypeId } });
      if (!ct) {
        res.status(400).json({ error: 'Invalid commodity type id' });
        return;
      }
    }
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    const updated = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { commodityTypeId },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
      },
    });
    res.json(updated);
  })
);

export default router;
