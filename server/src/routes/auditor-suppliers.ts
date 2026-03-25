/**
 * Auditor ↔ Supplier assignments (Admin only).
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
    const auditorId = typeof req.body?.auditorId === 'string' ? req.body.auditorId : '';
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
    if (!auditorId || !supplierId) {
      res.status(400).json({ error: 'auditorId and supplierId are required' });
      return;
    }

    const auditorRoles = await prisma.userRole.findMany({
      where: { userId: auditorId },
      include: { role: true },
    });
    if (!auditorRoles.some((ur) => ur.role.name === 'Auditor')) {
      res.status(400).json({ error: 'User is not an Auditor' });
      return;
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    await prisma.auditorSupplier.upsert({
      where: { auditorId_supplierId: { auditorId, supplierId } },
      update: {},
      create: { auditorId, supplierId },
    });

    res.status(201).json({ auditorId, supplierId });
  })
);

router.delete(
  '/:auditorId/:supplierId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { auditorId, supplierId } = req.params;
    try {
      await prisma.auditorSupplier.delete({
        where: { auditorId_supplierId: { auditorId, supplierId } },
      });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Assignment not found' });
    }
  })
);

export default router;

