/**
 * Labor Costs: list (own rows, or all for Admin/QM with scope=all); manual POST for Internal Management only.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requirePageAccessAny } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';
import { PaidStatus } from '@prisma/client';

const router = Router();

router.use(authMiddleware);

const workLogsScopedLaborAccess = requirePageAccessAny(['WorkLogs', 'GlobalSupplyWorkLogs']);

const laborCostInclude = {
  workLog: { select: { id: true, code: true, projectHistoryId: true, workDate: true } },
  projectHistory: { select: { id: true, projectCode: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

function canViewAllLaborCosts(user: { roleNames: string[] } | undefined): boolean {
  if (!user) return false;
  return user.roleNames.includes('Admin') || user.roleNames.includes('QualityManager');
}

function isAdminUser(user: { roleNames: string[] } | undefined): boolean {
  if (!user) return false;
  return user.roleNames.includes('Admin');
}

router.get(
  '/',
  workLogsScopedLaborAccess,
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

/** Pending (open) labor costs: count and total USD; same scope rules as GET /. */
router.get(
  '/open-summary',
  workLogsScopedLaborAccess,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const all = req.query.scope === 'all' && canViewAllLaborCosts(req.user);
    const where = {
      paidStatus: 'Pending' as const,
      ...(all ? {} : { createdById: req.user.id }),
    };
    const [sumRow, openCount] = await Promise.all([
      prisma.laborCost.aggregate({
        where,
        _sum: { totalCost: true },
      }),
      prisma.laborCost.count({ where }),
    ]);
    const openTotalUsd = sumRow._sum.totalCost ?? 0;
    res.json({ openCount, openTotalUsd });
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

/** Update labor cost. Admin can edit row fields (including Paid rows). */
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

    const existing = await prisma.laborCost.findUnique({
      where: { id },
      select: { id: true, paidStatus: true, hours: true, rate: true, workLogId: true, projectHistoryId: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Labor cost not found' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const fullNameProvided = body.fullName !== undefined;
    const hoursProvided = body.hours !== undefined;
    const rateProvided = body.rate !== undefined;
    const workLogProvided = body.workLogId !== undefined;
    const projectProvided = body.projectHistoryId !== undefined;
    const hasAdminEditPayload =
      fullNameProvided || hoursProvided || rateProvided || workLogProvided || projectProvided;

    if (hasAdminEditPayload) {
      if (!isAdminUser(req.user)) {
        res.status(403).json({ error: 'Only Admin can edit labor cost rows' });
        return;
      }
      const data: {
        fullName?: string;
        hours?: number;
        rate?: number;
        totalCost?: number;
        workLogId?: string | null;
        projectHistoryId?: string | null;
      } = {};

      if (fullNameProvided) {
        const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
        if (!fullName) {
          res.status(400).json({ error: 'fullName cannot be empty' });
          return;
        }
        data.fullName = fullName;
      }

      if (hoursProvided) {
        const hours = Number(body.hours);
        if (!Number.isFinite(hours) || hours < 0) {
          res.status(400).json({ error: 'hours must be a non-negative number' });
          return;
        }
        data.hours = hours;
      }

      if (rateProvided) {
        const rate = Number(body.rate);
        if (!Number.isFinite(rate) || rate < 0) {
          res.status(400).json({ error: 'rate must be a non-negative number' });
          return;
        }
        data.rate = rate;
      }

      if (workLogProvided) {
        const workLogId =
          typeof body.workLogId === 'string' && body.workLogId.trim() ? body.workLogId.trim() : null;
        if (workLogId) {
          const workLog = await prisma.workLog.findUnique({
            where: { id: workLogId },
            select: { id: true, projectHistoryId: true },
          });
          if (!workLog) {
            res.status(400).json({ error: 'workLogId is invalid' });
            return;
          }
          data.workLogId = workLog.id;
          if (!projectProvided) {
            data.projectHistoryId = workLog.projectHistoryId ?? null;
          }
        } else {
          data.workLogId = null;
        }
      }

      if (projectProvided) {
        const projectHistoryId =
          typeof body.projectHistoryId === 'string' && body.projectHistoryId.trim()
            ? body.projectHistoryId.trim()
            : null;
        if (projectHistoryId) {
          const project = await prisma.clientHistory.findUnique({
            where: { id: projectHistoryId },
            select: { id: true },
          });
          if (!project) {
            res.status(400).json({ error: 'projectHistoryId is invalid' });
            return;
          }
        }
        data.projectHistoryId = projectHistoryId;
      }

      const nextHours = data.hours ?? existing.hours;
      const nextRate = data.rate ?? existing.rate;
      if (hoursProvided || rateProvided) {
        data.totalCost = nextHours * nextRate;
      }

      const updated = await prisma.laborCost.update({
        where: { id },
        data,
        include: laborCostInclude,
      });
      res.json(updated);
      return;
    }

    const raw = typeof req.body?.paidStatus === 'string' ? req.body.paidStatus.trim() : '';
    if (raw !== 'Paid' && raw !== 'Rejected') {
      res.status(400).json({ error: 'Send editable fields, or paidStatus Paid or Rejected' });
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
