import { Request, Response, Router } from 'express';
import { prisma, prismaBase } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { getNextCode } from '../services/idGenerator';
import { computeCurrentRiskLevelForRisk } from '../services/riskRegisterCurrent';

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
    // Translate DB statuses to UI statuses (`Open`/`Closed`).
    // - DB `Mitigated` -> UI `Closed`
    // - DB `Open`/`InProgress` -> UI `Open`
    const mapped = rows.map((r) => ({
      ...r,
      status: r.status === 'Mitigated' ? 'Closed' : 'Open',
    }));
    res.json(mapped);
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
    const createdById = req.user.id;
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
    const riskId = typeof req.body?.riskId === 'string' ? req.body.riskId : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const owner = typeof req.body?.owner === 'string' ? req.body.owner.trim() || null : null;
    const dueDate = typeof req.body?.dueDate === 'string' && req.body.dueDate.trim() ? req.body.dueDate.trim() : null;
    // UI requirement: Actions status choices are only `Open` and `Closed`.
    // DB uses `Open` | `InProgress` | `Mitigated`, so we map:
    // - UI `Open` -> DB `Open`
    // - UI `Closed` -> DB `Mitigated`
    const uiStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : 'Open';
    const residualLikelihoodRaw = typeof req.body?.residualLikelihood === 'string' ? req.body.residualLikelihood.trim() : '';
    const residualSeverityRaw = typeof req.body?.residualSeverity === 'string' ? req.body.residualSeverity.trim() : '';

    if (!supplierId || !riskId || !description) {
      res.status(400).json({ error: 'supplierId, riskId, and description are required' });
      return;
    }
    if (!['Open', 'Closed'].includes(uiStatus)) {
      res.status(400).json({ error: 'status must be Open or Closed' });
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

    const dbStatus: RiskActionStatus = uiStatus === 'Closed' ? 'Mitigated' : 'Open';

    let residualLikelihood: RiskLikelihood | null = null;
    let residualSeverity: RiskSeverity | null = null;
    let residualRiskLevel: 'Low' | 'Medium' | 'High' | null = null;
    if (uiStatus === 'Closed' || residualLikelihoodRaw || residualSeverityRaw) {
      if (!['VeryUnlikely', 'Unlikely', 'Possible', 'Likely', 'VeryLikely'].includes(residualLikelihoodRaw)) {
        res.status(400).json({ error: 'residualLikelihood is required when status is Closed' });
        return;
      }
      if (!['Negligible', 'Minor', 'Moderate', 'Significant', 'Severe'].includes(residualSeverityRaw)) {
        res.status(400).json({ error: 'residualSeverity is required when status is Closed' });
        return;
      }
      residualLikelihood = residualLikelihoodRaw as RiskLikelihood;
      residualSeverity = residualSeverityRaw as RiskSeverity;
      residualRiskLevel = deriveRiskLevel(residualLikelihood, residualSeverity);
    }

    const syncOpportunityStatus =
      dbStatus === 'Mitigated' &&
      risk.type === 'risk' &&
      residualLikelihood != null &&
      residualSeverity != null &&
      residualRiskLevel != null;

    const actionsBefore = await prisma.riskAction.findMany({
      where: { riskId },
      orderBy: { createdAt: 'desc' },
    });
    const levelBefore = computeCurrentRiskLevelForRisk(risk, actionsBefore);

    const actionInclude = {
      supplier: { select: { id: true, code: true, name: true } },
      risk: { select: { id: true, code: true, description: true, riskLevel: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    };

    const code = await getNextCode('ACT', 4);
    const created = await prismaBase.$transaction(
      async (tx) => {
        const row = await tx.riskAction.create({
          data: {
            code,
            supplierId,
            riskId,
            description,
            owner,
            dueDate: dueDate ? new Date(`${dueDate.slice(0, 10)}T12:00:00.000Z`) : null,
            status: dbStatus,
            residualLikelihood,
            residualSeverity,
            residualRiskLevel,
            createdById,
          },
          include: actionInclude,
        });
        if (syncOpportunityStatus) {
          await tx.opportunity.update({
            where: { id: riskId },
            data: { status: 'Mitigated' },
          });
        }
        return row;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );

    const actionsAfter = await prisma.riskAction.findMany({
      where: { riskId },
      orderBy: { createdAt: 'desc' },
    });
    const riskAfter = await prisma.opportunity.findUnique({ where: { id: riskId } });
    if (riskAfter && levelBefore !== computeCurrentRiskLevelForRisk(riskAfter, actionsAfter)) {
      await prisma.opportunity.update({
        where: { id: riskId },
        data: { currentRiskUpdatedAt: new Date() },
      });
    }

    // Translate DB status to UI status for the frontend.
    const statusForUi = created.status === 'Mitigated' ? 'Closed' : 'Open';
    res.status(201).json({ ...created, status: statusForUi });
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
    const id = req.params.id;
    const existing = await prisma.riskAction.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        risk: { select: { id: true, code: true, description: true, riskLevel: true, type: true, supplierId: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'Risk action not found' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Risk action not found' });
      return;
    }

    const incomingStatus =
      req.body?.status !== undefined && typeof req.body.status === 'string' ? req.body.status.trim() : undefined;
    if (incomingStatus !== undefined && !['Open', 'Closed'].includes(incomingStatus)) {
      res.status(400).json({ error: 'status must be Open or Closed' });
      return;
    }

    const currentUi: 'Open' | 'Closed' = existing.status === 'Mitigated' ? 'Closed' : 'Open';
    const targetUi: 'Open' | 'Closed' = incomingStatus === 'Closed' ? 'Closed' : incomingStatus === 'Open' ? 'Open' : currentUi;

    let description = existing.description;
    if (req.body?.description !== undefined) {
      const d = typeof req.body.description === 'string' ? req.body.description.trim() : '';
      if (!d) {
        res.status(400).json({ error: 'description cannot be empty' });
        return;
      }
      description = d;
    }

    let owner = existing.owner;
    if (req.body?.owner !== undefined) {
      owner = typeof req.body.owner === 'string' ? req.body.owner.trim() || null : null;
    }

    let dueDate: Date | null = existing.dueDate;
    if (req.body?.dueDate !== undefined) {
      const raw = typeof req.body.dueDate === 'string' ? req.body.dueDate.trim() : '';
      dueDate = raw ? new Date(`${raw.slice(0, 10)}T12:00:00.000Z`) : null;
    }

    let residualLikelihood: RiskLikelihood | null = existing.residualLikelihood as RiskLikelihood | null;
    let residualSeverity: RiskSeverity | null = existing.residualSeverity as RiskSeverity | null;

    if (req.body?.residualLikelihood !== undefined) {
      const l = typeof req.body.residualLikelihood === 'string' ? req.body.residualLikelihood.trim() : '';
      if (!['VeryUnlikely', 'Unlikely', 'Possible', 'Likely', 'VeryLikely'].includes(l)) {
        res.status(400).json({ error: 'invalid residualLikelihood' });
        return;
      }
      residualLikelihood = l as RiskLikelihood;
    }
    if (req.body?.residualSeverity !== undefined) {
      const s = typeof req.body.residualSeverity === 'string' ? req.body.residualSeverity.trim() : '';
      if (!['Negligible', 'Minor', 'Moderate', 'Significant', 'Severe'].includes(s)) {
        res.status(400).json({ error: 'invalid residualSeverity' });
        return;
      }
      residualSeverity = s as RiskSeverity;
    }

    if (targetUi === 'Open') {
      residualLikelihood = null;
      residualSeverity = null;
    }

    let residualRiskLevel: 'Low' | 'Medium' | 'High' | null = null;
    const dbStatus: RiskActionStatus = targetUi === 'Closed' ? 'Mitigated' : 'Open';

    if (targetUi === 'Closed') {
      if (!residualLikelihood || !residualSeverity) {
        res.status(400).json({
          error: 'residualLikelihood and residualSeverity are required when status is Closed',
        });
        return;
      }
      residualRiskLevel = deriveRiskLevel(residualLikelihood, residualSeverity);
    }

    const hasAnyChange =
      description !== existing.description ||
      owner !== existing.owner ||
      (dueDate?.getTime() ?? null) !== (existing.dueDate?.getTime() ?? null) ||
      dbStatus !== existing.status ||
      residualLikelihood !== (existing.residualLikelihood as RiskLikelihood | null) ||
      residualSeverity !== (existing.residualSeverity as RiskSeverity | null);

    if (!hasAnyChange) {
      res.status(400).json({ error: 'Provide at least one field to update' });
      return;
    }

    const riskType = existing.risk.type;
    const riskId = existing.riskId;

    const syncOpportunityStatus =
      dbStatus === 'Mitigated' &&
      riskType === 'risk' &&
      residualLikelihood &&
      residualSeverity &&
      residualRiskLevel;

    const riskOpp = await prisma.opportunity.findUnique({ where: { id: riskId } });
    const actionsBeforePatch = await prisma.riskAction.findMany({
      where: { riskId },
      orderBy: { createdAt: 'desc' },
    });
    const levelBeforePatch = riskOpp ? computeCurrentRiskLevelForRisk(riskOpp, actionsBeforePatch) : null;

    const actionData = {
      description,
      owner,
      dueDate,
      status: dbStatus,
      residualLikelihood,
      residualSeverity,
      residualRiskLevel,
    };
    const actionInclude = {
      supplier: { select: { id: true, code: true, name: true } },
      risk: { select: { id: true, code: true, description: true, riskLevel: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    };

    // Use `prismaBase` so the interactive tx is not wrapped by extended-client query
    // middleware (disconnect/reconnect retry invalidates transaction id → P2028).
    const updated = await prismaBase.$transaction(
      async (tx) => {
        const row = await tx.riskAction.update({
          where: { id },
          data: actionData,
          include: actionInclude,
        });
        if (syncOpportunityStatus) {
          await tx.opportunity.update({
            where: { id: riskId },
            data: { status: 'Mitigated' },
          });
        }
        return row;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );

    const actionsAfterPatch = await prisma.riskAction.findMany({
      where: { riskId },
      orderBy: { createdAt: 'desc' },
    });
    const riskAfterPatch = await prisma.opportunity.findUnique({ where: { id: riskId } });
    if (
      riskAfterPatch &&
      levelBeforePatch !== computeCurrentRiskLevelForRisk(riskAfterPatch, actionsAfterPatch)
    ) {
      await prisma.opportunity.update({
        where: { id: riskId },
        data: { currentRiskUpdatedAt: new Date() },
      });
    }

    const statusForUi = updated.status === 'Mitigated' ? 'Closed' : 'Open';
    res.json({ ...updated, status: statusForUi });
  })
);

export default router;
