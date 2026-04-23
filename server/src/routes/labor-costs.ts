/**
 * Labor Costs: list (own rows, or all for Admin/QM with scope=all); manual POST for Internal Management only.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';
import { PaidStatus } from '@prisma/client';

const router = Router();

router.use(authMiddleware);

const laborCostInclude = {
  workLog: { select: { id: true, code: true, projectHistoryId: true, workDate: true } },
  projectHistory: { select: { id: true, projectCode: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

function canViewAllLaborCosts(user: { roleNames: string[] } | undefined): boolean {
  if (!user) return false;
  return user.roleNames.includes('Admin') || user.roleNames.includes('QualityManager');
}

router.get(
  '/',
  requirePageAccess('WorkLogs'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const all = req.query.scope === 'all' && canViewAllLaborCosts(req.user);
    const rows = await prisma.laborCost.findMany({
      where: all ? {} : { createdById: req.user.id },
      include: laborCostInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(rows);
  })
);

router.post(
  '/',
  requirePageAccess('InternalManagement'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const workLogId = typeof req.body?.workLogId === 'string' && req.body.workLogId.trim() ? req.body.workLogId.trim() : null;
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const hoursRaw = req.body?.hours;
    const rateRaw = req.body?.rate;
    const paidStatusRaw = typeof req.body?.paidStatus === 'string' ? req.body.paidStatus.trim() : '';
    let projectHistoryId =
      typeof req.body?.projectHistoryId === 'string' && req.body.projectHistoryId.trim()
        ? req.body.projectHistoryId.trim()
        : null;

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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

    const paidStatus: PaidStatus =
      paidStatusRaw === 'Paid' ? 'Paid' : paidStatusRaw === 'Rejected' ? 'Rejected' : 'Pending';
    let workLogProjectHistoryId: string | null = null;
    if (workLogId) {
      const workLog = await prisma.workLog.findUnique({
        where: { id: workLogId },
        select: { id: true, projectHistoryId: true },
      });
      if (!workLog) {
        res.status(400).json({ error: 'workLogId is invalid' });
        return;
      }
      workLogProjectHistoryId = workLog.projectHistoryId;
    }
    if (!projectHistoryId && workLogProjectHistoryId) {
      projectHistoryId = workLogProjectHistoryId;
    }
    if (projectHistoryId) {
      const project = await prisma.clientHistory.findUnique({ where: { id: projectHistoryId }, select: { id: true } });
      if (!project) {
        res.status(400).json({ error: 'projectHistoryId is invalid' });
        return;
      }
    }
    const code = await getNextCode('COST');
    const created = await prisma.laborCost.create({
      data: {
        code,
        workLogId,
        projectHistoryId,
        fullName,
        hours,
        rate,
        totalCost: hours * rate,
        paidStatus: paidStatus as PaidStatus,
        createdById: req.user.id,
      },
      include: laborCostInclude,
    });
    res.status(201).json(created);
  })
);

/** Update pending labor cost: optional `rate` (recalculates total), or `paidStatus` Paid/Rejected. */
router.patch(
  '/:id',
  requirePageAccess('InternalManagement'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = typeof req.params?.id === 'string' ? req.params.id.trim() : '';
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const rateRaw = req.body?.rate;
    const rateProvided =
      rateRaw !== undefined &&
      rateRaw !== null &&
      !(typeof rateRaw === 'string' && String(rateRaw).trim() === '');

    if (rateProvided) {
      const rate = Number(rateRaw);
      if (!Number.isFinite(rate) || rate < 0) {
        res.status(400).json({ error: 'rate must be a non-negative number' });
        return;
      }
      const existing = await prisma.laborCost.findUnique({
        where: { id },
        select: { id: true, hours: true, paidStatus: true },
      });
      if (!existing) {
        res.status(404).json({ error: 'Labor cost not found' });
        return;
      }
      if (existing.paidStatus !== 'Pending') {
        res.status(400).json({ error: 'Rate can only be adjusted while paid status is Pending' });
        return;
      }
      const totalCost = existing.hours * rate;
      const updated = await prisma.laborCost.update({
        where: { id },
        data: { rate, totalCost },
        include: laborCostInclude,
      });
      res.json(updated);
      return;
    }

    const raw = typeof req.body?.paidStatus === 'string' ? req.body.paidStatus.trim() : '';
    if (raw !== 'Paid' && raw !== 'Rejected') {
      res.status(400).json({ error: 'Send rate to update, or paidStatus Paid or Rejected' });
      return;
    }

    const existing = await prisma.laborCost.findUnique({
      where: { id },
      select: { id: true, paidStatus: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Labor cost not found' });
      return;
    }
    if (existing.paidStatus !== 'Pending') {
      res.status(400).json({ error: 'Only pending labor costs can be marked paid or rejected' });
      return;
    }

    const updated = await prisma.laborCost.update({
      where: { id },
      data: { paidStatus: raw as PaidStatus },
      include: laborCostInclude,
    });
    res.json(updated);
  })
);

export default router;
