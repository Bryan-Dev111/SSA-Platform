/**
 * Findings API: CRUD; status flow New → Waiting Disposition → Waiting Approval → Closed.
 * Required for Save (New): Supplier, Severity, Summary, Discrepancy.
 * Process/Reverse; Approve/Reject (Waiting Approval, Admin/QE only). Only Admin can delete.
 */
import { Router, Request, Response } from 'express';
import { FindingSeverity, FindingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { getNextCode } from '../services/idGenerator';
import { asyncHandler } from '../middleware/asyncHandler';
import { createAlertForRecipients } from '../services/alerts';

const router = Router();

const FINDING_STATUS_ORDER: FindingStatus[] = ['New', 'WaitingDisposition', 'WaitingApproval', 'Closed'];

function nextStatus(s: FindingStatus): FindingStatus | null {
  const i = FINDING_STATUS_ORDER.indexOf(s);
  return i < 0 || i >= FINDING_STATUS_ORDER.length - 1 ? null : FINDING_STATUS_ORDER[i + 1];
}

function prevStatus(s: FindingStatus): FindingStatus | null {
  const i = FINDING_STATUS_ORDER.indexOf(s);
  return i <= 0 ? null : FINDING_STATUS_ORDER[i - 1];
}

router.use(authMiddleware);
router.use(requirePageAccess('Findings'));

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
    const where: { supplierId?: { in: string[] } | string; status?: { notIn: FindingStatus[] } } = {};
    if (allowedIds !== null) {
      where.supplierId = { in: allowedIds };
      if (allowedIds.length === 0) {
        res.json({ list: [], stats: { totalAll: 0, openAll: 0, criticalMajor: 0 }, defectCodeCounts: [] });
        return;
      }
    }
    if (supplierId) {
      if (allowedIds !== null && !allowedIds.includes(supplierId)) {
        res.json({ list: [], stats: { totalAll: 0, openAll: 0, criticalMajor: 0 }, defectCodeCounts: [] });
        return;
      }
      where.supplierId = supplierId;
    }
    // Stats are computed from all DB findings in scope (no status exclusion).
    const statsWhere = { ...where };
    // List shows only findings that have left New (and legacy DRAFT).
    where.status = { notIn: ['New', 'DRAFT'] };
    const [list, allForStats] = await Promise.all([
      prisma.finding.findMany({
        where,
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          audit: { select: { id: true, code: true, auditDate: true } },
          correctiveActions: {
            select: { id: true, code: true, status: true },
            orderBy: { updatedAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.finding.findMany({
        where: statsWhere,
        select: { severity: true, status: true, defectCode: true },
      }),
    ]);
    const totalAll = allForStats.length;
    const openAll = allForStats.filter((f) => f.status !== 'Closed').length;
    const criticalMajor = allForStats.filter((f) => f.severity === 'Critical' || f.severity === 'Major').length;
    const defectCodeCounts = allForStats
      .filter((f) => f.defectCode)
      .reduce((acc: Record<string, number>, f) => {
        const c = (f.defectCode as string).trim();
        if (c) acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});
    const defectCodeArray = Object.entries(defectCodeCounts)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    res.json({
      list,
      stats: { totalAll, openAll, criticalMajor },
      defectCodeCounts: defectCodeArray,
    });
  })
);

router.get(
  '/by-code/:code',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const rawCode = String(req.params.code ?? '').trim();
    if (!rawCode) {
      res.status(400).json({ error: 'Finding code is required' });
      return;
    }
    const finding = await prisma.finding.findFirst({
      where: { code: { equals: rawCode.toUpperCase(), mode: 'insensitive' } },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true, auditDate: true } },
        createdBy: { select: { id: true, email: true, name: true } },
        correctiveActions: {
          select: { id: true, code: true, status: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!finding) {
      // Search endpoint behavior: return null to avoid noisy network errors for misses.
      res.json(null);
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(finding.supplierId)) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    res.json(finding);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const finding = await prisma.finding.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true, auditDate: true } },
        createdBy: { select: { id: true, email: true, name: true } },
        correctiveActions: {
          select: { id: true, code: true, status: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!finding) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(finding.supplierId)) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    res.json(finding);
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canInitiate = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
    if (!canInitiate) {
      res.status(403).json({ error: 'Only Admin, Quality Engineer, or Auditor can create a finding' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const {
      supplierId,
      auditId,
      severity,
      summary,
      discrepancy,
      defectCode,
      dispositionCode,
      containment,
      occurrenceRootCause,
      escapeRootCause,
      correctiveAction,
      verificationOfEffectiveness,
      closingComments,
    } = req.body as Record<string, unknown>;
    if (!supplierId || !severity || !summary || discrepancy === undefined) {
      res.status(400).json({ error: 'supplierId, severity, summary, and discrepancy are required' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(supplierId as string)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    let normalizedAuditId: string | undefined;
    if (auditId !== null && auditId !== undefined && String(auditId).trim() !== '') {
      const audit = await prisma.audit.findUnique({ where: { id: auditId as string }, select: { id: true, supplierId: true } });
      if (!audit || audit.supplierId !== supplierId) {
        res.status(400).json({ error: 'Audit not found or does not belong to supplier' });
        return;
      }
      normalizedAuditId = audit.id;
    }
    if (!['Critical', 'Major', 'Minor'].includes(severity as string)) {
      res.status(400).json({ error: 'severity must be Critical, Major, or Minor' });
      return;
    }
    const code = await getNextCode('FIN');
    const createData = {
      code,
      ...(normalizedAuditId ? { auditId: normalizedAuditId } : {}),
      supplierId: supplierId as string,
      status: 'New',
      severity: severity as 'Critical' | 'Major' | 'Minor',
      summary: String(summary).trim(),
      discrepancy: String(discrepancy).trim(),
      defectCode: defectCode ? String(defectCode).trim() : null,
      dispositionCode: dispositionCode ? String(dispositionCode).trim() : null,
      containment: containment ? String(containment).trim() : null,
      occurrenceRootCause: occurrenceRootCause ? String(occurrenceRootCause).trim() : null,
      escapeRootCause: escapeRootCause ? String(escapeRootCause).trim() : null,
      correctiveAction: correctiveAction ? String(correctiveAction).trim() : null,
      verificationOfEffectiveness: verificationOfEffectiveness ? String(verificationOfEffectiveness).trim() : null,
      closingComments: closingComments ? String(closingComments).trim() : null,
      createdById: req.user.id,
    };
    const finding = await prisma.finding.create({
      data: createData as any,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true, auditDate: true } },
        correctiveActions: { select: { id: true, code: true, status: true }, orderBy: { updatedAt: 'desc' } },
      },
    });
    if (finding.severity === 'Critical' || finding.severity === 'Major') {
      await createAlertForRecipients({
        category: 'majorCriticalFinding',
        entityType: 'Finding',
        entityId: finding.id,
        message: `${finding.severity} finding ${finding.code} created for ${finding.supplier.code} — ${finding.supplier.name}.`,
      });
    }
    res.status(201).json(finding);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canEditDraft = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
    if (!canEditDraft) {
      res.status(403).json({ error: 'Viewer and other roles cannot edit findings' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.finding.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (!['New', 'DRAFT'].includes(existing.status)) {
      res.status(400).json({ error: 'Only New findings can be updated via PATCH' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const data: {
      severity?: FindingSeverity;
      summary?: string;
      discrepancy?: string;
      defectCode?: string | null;
      dispositionCode?: string | null;
      containment?: string | null;
      occurrenceRootCause?: string | null;
      escapeRootCause?: string | null;
      correctiveAction?: string | null;
      verificationOfEffectiveness?: string | null;
      closingComments?: string | null;
    } = {};
    const allowed = [
      'summary',
      'discrepancy',
      'defectCode',
      'dispositionCode',
      'containment',
      'occurrenceRootCause',
      'escapeRootCause',
      'correctiveAction',
      'verificationOfEffectiveness',
      'closingComments',
    ] as const;
    for (const k of allowed) {
      if (body[k] !== undefined) (data as Record<string, unknown>)[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
    }
    if (data.defectCode === '') data.defectCode = null;
    if (data.dispositionCode === '') data.dispositionCode = null;
    if (body.severity !== undefined) {
      if (!['Critical', 'Major', 'Minor'].includes(body.severity as string)) {
        res.status(400).json({ error: 'severity must be Critical, Major, or Minor' });
        return;
      }
      data.severity = body.severity as FindingSeverity;
    }
    const finding = await prisma.finding.update({
      where: { id: req.params.id },
      data,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true, auditDate: true } },
        correctiveActions: {
          select: { id: true, code: true, status: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    res.json(finding);
  })
);

router.post(
  '/:id/save',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canEditDraft = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
    if (!canEditDraft) {
      res.status(403).json({ error: 'Viewer and other roles cannot save findings' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.finding.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (!['New', 'DRAFT'].includes(existing.status)) {
      res.status(400).json({ error: 'Only New findings can be saved' });
      return;
    }
    if (!existing.summary?.trim() || !existing.discrepancy?.trim()) {
      res.status(400).json({ error: 'Required fields for Save: Supplier, Severity, Summary, Discrepancy' });
      return;
    }
    const code = /^FIN-\d{5}$/.test(existing.code) ? existing.code : await getNextCode('FIN');
    const finding = await prisma.finding.update({
      where: { id: req.params.id },
      data: { code, status: 'New' },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true, auditDate: true } },
        correctiveActions: {
          select: { id: true, code: true, status: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    res.json(finding);
  })
);

router.post(
  '/:id/process',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canProcess = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
    if (!canProcess) {
      res.status(403).json({ error: 'Viewer and other roles cannot process findings' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.finding.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    let next: FindingStatus | null = null;
    if (existing.status === 'New' || existing.status === 'DRAFT' || existing.status === 'WaitingDisposition') {
      next = 'WaitingApproval';
    }
    if (!next) {
      res.status(400).json({ error: 'Process not available for current status' });
      return;
    }
    const finding = await prisma.finding.update({
      where: { id: req.params.id },
      data: { status: next },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true, auditDate: true } },
        correctiveActions: {
          select: { id: true, code: true, status: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    res.json(finding);
  })
);

router.post(
  '/:id/reverse',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canReverse = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));
    if (!canReverse) {
      res.status(403).json({ error: 'Viewer and other roles cannot reverse findings' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.finding.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    const prev = prevStatus(existing.status);
    if (!prev || prev === 'DRAFT' || prev === 'New') {
      res.status(400).json({ error: 'Cannot reverse to New' });
      return;
    }
    const finding = await prisma.finding.update({
      where: { id: req.params.id },
      data: { status: prev },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true, auditDate: true } },
        correctiveActions: {
          select: { id: true, code: true, status: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    res.json(finding);
  })
);

router.post(
  '/:id/approve',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canApprove = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer'].includes(r));
    if (!canApprove) {
      res.status(403).json({ error: 'Only Admin or Quality Engineer can approve findings' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.finding.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (existing.status !== 'WaitingApproval') {
      res.status(400).json({ error: 'Only findings in Waiting Approval can be approved' });
      return;
    }
    const finding = await prisma.finding.update({
      where: { id: req.params.id },
      data: { status: 'Closed' },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true, auditDate: true } },
        correctiveActions: {
          select: { id: true, code: true, status: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    res.json(finding);
  })
);

router.post(
  '/:id/reject',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canReject = req.user.roleNames.some((r) => ['Admin', 'QualityEngineer'].includes(r));
    if (!canReject) {
      res.status(403).json({ error: 'Only Admin or Quality Engineer can reject findings' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.finding.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (existing.status !== 'WaitingApproval') {
      res.status(400).json({ error: 'Only findings in Waiting Approval can be rejected' });
      return;
    }
    const finding = await prisma.finding.update({
      where: { id: req.params.id },
      data: { status: 'WaitingDisposition' },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        audit: { select: { id: true, code: true, auditDate: true } },
        correctiveActions: {
          select: { id: true, code: true, status: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    res.json(finding);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!req.user.roleNames.includes('Admin')) {
      res.status(403).json({ error: 'Only Admin can delete a finding' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.finding.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    await prisma.finding.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
