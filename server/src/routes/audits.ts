/**
 * Audits API: CRUD; schedule (date, notes); results Passed/Failed/Cancelled;
 * derived status (Scheduled/In-Process/Overdue/Complete/Cancelled); filter by supplier (Buyer).
 * Only Admin/QE can set result; only Admin can delete.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { getNextCode } from '../services/idGenerator';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listSentinelEmployeeContractorsForPicker,
  sentinelEmployeeContractorDisplayLabelsMatch,
} from '../lib/sentinelRoster';

const router = Router();

type AuditResult = 'Passed' | 'Failed' | 'Cancelled';
type DerivedStatus = 'Scheduled' | 'In Process' | 'Overdue' | 'Complete' | 'Cancelled';

function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isAssignedAuditorForAudit(auditorField: string | null, user: { email: string; name?: string | null }): boolean {
  const target = normalizeIdentity(auditorField);
  if (!target) return false;
  const email = normalizeIdentity(user.email);
  const name = normalizeIdentity(user.name);
  const emailLocal = email.includes('@') ? email.split('@')[0] : email;
  return target === email || target === name || target === emailLocal;
}

/** Compare calendar dates in UTC so status is correct regardless of server timezone. */
function getDerivedStatus(result: AuditResult | null, auditDate: Date): DerivedStatus {
  if (result === 'Cancelled') return 'Cancelled';
  if (result === 'Passed' || result === 'Failed') return 'Complete';
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const auditUTC = Date.UTC(
    auditDate.getUTCFullYear(),
    auditDate.getUTCMonth(),
    auditDate.getUTCDate()
  );
  if (auditUTC > todayUTC) return 'Scheduled';
  if (auditUTC === todayUTC) return 'In Process';
  return 'Overdue';
}

router.use(authMiddleware);
router.use(requirePageAccess('Audits'));

router.get(
  '/types',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const types = await prisma.auditType.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
    res.json(types);
  })
);

/** Admin / QE / QM: pickers for audit auditor (Sentinel employees & contractors). */
router.get(
  '/auditors',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canPick =
      req.user.roleNames.includes('Admin') ||
      req.user.roleNames.includes('QualityEngineer') ||
      req.user.roleNames.includes('QualityManager');
    if (!canPick) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    const list = await listSentinelEmployeeContractorsForPicker();
    res.json({ list });
  })
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const currentUser = req.user;
    const allowedIds = await getAllowedSupplierIds(req.user);
    const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
    const where: { supplierId?: string | { in: string[] } } = {};
    if (allowedIds !== null) {
      where.supplierId = { in: allowedIds };
      if (allowedIds.length === 0) {
        res.json([]);
        return;
      }
    }
    if (supplierId) {
      if (allowedIds !== null && !allowedIds.includes(supplierId)) {
        res.json([]);
        return;
      }
      where.supplierId = supplierId;
    }
    const audits = await prisma.audit.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        auditType: { select: { id: true, code: true, name: true } },
        projectHistory: { select: { id: true, projectCode: true } },
        findings: { select: { id: true, code: true } },
        records: { select: { id: true, name: true, filePath: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { auditDate: 'desc' },
    });
    const scopedAudits = currentUser.roleNames.includes('Auditor')
      ? audits.filter((a) => isAssignedAuditorForAudit(a.auditor, currentUser))
      : audits;
    const list = scopedAudits.map((a) => ({
      id: a.id,
      code: a.code,
      supplierId: a.supplierId,
      supplier: a.supplier,
      projectHistoryId: a.projectHistoryId,
      projectHistory: a.projectHistory,
      auditTypeId: a.auditTypeId,
      auditType: a.auditType,
      auditDate: a.auditDate,
      auditor: a.auditor,
      result: a.result,
      summary: a.summary,
      scope: a.scope,
      notes: a.notes,
      createdAt: a.createdAt,
      derivedStatus: getDerivedStatus(a.result, a.auditDate),
      findingCodes: a.findings.map((f) => f.code),
      records: a.records.map((r) => ({ id: r.id, name: r.name, hasFile: Boolean(r.filePath) })),
    }));
    res.json(list);
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
    const audit = await prisma.audit.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: { select: { id: true, code: true, name: true, city: true, country: true } },
        auditType: { select: { id: true, code: true, name: true } },
        projectHistory: { select: { id: true, projectCode: true, companyName: true } },
        findings: { select: { id: true, code: true, status: true, severity: true } },
        records: {
          select: {
            id: true,
            name: true,
            filePath: true,
            fileName: true,
            status: true,
            internalOrSupplier: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!audit) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }
    if (req.user.roleNames.includes('Auditor') && !isAssignedAuditorForAudit(audit.auditor, req.user)) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(audit.supplierId)) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }
    const { records: recordsRaw, ...auditRest } = audit;
    res.json({
      ...auditRest,
      derivedStatus: getDerivedStatus(audit.result, audit.auditDate),
      findingCodes: audit.findings.map((f) => f.code),
      records: recordsRaw.map((r) => ({
        id: r.id,
        name: r.name,
        hasFile: Boolean(r.filePath),
        status: r.status,
        internalOrSupplier: r.internalOrSupplier,
        createdAt: r.createdAt,
      })),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const canCreateOrEdit =
      req.user.roleNames.includes('Admin') ||
      req.user.roleNames.includes('QualityEngineer') ||
      req.user.roleNames.includes('QualityManager');
    if (!canCreateOrEdit) {
      res.status(403).json({ error: 'Read-only roles cannot edit audits' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const { supplierId, auditTypeId, auditDate, auditor, summary, scope, notes, projectHistoryId } = req.body as {
      supplierId?: string;
      auditTypeId?: string | null;
      auditDate?: string;
      auditor?: string | null;
      summary?: string | null;
      scope?: string | null;
      notes?: string | null;
      projectHistoryId?: string | null;
    };
    if (!supplierId || !auditDate) {
      res.status(400).json({ error: 'supplierId and auditDate are required' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    let projectHistoryIdCreate: string | null = null;
    if (typeof projectHistoryId === 'string' && projectHistoryId.trim()) {
      const pid = projectHistoryId.trim();
      const proj = await prisma.clientHistory.findUnique({
        where: { id: pid },
        select: { supplierId: true },
      });
      if (!proj) {
        res.status(400).json({ error: 'projectHistoryId is invalid' });
        return;
      }
      if (proj.supplierId && proj.supplierId !== supplierId) {
        res.status(400).json({ error: 'Project supplier must match audit supplier' });
        return;
      }
      projectHistoryIdCreate = pid;
    }
    const auditorTrimmed = auditor ? String(auditor).trim() : null;
    const auditorAllowed = await sentinelEmployeeContractorDisplayLabelsMatch(auditorTrimmed);
    if (!auditorAllowed) {
      res.status(400).json({
        error:
          'Auditor must be an active employee or contractor on the Sentinel Supplier Assurance roster.',
      });
      return;
    }
    const code = await getNextCode('AUD');
    // Parse as calendar date (YYYY-MM-DD) using UTC noon so timezone does not shift the day
    const dateOnly = new Date(auditDate.trim().slice(0, 10) + 'T12:00:00.000Z');
    const audit = await prisma.audit.create({
      data: {
        code,
        supplierId,
        projectHistoryId: projectHistoryIdCreate,
        auditTypeId: auditTypeId || null,
        auditDate: dateOnly,
        auditor: auditorTrimmed,
        summary: summary ? String(summary).trim() : null,
        scope: scope ? String(scope).trim() : null,
        notes: notes || null,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        auditType: { select: { id: true, code: true, name: true } },
        projectHistory: { select: { id: true, projectCode: true } },
        findings: { select: { id: true, code: true } },
      },
    });
    res.status(201).json({
      ...audit,
      derivedStatus: getDerivedStatus(audit.result, audit.auditDate),
      findingCodes: audit.findings.map((f) => f.code),
    });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.audit.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }
    const { auditDate, notes, result, auditTypeId, auditor, summary, scope, projectHistoryId } = req.body as {
      auditDate?: string;
      notes?: string | null;
      result?: AuditResult | null;
      auditTypeId?: string | null;
      auditor?: string | null;
      summary?: string | null;
      scope?: string | null;
      projectHistoryId?: string | null;
    };

    const isAdminOrQe =
      req.user.roleNames.includes('Admin') ||
      req.user.roleNames.includes('QualityEngineer') ||
      req.user.roleNames.includes('QualityManager');
    if (!isAdminOrQe) {
      // Auditors are allowed to submit only `result` for audits they are assigned to.
      const triesToEditOtherFields =
        auditDate !== undefined ||
        notes !== undefined ||
        summary !== undefined ||
        scope !== undefined ||
        auditTypeId !== undefined ||
        auditor !== undefined ||
        projectHistoryId !== undefined;
      if (triesToEditOtherFields) {
        res.status(403).json({ error: 'Read-only roles cannot edit audits' });
        return;
      }
    }
    const canSetResult =
      req.user.roleNames.includes('Admin') ||
      req.user.roleNames.includes('QualityEngineer') ||
      req.user.roleNames.includes('QualityManager') ||
      (req.user.roleNames.includes('Auditor') && isAssignedAuditorForAudit(existing.auditor, req.user));
    const update: {
      auditDate?: Date;
      notes?: string | null;
      summary?: string | null;
      scope?: string | null;
      result?: AuditResult | null;
      auditTypeId?: string | null;
      auditor?: string | null;
      projectHistoryId?: string | null;
    } = {};
    if (auditDate !== undefined) {
      update.auditDate = new Date(auditDate.trim().slice(0, 10) + 'T12:00:00.000Z');
    }
    if (notes !== undefined) update.notes = notes;
    if (summary !== undefined) update.summary = summary ? String(summary).trim() : null;
    if (scope !== undefined) update.scope = scope ? String(scope).trim() : null;
    if (auditor !== undefined) {
      const nextAuditor = auditor ? String(auditor).trim() : null;
      const sameAsExisting =
        nextAuditor != null &&
        existing.auditor != null &&
        normalizeIdentity(nextAuditor) === normalizeIdentity(existing.auditor);
      const auditorAllowed =
        sameAsExisting || (await sentinelEmployeeContractorDisplayLabelsMatch(nextAuditor));
      if (!auditorAllowed) {
        res.status(400).json({
          error:
            'Auditor must be an active employee or contractor on the Sentinel Supplier Assurance roster.',
        });
        return;
      }
      update.auditor = nextAuditor;
    }
    if (result !== undefined) {
      if (!canSetResult) {
        res.status(403).json({ error: 'Only assigned Auditor, Admin, or Quality Engineer can set audit result' });
        return;
      }
      if (result !== null && result !== 'Passed' && result !== 'Failed' && result !== 'Cancelled') {
        res.status(400).json({ error: 'result must be Passed, Failed, or Cancelled' });
        return;
      }
      update.result = result;
    }
    if (auditTypeId !== undefined) {
      if (auditTypeId === null || auditTypeId === '') {
        update.auditTypeId = null;
      } else {
        const typ = await prisma.auditType.findUnique({ where: { id: auditTypeId } });
        if (!typ) {
          res.status(400).json({ error: 'Invalid audit type id' });
          return;
        }
        update.auditTypeId = auditTypeId;
      }
    }
    if (projectHistoryId !== undefined) {
      if (!isAdminOrQe) {
        res.status(403).json({ error: 'Only Admin, QE, or QM can change project link' });
        return;
      }
      if (projectHistoryId === null || projectHistoryId === '') {
        update.projectHistoryId = null;
      } else {
        const proj = await prisma.clientHistory.findUnique({
          where: { id: projectHistoryId },
          select: { supplierId: true },
        });
        if (!proj) {
          res.status(400).json({ error: 'projectHistoryId is invalid' });
          return;
        }
        if (proj.supplierId && proj.supplierId !== existing.supplierId) {
          res.status(400).json({ error: 'Project supplier must match audit supplier' });
          return;
        }
        update.projectHistoryId = projectHistoryId;
      }
    }
    const audit = await prisma.audit.update({
      where: { id: req.params.id },
      data: update,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        auditType: { select: { id: true, code: true, name: true } },
        projectHistory: { select: { id: true, projectCode: true } },
        findings: { select: { id: true, code: true } },
        records: { select: { id: true, name: true, filePath: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    res.json({
      ...audit,
      derivedStatus: getDerivedStatus(audit.result, audit.auditDate),
      findingCodes: audit.findings.map((f) => f.code),
      records: audit.records.map((r) => ({ id: r.id, name: r.name, hasFile: Boolean(r.filePath) })),
    });
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
      res.status(403).json({ error: 'Only Admin can delete an audit' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.audit.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Audit not found' });
      return;
    }
    await prisma.audit.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
