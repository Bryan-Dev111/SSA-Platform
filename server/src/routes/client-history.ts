/**
 * Project History — Internal Management (Admin only).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getAllowedSupplierIds } from '../services/scope';
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

/** YYYY-MM-DD calendar input → UTC noon (stable JSON round-trip). */
function parsePopDateInput(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Active when today (UTC calendar) is within [popStart, popEnd] inclusive; requires both dates. */
function computeClientHistoryStatus(popStart: Date | null, popEnd: Date | null): 'Active' | 'Inactive' {
  if (!popStart || !popEnd) return 'Inactive';
  const s = startOfUtcDay(popStart);
  const e = startOfUtcDay(popEnd);
  const t = startOfUtcDay(new Date());
  if (s > e) return 'Inactive';
  if (t >= s && t <= e) return 'Active';
  return 'Inactive';
}

/**
 * Parse POP from body: both empty → null,null; both required if either provided.
 */
function parsePopPair(body: Record<string, unknown>): { ok: true; popStart: Date | null; popEnd: Date | null } | { ok: false; error: string } {
  const startRaw = body.popStart;
  const endRaw = body.popEnd;
  const startEmpty =
    startRaw === undefined ||
    startRaw === null ||
    (typeof startRaw === 'string' && startRaw.trim() === '');
  const endEmpty =
    endRaw === undefined || endRaw === null || (typeof endRaw === 'string' && endRaw.trim() === '');
  if (startEmpty && endEmpty) {
    return { ok: true, popStart: null, popEnd: null };
  }
  if (startEmpty || endEmpty) {
    return { ok: false, error: 'Period of performance requires both start and end dates, or leave both empty' };
  }
  const popStart = parsePopDateInput(startRaw);
  const popEnd = parsePopDateInput(endRaw);
  if (!popStart || !popEnd) {
    return { ok: false, error: 'Invalid period of performance dates (use YYYY-MM-DD)' };
  }
  if (popStart > popEnd) {
    return { ok: false, error: 'Period of performance end date must be on or after start date' };
  }
  return { ok: true, popStart, popEnd };
}

/** Combine PATCH body with existing row, then validate with parsePopPair. */
function mergePatchPop(
  body: Record<string, unknown>,
  existing: { popStart: Date | null; popEnd: Date | null }
): { ok: true; popStart: Date | null; popEnd: Date | null } | { ok: false; error: string } {
  if (body.popStart === undefined && body.popEnd === undefined) {
    return { ok: true, popStart: existing.popStart, popEnd: existing.popEnd };
  }
  const startStr =
    body.popStart !== undefined
      ? typeof body.popStart === 'string'
        ? body.popStart.trim()
        : ''
      : existing.popStart
        ? existing.popStart.toISOString().slice(0, 10)
        : '';
  const endStr =
    body.popEnd !== undefined
      ? typeof body.popEnd === 'string'
        ? body.popEnd.trim()
        : ''
      : existing.popEnd
        ? existing.popEnd.toISOString().slice(0, 10)
        : '';
  return parsePopPair({ popStart: startStr, popEnd: endStr });
}

function mapClientHistoryRow<
  T extends {
    popStart: Date | null;
    popEnd: Date | null;
    status: string;
    buyer?: unknown;
    supplier?: unknown;
    [key: string]: unknown;
  },
>(row: T): T {
  const status = computeClientHistoryStatus(row.popStart, row.popEnd);
  return { ...row, status };
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

/** Active employees and contractors (for Internal Management — Contracts). */
router.get(
  '/employees-contractors',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const users = await prisma.user.findMany({
      where: {
        OR: [{ isEmployee: true }, { isContractor: true }],
        employmentStatus: 'Active',
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
    res.json(users);
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
    res.json(list.map((row) => mapClientHistoryRow(row)));
  })
);

router.get(
  '/profit-summary',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const [projects, laborCosts, expenses] = await Promise.all([
      prisma.clientHistory.findMany({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          projectCode: true,
          companyName: true,
          revenue: true,
          revenueAmount: true,
          status: true,
          popStart: true,
          popEnd: true,
        },
      }),
      prisma.laborCost.findMany({
        where: { projectHistoryId: { not: null }, paidStatus: 'Paid' },
        select: { code: true, totalCost: true, projectHistoryId: true },
      }),
      prisma.expense.findMany({
        select: { code: true, amount: true, project: true },
      }),
    ]);

    const laborByProjectId = new Map<string, Array<{ code: string; amount: number }>>();
    for (const row of laborCosts) {
      if (!row.projectHistoryId) continue;
      if (!laborByProjectId.has(row.projectHistoryId)) laborByProjectId.set(row.projectHistoryId, []);
      laborByProjectId.get(row.projectHistoryId)!.push({
        code: row.code,
        amount: Number.isFinite(row.totalCost) ? row.totalCost : 0,
      });
    }

    const normalize = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
    const rows = projects.map((p) => {
      const laborItems = laborByProjectId.get(p.id) ?? [];
      const expenseItems = expenses
        .filter((e) => {
          const expenseProject = normalize(e.project);
          if (!expenseProject) return false;
          return expenseProject === normalize(p.projectCode) || expenseProject === normalize(p.companyName);
        })
        .map((e) => ({ code: e.code, amount: Number.isFinite(e.amount) ? e.amount : 0 }));
      const allDeductions = [
        ...laborItems.map((d) => ({ ...d, kind: 'Labor Cost' as const })),
        ...expenseItems.map((d) => ({ ...d, kind: 'Expense' as const })),
      ];
      const costs = allDeductions.reduce((sum, d) => sum + d.amount, 0);
      const revenue = p.revenueAmount ?? 0;
      return {
        projectId: p.id,
        projectCode: p.projectCode,
        companyName: p.companyName,
        revenue: p.revenue,
        revenueAmount: revenue,
        costs,
        profit: revenue - costs,
        status: computeClientHistoryStatus(p.popStart, p.popEnd),
        deductions: allDeductions,
      };
    });
    res.json(rows);
  })
);

/** Active project management table: Project, Buyer, Supplier, assigned QE, assigned QM. */
router.get(
  '/management-assignments',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.clientHistory.findMany({
      orderBy: [{ projectCode: 'asc' }],
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
    });
    const active = list.filter((p) => computeClientHistoryStatus(p.popStart, p.popEnd) === 'Active');
    const buyerIds = [...new Set(active.map((p) => p.buyerId).filter((id): id is string => Boolean(id)))];
    const qeBuyerLinks =
      buyerIds.length === 0
        ? []
        : await prisma.qeBuyer.findMany({
            where: { buyerId: { in: buyerIds } },
            select: { buyerId: true, qualityEngineerId: true },
          });
    const qeIds = [...new Set(qeBuyerLinks.map((r) => r.qualityEngineerId))];
    const qmQeLinks =
      qeIds.length === 0
        ? []
        : await prisma.qualityManagerQe.findMany({
            where: { qualityEngineerId: { in: qeIds } },
            select: { qualityEngineerId: true, qualityManagerId: true },
          });
    const userIds = [...new Set([...qeIds, ...qmQeLinks.map((r) => r.qualityManagerId)])];
    const usersById = new Map<string, { name: string | null; email: string }>();
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });
      for (const u of users) usersById.set(u.id, { name: u.name, email: u.email });
    }
    const displayUser = (userId: string): string => {
      const u = usersById.get(userId);
      if (!u) return userId;
      return u.name?.trim() || u.email;
    };
    const qeIdsByBuyerId = new Map<string, string[]>();
    for (const row of qeBuyerLinks) {
      const arr = qeIdsByBuyerId.get(row.buyerId) ?? [];
      arr.push(row.qualityEngineerId);
      qeIdsByBuyerId.set(row.buyerId, arr);
    }
    const qmIdsByQeId = new Map<string, string[]>();
    for (const row of qmQeLinks) {
      const arr = qmIdsByQeId.get(row.qualityEngineerId) ?? [];
      arr.push(row.qualityManagerId);
      qmIdsByQeId.set(row.qualityEngineerId, arr);
    }
    const rows = active.map((p) => {
      const qeIdsForProject = p.buyerId ? qeIdsByBuyerId.get(p.buyerId) ?? [] : [];
      const qeNames = [...new Set(qeIdsForProject.map(displayUser))].sort((a, b) => a.localeCompare(b));
      const qmIdsForProject = qeIdsForProject.flatMap((id) => qmIdsByQeId.get(id) ?? []);
      const qmNames = [...new Set(qmIdsForProject.map(displayUser))].sort((a, b) => a.localeCompare(b));
      return {
        id: p.id,
        projectCode: p.projectCode,
        buyerName: p.buyer ? p.buyer.name?.trim() || p.buyer.email : '—',
        supplierName: p.supplier ? `${p.supplier.code}: ${p.supplier.name}` : '—',
        qualityEngineers: qeNames,
        qualityManagers: qmNames,
      };
    });
    res.json(rows);
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

    const popParsed = parsePopPair(body);
    if (!popParsed.ok) {
      res.status(400).json({ error: popParsed.error });
      return;
    }
    const { popStart, popEnd } = popParsed;
    const status = computeClientHistoryStatus(popStart, popEnd);

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
    const matchPo =
      typeof body.shipmentMatchPurchaseOrder === 'string' ? body.shipmentMatchPurchaseOrder.trim() || null : null;
    const matchPart =
      typeof body.shipmentMatchPartNumber === 'string' ? body.shipmentMatchPartNumber.trim() || null : null;

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
        popStart,
        popEnd,
        revenue: revenueRaw || null,
        revenueAmount: parseRevenueAmount(revenueRaw),
        status,
        buyerId,
        supplierId,
        shipmentMatchPurchaseOrder: matchPo,
        shipmentMatchPartNumber: matchPart,
      },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
    });
    res.status(201).json(mapClientHistoryRow(row));
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = req.params.id;
    const existing = await prisma.clientHistory.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && existing.supplierId && !allowedIds.includes(existing.supplierId)) {
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
      popStart?: Date | null;
      popEnd?: Date | null;
      revenue?: string | null;
      status?: string;
      revenueAmount?: number | null;
      buyerId?: string | null;
      supplierId?: string | null;
      shipmentMatchPurchaseOrder?: string | null;
      shipmentMatchPartNumber?: string | null;
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
    if (body.popStart !== undefined || body.popEnd !== undefined) {
      const popMerged = mergePatchPop(body, existing);
      if (!popMerged.ok) {
        res.status(400).json({ error: popMerged.error });
        return;
      }
      data.popStart = popMerged.popStart;
      data.popEnd = popMerged.popEnd;
    }

    if (body.revenue !== undefined) {
      const revenueRaw = typeof body.revenue === 'string' ? body.revenue.trim() : '';
      data.revenue = revenueRaw || null;
      data.revenueAmount = parseRevenueAmount(revenueRaw);
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
    if (body.shipmentMatchPurchaseOrder !== undefined) {
      data.shipmentMatchPurchaseOrder =
        typeof body.shipmentMatchPurchaseOrder === 'string'
          ? body.shipmentMatchPurchaseOrder.trim() || null
          : null;
    }
    if (body.shipmentMatchPartNumber !== undefined) {
      data.shipmentMatchPartNumber =
        typeof body.shipmentMatchPartNumber === 'string' ? body.shipmentMatchPartNumber.trim() || null : null;
    }
    if (data.clientName !== undefined && !data.clientName) {
      res.status(400).json({ error: 'clientName cannot be empty' });
      return;
    }
    if (data.companyName !== undefined && !data.companyName) {
      res.status(400).json({ error: 'companyName cannot be empty' });
      return;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'Provide at least one field to update' });
      return;
    }

    const nextPopStart = data.popStart !== undefined ? data.popStart : existing.popStart;
    const nextPopEnd = data.popEnd !== undefined ? data.popEnd : existing.popEnd;
    data.status = computeClientHistoryStatus(nextPopStart, nextPopEnd);

    const row = await prisma.clientHistory.update({
      where: { id },
      data,
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
    });
    res.json(mapClientHistoryRow(row));
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
