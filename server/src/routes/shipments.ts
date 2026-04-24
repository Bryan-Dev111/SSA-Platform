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
import {
  batchResolvedProjectHistoryForShipments,
  resolveProjectHistoryIdFromShipmentFields,
} from '../lib/shipmentProjectResolve';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Shipments'));

function canRecordInspectionResult(roleNames: string[]): boolean {
  return (
    roleNames.includes('Admin') ||
    roleNames.includes('QualityEngineer') ||
    roleNames.includes('QualityManager') ||
    roleNames.includes('Inspector')
  );
}

function canEditInspector(roleNames: string[]): boolean {
  return (
    roleNames.includes('Admin') ||
    roleNames.includes('QualityEngineer') ||
    roleNames.includes('QualityManager') ||
    roleNames.includes('Inspector')
  );
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
          overdueDetails: [],
          shortDeliveries: 0,
          shortDeliveryDetails: [],
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

/** Part numbers on the shipment schedule for a supplier + PO (for supplier upload form dropdown). */
router.get(
  '/schedule-parts',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId.trim() : '';
    const purchaseOrder = typeof req.query.purchaseOrder === 'string' ? req.query.purchaseOrder.trim() : '';
    if (!supplierId || !purchaseOrder) {
      res.status(400).json({ error: 'supplierId and purchaseOrder are required' });
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
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }
    const rows = await prisma.shipmentSchedule.findMany({
      where: {
        supplierId,
        purchaseOrder: { not: null, mode: 'insensitive', equals: purchaseOrder },
      },
      select: { partNumber: true },
    });
    const unique = new Set<string>();
    for (const r of rows) {
      const p = r.partNumber?.trim();
      if (p) unique.add(p);
    }
    const list = [...unique].sort((a, b) => a.localeCompare(b));
    res.json(list);
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
        projectHistory: { select: { id: true, projectCode: true } },
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
    const resolvedMap = await batchResolvedProjectHistoryForShipments(
      list.map((s) => ({
        id: s.id,
        supplierId: s.supplierId,
        purchaseOrder: s.purchaseOrder,
        partNumber: s.partNumber,
        projectHistoryId: s.projectHistoryId,
        projectHistory: s.projectHistory,
      }))
    );

    const withRecords = list.map((s) => ({
      ...s,
      resolvedProjectHistory: resolvedMap.get(s.id) ?? null,
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
        employmentStatus: 'Active',
        OR: [{ isEmployee: true }, { isContractor: true }],
        userRoles: {
          some: {
            role: {
              name: {
                in: ['Admin', 'QualityEngineer', 'QualityManager', 'Inspector'],
              },
            },
          },
        },
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

/** Projects linked to a supplier (for optional project on new inspection request / UI). */
router.get(
  '/eligible-projects',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId.trim() : '';
    if (!supplierId) {
      res.status(400).json({ error: 'supplierId is required' });
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
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }
    const rows = await prisma.clientHistory.findMany({
      where: { supplierId },
      select: { id: true, projectCode: true, companyName: true },
      orderBy: { projectCode: 'asc' },
    });
    res.json(rows);
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

    const rawPh = typeof req.body?.projectHistoryId === 'string' ? req.body.projectHistoryId.trim() : '';
    let projectHistoryId: string | null = null;
    if (rawPh) {
      const proj = await prisma.clientHistory.findUnique({
        where: { id: rawPh },
        select: { supplierId: true },
      });
      if (!proj) {
        res.status(400).json({ error: 'projectHistoryId is invalid' });
        return;
      }
      if (proj.supplierId && proj.supplierId !== supplierId) {
        res.status(400).json({ error: 'Project must use the same supplier as this shipment' });
        return;
      }
      projectHistoryId = rawPh;
    } else {
      projectHistoryId = await resolveProjectHistoryIdFromShipmentFields({
        supplierId,
        purchaseOrder: purchaseOrder || null,
        partNumber: partNumber || null,
        explicitProjectHistoryId: null,
      });
    }

    // Validate that there is at least one scheduled row for this supplier + PO,
    // so OTD / short-delivery logic can reliably match on the same pair.
    const normalizedPo = purchaseOrder.toLowerCase();
    const matchingSchedule = await prisma.shipmentSchedule.findFirst({
      where: {
        supplierId,
        purchaseOrder: {
          not: null,
          mode: 'insensitive',
          equals: normalizedPo,
        },
      },
    });
    if (!matchingSchedule) {
      res.status(400).json({
        error: 'This purchase order does not exist on the shipment schedule for this supplier. Please check the PO number or ask your buyer to add it to the schedule.',
      });
      return;
    }
    const code = await getNextCode('SHIP');
    const createdBy = req.user.name?.trim() ? req.user.name.trim() : req.user.email;
    const shipment = await prisma.shipment.create({
      data: {
        supplierId,
        code,
        projectHistoryId,
        purchaseOrder,
        partNumber,
        lot,
        qty: Math.floor(qty),
        inspectionDate,
        createdBy,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        projectHistory: { select: { id: true, projectCode: true } },
      },
    });
    await createAlertForRecipients({
      category: 'shipmentInspectionRequest',
      entityType: 'Shipment',
      entityId: shipment.id,
      message: `Shipment inspection request for ${shipment.supplier.code}: ${shipment.supplier.name} (${shipment.purchaseOrder || 'PO-N/A'}).`,
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
        res.status(403).json({
          error: 'Only Admin, Quality Engineer, Quality Manager, or Inspector can record inspection results',
        });
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
          message: `Shipment ${updated.purchaseOrder || updated.id} was rejected for ${updated.supplier.code}: ${updated.supplier.name}.`,
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
