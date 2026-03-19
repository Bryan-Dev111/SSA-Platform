/**
 * Records: list (scoped); Supplier (and Admin/QE/Auditor/Buyer per scope) upload metadata + optional file (base64).
 */
import { Router, Request, Response } from 'express';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { RecordSource, RecordStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'records');
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function safeUploadFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return base || 'attachment';
}

router.use(authMiddleware);
router.use(requirePageAccess('Records'));

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
      const comma = fileBase64Raw.indexOf(',');
      const b64 = comma >= 0 ? fileBase64Raw.slice(comma + 1) : fileBase64Raw;
      let buf: Buffer;
      try {
        buf = Buffer.from(b64, 'base64');
      } catch {
        res.status(400).json({ error: 'Invalid file encoding' });
        return;
      }
      if (!buf.length) {
        res.status(400).json({ error: 'Empty file' });
        return;
      }
      if (buf.length > MAX_FILE_BYTES) {
        res.status(400).json({ error: 'File too large (max 8MB)' });
        return;
      }
      try {
        await mkdir(UPLOAD_DIR, { recursive: true });
        const unique = `${Date.now()}-${randomBytes(8).toString('hex')}-${safeUploadFileName(uploadFileName)}`;
        const dest = path.join(UPLOAD_DIR, unique);
        await writeFile(dest, buf);
        filePath = path.posix.join('records', unique);
      } catch (err) {
        console.error('Record file save failed', err);
        res.status(500).json({ error: 'Could not save file' });
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
