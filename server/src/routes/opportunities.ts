/**
 * Opportunities / risk items: list (scoped); Admin delete (Day 9.4).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Risk'));

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const where = allowedIds === null ? {} : { supplierId: { in: allowedIds } };
    if (allowedIds !== null && allowedIds.length === 0) {
      res.json([]);
      return;
    }
    const list = await prisma.opportunity.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  })
);

router.delete(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const allowedIds = await getAllowedSupplierIds(req.user!);
    const row = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(row.supplierId)) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    await prisma.opportunity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
