/**
 * Risk weight config (single row): percentages for risk categories; sum should be 100.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);

async function getOrCreateConfig() {
  let row = await prisma.riskWeightConfig.findFirst();
  if (!row) {
    row = await prisma.riskWeightConfig.create({
      data: {},
    });
  }
  return row;
}

router.get(
  '/',
  requireRole(['Admin', 'QualityEngineer', 'QualityManager', 'Buyer']),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const row = await getOrCreateConfig();
    res.json(row);
  })
);

router.put(
  '/',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const b = req.body as Record<string, unknown>;
    const q = typeof b.qualityPercent === 'number' ? b.qualityPercent : Number(b.qualityPercent);
    const a = typeof b.auditPercent === 'number' ? b.auditPercent : Number(b.auditPercent);
    const d = typeof b.deliveryPercent === 'number' ? b.deliveryPercent : Number(b.deliveryPercent);
    const c = typeof b.carClosurePercent === 'number' ? b.carClosurePercent : Number(b.carClosurePercent);
    const doc = typeof b.documentationPercent === 'number' ? b.documentationPercent : Number(b.documentationPercent);
    const nums = [q, a, d, c, doc];
    if (nums.some((x) => Number.isNaN(x) || x < 0 || x > 100)) {
      res.status(400).json({ error: 'Each weight must be a number between 0 and 100' });
      return;
    }
    const sum = q + a + d + c + doc;
    if (Math.abs(sum - 100) > 0.01) {
      res.status(400).json({ error: `Weights must sum to 100% (currently ${sum.toFixed(2)})` });
      return;
    }
    const existing = await getOrCreateConfig();
    const updated = await prisma.riskWeightConfig.update({
      where: { id: existing.id },
      data: {
        qualityPercent: q,
        auditPercent: a,
        deliveryPercent: d,
        carClosurePercent: c,
        documentationPercent: doc,
      },
    });
    res.json(updated);
  })
);

export default router;
