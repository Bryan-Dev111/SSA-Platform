/**
 * Day 10: Documents (policies, SOPs, etc.) — QE/Admin manage; all Documents roles read.
 */
import { Router, Request, Response } from 'express';
import { DocumentType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { saveBase64ToUploads, resolveStoredUploadPath, fileExists, MAX_FILE_BYTES } from '../lib/uploads';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Documents'));

const canMutate = requireRole(['Admin', 'QualityEngineer']);

const DOCUMENT_TYPES: DocumentType[] = [
  'Procedure',
  'Policy',
  'StandardOperatingProcedure',
  'WorkInstruction',
  'Form',
];

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
    const uploadFileName = typeof req.body?.fileName === 'string' ? req.body.fileName : 'document';
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
    let filePath: string | null = null;
    if (fileBase64Raw) {
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
    const fileBase64Raw =
      typeof req.body?.fileBase64 === 'string' && req.body.fileBase64.trim() !== ''
        ? req.body.fileBase64.trim()
        : null;
    if (fileBase64Raw) {
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
