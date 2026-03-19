/**
 * Shipments: inspection requests; Supplier creates (Day 9); list scoped.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Shipments'));

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
    const purchaseOrder = typeof req.body?.purchaseOrder === 'string' ? req.body.purchaseOrder.trim() || null : null;
    const partNumber = typeof req.body?.partNumber === 'string' ? req.body.partNumber.trim() || null : null;
    const qtyRaw = req.body?.qty;
    const qty = qtyRaw === undefined || qtyRaw === null || qtyRaw === '' ? null : Number(qtyRaw);
    const inspectionDateStr = typeof req.body?.inspectionDate === 'string' ? req.body.inspectionDate.trim() : '';
    if (!supplierId) {
      res.status(400).json({ error: 'supplierId is required' });
      return;
    }
    if (!inspectionDateStr) {
      res.status(400).json({ error: 'inspectionDate is required (YYYY-MM-DD)' });
      return;
    }
    if (qty !== null && (Number.isNaN(qty) || qty < 0)) {
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
        qty,
        inspectionDate,
      },
      include: { supplier: { select: { id: true, code: true, name: true } } },
    });
    res.status(201).json(shipment);
  })
);

export default router;
