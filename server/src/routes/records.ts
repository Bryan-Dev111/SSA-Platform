/**
 * Records: list (scoped); upload; Admin/QE approve/reject; download file (Day 10).
 */
import { Router, Request, Response } from 'express';
import { RecordSource, RecordStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { saveBase64ToUploads, resolveStoredUploadPath, fileExists, MAX_FILE_BYTES } from '../lib/uploads';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Records'));

function canReviewRecord(roleNames: string[]): boolean {
  return roleNames.includes('Admin') || roleNames.includes('QualityEngineer');
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
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
    const list = await prisma.record.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = req.params.id;
    const rec = await prisma.record.findUnique({ where: { id } });
    if (!rec || !rec.filePath) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && !allowedIds.includes(rec.supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    const abs = resolveStoredUploadPath(rec.filePath);
    if (!abs || !(await fileExists(abs))) {
      res.status(404).json({ error: 'File missing' });
      return;
    }
    res.download(abs, rec.name.replace(/[/\\]/g, '_'), (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Download failed' });
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
    if (!canReviewRecord(req.user.roleNames)) {
      res.status(403).json({ error: 'Only Admin or Quality Engineer can approve or reject records' });
      return;
    }
    const id = req.params.id;
    const statusRaw = req.body?.status;
    if (statusRaw !== 'Approved' && statusRaw !== 'Rejected') {
      res.status(400).json({ error: 'status must be Approved or Rejected' });
      return;
    }
    const existing = await prisma.record.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    const status = statusRaw as RecordStatus;
    const updated = await prisma.record.update({
      where: { id },
      data: { status },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, email: true, name: true } },
      },
    });
    res.json(updated);
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
    const internalOrSupplier = req.body?.internalOrSupplier === 'internal' ? 'internal' : 'supplier';
    const fileBase64Raw =
      typeof req.body?.fileBase64 === 'string' && req.body.fileBase64.trim() !== ''
        ? req.body.fileBase64.trim()
        : null;
    const uploadFileName = typeof req.body?.fileName === 'string' ? req.body.fileName : '';
    const isSupplierUser = req.user.roleNames.includes('Supplier');

    let filePath: string | null = null;
    if (!isSupplierUser && typeof req.body?.filePath === 'string') {
      const p = req.body.filePath.trim();
      filePath = p || null;
    }

    if (!name || !supplierId) {
      res.status(400).json({ error: 'name and supplierId are required' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    if (isSupplierUser) {
      const own = await prisma.supplier.findFirst({ where: { userId: req.user.id }, select: { id: true } });
      if (!own || own.id !== supplierId) {
        res.status(403).json({ error: 'Suppliers can only upload records for their own supplier' });
        return;
      }
      if (internalOrSupplier !== 'supplier') {
        res.status(403).json({ error: 'Suppliers may only upload supplier-sourced records' });
        return;
      }
    }

    if (fileBase64Raw) {
      try {
        filePath = await saveBase64ToUploads('records', fileBase64Raw, uploadFileName, MAX_FILE_BYTES);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save file';
        res.status(msg.includes('large') ? 400 : 500).json({ error: msg });
        return;
      }
    }

    const record = await prisma.record.create({
      data: {
        name,
        supplierId,
        internalOrSupplier: internalOrSupplier as RecordSource,
        status: RecordStatus.PENDING,
        filePath,
        uploadedById: req.user.id,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        uploadedBy: { select: { id: true, email: true, name: true } },
      },
    });
    res.status(201).json(record);
  })
);

export default router;
