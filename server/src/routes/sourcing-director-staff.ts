/**
 * Global Supply: assign employees/contractors to users with the SourcingDirector role.
 */
import { Router, Request, Response } from 'express';
import { prisma, prismaBase } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['Admin', 'QualityManager']));

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sourcingDirectorId =
      typeof req.body?.sourcingDirectorId === 'string' ? req.body.sourcingDirectorId.trim() : '';
    const staffUserId = typeof req.body?.staffUserId === 'string' ? req.body.staffUserId.trim() : '';
    if (!sourcingDirectorId || !staffUserId) {
      res.status(400).json({ error: 'sourcingDirectorId and staffUserId are required' });
      return;
    }
    if (sourcingDirectorId === staffUserId) {
      res.status(400).json({ error: 'Sourcing director and staff must be different users' });
      return;
    }

    const [director, staff] = await Promise.all([
      prisma.user.findUnique({
        where: { id: sourcingDirectorId },
        select: {
          id: true,
          userRoles: { include: { role: { select: { name: true } } } },
        },
      }),
      prisma.user.findUnique({
        where: { id: staffUserId },
        select: { id: true, isEmployee: true, isContractor: true },
      }),
    ]);

    if (!director || !director.userRoles.some((ur) => ur.role.name === 'SourcingDirector')) {
      res.status(400).json({ error: 'Selected user is not a Sourcing Director' });
      return;
    }
    if (!staff || (!staff.isEmployee && !staff.isContractor)) {
      res.status(400).json({ error: 'Selected user must be an employee or contractor' });
      return;
    }

    await prismaBase.sourcingDirectorStaff.upsert({
      where: {
        sourcingDirectorId_staffUserId: { sourcingDirectorId, staffUserId },
      },
      create: { sourcingDirectorId, staffUserId },
      update: {},
    });

    res.status(201).json({ sourcingDirectorId, staffUserId });
  })
);

router.delete(
  '/:sourcingDirectorId/:staffUserId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sourcingDirectorId, staffUserId } = req.params;
    try {
      await prismaBase.sourcingDirectorStaff.delete({
        where: { sourcingDirectorId_staffUserId: { sourcingDirectorId, staffUserId } },
      });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Assignment not found' });
    }
  })
);

export default router;
