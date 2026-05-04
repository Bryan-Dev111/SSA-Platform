/**
 * Work Logs: self-serve + admin list (scope=all for Internal Management).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requirePageAccessAny } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';
import { WorkType } from '@prisma/client';
import { resolveProjectHistoryIdFromShipmentFields } from '../lib/shipmentProjectResolve';
import { hourlyRateForFullName } from '../lib/employeeHourlyRate';

const router = Router();

async function resolveWorkLogProjectHistoryId(
  auditId: string | null,
  shipmentId: string | null
): Promise<string | null> {
  if (auditId) {
    const a = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { projectHistoryId: true },
    });
    return a?.projectHistoryId ?? null;
  }
  if (shipmentId) {
    const s = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        supplierId: true,
        purchaseOrder: true,
        partNumber: true,
        projectHistoryId: true,
      },
    });
    if (!s) return null;
    if (s.projectHistoryId) return s.projectHistoryId;
    return resolveProjectHistoryIdFromShipmentFields({
      supplierId: s.supplierId,
      purchaseOrder: s.purchaseOrder,
      partNumber: s.partNumber,
      explicitProjectHistoryId: null,
    });
  }
  return null;
}

router.use(authMiddleware);

function canViewAllWorkLogs(user: { roleNames: string[] } | undefined): boolean {
  if (!user) return false;
  return user.roleNames.includes('Admin') || user.roleNames.includes('QualityManager');
}

function isAdminUser(user: { roleNames: string[] } | undefined): boolean {
  if (!user) return false;
  return user.roleNames.includes('Admin');
}

const workLogsPageAccess = requirePageAccessAny(['WorkLogs', 'GlobalSupplyWorkLogs']);

router.get(
  '/preview-rate',
  workLogsPageAccess,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, email: true, currency: true },
    });
    const label = (me?.name?.trim() || me?.email || '').trim();
    const hourlyRate = await hourlyRateForFullName(label);
    res.json({
      hourlyRate,
      currency: me?.currency ?? null,
    });
  })
);

router.get(
  '/',
  workLogsPageAccess,
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
        audit: { select: { id: true, code: true, projectHistoryId: true, projectHistory: { select: { id: true, projectCode: true } } } },
        shipment: {
          select: {
            id: true,
            code: true,
            projectHistoryId: true,
            supplierId: true,
            purchaseOrder: true,
            partNumber: true,
            projectHistory: { select: { id: true, projectCode: true } },
          },
        },
        projectHistory: { select: { id: true, projectCode: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        laborCosts: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { totalCost: true },
        },
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    res.json(rows);
  })
);

router.post(
  '/',
  workLogsPageAccess,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = req.user.id;
    const workDateRaw = typeof req.body?.workDate === 'string' ? req.body.workDate.trim() : '';
    const hoursWorkedRaw = req.body?.hoursWorked;
    const workTypeRaw = typeof req.body?.workType === 'string' ? req.body.workType.trim() : '';
    const supplierId = typeof req.body?.supplierId === 'string' && req.body.supplierId.trim() ? req.body.supplierId.trim() : null;
    const auditId = typeof req.body?.auditId === 'string' && req.body.auditId.trim() ? req.body.auditId.trim() : null;
    const shipmentId = typeof req.body?.shipmentId === 'string' && req.body.shipmentId.trim() ? req.body.shipmentId.trim() : null;
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() || null : null;

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, country: true },
    });
    const fullName = (me?.name?.trim() || me?.email || '').trim();
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

    const projectHistoryId = await resolveWorkLogProjectHistoryId(auditId, shipmentId);

    const workDate = new Date(workDateRaw.slice(0, 10) + 'T12:00:00.000Z');
    const logCode = await getNextCode('LOG');
    const rate = await hourlyRateForFullName(fullName);
    const totalCost = hoursWorked * rate;
    const costCode = await getNextCode('COST');
    const expCode = await getNextCode('EXP');
    const expenseCountry = me?.country?.trim() || null;
    const payrollDescription = `Paying ${fullName}`;

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
      await tx.expense.create({
        data: {
          code: expCode,
          status: 'Open',
          type: 'Payroll',
          description: payrollDescription,
          project: 'Global Vendors',
          amount: totalCost,
          expenseDate: workDate,
          paymentMethod: '',
          country: expenseCountry,
        },
      });
      return tx.workLog.findUniqueOrThrow({
        where: { id: wl.id },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          audit: { select: { id: true, code: true, projectHistoryId: true, projectHistory: { select: { id: true, projectCode: true } } } },
          shipment: {
            select: {
              id: true,
              code: true,
              projectHistoryId: true,
              supplierId: true,
              purchaseOrder: true,
              partNumber: true,
              projectHistory: { select: { id: true, projectCode: true } },
            },
          },
          projectHistory: { select: { id: true, projectCode: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          laborCosts: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { totalCost: true },
          },
        },
      });
    });

    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  workLogsPageAccess,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!isAdminUser(req.user)) {
      res.status(403).json({ error: 'Only Admin can edit work logs' });
      return;
    }

    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Work log id is required' });
      return;
    }

    const patch: {
      workDate?: Date;
      workType?: WorkType;
      description?: string | null;
    } = {};

    if (typeof req.body?.workDate === 'string') {
      const workDateRaw = req.body.workDate.trim();
      if (!workDateRaw) {
        res.status(400).json({ error: 'workDate cannot be empty' });
        return;
      }
      patch.workDate = new Date(workDateRaw.slice(0, 10) + 'T12:00:00.000Z');
      if (Number.isNaN(patch.workDate.getTime())) {
        res.status(400).json({ error: 'workDate must be a valid date (YYYY-MM-DD)' });
        return;
      }
    }

    if (typeof req.body?.workType === 'string') {
      const workTypeRaw = req.body.workType.trim();
      if (!['Audit', 'Inspection', 'Travel', 'Admin', 'Other'].includes(workTypeRaw)) {
        res
          .status(400)
          .json({ error: 'workType must be one of: Audit, Inspection, Travel, Admin, Other' });
        return;
      }
      patch.workType = workTypeRaw as WorkType;
    }

    if (typeof req.body?.description === 'string') {
      patch.description = req.body.description.trim() || null;
    } else if (req.body && req.body.description === null) {
      patch.description = null;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'No editable fields provided' });
      return;
    }

    const existing = await prisma.workLog.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      res.status(404).json({ error: 'Work log not found' });
      return;
    }

    const updated = await prisma.workLog.update({
      where: { id },
      data: patch,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: {
          select: {
            id: true,
            code: true,
            projectHistoryId: true,
            projectHistory: { select: { id: true, projectCode: true } },
          },
        },
        shipment: {
          select: {
            id: true,
            code: true,
            projectHistoryId: true,
            supplierId: true,
            purchaseOrder: true,
            partNumber: true,
            projectHistory: { select: { id: true, projectCode: true } },
          },
        },
        projectHistory: { select: { id: true, projectCode: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        laborCosts: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { totalCost: true },
        },
      },
    });

    res.json(updated);
  })
);

export default router;
