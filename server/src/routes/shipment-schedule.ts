/**
 * Day 10: Shipment schedule (Admin-loaded) for OTD vs inspection requests.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('InternalManagement'));

const adminOnly = requireRole(['Admin', 'QualityManager']);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
    const where: { supplierId?: string | { in: string[] } | null } = {};
    if (allowedIds !== null) {
      if (allowedIds.length === 0) {
        res.json([]);
        return;
      }
      where.supplierId = { in: allowedIds };
    }
    if (supplierId) {
      if (allowedIds !== null && !allowedIds.includes(supplierId)) {
        res.json([]);
        return;
      }
      where.supplierId = supplierId;
    }
    const list = await prisma.shipmentSchedule.findMany({
      where,
      include: { supplier: { select: { id: true, code: true, name: true } } },
      orderBy: { scheduledDate: 'asc' },
    });
    res.json(list);
  })
);

router.post(
  '/',
  adminOnly,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) return;
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : null;
    const purchaseOrder =
      typeof req.body?.purchaseOrder === 'string' ? req.body.purchaseOrder.trim() || null : null;
    const partNumber =
      typeof req.body?.partNumber === 'string' ? req.body.partNumber.trim() || null : null;
    const qtyRaw = req.body?.qty;
    const qty = qtyRaw === undefined || qtyRaw === null || qtyRaw === '' ? null : Number(qtyRaw);
    const scheduledDateStr =
      typeof req.body?.scheduledDate === 'string' ? req.body.scheduledDate.trim() : '';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() || null : null;
    if (!supplierId) {
      res.status(400).json({ error: 'supplierId is required' });
      return;
    }
    if (!scheduledDateStr) {
      res.status(400).json({ error: 'scheduledDate is required (YYYY-MM-DD)' });
      return;
    }
    if (qty !== null && (Number.isNaN(qty) || qty < 0)) {
      res.status(400).json({ error: 'qty must be a non-negative number' });
      return;
    }
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      res.status(400).json({ error: 'Invalid supplierId' });
      return;
    }
    const scheduledDate = new Date(scheduledDateStr.slice(0, 10) + 'T12:00:00.000Z');
    const row = await prisma.shipmentSchedule.create({
      data: {
        supplierId,
        purchaseOrder,
        partNumber,
        qty,
        scheduledDate,
        notes,
      },
      include: { supplier: { select: { id: true, code: true, name: true } } },
    });
    res.status(201).json(row);
  })
);

router.patch(
  '/:id',
  adminOnly,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.shipmentSchedule.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const data: {
      supplierId?: string;
      purchaseOrder?: string | null;
      partNumber?: string | null;
      qty?: number | null;
      scheduledDate?: Date;
      notes?: string | null;
    } = {};
    if (typeof req.body?.supplierId === 'string') {
      const sid = req.body.supplierId;
      const sup = await prisma.supplier.findUnique({ where: { id: sid } });
      if (!sup) {
        res.status(400).json({ error: 'Invalid supplierId' });
        return;
      }
      data.supplierId = sid;
    }
    if (typeof req.body?.purchaseOrder === 'string') data.purchaseOrder = req.body.purchaseOrder.trim() || null;
    if (typeof req.body?.partNumber === 'string') data.partNumber = req.body.partNumber.trim() || null;
    if (req.body?.qty !== undefined) {
      const q = req.body.qty === null || req.body.qty === '' ? null : Number(req.body.qty);
      if (q !== null && (Number.isNaN(q) || q < 0)) {
        res.status(400).json({ error: 'Invalid qty' });
        return;
      }
      data.qty = q;
    }
    if (typeof req.body?.scheduledDate === 'string' && req.body.scheduledDate.trim()) {
      data.scheduledDate = new Date(req.body.scheduledDate.trim().slice(0, 10) + 'T12:00:00.000Z');
    }
    if (typeof req.body?.notes === 'string') data.notes = req.body.notes.trim() || null;
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const updated = await prisma.shipmentSchedule.update({
      where: { id },
      data,
      include: { supplier: { select: { id: true, code: true, name: true } } },
    });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    try {
      await prisma.shipmentSchedule.delete({ where: { id } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  })
);

export default router;
