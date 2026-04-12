/**
 * Project History — Internal Management (Admin only).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';

const router = Router();

async function userHasBuyerRole(userId: string): Promise<boolean> {
  const buyerRole = await prisma.role.findFirst({ where: { name: 'Buyer' } });
  if (!buyerRole) return false;
  const link = await prisma.userRole.findFirst({
    where: { userId, roleId: buyerRole.id },
    select: { userId: true },
  });
  return !!link;
}

function parseRevenueAmount(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

router.use(authMiddleware);
router.use(requirePageAccess('InternalManagement'));
router.use(requireRole(['Admin', 'QualityManager']));

router.get(
  '/buyers',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const buyerRole = await prisma.role.findFirst({ where: { name: 'Buyer' } });
    if (!buyerRole) {
      res.json([]);
      return;
    }
    const buyers = await prisma.user.findMany({
      where: { userRoles: { some: { roleId: buyerRole.id } } },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
    res.json(buyers);
  })
);

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.clientHistory.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
    });
    res.json(list);
  })
);

router.get(
  '/profit-summary',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const [projects, laborGrouped] = await Promise.all([
      prisma.clientHistory.findMany({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          projectCode: true,
          companyName: true,
          revenue: true,
          revenueAmount: true,
          status: true,
        },
      }),
      prisma.laborCost.groupBy({
        by: ['projectHistoryId'],
        _sum: { totalCost: true },
        where: { projectHistoryId: { not: null } },
      }),
    ]);
    const costByProjectId = new Map(
      laborGrouped
        .filter((r) => r.projectHistoryId)
        .map((r) => [r.projectHistoryId as string, r._sum.totalCost ?? 0])
    );
    res.json(
      projects.map((p) => {
        const costs = costByProjectId.get(p.id) ?? 0;
        const revenue = p.revenueAmount ?? 0;
        return {
          projectId: p.id,
          projectCode: p.projectCode,
          companyName: p.companyName,
          revenue: p.revenue,
          revenueAmount: revenue,
          costs,
          profit: revenue - costs,
          status: p.status,
        };
      })
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Record<string, unknown>;
    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    if (!clientName || !companyName) {
      res.status(400).json({ error: 'clientName and companyName are required' });
      return;
    }
    const statusRaw = typeof body.status === 'string' ? body.status.trim() : 'Active';
    const status = statusRaw.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    const projectCode = await getNextCode('PROJ');
    const revenueRaw = typeof body.revenue === 'string' ? body.revenue.trim() : '';
    const buyerIdRaw = typeof body.buyerId === 'string' ? body.buyerId.trim() : '';
    const buyerId = buyerIdRaw || null;
    const supplierIdRaw = typeof body.supplierId === 'string' ? body.supplierId.trim() : '';
    const supplierId = supplierIdRaw || null;
    if (buyerId && !(await userHasBuyerRole(buyerId))) {
      res.status(400).json({ error: 'buyerId must be a user with the Buyer role' });
      return;
    }
    if (supplierId) {
      const sup = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
      if (!sup) {
        res.status(400).json({ error: 'supplierId is invalid' });
        return;
      }
    }
    const row = await prisma.clientHistory.create({
      data: {
        projectCode,
        clientName,
        companyName,
        clientEmail: typeof body.clientEmail === 'string' ? body.clientEmail.trim() || null : null,
        clientMobile: typeof body.clientMobile === 'string' ? body.clientMobile.trim() || null : null,
        industry: typeof body.industry === 'string' ? body.industry.trim() || null : null,
        country: typeof body.country === 'string' ? body.country.trim() || null : null,
        projectDescription:
          typeof body.projectDescription === 'string' ? body.projectDescription.trim() || null : null,
        periodOfPerformance:
          typeof body.periodOfPerformance === 'string' ? body.periodOfPerformance.trim() || null : null,
        revenue: revenueRaw || null,
        revenueAmount: parseRevenueAmount(revenueRaw),
        status,
        buyerId,
        supplierId,
      },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
    });
    res.status(201).json(row);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.clientHistory.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const data: {
      clientName?: string;
      companyName?: string;
      clientEmail?: string | null;
      clientMobile?: string | null;
      industry?: string | null;
      country?: string | null;
      projectDescription?: string | null;
      periodOfPerformance?: string | null;
      revenue?: string | null;
      status?: string;
      revenueAmount?: number | null;
      buyerId?: string | null;
      supplierId?: string | null;
    } = {};
    if (typeof body.clientName === 'string') data.clientName = body.clientName.trim();
    if (typeof body.companyName === 'string') data.companyName = body.companyName.trim();
    if (body.clientEmail !== undefined) {
      data.clientEmail = typeof body.clientEmail === 'string' ? body.clientEmail.trim() || null : null;
    }
    if (body.clientMobile !== undefined) {
      data.clientMobile = typeof body.clientMobile === 'string' ? body.clientMobile.trim() || null : null;
    }
    if (body.industry !== undefined) {
      data.industry = typeof body.industry === 'string' ? body.industry.trim() || null : null;
    }
    if (body.country !== undefined) data.country = typeof body.country === 'string' ? body.country.trim() || null : null;
    if (body.projectDescription !== undefined) {
      data.projectDescription =
        typeof body.projectDescription === 'string' ? body.projectDescription.trim() || null : null;
    }
    if (body.periodOfPerformance !== undefined) {
      data.periodOfPerformance =
        typeof body.periodOfPerformance === 'string' ? body.periodOfPerformance.trim() || null : null;
    }
    if (body.revenue !== undefined) {
      const revenueRaw = typeof body.revenue === 'string' ? body.revenue.trim() : '';
      data.revenue = revenueRaw || null;
      data.revenueAmount = parseRevenueAmount(revenueRaw);
    }
    if (typeof body.status === 'string') {
      data.status = body.status.trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    }
    if (body.buyerId !== undefined) {
      const raw = typeof body.buyerId === 'string' ? body.buyerId.trim() : '';
      const next = raw || null;
      if (next && !(await userHasBuyerRole(next))) {
        res.status(400).json({ error: 'buyerId must be a user with the Buyer role' });
        return;
      }
      data.buyerId = next;
    }
    if (body.supplierId !== undefined) {
      const raw = typeof body.supplierId === 'string' ? body.supplierId.trim() : '';
      const next = raw || null;
      if (next) {
        const sup = await prisma.supplier.findUnique({ where: { id: next }, select: { id: true } });
        if (!sup) {
          res.status(400).json({ error: 'supplierId is invalid' });
          return;
        }
      }
      data.supplierId = next;
    }
    if (data.clientName !== undefined && !data.clientName) {
      res.status(400).json({ error: 'clientName cannot be empty' });
      return;
    }
    if (data.companyName !== undefined && !data.companyName) {
      res.status(400).json({ error: 'companyName cannot be empty' });
      return;
    }
    const row = await prisma.clientHistory.update({
      where: { id },
      data,
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
    });
    res.json(row);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.clientHistory.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await prisma.clientHistory.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
