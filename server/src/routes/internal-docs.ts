/**
 * Day 10: Internal Management — contracts, SOW, etc. Admin only.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { saveBase64ToUploads, resolveStoredUploadPath, fileExists, MAX_FILE_BYTES } from '../lib/uploads';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('InternalManagement'));
router.use(requireRole(['Admin', 'QualityManager']));

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.internalDoc.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json(list);
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const doc = await prisma.internalDoc.findUnique({ where: { id } });
    if (!doc || !doc.filePath) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const abs = resolveStoredUploadPath(doc.filePath);
    if (!abs || !(await fileExists(abs))) {
      res.status(404).json({ error: 'File missing' });
      return;
    }
    res.download(abs, doc.name.replace(/[/\\]/g, '_'), (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Download failed' });
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() || null : null;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() || null : null;
    const fileBase64Raw =
      typeof req.body?.fileBase64 === 'string' && req.body.fileBase64.trim() !== ''
        ? req.body.fileBase64.trim()
        : null;
    const uploadFileName = typeof req.body?.fileName === 'string' ? req.body.fileName : 'file';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    let filePath: string | null = null;
    if (fileBase64Raw) {
      try {
        filePath = await saveBase64ToUploads('internal', fileBase64Raw, uploadFileName, MAX_FILE_BYTES);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save file';
        res.status(msg.includes('large') ? 400 : 500).json({ error: msg });
        return;
      }
    }
    const created = await prisma.internalDoc.create({
      data: { name, category, note, filePath },
    });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.internalDoc.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const data: { name?: string; category?: string | null; note?: string | null; filePath?: string | null } = {};
    if (typeof req.body?.name === 'string') data.name = req.body.name.trim();
    if (typeof req.body?.category === 'string') data.category = req.body.category.trim() || null;
    if (typeof req.body?.note === 'string') data.note = req.body.note.trim() || null;
    const fileBase64Raw =
      typeof req.body?.fileBase64 === 'string' && req.body.fileBase64.trim() !== ''
        ? req.body.fileBase64.trim()
        : null;
    if (fileBase64Raw) {
      const uploadFileName = typeof req.body?.fileName === 'string' ? req.body.fileName : 'file';
      try {
        data.filePath = await saveBase64ToUploads('internal', fileBase64Raw, uploadFileName, MAX_FILE_BYTES);
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
    const updated = await prisma.internalDoc.update({ where: { id }, data });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    try {
      await prisma.internalDoc.delete({ where: { id } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  })
);

export default router;
