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
      auditTypeId: a.auditTypeId,
      auditType: a.auditType,
      auditDate: a.auditDate,
      auditor: a.auditor,
      result: a.result,
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
        findings: { select: { id: true, code: true, status: true, severity: true } },
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
    res.json({
      ...audit,
      derivedStatus: getDerivedStatus(audit.result, audit.auditDate),
      findingCodes: audit.findings.map((f) => f.code),
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
    const canCreateOrEdit = req.user.roleNames.includes('Admin') || req.user.roleNames.includes('QualityEngineer');
    if (!canCreateOrEdit) {
      res.status(403).json({ error: 'Viewer and other roles are read-only for audits' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const { supplierId, auditTypeId, auditDate, auditor, notes } = req.body as {
      supplierId?: string;
      auditTypeId?: string | null;
      auditDate?: string;
      auditor?: string | null;
      notes?: string | null;
    };
    if (!supplierId || !auditDate) {
      res.status(400).json({ error: 'supplierId and auditDate are required' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    const code = await getNextCode('AUD');
    // Parse as calendar date (YYYY-MM-DD) using UTC noon so timezone does not shift the day
    const dateOnly = new Date(auditDate.trim().slice(0, 10) + 'T12:00:00.000Z');
    const audit = await prisma.audit.create({
      data: {
        code,
        supplierId,
        auditTypeId: auditTypeId || null,
        auditDate: dateOnly,
        auditor: auditor ? String(auditor).trim() : null,
        notes: notes || null,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        auditType: { select: { id: true, code: true, name: true } },
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
    const canCreateOrEdit = req.user.roleNames.includes('Admin') || req.user.roleNames.includes('QualityEngineer');
    if (!canCreateOrEdit) {
      res.status(403).json({ error: 'Viewer and other roles are read-only for audits' });
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
    const { auditDate, notes, result, auditTypeId, auditor } = req.body as {
      auditDate?: string;
      notes?: string | null;
      result?: AuditResult | null;
      auditTypeId?: string | null;
      auditor?: string | null;
    };
    const canSetResult =
      req.user.roleNames.includes('Admin') ||
      req.user.roleNames.includes('QualityEngineer') ||
      (req.user.roleNames.includes('Auditor') && isAssignedAuditorForAudit(existing.auditor, req.user));
    const update: {
      auditDate?: Date;
      notes?: string | null;
      result?: AuditResult | null;
      auditTypeId?: string | null;
      auditor?: string | null;
    } = {};
    if (auditDate !== undefined) {
      update.auditDate = new Date(auditDate.trim().slice(0, 10) + 'T12:00:00.000Z');
    }
    if (notes !== undefined) update.notes = notes;
    if (auditor !== undefined) update.auditor = auditor ? String(auditor).trim() : null;
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
    const audit = await prisma.audit.update({
      where: { id: req.params.id },
      data: update,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        auditType: { select: { id: true, code: true, name: true } },
        findings: { select: { id: true, code: true } },
      },
    });
    res.json({
      ...audit,
      derivedStatus: getDerivedStatus(audit.result, audit.auditDate),
      findingCodes: audit.findings.map((f) => f.code),
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
