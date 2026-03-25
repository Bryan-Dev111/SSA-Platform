/**
 * Quality Engineer ↔ Buyer assignments (Admin only).
 * QE -> Buyer mapping; supplier responsibility is derived from Buyer -> Suppliers.
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
    const qualityEngineerId =
      typeof req.body?.qualityEngineerId === 'string' ? req.body.qualityEngineerId : '';
    const buyerId = typeof req.body?.buyerId === 'string' ? req.body.buyerId : '';
    if (!qualityEngineerId || !buyerId) {
      res.status(400).json({ error: 'qualityEngineerId and buyerId are required' });
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
    const buyerRoles = await prisma.userRole.findMany({
      where: { userId: buyerId },
      include: { role: true },
    });
    if (!buyerRoles.some((ur) => ur.role.name === 'Buyer')) {
      res.status(400).json({ error: 'User is not a Buyer' });
      return;
    }

    await prisma.qeBuyer.upsert({
      where: { qualityEngineerId_buyerId: { qualityEngineerId, buyerId } },
      update: {},
      create: { qualityEngineerId, buyerId },
    });

    res.status(201).json({ qualityEngineerId, buyerId });
  })
);

router.delete(
  '/:qualityEngineerId/:buyerId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { qualityEngineerId, buyerId } = req.params;
    try {
      await prisma.qeBuyer.delete({
        where: { qualityEngineerId_buyerId: { qualityEngineerId, buyerId } },
      });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Assignment not found' });
    }
  })
);

export default router;

