/**
 * Records: list (scoped); upload; Admin/QE approve/reject/override; download.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { RecordSource, RecordStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { saveBase64ToUploads, resolveStoredUploadPath, fileExists, MAX_FILE_BYTES } from '../lib/uploads';
import { MAX_RECORD_FILE_BYTES, createRecordDownloadSignedUrl, uploadRecordToStorage } from '../lib/supabaseStorage';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RECORD_FILE_BYTES } });

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
    if (supplierId === 'none') {
      if (allowedIds !== null) {
        res.json([]);
        return;
      }
      const list = await prisma.record.findMany({
        where: { supplierId: null as any },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          uploadedBy: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(list);
      return;
    } else if (supplierId) {
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
    if (!rec || (!rec.fileData && !rec.filePath)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && (!rec.supplierId || !allowedIds.includes(rec.supplierId))) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    if (rec.fileData) {
      const outName = (rec.fileName || rec.name || 'record-file').replace(/[/\\]/g, '_');
      if (rec.fileMime) res.setHeader('Content-Type', rec.fileMime);
      res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
      res.send(rec.fileData);
      return;
    }
    if (rec.filePath) {
      try {
        const signedUrl = await createRecordDownloadSignedUrl(rec.filePath);
        const upstream = await fetch(signedUrl);
        if (!upstream.ok) {
          res.status(404).json({ error: 'File missing' });
          return;
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        const outName = (rec.fileName || rec.name || 'record-file').replace(/[/\\]/g, '_');
        const mime = rec.fileMime || upstream.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
        res.send(buf);
        return;
      } catch {
        // fallback to legacy local file flow below
      }
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
    if (allowedIds !== null && (!existing.supplierId || !allowedIds.includes(existing.supplierId))) {
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
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const supplierIdRaw = req.body?.supplierId;
    const supplierId =
      supplierIdRaw === null || supplierIdRaw === undefined || supplierIdRaw === ''
        ? null
        : String(supplierIdRaw);
    const internalOrSupplier = req.body?.internalOrSupplier === 'internal' ? 'internal' : 'supplier';
    const fileBase64Raw =
      typeof req.body?.fileBase64 === 'string' && req.body.fileBase64.trim() !== ''
        ? req.body.fileBase64.trim()
        : null;
    const uploadFileName = req.file?.originalname || (typeof req.body?.fileName === 'string' ? req.body.fileName : '');
    const uploadFileMime = req.file?.mimetype || (typeof req.body?.fileMime === 'string' ? req.body.fileMime : '');
    const isSupplierUser = req.user.roleNames.includes('Supplier');

    let filePath: string | null = null;
    let fileData: Buffer | null = null;
    let fileName: string | null = null;
    let fileMime: string | null = null;
    if (!isSupplierUser && typeof req.body?.filePath === 'string') {
      const p = req.body.filePath.trim();
      filePath = p || null;
    }

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (isSupplierUser && !supplierId) {
      res.status(400).json({ error: 'supplierId is required for Supplier role uploads' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (supplierId && allowedIds !== null && !allowedIds.includes(supplierId)) {
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

    if (req.file) {
      try {
        const tmpId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const uploaded = await uploadRecordToStorage({
          supplierId,
          recordId: tmpId,
          fileName: uploadFileName || 'record-file',
          fileMime: uploadFileMime || null,
          fileBuffer: req.file.buffer,
        });
        filePath = uploaded.storagePath;
        fileName = (uploadFileName || null)?.slice(0, 255) || null;
        fileMime = (uploadFileMime || null)?.slice(0, 255) || null;
        fileData = null;
      } catch (e) {
        // Safe fallback when storage is unavailable: keep DB-backed bytes.
        fileData = req.file.buffer;
        fileName = (uploadFileName || null)?.slice(0, 255) || null;
        fileMime = (uploadFileMime || null)?.slice(0, 255) || null;
        filePath = null;
      }
    } else if (fileBase64Raw) {
      try {
        const comma = fileBase64Raw.indexOf(',');
        const maybePrefix = comma >= 0 ? fileBase64Raw.slice(0, comma) : '';
        const b64 = comma >= 0 ? fileBase64Raw.slice(comma + 1) : fileBase64Raw;
        const buf = Buffer.from(b64, 'base64');
        const MAX_FILE_BYTES = 100 * 1024 * 1024;
        if (!buf.length) throw new Error('Empty file');
        if (buf.length > MAX_FILE_BYTES) throw new Error(`File too large (max ${MAX_FILE_BYTES} bytes)`);
        fileData = buf;
        fileName = uploadFileName ? uploadFileName.slice(0, 255) : null;
        const prefixMime = maybePrefix.startsWith('data:') ? maybePrefix.slice(5).split(';')[0] : '';
        fileMime = (uploadFileMime || prefixMime || '').slice(0, 255) || null;
        // Legacy compatibility fallback.
        filePath = await saveBase64ToUploads('records', fileBase64Raw, uploadFileName || 'record-file', MAX_FILE_BYTES);
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
        fileName,
        fileMime,
        fileData,
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
