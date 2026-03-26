/**
 * Day 10: Documents (policies, SOPs, etc.) — QE/Admin manage; all Documents roles read.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { DocumentType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { saveBase64ToUploads, resolveStoredUploadPath, fileExists, MAX_FILE_BYTES } from '../lib/uploads';
import { MAX_RECORD_FILE_BYTES, createRecordDownloadSignedUrl, uploadDocumentToStorage } from '../lib/supabaseStorage';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RECORD_FILE_BYTES } });

router.use(authMiddleware);
router.use(requirePageAccess('Documents'));

const canMutate = requireRole(['Admin', 'QualityEngineer', 'QualityManager']);

const DOCUMENT_TYPES: DocumentType[] = [
  'Procedure',
  'Policy',
  'QualityManual',
  'Standard',
  'StandardOperatingProcedure',
  'WorkInstruction',
  'Form',
];

let ensuredDocumentTypeEnum = false;
async function ensureDocumentTypeEnumValues(): Promise<void> {
  if (ensuredDocumentTypeEnum) return;
  for (const value of DOCUMENT_TYPES) {
    await prisma.$executeRawUnsafe(
      `DO $$ BEGIN
         ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS '${value}';
       EXCEPTION
         WHEN duplicate_object THEN null;
       END $$;`
    );
  }
  ensuredDocumentTypeEnum = true;
}

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.document.findMany({ orderBy: { documentNumber: 'asc' } });
    res.json(list);
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc || !doc.filePath) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    try {
      const signedUrl = await createRecordDownloadSignedUrl(doc.filePath);
      const upstream = await fetch(signedUrl);
      if (upstream.ok) {
        const buf = Buffer.from(await upstream.arrayBuffer());
        const safeName = `${doc.documentNumber}-${doc.name}`.replace(/[/\\]/g, '_');
        const mime = upstream.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
        res.send(buf);
        return;
      }
    } catch {
      // fallback to legacy local-file path flow below
    }
    const abs = resolveStoredUploadPath(doc.filePath);
    if (!abs || !(await fileExists(abs))) {
      res.status(404).json({ error: 'File missing' });
      return;
    }
    const safeName = `${doc.documentNumber}-${doc.name}`.replace(/[/\\]/g, '_');
    res.download(abs, safeName, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Download failed' });
    });
  })
);

router.post(
  '/',
  canMutate,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const documentNumber = typeof req.body?.documentNumber === 'string' ? req.body.documentNumber.trim() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const revisionRaw =
      typeof req.body?.revision === 'string'
        ? req.body.revision
        : typeof req.body?.category === 'string'
          ? req.body.category
          : '';
    const category = revisionRaw.trim() || null;
    const documentType = req.body?.documentType as string;
    const fileBase64Raw =
      typeof req.body?.fileBase64 === 'string' && req.body.fileBase64.trim() !== ''
        ? req.body.fileBase64.trim()
        : null;
    const uploadFileName = req.file?.originalname || (typeof req.body?.fileName === 'string' ? req.body.fileName : 'document');
    const uploadFileMime = req.file?.mimetype || null;
    if (!documentNumber || !name) {
      res.status(400).json({ error: 'documentNumber and name are required' });
      return;
    }
    if (!DOCUMENT_TYPES.includes(documentType as DocumentType)) {
      res.status(400).json({
        error: `documentType must be one of: ${DOCUMENT_TYPES.join(', ')}`,
      });
      return;
    }
    await ensureDocumentTypeEnumValues();
    let filePath: string | null = null;
    if (req.file) {
      try {
        const tmpId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const uploaded = await uploadDocumentToStorage({
          documentId: tmpId,
          fileName: uploadFileName || 'document',
          fileMime: uploadFileMime,
          fileBuffer: req.file.buffer,
        });
        filePath = uploaded.storagePath;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save file';
        res.status(500).json({ error: msg });
        return;
      }
    } else if (fileBase64Raw) {
      try {
        filePath = await saveBase64ToUploads('documents', fileBase64Raw, uploadFileName, MAX_FILE_BYTES);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save file';
        res.status(msg.includes('large') ? 400 : 500).json({ error: msg });
        return;
      }
    }
    const created = await prisma.document.create({
      data: {
        documentNumber,
        name,
        category,
        documentType: documentType as DocumentType,
        filePath,
      },
    });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  canMutate,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const data: {
      documentNumber?: string;
      name?: string;
      category?: string | null;
      documentType?: DocumentType;
      filePath?: string | null;
    } = {};
    if (typeof req.body?.documentNumber === 'string') data.documentNumber = req.body.documentNumber.trim();
    if (typeof req.body?.name === 'string') data.name = req.body.name.trim();
    if (typeof req.body?.revision === 'string') data.category = req.body.revision.trim() || null;
    else if (typeof req.body?.category === 'string') data.category = req.body.category.trim() || null;
    if (req.body?.documentType !== undefined) {
      if (!DOCUMENT_TYPES.includes(req.body.documentType as DocumentType)) {
        res.status(400).json({ error: 'Invalid documentType' });
        return;
      }
      data.documentType = req.body.documentType as DocumentType;
    }
    await ensureDocumentTypeEnumValues();
    const fileBase64Raw =
      typeof req.body?.fileBase64 === 'string' && req.body.fileBase64.trim() !== ''
        ? req.body.fileBase64.trim()
        : null;
    if (req.file) {
      const uploadFileName = req.file.originalname || 'document';
      try {
        const tmpId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const uploaded = await uploadDocumentToStorage({
          documentId: tmpId,
          fileName: uploadFileName,
          fileMime: req.file.mimetype || null,
          fileBuffer: req.file.buffer,
        });
        data.filePath = uploaded.storagePath;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save file';
        res.status(500).json({ error: msg });
        return;
      }
    } else if (fileBase64Raw) {
      const uploadFileName = typeof req.body?.fileName === 'string' ? req.body.fileName : 'document';
      try {
        data.filePath = await saveBase64ToUploads('documents', fileBase64Raw, uploadFileName, MAX_FILE_BYTES);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save file';
        res.status(msg.includes('large') ? 400 : 500).json({ error: msg });
        return;
      }
    }
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    const updated = await prisma.document.update({ where: { id }, data });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  canMutate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    try {
      await prisma.document.delete({ where: { id } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  })
);

export default router;
