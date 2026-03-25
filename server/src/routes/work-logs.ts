/**
 * Work Logs (Admin): list and create work log rows.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';
import { WorkType } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['Admin']));

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const rows = await prisma.workLog.findMany({
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true } },
        shipment: { select: { id: true, code: true } },
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    res.json(rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const workDateRaw = typeof req.body?.workDate === 'string' ? req.body.workDate.trim() : '';
    const hoursWorkedRaw = req.body?.hoursWorked;
    const workTypeRaw = typeof req.body?.workType === 'string' ? req.body.workType.trim() : '';
    const supplierId = typeof req.body?.supplierId === 'string' && req.body.supplierId.trim() ? req.body.supplierId.trim() : null;
    const auditId = typeof req.body?.auditId === 'string' && req.body.auditId.trim() ? req.body.auditId.trim() : null;
    const shipmentId = typeof req.body?.shipmentId === 'string' && req.body.shipmentId.trim() ? req.body.shipmentId.trim() : null;
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() || null : null;

    if (!fullName) {
      res.status(400).json({ error: 'fullName is required' });
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

    const code = await getNextCode('LOG');
    const workDate = new Date(workDateRaw.slice(0, 10) + 'T12:00:00.000Z');
    const created = await prisma.workLog.create({
      data: {
        code,
        fullName,
        workDate,
        hoursWorked,
        workType: workTypeRaw as WorkType,
        supplierId,
        auditId,
        shipmentId,
        description,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true } },
        shipment: { select: { id: true, code: true } },
      },
    });
    res.status(201).json(created);
  })
);

export default router;
