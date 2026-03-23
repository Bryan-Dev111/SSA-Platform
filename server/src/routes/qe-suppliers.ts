/**
 * Quality Engineer ↔ Supplier assignments (Admin only).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['Admin']));

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const qualityEngineerId = typeof req.body?.qualityEngineerId === 'string' ? req.body.qualityEngineerId : '';
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
    if (!qualityEngineerId || !supplierId) {
      res.status(400).json({ error: 'qualityEngineerId and supplierId are required' });
      return;
    }
    const qeRoles = await prisma.userRole.findMany({
      where: { userId: qualityEngineerId },
      include: { role: true },
    });
    if (!qeRoles.some((ur) => ur.role.name === 'QualityEngineer')) {
      res.status(400).json({ error: 'User is not a Quality Engineer' });
      return;
    }
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    await prisma.qeSupplier.upsert({
      where: { qualityEngineerId_supplierId: { qualityEngineerId, supplierId } },
      update: {},
      create: { qualityEngineerId, supplierId },
    });
    res.status(201).json({ qualityEngineerId, supplierId });
  })
);

router.delete(
  '/:qualityEngineerId/:supplierId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { qualityEngineerId, supplierId } = req.params;
    try {
      await prisma.qeSupplier.delete({
        where: { qualityEngineerId_supplierId: { qualityEngineerId, supplierId } },
      });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Assignment not found' });
    }
  })
);

export default router;
