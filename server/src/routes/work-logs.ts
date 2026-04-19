/**
 * Work Logs: self-serve + admin list (scope=all for Internal Management).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';
import { WorkType } from '@prisma/client';

const router = Router();

router.use(authMiddleware);

function canViewAllWorkLogs(user: { roleNames: string[] } | undefined): boolean {
  if (!user) return false;
  return user.roleNames.includes('Admin') || user.roleNames.includes('QualityManager');
}

/** Best-effort hourly rate for the person named on the work log (employee user record). */
async function hourlyRateForFullName(fullName: string): Promise<number> {
  const t = fullName.trim();
  if (!t) return 0;
  const u = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: t, mode: 'insensitive' } },
        { name: { equals: t, mode: 'insensitive' } },
      ],
    },
    select: { hourlyRate: true },
  });
  if (u && typeof u.hourlyRate === 'number' && Number.isFinite(u.hourlyRate) && u.hourlyRate >= 0) {
    return u.hourlyRate;
  }
  return 0;
}

router.get(
  '/',
  requirePageAccess('WorkLogs'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const all = req.query.scope === 'all' && canViewAllWorkLogs(req.user);
    const rows = await prisma.workLog.findMany({
      where: all ? {} : { createdById: req.user.id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true } },
        shipment: { select: { id: true, code: true } },
        projectHistory: { select: { id: true, projectCode: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    res.json(rows);
  })
);

router.post(
  '/',
  requirePageAccess('WorkLogs'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = req.user.id;
    const allowNameForOther = canViewAllWorkLogs(req.user);
    const workDateRaw = typeof req.body?.workDate === 'string' ? req.body.workDate.trim() : '';
    const hoursWorkedRaw = req.body?.hoursWorked;
    const workTypeRaw = typeof req.body?.workType === 'string' ? req.body.workType.trim() : '';
    const supplierId = typeof req.body?.supplierId === 'string' && req.body.supplierId.trim() ? req.body.supplierId.trim() : null;
    const auditId = typeof req.body?.auditId === 'string' && req.body.auditId.trim() ? req.body.auditId.trim() : null;
    const shipmentId = typeof req.body?.shipmentId === 'string' && req.body.shipmentId.trim() ? req.body.shipmentId.trim() : null;
    const projectHistoryId =
      typeof req.body?.projectHistoryId === 'string' && req.body.projectHistoryId.trim()
        ? req.body.projectHistoryId.trim()
        : null;
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() || null : null;
    const bodyName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const selfLabel = (me?.name?.trim() || me?.email || '').trim();
    const fullName = allowNameForOther && bodyName ? bodyName : selfLabel;
    if (!fullName) {
      res.status(400).json({ error: 'Could not resolve name for this user' });
      return;
    }
    if (!workDateRaw) {
      res.status(400).json({ error: 'workDate is required (YYYY-MM-DD)' });
      return;
    }
    const hoursWorked = Number(hoursWorkedRaw);
    if (!Number.isFinite(hoursWorked) || hoursWorked < 0) {
      res.status(400).json({ error: 'hoursWorked must be a non-negative number' });
      return;
    }
    if (!['Audit', 'Inspection', 'Travel', 'Admin', 'Other'].includes(workTypeRaw)) {
      res.status(400).json({ error: 'workType must be one of: Audit, Inspection, Travel, Admin, Other' });
      return;
    }

    if (projectHistoryId) {
      const exists = await prisma.clientHistory.findUnique({ where: { id: projectHistoryId }, select: { id: true } });
      if (!exists) {
        res.status(400).json({ error: 'projectHistoryId is invalid' });
        return;
      }
    }

    const workDate = new Date(workDateRaw.slice(0, 10) + 'T12:00:00.000Z');
    const logCode = await getNextCode('LOG');
    const rate = await hourlyRateForFullName(fullName);
    const totalCost = hoursWorked * rate;
    const costCode = await getNextCode('COST');

    const created = await prisma.$transaction(async (tx) => {
      const wl = await tx.workLog.create({
        data: {
          code: logCode,
          fullName,
          workDate,
          hoursWorked,
          workType: workTypeRaw as WorkType,
          supplierId,
          auditId,
          shipmentId,
          projectHistoryId,
          description,
          createdById: userId,
        },
      });
      await tx.laborCost.create({
        data: {
          code: costCode,
          workLogId: wl.id,
          projectHistoryId,
          fullName,
          hours: hoursWorked,
          rate,
          totalCost,
          paidStatus: 'Pending',
          createdById: userId,
        },
      });
      return tx.workLog.findUniqueOrThrow({
        where: { id: wl.id },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          audit: { select: { id: true, code: true } },
          shipment: { select: { id: true, code: true } },
          projectHistory: { select: { id: true, projectCode: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
    });

    res.status(201).json(created);
  })
);

export default router;
