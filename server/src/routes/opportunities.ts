/**
 * Risk/Opportunity managed entity with lifecycle:
 * type: risk|opportunity
 * status: Open|Mitigated|Closed|Realized
 * risk_level is derived from likelihood x severity for risk rows.
 */
import { Router, Request, Response } from 'express';
import { prisma, prismaBase } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Risk'));

type RiskItemType = 'risk' | 'opportunity';
type RiskStatus = 'Open' | 'Mitigated' | 'Closed' | 'Realized';
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
    const type = typeof req.query.type === 'string' ? (req.query.type as RiskItemType) : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as RiskStatus) : undefined;
    const riskLevel = typeof req.query.riskLevel === 'string'
      ? (req.query.riskLevel as 'Low' | 'Medium' | 'High')
      : undefined;
    const where = {
      ...(allowedIds === null ? {} : { supplierId: { in: allowedIds } }),
      ...(supplierId ? { supplierId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(riskLevel ? { riskLevel } : {}),
    };
    const list = await prisma.opportunity.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  })
);

router.post(
  '/',
  requireRole(['Admin', 'QualityEngineer', 'QualityManager', 'Buyer']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const typeRaw = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
    const likelihoodRaw = typeof req.body?.likelihood === 'string' ? req.body.likelihood.trim() : '';
    const severityRaw = typeof req.body?.severity === 'string' ? req.body.severity.trim() : '';
    if (!supplierId || !description) {
      res.status(400).json({ error: 'supplierId and description are required' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    if (!['risk', 'opportunity'].includes(typeRaw)) {
      res.status(400).json({ error: 'type must be risk or opportunity' });
      return;
    }
    const type = typeRaw as RiskItemType;
    let likelihood: RiskLikelihood | null = null;
    let severity: RiskSeverity | null = null;
    let riskLevel: 'Low' | 'Medium' | 'High' | null = null;
    if (type === 'risk') {
      if (!['VeryUnlikely', 'Unlikely', 'Possible', 'Likely', 'VeryLikely'].includes(likelihoodRaw)) {
        res.status(400).json({ error: 'likelihood is required for risk type' });
        return;
      }
      if (!['Negligible', 'Minor', 'Moderate', 'Significant', 'Severe'].includes(severityRaw)) {
        res.status(400).json({ error: 'severity is required for risk type' });
        return;
      }
      likelihood = likelihoodRaw as RiskLikelihood;
      severity = severityRaw as RiskSeverity;
      riskLevel = deriveRiskLevel(likelihood, severity);
    }
    const created = await prisma.opportunity.create({
      data: {
        code: type === 'risk' ? await getNextCode('RISK', 4) : await getNextCode('OPP', 4),
        supplierId,
        type,
        description,
        likelihood,
        severity,
        riskLevel,
        status: 'Open',
        createdById: req.user.id,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requireRole(['Admin', 'QualityEngineer', 'QualityManager', 'Buyer']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }

    const data: {
      description?: string;
      type?: RiskItemType;
      status?: RiskStatus;
      likelihood?: RiskLikelihood | null;
      severity?: RiskSeverity | null;
      riskLevel?: 'Low' | 'Medium' | 'High' | null;
    } = {};

    if (req.body?.description !== undefined) {
      const d = typeof req.body.description === 'string' ? req.body.description.trim() : '';
      if (!d) {
        res.status(400).json({ error: 'description cannot be empty' });
        return;
      }
      data.description = d;
    }

    if (req.body?.type !== undefined) {
      const t = typeof req.body.type === 'string' ? req.body.type.trim() : '';
      if (!['risk', 'opportunity'].includes(t)) {
        res.status(400).json({ error: 'type must be risk or opportunity' });
        return;
      }
      data.type = t as RiskItemType;
    }

    if (req.body?.status !== undefined) {
      const s = typeof req.body.status === 'string' ? req.body.status.trim() : '';
      if (!['Open', 'Mitigated', 'Closed', 'Realized'].includes(s)) {
        res.status(400).json({ error: 'status must be Open, Mitigated, Closed, or Realized' });
        return;
      }
      data.status = s as RiskStatus;
    }

    if (req.body?.likelihood !== undefined) {
      const l = typeof req.body.likelihood === 'string' ? req.body.likelihood.trim() : '';
      if (!['VeryUnlikely', 'Unlikely', 'Possible', 'Likely', 'VeryLikely'].includes(l)) {
        res.status(400).json({ error: 'invalid likelihood' });
        return;
      }
      data.likelihood = l as RiskLikelihood;
    }

    if (req.body?.severity !== undefined) {
      const s = typeof req.body.severity === 'string' ? req.body.severity.trim() : '';
      if (!['Negligible', 'Minor', 'Moderate', 'Significant', 'Severe'].includes(s)) {
        res.status(400).json({ error: 'invalid severity' });
        return;
      }
      data.severity = s as RiskSeverity;
    }

    const finalType = data.type ?? existing.type;
    const finalLikelihood = data.likelihood ?? existing.likelihood;
    const finalSeverity = data.severity ?? existing.severity;
    if (finalType === 'risk') {
      if (!finalLikelihood || !finalSeverity) {
        res.status(400).json({ error: 'risk items require likelihood and severity' });
        return;
      }
      data.riskLevel = deriveRiskLevel(finalLikelihood as RiskLikelihood, finalSeverity as RiskSeverity);
    } else {
      data.likelihood = null;
      data.severity = null;
      data.riskLevel = null;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'Provide at least one field to update' });
      return;
    }

    const finalStatus = data.status ?? existing.status;
    const syncLatestClosedActionResidual =
      (data.likelihood !== undefined || data.severity !== undefined) &&
      finalType === 'risk' &&
      finalStatus === 'Mitigated' &&
      !!finalLikelihood &&
      !!finalSeverity;

    const updated = await prismaBase.$transaction(
      async (tx) => {
        const row = await tx.opportunity.update({
          where: { id: req.params.id },
          data,
          include: {
            supplier: { select: { id: true, code: true, name: true } },
            createdBy: { select: { id: true, email: true, name: true } },
          },
        });
        if (syncLatestClosedActionResidual && finalLikelihood && finalSeverity) {
          const latest = await tx.riskAction.findFirst({
            where: { riskId: row.id, status: 'Mitigated' },
            orderBy: { createdAt: 'desc' },
          });
          if (latest) {
            const rl = deriveRiskLevel(finalLikelihood as RiskLikelihood, finalSeverity as RiskSeverity);
            await tx.riskAction.update({
              where: { id: latest.id },
              data: {
                residualLikelihood: finalLikelihood as RiskLikelihood,
                residualSeverity: finalSeverity as RiskSeverity,
                residualRiskLevel: rl,
              },
            });
          }
        }
        return row;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
    res.json(updated);
  })
);

router.delete(
  '/:id',
  requireRole(['Admin', 'QualityEngineer', 'QualityManager', 'Buyer']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const allowedIds = await getAllowedSupplierIds(req.user!);
    const row = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(row.supplierId)) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    await prisma.opportunity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
