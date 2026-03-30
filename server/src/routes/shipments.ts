/**
 * Shipments: inspection requests; Supplier creates (Day 9); list scoped.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { computeShipmentMetrics } from '../services/shipmentMetrics';
import { asyncHandler } from '../middleware/asyncHandler';
import { ShipmentResult, ShipmentStatus } from '@prisma/client';
import { createAlertForRecipients } from '../services/alerts';
import { getNextCode } from '../services/idGenerator';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Shipments'));

function canRecordInspectionResult(roleNames: string[]): boolean {
  return roleNames.includes('Admin') || roleNames.includes('QualityEngineer') || roleNames.includes('QualityManager');
}

function canEditInspector(roleNames: string[]): boolean {
  return roleNames.includes('Admin') || roleNames.includes('QualityEngineer') || roleNames.includes('QualityManager');
}

router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
    let scope: string[] | null = allowedIds;
    if (supplierId) {
      if (allowedIds !== null && !allowedIds.includes(supplierId)) {
        res.json({
          totalInspectionRequests: 0,
          waitingInspection: 0,
          passed: 0,
          failed: 0,
          overdueWaiting: 0,
          lateVsSchedule: 0,
          lateDetails: [],
          otdPercent: null,
          fpyPercent: null,
          scheduleRowCount: 0,
        });
        return;
      }
      scope = [supplierId];
    }
    const metrics = await computeShipmentMetrics(scope);
    res.json(metrics);
  })
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
    const where: { supplierId?: string | { in: string[] } } = {};
    if (allowedIds !== null) {
      where.supplierId = { in: allowedIds };
      if (allowedIds.length === 0) {
        res.json([]);
        return;
      }
    }
    if (supplierId) {
      if (allowedIds !== null && !allowedIds.includes(supplierId)) {
        res.json([]);
        return;
      }
      where.supplierId = supplierId;
    }
    const list = await prisma.shipment.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        records: { select: { id: true, name: true, filePath: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Backfill missing SHIP codes for existing shipments.
    // (Older rows may have `code = null` until the migration is fully applied.)
    const missing = list.filter((s) => s.code == null);
    if (missing.length > 0) {
      for (const s of missing) {
        const code = await getNextCode('SHIP');
        await prisma.shipment.update({ where: { id: s.id }, data: { code } });
        // Reflect backfill in the response object.
        s.code = code;
      }
    }
    const withRecords = list.map((s) => ({
      ...s,
      records: (s.records ?? []).map((r) => ({ id: r.id, name: r.name, hasFile: Boolean(r.filePath) })),
    }));
    res.json(withRecords);
  })
);

router.get(
  '/inspectors',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!canEditInspector(req.user.roleNames)) {
      res.status(403).json({ error: 'Insufficient permissions to view inspectors' });
      return;
    }
    const users = await prisma.user.findMany({
      where: {
        isEmployee: true,
        employmentStatus: 'Active',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
    const list = users.map((u) => ({
      id: u.id,
      name: u.name?.trim() || u.email,
      email: u.email,
    }));
    res.json({ list });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
    const purchaseOrder = typeof req.body?.purchaseOrder === 'string' ? req.body.purchaseOrder.trim() : '';
    const partNumber = typeof req.body?.partNumber === 'string' ? req.body.partNumber.trim() : '';
    const lot = typeof req.body?.lot === 'string' ? req.body.lot.trim() : '';
    const qtyRaw = req.body?.qty;
    const qty = qtyRaw === undefined || qtyRaw === null || qtyRaw === '' ? NaN : Number(qtyRaw);
    const inspectionDateStr = typeof req.body?.inspectionDate === 'string' ? req.body.inspectionDate.trim() : '';
    if (!supplierId) {
      res.status(400).json({ error: 'supplierId is required' });
      return;
    }
    if (!purchaseOrder) {
      res.status(400).json({ error: 'purchaseOrder is required' });
      return;
    }
    if (!partNumber) {
      res.status(400).json({ error: 'partNumber is required' });
      return;
    }
    if (!lot) {
      res.status(400).json({ error: 'lot is required' });
      return;
    }
    if (!inspectionDateStr) {
      res.status(400).json({ error: 'inspectionDate is required (YYYY-MM-DD)' });
      return;
    }
    if (Number.isNaN(qty) || qty < 0 || !Number.isFinite(qty)) {
      res.status(400).json({ error: 'qty must be a non-negative number' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    if (req.user.roleNames.includes('Supplier')) {
      const own = await prisma.supplier.findFirst({ where: { userId: req.user.id }, select: { id: true } });
      if (!own || own.id !== supplierId) {
        res.status(403).json({ error: 'Suppliers can only request inspection for their own supplier' });
        return;
      }
    }
    const canCreateForOthers =
      req.user.roleNames.includes('Admin') ||
      req.user.roleNames.includes('QualityEngineer') ||
      req.user.roleNames.includes('QualityManager') ||
      req.user.roleNames.includes('Buyer');
    const isSupplier = req.user.roleNames.includes('Supplier');
    if (!canCreateForOthers && !isSupplier) {
      res.status(403).json({ error: 'Only Supplier, Admin, QE, or Buyer can create shipment requests' });
      return;
    }
    const inspectionDate = new Date(inspectionDateStr.slice(0, 10) + 'T12:00:00.000Z');
    const code = await getNextCode('SHIP');
    const createdBy = req.user.name?.trim() ? req.user.name.trim() : req.user.email;
    const shipment = await prisma.shipment.create({
      data: {
        supplierId,
        code,
        purchaseOrder,
        partNumber,
        lot,
        qty: Math.floor(qty),
        inspectionDate,
        createdBy,
      },
      include: { supplier: { select: { id: true, code: true, name: true } } },
    });
    await createAlertForRecipients({
      category: 'shipmentInspectionRequest',
      entityType: 'Shipment',
      entityId: shipment.id,
      message: `Shipment inspection request for ${shipment.supplier.code} — ${shipment.supplier.name} (${shipment.purchaseOrder || 'PO-N/A'}).`,
    });
    res.status(201).json(shipment);
  })
);

/** Admin / QE: record inspection Passed or Failed (Day 10). */
router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = req.params.id;
    const resultRaw = req.body?.result;
    const inspectorRaw = req.body?.inspector;
    const existing = await prisma.shipment.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }

    const hasResultUpdate = resultRaw === 'Passed' || resultRaw === 'Failed';
    const hasInspectorUpdate = typeof inspectorRaw === 'string' || inspectorRaw === null;

    if (!hasResultUpdate && !hasInspectorUpdate) {
      res.status(400).json({ error: 'Provide either result (Passed/Failed) or inspector' });
      return;
    }

    const shouldBePending = existing.status === 'WaitingInspection';
    const canInspector = canEditInspector(req.user.roleNames);
    const canResult = canRecordInspectionResult(req.user.roleNames);

    // Inspector-only edit: allowed only while waiting.
    if (hasInspectorUpdate && !hasResultUpdate) {
      if (!canInspector) {
        res.status(403).json({ error: 'Insufficient permissions to edit inspector' });
        return;
      }
      if (!shouldBePending) {
        res.status(400).json({ error: 'This inspection was already reviewed' });
        return;
      }

      const inspector = typeof inspectorRaw === 'string' ? inspectorRaw.trim() || null : null;
      const updated = await prisma.shipment.update({
        where: { id },
        data: { inspector },
        include: { supplier: { select: { id: true, code: true, name: true } } },
      });
      res.json(updated);
      return;
    }

    // Result update: only Admin/QE. Also requires pending status.
    if (hasResultUpdate) {
      if (!canResult) {
        res.status(403).json({ error: 'Only Admin or Quality Engineer can record inspection results' });
        return;
      }
      if (!shouldBePending) {
        res.status(400).json({ error: 'This inspection was already reviewed' });
        return;
      }

      const result = resultRaw as ShipmentResult;
      const status: ShipmentStatus = result === 'Passed' ? 'Passed' : 'Failed';
      const notesRaw = req.body?.notes;

      const data: { result: ShipmentResult; status: ShipmentStatus; notes?: string | null; inspector?: string | null } = {
        result,
        status,
      };

      if (typeof notesRaw === 'string') {
        const trimmed = notesRaw.trim();
        data.notes = trimmed || (result === 'Failed' ? 'Rejected' : null);
      } else if (result === 'Failed') {
        data.notes = 'Rejected';
      } else if (result === 'Passed') {
        data.notes = null;
      }

      // If caller can edit inspector, persist it at the same time as the decision.
      if (hasInspectorUpdate && canInspector) {
        data.inspector = typeof inspectorRaw === 'string' ? inspectorRaw.trim() || null : null;
      }

      const updated = await prisma.shipment.update({
        where: { id },
        data,
        include: { supplier: { select: { id: true, code: true, name: true } } },
      });

      if (updated.result === 'Failed') {
        await createAlertForRecipients({
          category: 'rejectedShipmentDocument',
          entityType: 'Shipment',
          entityId: updated.id,
          message: `Shipment ${updated.purchaseOrder || updated.id} was rejected for ${updated.supplier.code} — ${updated.supplier.name}.`,
        });
      }

      res.json(updated);
      return;
    }

    // If we reached here, something unexpected happened.
    res.status(400).json({ error: 'No valid updates provided' });
  })
);

export default router;
