/**
 * Buyer ↔ Supplier assignments (Admin only).
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
    const buyerId = typeof req.body?.buyerId === 'string' ? req.body.buyerId : '';
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
    if (!buyerId || !supplierId) {
      res.status(400).json({ error: 'buyerId and supplierId are required' });
      return;
    }
    const buyerRoles = await prisma.userRole.findMany({
      where: { userId: buyerId },
      include: { role: true },
    });
    if (!buyerRoles.some((ur) => ur.role.name === 'Buyer')) {
      res.status(400).json({ error: 'User is not a Buyer' });
      return;
    }
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    await prisma.buyerSupplier.upsert({
      where: { buyerId_supplierId: { buyerId, supplierId } },
      update: {},
      create: { buyerId, supplierId },
    });
    res.status(201).json({ buyerId, supplierId });
  })
);

router.delete(
  '/:buyerId/:supplierId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { buyerId, supplierId } = req.params;
    try {
      await prisma.buyerSupplier.delete({
        where: { buyerId_supplierId: { buyerId, supplierId } },
      });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Assignment not found' });
    }
  })
);

export default router;
