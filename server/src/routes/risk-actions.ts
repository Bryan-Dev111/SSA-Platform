import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { getNextCode } from '../services/idGenerator';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Risk'));

type RiskActionStatus = 'Open' | 'InProgress' | 'Mitigated';
type RiskLikelihood = 'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely';
type RiskSeverity = 'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe';

function deriveRiskLevel(likelihood: RiskLikelihood, severity: RiskSeverity): 'Low' | 'Medium' | 'High' {
  const l = ['VeryUnlikely', 'Unlikely', 'Possible', 'Likely', 'VeryLikely'].indexOf(likelihood);
  const s = ['Negligible', 'Minor', 'Moderate', 'Significant', 'Severe'].indexOf(severity);
  const matrix: Array<Array<'Low' | 'Medium' | 'High'>> = [
    ['Low', 'Low', 'Medium', 'Medium', 'Medium'],
    ['Low', 'Medium', 'Medium', 'Medium', 'High'],
    ['Low', 'Medium', 'Medium', 'High', 'High'],
    ['Medium', 'Medium', 'High', 'High', 'High'],
    ['Medium', 'High', 'High', 'High', 'High'],
  ];
  return matrix[l]?.[s] ?? 'Medium';
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
      res.json([]);
      return;
    }
    const rows = await prisma.riskAction.findMany({
      where: {
        ...(allowedIds === null ? {} : { supplierId: { in: allowedIds } }),
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        risk: { select: { id: true, code: true, description: true, riskLevel: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  })
);

router.post(
  '/',
  requireRole(['Admin', 'QualityEngineer', 'Buyer']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
    const riskId = typeof req.body?.riskId === 'string' ? req.body.riskId : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const owner = typeof req.body?.owner === 'string' ? req.body.owner.trim() || null : null;
    const dueDate = typeof req.body?.dueDate === 'string' && req.body.dueDate.trim() ? req.body.dueDate.trim() : null;
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : 'Open';
    const residualLikelihoodRaw = typeof req.body?.residualLikelihood === 'string' ? req.body.residualLikelihood.trim() : '';
    const residualSeverityRaw = typeof req.body?.residualSeverity === 'string' ? req.body.residualSeverity.trim() : '';

    if (!supplierId || !riskId || !description) {
      res.status(400).json({ error: 'supplierId, riskId, and description are required' });
      return;
    }
    if (!['Open', 'InProgress', 'Mitigated'].includes(status)) {
      res.status(400).json({ error: 'status must be Open, InProgress, or Mitigated' });
      return;
    }

    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }

    const risk = await prisma.opportunity.findUnique({ where: { id: riskId } });
    if (!risk || risk.type !== 'risk' || risk.supplierId !== supplierId) {
      res.status(400).json({ error: 'riskId must reference a risk for selected supplier' });
      return;
    }

    let residualLikelihood: RiskLikelihood | null = null;
    let residualSeverity: RiskSeverity | null = null;
    let residualRiskLevel: 'Low' | 'Medium' | 'High' | null = null;
    if (status === 'Mitigated' || residualLikelihoodRaw || residualSeverityRaw) {
      if (!['VeryUnlikely', 'Unlikely', 'Possible', 'Likely', 'VeryLikely'].includes(residualLikelihoodRaw)) {
        res.status(400).json({ error: 'residualLikelihood is required when status is Mitigated' });
        return;
      }
      if (!['Negligible', 'Minor', 'Moderate', 'Significant', 'Severe'].includes(residualSeverityRaw)) {
        res.status(400).json({ error: 'residualSeverity is required when status is Mitigated' });
        return;
      }
      residualLikelihood = residualLikelihoodRaw as RiskLikelihood;
      residualSeverity = residualSeverityRaw as RiskSeverity;
      residualRiskLevel = deriveRiskLevel(residualLikelihood, residualSeverity);
    }

    const created = await prisma.riskAction.create({
      data: {
        code: await getNextCode('ACT', 4),
        supplierId,
        riskId,
        description,
        owner,
        dueDate: dueDate ? new Date(`${dueDate.slice(0, 10)}T12:00:00.000Z`) : null,
        status: status as RiskActionStatus,
        residualLikelihood,
        residualSeverity,
        residualRiskLevel,
        createdById: req.user.id,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        risk: { select: { id: true, code: true, description: true, riskLevel: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    res.status(201).json(created);
  })
);

export default router;
