/**
 * Quality Manager ↔ Quality Engineer assignments (Admin only).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['Admin', 'QualityManager']));

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const qualityManagerId = typeof req.body?.qualityManagerId === 'string' ? req.body.qualityManagerId : '';
    const qualityEngineerId = typeof req.body?.qualityEngineerId === 'string' ? req.body.qualityEngineerId : '';
    if (!qualityManagerId || !qualityEngineerId) {
      res.status(400).json({ error: 'qualityManagerId and qualityEngineerId are required' });
      return;
    }

    const managerRoles = await prisma.userRole.findMany({
      where: { userId: qualityManagerId },
      include: { role: true },
    });
    if (!managerRoles.some((ur) => ur.role.name === 'QualityManager')) {
      res.status(400).json({ error: 'User is not a Quality Manager' });
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

    await prisma.qualityManagerQe.upsert({
      where: { qualityManagerId_qualityEngineerId: { qualityManagerId, qualityEngineerId } },
      update: {},
      create: { qualityManagerId, qualityEngineerId },
    });

    res.status(201).json({ qualityManagerId, qualityEngineerId });
  })
);

router.delete(
  '/:qualityManagerId/:qualityEngineerId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { qualityManagerId, qualityEngineerId } = req.params;
    try {
      await prisma.qualityManagerQe.delete({
        where: { qualityManagerId_qualityEngineerId: { qualityManagerId, qualityEngineerId } },
      });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Assignment not found' });
    }
  })
);

export default router;
