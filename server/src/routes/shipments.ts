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

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Shipments'));

function canRecordInspectionResult(roleNames: string[]): boolean {
  return roleNames.includes('Admin') || roleNames.includes('QualityEngineer');
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
      include: { supplier: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
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
      req.user.roleNames.includes('Buyer');
    const isSupplier = req.user.roleNames.includes('Supplier');
    if (!canCreateForOthers && !isSupplier) {
      res.status(403).json({ error: 'Only Supplier, Admin, QE, or Buyer can create shipment requests' });
      return;
    }
    const inspectionDate = new Date(inspectionDateStr.slice(0, 10) + 'T12:00:00.000Z');
    const shipment = await prisma.shipment.create({
      data: {
        supplierId,
        purchaseOrder,
        partNumber,
        lot,
        qty: Math.floor(qty),
        inspectionDate,
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
    if (!canRecordInspectionResult(req.user.roleNames)) {
      res.status(403).json({ error: 'Only Admin or Quality Engineer can record inspection results' });
      return;
    }
    const id = req.params.id;
    const resultRaw = req.body?.result;
    if (resultRaw !== 'Passed' && resultRaw !== 'Failed') {
      res.status(400).json({ error: 'result must be Passed or Failed' });
      return;
    }
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
    const result = resultRaw as ShipmentResult;
    const status: ShipmentStatus = result === 'Passed' ? 'Passed' : 'Failed';
    const updated = await prisma.shipment.update({
      where: { id },
      data: { result, status },
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
  })
);

export default router;
