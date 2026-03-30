import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getAllowedSupplierIds } from '../services/scope';
import { computeSupplierRisk } from '../services/riskScoring';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Dashboard'));

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const allowedIds = await getAllowedSupplierIds(req.user);
    const selectedSupplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : '';
    if (selectedSupplierId && allowedIds !== null && !allowedIds.includes(selectedSupplierId)) {
      res.json({
        metrics: {
          totalSuppliers: 0,
          highRiskSuppliers: 0,
          mediumRiskSuppliers: 0,
          openCars: 0,
          overdueCars: 0,
          openRisks: 0,
          overdueRisks: 0,
          openFindingsMajorCritical: 0,
          shipmentRequests: 0,
          shipmentsRejected: 0,
          rejectedDocuments: 0,
        },
        charts: { topRiskSuppliers: [], upcomingEvents: [], recentUpdates: [], monthlyTrends: [] },
      });
      return;
    }

    const scopeIds = selectedSupplierId ? [selectedSupplierId] : allowedIds;
    const supplierWhere = scopeIds === null ? {} : { id: { in: scopeIds } };
    const suppliers = await prisma.supplier.findMany({
      where: supplierWhere,
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    const supplierIds = suppliers.map((s) => s.id);
    const whereInScope = scopeIds === null ? {} : { supplierId: { in: supplierIds } };

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      openCars,
      openRisks,
      overdueRiskActions,
      openFindingsMajorCritical,
      shipmentRequests,
      shipmentsRejected,
      rejectedDocuments,
      upcomingAudits,
      upcomingShipments,
    ] =
      await Promise.all([
        prisma.correctiveAction.findMany({
          where: { ...whereInScope, status: { not: 'Closed' } },
          select: { targetCompletionDate: true },
        }),
        prisma.opportunity.count({
          where: { ...whereInScope, type: 'risk', status: 'Open' },
        }),
        prisma.riskAction.findMany({
          where: {
            ...whereInScope,
            dueDate: { lt: now },
            status: { in: ['Open', 'InProgress'] },
          },
          select: {
            riskId: true,
            risk: { select: { type: true, status: true } },
          },
        }),
        prisma.finding.count({
          where: {
            ...whereInScope,
            status: { not: 'Closed' },
            severity: { in: ['Major', 'Critical'] },
          },
        }),
        prisma.shipment.count({ where: { ...whereInScope, status: 'WaitingInspection' } }),
        prisma.shipment.count({ where: { ...whereInScope, status: 'Failed' } }),
        prisma.record.count({
          where: { ...whereInScope, status: 'Rejected', internalOrSupplier: 'internal' },
        }),
        prisma.audit.findMany({
          where: { ...whereInScope, auditDate: { gte: now, lte: in30Days } },
          select: { id: true, code: true, auditDate: true, supplier: { select: { code: true, name: true } } },
          orderBy: { auditDate: 'asc' },
          take: 8,
        }),
        prisma.shipment.findMany({
          where: { ...whereInScope, status: 'WaitingInspection', inspectionDate: { gte: now, lte: in30Days } },
          select: {
            id: true,
            purchaseOrder: true,
            inspectionDate: true,
            supplier: { select: { code: true, name: true } },
          },
          orderBy: { inspectionDate: 'asc' },
          take: 8,
        }),
      ]);

    const overdueCars = openCars.filter((c) => c.targetCompletionDate && new Date(c.targetCompletionDate) < now).length;
    const overdueRisks = new Set(
      overdueRiskActions
        .filter((a) => a.risk.type === 'risk' && a.risk.status === 'Open')
        .map((a) => a.riskId)
    ).size;

    const risks: Array<{
      supplierId: string;
      code: string;
      name: string;
      score: number;
      level: 'Low' | 'Medium' | 'High';
    }> = [];
    for (const supplier of suppliers) {
      // eslint-disable-next-line no-await-in-loop
      const summary = await computeSupplierRisk(supplier.id);
      risks.push({
        supplierId: supplier.id,
        code: supplier.code,
        name: supplier.name,
        score: summary.score,
        level: summary.level,
      });
    }
    const topRiskSuppliers = [...risks].sort((a, b) => b.score - a.score).slice(0, 5);
    const highRiskSuppliers = risks.filter((r) => r.level === 'High').length;
    const mediumRiskSuppliers = risks.filter((r) => r.level === 'Medium').length;

    const monthlyTrends: Array<{ month: string; findings: number; cars: number; audits: number; shipments: number }> = [];
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    for (let i = 5; i >= 0; i -= 1) {
      const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      // eslint-disable-next-line no-await-in-loop
      const [findings, cars, audits, shipments] = await Promise.all([
        prisma.finding.count({ where: { ...whereInScope, createdAt: { gte: start, lt: end } } }),
        prisma.correctiveAction.count({ where: { ...whereInScope, createdAt: { gte: start, lt: end } } }),
        prisma.audit.count({ where: { ...whereInScope, createdAt: { gte: start, lt: end } } }),
        prisma.shipment.count({ where: { ...whereInScope, createdAt: { gte: start, lt: end } } }),
      ]);
      monthlyTrends.push({
        month: start.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
        findings,
        cars,
        audits,
        shipments,
      });
    }

    const [recentShipments, recentFindings, recentCars, recentAudits] = await Promise.all([
      prisma.shipment.findMany({
        where: { ...whereInScope, createdAt: { gte: sevenDaysAgo }, status: 'WaitingInspection' },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          purchaseOrder: true,
          createdAt: true,
          supplier: { select: { code: true, name: true } },
        },
      }),
      prisma.finding.findMany({
        where: { ...whereInScope, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          code: true,
          createdAt: true,
          supplier: { select: { code: true, name: true } },
        },
      }),
      prisma.correctiveAction.findMany({
        where: { ...whereInScope, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          code: true,
          createdAt: true,
          supplier: { select: { code: true, name: true } },
        },
      }),
      prisma.audit.findMany({
        where: { ...whereInScope, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          code: true,
          createdAt: true,
          supplier: { select: { code: true, name: true } },
        },
      }),
    ]);

    const recentUpdates = [
      ...recentShipments.map((s) => ({
        id: `shipment-${s.id}`,
        type: 'Shipment Request' as const,
        code: s.purchaseOrder || 'PO-N/A',
        date: s.createdAt.toISOString(),
        supplierCode: s.supplier.code,
        supplierName: s.supplier.name,
      })),
      ...recentFindings.map((f) => ({
        id: `finding-${f.id}`,
        type: 'Finding' as const,
        code: f.code,
        date: f.createdAt.toISOString(),
        supplierCode: f.supplier.code,
        supplierName: f.supplier.name,
      })),
      ...recentCars.map((c) => ({
        id: `car-${c.id}`,
        type: 'CAR' as const,
        code: c.code,
        date: c.createdAt.toISOString(),
        supplierCode: c.supplier.code,
        supplierName: c.supplier.name,
      })),
      ...recentAudits.map((a) => ({
        id: `audit-${a.id}`,
        type: 'Audit' as const,
        code: a.code,
        date: a.createdAt.toISOString(),
        supplierCode: a.supplier.code,
        supplierName: a.supplier.name,
      })),
    ]
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 40);

    const upcomingEvents = [
      ...upcomingAudits.map((a) => ({
        id: a.id,
        type: 'Audit' as const,
        code: a.code,
        date: a.auditDate,
        supplierCode: a.supplier.code,
        supplierName: a.supplier.name,
      })),
      ...upcomingShipments.map((s) => ({
        id: s.id,
        type: 'Shipment' as const,
        code: s.purchaseOrder || 'PO-N/A',
        date: s.inspectionDate,
        supplierCode: s.supplier.code,
        supplierName: s.supplier.name,
      })),
    ]
      .sort((a, b) => +new Date(a.date || 0) - +new Date(b.date || 0))
      .slice(0, 10);

    res.json({
      metrics: {
        totalSuppliers: suppliers.length,
        highRiskSuppliers,
        mediumRiskSuppliers,
        openCars: openCars.length,
        overdueCars,
        openRisks,
        overdueRisks,
        openFindingsMajorCritical,
        shipmentRequests,
        shipmentsRejected,
        rejectedDocuments,
      },
      charts: {
        topRiskSuppliers,
        upcomingEvents,
        recentUpdates,
        monthlyTrends,
      },
    });
  })
);

export default router;
