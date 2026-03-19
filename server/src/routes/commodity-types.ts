/**
 * Commodity Types: CRUD (Admin). GET list for supplier classification (authenticated app users).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const READ_ROLES = ['Admin', 'Viewer', 'QualityEngineer', 'Auditor', 'Buyer'] as const;

router.use(authMiddleware);

router.get(
  '/',
  requireRole([...READ_ROLES]),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.commodityType.findMany({ orderBy: { name: 'asc' } });
    res.json({ list });
  })
);

router.post(
  '/',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const created = await prisma.commodityType.create({ data: { name } });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const updated = await prisma.commodityType.update({
        where: { id: req.params.id },
        data: { name },
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Commodity type not found' });
    }
  })
);

router.delete(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const count = await prisma.supplier.count({ where: { commodityTypeId: req.params.id } });
    if (count > 0) {
      res.status(400).json({ error: `Cannot delete: ${count} supplier(s) use this commodity type` });
      return;
    }
    try {
      await prisma.commodityType.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Commodity type not found' });
    }
  })
);

export default router;
