/**
 * Risk snapshots: list (scoped); Admin delete (Day 9.4).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';
import { computeAndStoreRiskSnapshot, computeSupplierRisk } from '../services/riskScoring';

const router = Router();

router.use(authMiddleware);

async function getCurrentRiskRows(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const allowedIds = await getAllowedSupplierIds(req.user);
  if (allowedIds !== null && allowedIds.length === 0) {
    res.json([]);
    return;
  }
  const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
  if (supplierId && allowedIds !== null && !allowedIds.includes(supplierId)) {
    res.status(404).json({ error: 'Supplier not found' });
    return;
  }
  const suppliers = await prisma.supplier.findMany({
    where: supplierId
      ? { id: supplierId }
      : allowedIds === null
        ? {}
        : { id: { in: allowedIds } },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
  // Compute sequentially to avoid DB-connection spikes when many suppliers are in scope.
  const list: Array<{
    supplier: { id: string; code: string; name: string };
    score: number;
    level: 'Low' | 'Medium' | 'High';
    factors: {
      quality: number;
      audit: number;
      delivery: number;
      carClosure: number;
      documentation: number;
    };
  }> = [];
  for (const s of suppliers) {
    const summary = await computeSupplierRisk(s.id);
    list.push({
      supplier: s,
      score: summary.score,
      level: summary.level,
      factors: summary.factors,
    });
  }
  res.json(list);
}

router.get(
  '/',
  requirePageAccess('Risk'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const where = allowedIds === null ? {} : { supplierId: { in: allowedIds } };
    if (allowedIds !== null && allowedIds.length === 0) {
      res.json([]);
      return;
    }
    const list = await prisma.riskSnapshot.findMany({
      where,
      include: { supplier: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  })
);

router.get(
  '/current',
  requirePageAccess('Risk'),
  asyncHandler(getCurrentRiskRows)
);

router.get(
  '/map-current',
  requirePageAccess('SuppliersMap'),
  asyncHandler(getCurrentRiskRows)
);

router.post(
  '/recalculate',
  requirePageAccess('Risk'),
  requireRole(['Admin', 'QualityEngineer', 'QualityManager', 'Buyer']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && allowedIds.length === 0) {
      res.json({ created: [] });
      return;
    }
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : undefined;
    if (supplierId && allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    const suppliers = await prisma.supplier.findMany({
      where: supplierId
        ? { id: supplierId }
        : allowedIds === null
          ? {}
          : { id: { in: allowedIds } },
      select: { id: true },
    });
    // Compute/store sequentially to keep Prisma DB load predictable.
    const created: Array<{
      snapshot: Awaited<ReturnType<typeof computeAndStoreRiskSnapshot>>['snapshot'];
      summary: Awaited<ReturnType<typeof computeAndStoreRiskSnapshot>>['summary'];
    }> = [];
    for (const s of suppliers) {
      const { snapshot, summary } = await computeAndStoreRiskSnapshot(s.id);
      created.push({ snapshot, summary });
    }
    res.status(201).json({ created });
  })
);

router.delete(
  '/:id',
  requirePageAccess('Risk'),
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const allowedIds = await getAllowedSupplierIds(req.user!);
    const row = await prisma.riskSnapshot.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Risk snapshot not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(row.supplierId)) {
      res.status(404).json({ error: 'Risk snapshot not found' });
      return;
    }
    await prisma.riskSnapshot.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
