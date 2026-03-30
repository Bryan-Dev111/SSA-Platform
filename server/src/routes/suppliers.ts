/**
 * Suppliers API: list, get, create (Admin), partial update (Admin), delete (Admin).
 * Scope: Admin all; Buyer assigned; Supplier own.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { getNextCode } from '../services/idGenerator';
import { buildSupplierMonthlyTrends } from '../services/supplierMonthlyTrends';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const where = allowedIds === null ? {} : { id: { in: allowedIds } };
    const suppliers = await prisma.supplier.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        status: true,
        notes: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
        userId: true,
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { code: 'asc' },
    });
    res.json(suppliers);
  })
);

/** POST /suppliers — Admin: create supplier (auto SUP- code) */
router.post(
  '/',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const city = typeof req.body?.city === 'string' ? req.body.city.trim() || null : null;
    const country = typeof req.body?.country === 'string' ? req.body.country.trim() || null : null;
    const statusRaw = typeof req.body?.status === 'string' ? req.body.status.trim() : 'Active';
    const status = statusRaw === 'Inactive' ? 'Inactive' : 'Active';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() || null : null;
    const commodityTypeIdRaw = req.body?.commodityTypeId;
    // Omitting the field must mean "no commodity" — do not use String(undefined) → "undefined"
    const commodityTypeId =
      commodityTypeIdRaw === null ||
      commodityTypeIdRaw === undefined ||
      commodityTypeIdRaw === ''
        ? null
        : String(commodityTypeIdRaw);
    if (commodityTypeId !== null) {
      const ct = await prisma.commodityType.findUnique({ where: { id: commodityTypeId } });
      if (!ct) {
        res.status(400).json({ error: 'Invalid commodity type id' });
        return;
      }
    }
    const code = await getNextCode('SUP');
    const created = await prisma.supplier.create({
      // Keep create compatible with databases where Supplier.status is TEXT (no SupplierStatus enum type).
      data: { code, name, city, country, notes, commodityTypeId },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        status: true,
        notes: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
        userId: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (status === 'Inactive') {
      await prisma.$executeRaw`UPDATE "Supplier" SET "status" = 'Inactive' WHERE "id" = ${created.id}`;
      const refreshed = await prisma.supplier.findUnique({
        where: { id: created.id },
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          country: true,
          status: true,
          notes: true,
          commodityTypeId: true,
          commodityType: { select: { id: true, name: true } },
          userId: true,
          user: { select: { id: true, email: true, name: true } },
        },
      });
      res.status(201).json(refreshed ?? created);
      return;
    }
    res.status(201).json(created);
  })
);

/** PATCH /suppliers/:id — Admin: optional name, city, country, commodityTypeId */
router.patch(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const data: {
      name?: string;
      city?: string | null;
      country?: string | null;
      notes?: string | null;
      commodityTypeId?: string | null;
      userId?: string | null;
    } = {};
    let statusToApply: 'Active' | 'Inactive' | null = null;
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        res.status(400).json({ error: 'name cannot be empty' });
        return;
      }
      data.name = name;
    }
    if (body.city !== undefined) {
      data.city = typeof body.city === 'string' ? body.city.trim() || null : null;
    }
    if (body.country !== undefined) {
      data.country = typeof body.country === 'string' ? body.country.trim() || null : null;
    }
    if (body.status !== undefined) {
      const status = typeof body.status === 'string' ? body.status.trim() : '';
      if (status !== 'Active' && status !== 'Inactive') {
        res.status(400).json({ error: 'status must be Active or Inactive' });
        return;
      }
      statusToApply = status as 'Active' | 'Inactive';
    }
    if (body.notes !== undefined) {
      data.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    }
    if (body.commodityTypeId !== undefined) {
      const raw = body.commodityTypeId;
      const commodityTypeId =
        raw === null || raw === undefined || raw === '' ? null : String(raw);
      if (commodityTypeId !== null) {
        const ct = await prisma.commodityType.findUnique({ where: { id: commodityTypeId } });
        if (!ct) {
          res.status(400).json({ error: 'Invalid commodity type id' });
          return;
        }
      }
      data.commodityTypeId = commodityTypeId;
    }
    if (Object.keys(data).length === 0 && statusToApply === null) {
      res.status(400).json({ error: 'Provide at least one of: name, city, country, status, notes, commodityTypeId, userId' });
      return;
    }
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    await prisma.supplier.update({
      where: { id: req.params.id },
      data,
    });
    if (statusToApply) {
      await prisma.$executeRaw`UPDATE "Supplier" SET "status" = ${statusToApply} WHERE "id" = ${req.params.id}`;
    }
    const updated = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        status: true,
        notes: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
        userId: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (!updated) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    res.json(updated);
  })
);

/** POST /suppliers/:id/link-user — Admin: link a Supplier-role user to supplier */
router.post(
  '/:id/link-user',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const supplierId = req.params.id;
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const [supplier, user, roleRows] = await Promise.all([
      prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }),
      prisma.userRole.findMany({ where: { userId }, include: { role: true } }),
    ]);

    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!roleRows.some((ur) => ur.role.name === 'Supplier')) {
      res.status(400).json({ error: 'User must have Supplier role' });
      return;
    }

    // Relink in one flow: no manual unlink step required by admin users.
    await prisma.$transaction(async (tx) => {
      await tx.supplier.updateMany({
        where: { OR: [{ userId }, { id: supplierId }] },
        data: { userId: null },
      });
      await tx.supplier.update({ where: { id: supplierId }, data: { userId } });
    });

    const updated = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        status: true,
        notes: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
        userId: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    res.json(updated);
  })
);

/** DELETE /suppliers/:id/link-user — Admin: unlink supplier from its user */
router.delete(
  '/:id/link-user',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const supplierId = req.params.id;
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: { userId: null },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        status: true,
        notes: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
        userId: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    res.json(updated);
  })
);

/** DELETE /suppliers/:idOrCode — Admin only */
router.delete(
  '/:idOrCode',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const idOrCode = req.params.idOrCode;
    const existing = await prisma.supplier.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    });
    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    await prisma.supplier.update({
      where: { id: existing.id },
      data: { userId: null },
    });
    await prisma.supplier.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);

/** GET /suppliers/:id/profile — supplier profile dashboard data by supplier id (scoped by role) */
router.get(
  '/:id/profile',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const supplierId = req.params.id;
    if (allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        commodityType: { select: { id: true, name: true } },
      },
    });
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    const now = new Date();
    const [
      buyerLinks,
      audits,
      findings,
      cars,
      riskSnapshots,
      records,
      shipments,
      monthlyTrends,
      auditTotal,
      findingTotal,
      recordTotal,
      shipmentTotal,
      openCarTotal,
      overdueCarCount,
      waitingInspectionCount,
      openFindingCount,
    ] = await Promise.all([
      prisma.buyerSupplier.findMany({
        where: { supplierId },
        include: { buyer: { select: { id: true, email: true, name: true } } },
      }),
      prisma.audit.findMany({
        where: { supplierId },
        include: { auditType: { select: { id: true, code: true, name: true } } },
        orderBy: { auditDate: 'desc' },
        take: 100,
      }),
      prisma.finding.findMany({
        where: { supplierId, status: { notIn: ['New', 'DRAFT'] } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          code: true,
          status: true,
          severity: true,
          summary: true,
          updatedAt: true,
        },
      }),
      prisma.correctiveAction.findMany({
        where: { supplierId, status: { not: 'DRAFT' } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          code: true,
          status: true,
          severity: true,
          summary: true,
          updatedAt: true,
        },
      }),
      prisma.riskSnapshot.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.record.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { uploadedBy: { select: { id: true, email: true, name: true } } },
      }),
      prisma.shipment.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          code: true,
          purchaseOrder: true,
          partNumber: true,
          lot: true,
          qty: true,
          inspectionDate: true,
          status: true,
          notes: true,
          createdAt: true,
          createdBy: true,
        },
      }),
      buildSupplierMonthlyTrends(supplierId, now),
      prisma.audit.count({ where: { supplierId } }),
      prisma.finding.count({ where: { supplierId, status: { notIn: ['New', 'DRAFT'] } } }),
      prisma.record.count({ where: { supplierId } }),
      prisma.shipment.count({ where: { supplierId } }),
      prisma.correctiveAction.count({ where: { supplierId, status: { notIn: ['DRAFT', 'Closed'] } } }),
      prisma.correctiveAction.count({
        where: {
          supplierId,
          status: { notIn: ['DRAFT', 'Closed'] },
          targetCompletionDate: { lt: now },
        },
      }),
      prisma.shipment.count({ where: { supplierId, status: 'WaitingInspection' } }),
      prisma.finding.count({
        where: { supplierId, status: { notIn: ['DRAFT', 'Closed'] } },
      }),
    ]);

    // Backfill missing SHIP codes for existing shipments.
    const missingShipCodes = shipments.filter((s) => s.code == null);
    if (missingShipCodes.length > 0) {
      for (const s of missingShipCodes) {
        const code = await getNextCode('SHIP');
        await prisma.shipment.update({ where: { id: s.id }, data: { code } });
        s.code = code;
      }
    }
    res.json({
      supplier: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        city: supplier.city,
        country: supplier.country,
        commodityType: supplier.commodityType,
      },
      assignedBuyers: buyerLinks.map((b) => b.buyer),
      audits,
      findings,
      cars,
      riskSnapshots,
      records,
      shipments,
      metrics: {
        assignedBuyerCount: buyerLinks.length,
        openCarCount: openCarTotal,
        overdueCarCount,
        auditCount: auditTotal,
        findingCount: findingTotal,
        openFindingCount,
        recordCount: recordTotal,
        shipmentCount: shipmentTotal,
        waitingInspectionCount,
      },
      charts: {
        monthlyTrends,
      },
    });
  })
);

router.get(
  '/:idOrCode',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const idOrCode = req.params.idOrCode;
    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        status: true,
        notes: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(supplier.id)) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    res.json(supplier);
  })
);

export default router;
