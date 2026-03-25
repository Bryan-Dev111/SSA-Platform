/**
 * Labor Costs (Admin): list and create labor cost rows.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';
import { PaidStatus } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['Admin']));

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const rows = await prisma.laborCost.findMany({
      include: { workLog: { select: { id: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const workLogId = typeof req.body?.workLogId === 'string' && req.body.workLogId.trim() ? req.body.workLogId.trim() : null;
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const hoursRaw = req.body?.hours;
    const rateRaw = req.body?.rate;
    const paidStatusRaw = typeof req.body?.paidStatus === 'string' ? req.body.paidStatus.trim() : '';

    if (!fullName) {
      res.status(400).json({ error: 'fullName is required' });
      return;
    }
    const hours = Number(hoursRaw);
    const rate = Number(rateRaw);
    if (!Number.isFinite(hours) || hours < 0) {
      res.status(400).json({ error: 'hours must be a non-negative number' });
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      res.status(400).json({ error: 'rate must be a non-negative number' });
      return;
    }

    const paidStatus = paidStatusRaw === 'Paid' ? 'Paid' : 'Pending';
    const code = await getNextCode('COST');
    const created = await prisma.laborCost.create({
      data: {
        code,
        workLogId,
        fullName,
        hours,
        rate,
        totalCost: hours * rate,
        paidStatus: paidStatus as PaidStatus,
      },
      include: { workLog: { select: { id: true, code: true } } },
    });
    res.status(201).json(created);
  })
);

export default router;
