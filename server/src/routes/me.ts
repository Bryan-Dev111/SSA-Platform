/**
 * Current user / profile — GET /me (auth required)
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { getPathRolesMatrix } from '../lib/permissions';

const router = Router();

router.use(authMiddleware);

/** Supplier portal dashboard: metrics + tables for own supplier only */
router.get(
  '/supplier-portal',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!req.user.roleNames.includes('Supplier')) {
      res.status(403).json({ error: 'Supplier role required' });
      return;
    }
    const supplier = await prisma.supplier.findFirst({
      where: { userId: req.user.id },
      include: {
        commodityType: { select: { id: true, name: true } },
      },
    });
    if (!supplier) {
      res.status(404).json({ error: 'No supplier linked to this account' });
      return;
    }
    const sid = supplier.id;
    const [buyerLinks, audits, findings, cars, riskSnapshots, records, shipments] = await Promise.all([
      prisma.buyerSupplier.findMany({
        where: { supplierId: sid },
        include: { buyer: { select: { id: true, email: true, name: true } } },
      }),
      prisma.audit.findMany({
        where: { supplierId: sid },
        include: { auditType: { select: { id: true, code: true, name: true } } },
        orderBy: { auditDate: 'desc' },
        take: 100,
      }),
      prisma.finding.findMany({
        where: { supplierId: sid, status: { not: 'DRAFT' } },
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
        where: { supplierId: sid, status: { not: 'DRAFT' } },
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
        where: { supplierId: sid },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.record.findMany({
        where: { supplierId: sid },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { uploadedBy: { select: { id: true, email: true, name: true } } },
      }),
      prisma.shipment.findMany({
        where: { supplierId: sid },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    const openCars = cars.filter((c) => c.status !== 'Closed').length;
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
        openCarCount: openCars,
        auditCount: audits.length,
        findingCount: findings.length,
        recordCount: records.length,
        shipmentCount: shipments.length,
      },
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      userRoles: { include: { role: true } },
      supplier: { select: { id: true, code: true, name: true } },
      buyerSuppliers: { select: { supplierId: true } },
      qeSuppliers: { select: { supplierId: true } },
    },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    pathRoles: await getPathRolesMatrix(),
    id: user.id,
    email: user.email,
    name: user.name,
    roleNames: user.userRoles.map((ur) => ur.role.name),
    supplier: user.supplier ?? undefined,
    assignedSupplierIds: user.buyerSuppliers.map((b) => b.supplierId),
    qeAssignedSupplierIds: user.qeSuppliers.map((q) => q.supplierId),
  });
  })
);

export default router;
