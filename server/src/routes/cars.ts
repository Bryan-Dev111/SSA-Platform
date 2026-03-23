/**
 * CARs API: CRUD; status flow DRAFT → RCCA → Waiting Approval → Follow-Up → Closed.
 * Required for Save (DRAFT → RCCA): Supplier, Audit #, Finding #, Severity, Summary, Discrepancy.
 * Process/Reverse; Approve/Reject (Waiting Approval: Admin, Buyer, QE). Only Admin can delete.
 */
import { Router, Request, Response } from 'express';
import { CARStatus, FindingSeverity } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { getNextCode } from '../services/idGenerator';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const carInclude = {
  supplier: { select: { id: true, code: true, name: true } },
  audit: { select: { id: true, code: true, auditDate: true } },
  finding: { select: { id: true, code: true, severity: true } },
  approvalLogs: {
    select: {
      id: true,
      action: true,
      comment: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
};

const CAR_STATUS_ORDER: CARStatus[] = ['DRAFT', 'RCCA', 'WaitingApproval', 'FollowUp', 'Closed'];

function nextCarStatus(s: CARStatus): CARStatus | null {
  const i = CAR_STATUS_ORDER.indexOf(s);
  return i < 0 || i >= CAR_STATUS_ORDER.length - 1 ? null : CAR_STATUS_ORDER[i + 1];
}

function prevCarStatus(s: CARStatus): CARStatus | null {
  const i = CAR_STATUS_ORDER.indexOf(s);
  return i <= 0 ? null : CAR_STATUS_ORDER[i - 1];
}

router.use(authMiddleware);
router.use(requirePageAccess('CorrectiveActions'));

/** GET /cars — list CARs (non-DRAFT), stats, supplier filter */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
    const where: { supplierId?: { in: string[] } | string; status?: { not: CARStatus } } = { status: { not: 'DRAFT' } };
    if (allowedIds !== null) {
      where.supplierId = { in: allowedIds };
      if (allowedIds.length === 0) {
        res.json({
          list: [],
          stats: { open: 0, overdue: 0, waitingApproval: 0, avgClosureDays: 0 },
          defectCodeCounts: [],
          severityCounts: [
            { severity: 'Critical', count: 0 },
            { severity: 'Major', count: 0 },
            { severity: 'Minor', count: 0 },
          ],
        });
        return;
      }
    }
    if (supplierId) {
      if (allowedIds !== null && !allowedIds.includes(supplierId)) {
        res.json({
          list: [],
          stats: { open: 0, overdue: 0, waitingApproval: 0, avgClosureDays: 0 },
          defectCodeCounts: [],
          severityCounts: [
            { severity: 'Critical', count: 0 },
            { severity: 'Major', count: 0 },
            { severity: 'Minor', count: 0 },
          ],
        });
        return;
      }
      where.supplierId = supplierId;
    }
    const [list, allForStats] = await Promise.all([
      prisma.correctiveAction.findMany({
        where,
        include: carInclude,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.correctiveAction.findMany({
        where: { ...where, status: { not: 'DRAFT' } },
        select: { status: true, targetCompletionDate: true, createdAt: true, updatedAt: true },
      }),
    ]);
    const open = allForStats.filter((c) => c.status !== 'Closed').length;
    const now = new Date();
    const overdue = allForStats.filter(
      (c) => c.status !== 'Closed' && c.targetCompletionDate && new Date(c.targetCompletionDate) < now
    ).length;
    const waitingApproval = allForStats.filter((c) => c.status === 'WaitingApproval').length;
    const closed = allForStats.filter((c) => c.status === 'Closed');
    let avgClosureDays = 0;
    if (closed.length > 0) {
      const totalDays = closed.reduce((sum, c) => {
        const created = new Date(c.createdAt).getTime();
        const updated = new Date(c.updatedAt).getTime();
        return sum + (updated - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgClosureDays = Math.round((totalDays / closed.length) * 10) / 10;
    }
    const defectCodeMap = list
      .filter((c) => c.defectCode?.trim())
      .reduce((acc: Record<string, number>, c) => {
        const code = (c.defectCode as string).trim();
        if (code) acc[code] = (acc[code] || 0) + 1;
        return acc;
      }, {});
    const defectCodeCounts = Object.entries(defectCodeMap)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const severityCounts = (['Critical', 'Major', 'Minor'] as const).map((severity) => ({
      severity,
      count: list.filter((c) => c.severity === severity).length,
    }));
    res.json({
      list,
      stats: { open, overdue, waitingApproval, avgClosureDays },
      defectCodeCounts,
      severityCounts,
    });
  })
);

/** GET /cars/by-code/:code */
router.get(
  '/by-code/:code',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const car = await prisma.correctiveAction.findUnique({
      where: { code: req.params.code },
      include: {
        ...carInclude,
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });
    if (!car) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(car.supplierId)) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    res.json(car);
  })
);

/** GET /cars/:id */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const car = await prisma.correctiveAction.findUnique({
      where: { id: req.params.id },
      include: {
        ...carInclude,
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });
    if (!car) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(car.supplierId)) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    res.json(car);
  })
);

/** POST /cars — create DRAFT CAR */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canInitiate = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
    if (!canInitiate) {
      res.status(403).json({ error: 'Only Admin, Quality Engineer, or Buyer can create a CAR' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const {
      findingId,
      auditId,
      supplierId,
      severity,
      carOwner,
      targetCompletionDate,
      summary,
      discrepancy,
      defectCode,
      containment,
      occurrenceRootCause,
      escapeRootCause,
      correctiveAction,
      verificationOfEffectiveness,
      closingComments,
    } = req.body as Record<string, unknown>;
    if (!auditId || !supplierId || !severity || !summary || discrepancy === undefined) {
      res.status(400).json({ error: 'auditId, supplierId, severity, summary, and discrepancy are required' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(supplierId as string)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    const audit = await prisma.audit.findUnique({
      where: { id: auditId as string },
      select: { id: true, supplierId: true },
    });
    if (!audit || audit.supplierId !== supplierId) {
      res.status(400).json({ error: 'Audit not found or does not match supplier' });
      return;
    }
    let normalizedFindingId: string | undefined;
    if (findingId !== null && findingId !== undefined && String(findingId).trim() !== '') {
      const finding = await prisma.finding.findUnique({
        where: { id: findingId as string },
        select: { id: true, auditId: true, supplierId: true, severity: true },
      });
      if (!finding || finding.supplierId !== supplierId || finding.auditId !== auditId) {
        res.status(400).json({ error: 'Finding not found or does not match audit/supplier' });
        return;
      }
      normalizedFindingId = finding.id;
    }
    if (!['Critical', 'Major', 'Minor'].includes(severity as string)) {
      res.status(400).json({ error: 'severity must be Critical, Major, or Minor' });
      return;
    }
    const code = `CAR-DRAFT-${Date.now()}`;
    const createData = {
      code,
      ...(normalizedFindingId ? { findingId: normalizedFindingId } : {}),
      auditId: auditId as string,
      supplierId: supplierId as string,
      status: 'DRAFT',
      severity: severity as FindingSeverity,
      summary: String(summary).trim(),
      discrepancy: String(discrepancy).trim(),
      carOwner: carOwner ? String(carOwner).trim() : null,
      targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate as string) : null,
      defectCode: defectCode ? String(defectCode).trim() : null,
      containment: containment ? String(containment).trim() : null,
      occurrenceRootCause: occurrenceRootCause ? String(occurrenceRootCause).trim() : null,
      escapeRootCause: escapeRootCause ? String(escapeRootCause).trim() : null,
      correctiveAction: correctiveAction ? String(correctiveAction).trim() : null,
      verificationOfEffectiveness: verificationOfEffectiveness ? String(verificationOfEffectiveness).trim() : null,
      closingComments: closingComments ? String(closingComments).trim() : null,
      createdById: req.user.id,
    };
    const car = await prisma.correctiveAction.create({
      data: createData as any,
      include: carInclude,
    });
    res.status(201).json(car);
  })
);

/** PATCH /cars/:id — update CAR fields */
router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canEdit = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
    if (!canEdit) {
      res.status(403).json({ error: 'Viewer and other roles cannot edit CARs' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.correctiveAction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    const allowed = [
      'carOwner',
      'targetCompletionDate',
      'summary',
      'discrepancy',
      'defectCode',
      'containment',
      'occurrenceRootCause',
      'escapeRootCause',
      'correctiveAction',
      'verificationOfEffectiveness',
      'closingComments',
    ] as const;
    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (k === 'targetCompletionDate') data[k] = body[k] ? new Date(body[k] as string) : null;
        else data[k] = typeof body[k] === 'string' ? (body[k] as string).trim() : body[k];
      }
    }
    if (body.severity !== undefined) {
      if (!['Critical', 'Major', 'Minor'].includes(body.severity as string)) {
        res.status(400).json({ error: 'severity must be Critical, Major, or Minor' });
        return;
      }
      data.severity = body.severity as FindingSeverity;
    }
    const car = await prisma.correctiveAction.update({
      where: { id: req.params.id },
      data,
      include: carInclude,
    });
    res.json(car);
  })
);

/** POST /cars/:id/save — DRAFT → RCCA */
router.post(
  '/:id/save',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canSave = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
    if (!canSave) {
      res.status(403).json({ error: 'Viewer and other roles cannot save CARs' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.correctiveAction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (existing.status !== 'DRAFT') {
      res.status(400).json({ error: 'Only draft CARs can be saved' });
      return;
    }
    if (!existing.summary?.trim() || !existing.discrepancy?.trim()) {
      res.status(400).json({ error: 'Required fields for Save: Supplier, Audit #, Severity, Summary, Discrepancy' });
      return;
    }
    const code = await getNextCode('CAR');
    const car = await prisma.correctiveAction.update({
      where: { id: req.params.id },
      data: { code, status: 'RCCA' },
      include: carInclude,
    });
    res.json(car);
  })
);

/** POST /cars/:id/process */
router.post(
  '/:id/process',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canProcess = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
    if (!canProcess) {
      res.status(403).json({ error: 'Viewer and other roles cannot process CARs' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.correctiveAction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    const next = nextCarStatus(existing.status);
    if (!next || existing.status === 'WaitingApproval') {
      res.status(400).json({ error: 'Process not available for current status' });
      return;
    }
    const car = await prisma.correctiveAction.update({
      where: { id: req.params.id },
      data: { status: next },
      include: carInclude,
    });
    res.json(car);
  })
);

/** POST /cars/:id/reverse */
router.post(
  '/:id/reverse',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canReverse = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
    if (!canReverse) {
      res.status(403).json({ error: 'Viewer and other roles cannot reverse CARs' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.correctiveAction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    const prev = prevCarStatus(existing.status);
    if (!prev || prev === 'DRAFT') {
      res.status(400).json({ error: 'Cannot reverse to DRAFT' });
      return;
    }
    const car = await prisma.correctiveAction.update({
      where: { id: req.params.id },
      data: { status: prev },
      include: carInclude,
    });
    res.json(car);
  })
);

/** POST /cars/:id/approve — WaitingApproval → Closed */
router.post(
  '/:id/approve',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canApprove = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
    if (!canApprove) {
      res.status(403).json({ error: 'Only Admin, Quality Engineer, or Buyer can approve CARs' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.correctiveAction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (existing.status !== 'WaitingApproval') {
      res.status(400).json({ error: 'Only CARs in Waiting Approval can be approved' });
      return;
    }
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    const approveData = {
      status: 'FollowUp',
      approvalLogs: {
        create: {
          action: 'Approved',
          comment: comment || null,
          userId: req.user.id,
        },
      },
    };
    const car = await prisma.correctiveAction.update({
      where: { id: req.params.id },
      data: approveData as any,
      include: carInclude,
    });
    res.json(car);
  })
);

/** POST /cars/:id/reject — WaitingApproval → RCCA */
router.post(
  '/:id/reject',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canReject = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Buyer'].includes(r));
    if (!canReject) {
      res.status(403).json({ error: 'Only Admin, Quality Engineer, or Buyer can reject CARs' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.correctiveAction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (existing.status !== 'WaitingApproval') {
      res.status(400).json({ error: 'Only CARs in Waiting Approval can be rejected' });
      return;
    }
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    const rejectData = {
      status: 'RCCA',
      approvalLogs: {
        create: {
          action: 'Rejected',
          comment: comment || null,
          userId: req.user.id,
        },
      },
    };
    const car = await prisma.correctiveAction.update({
      where: { id: req.params.id },
      data: rejectData as any,
      include: carInclude,
    });
    res.json(car);
  })
);

/** DELETE /cars/:id — Admin only */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!req.user.roleNames.includes('Admin')) {
      res.status(403).json({ error: 'Only Admin can delete a CAR' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.correctiveAction.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'CAR not found' });
      return;
    }
    await prisma.correctiveAction.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
