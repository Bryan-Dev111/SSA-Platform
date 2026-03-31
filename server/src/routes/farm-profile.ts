/**
 * Global Vendors — Farmer Profile & Processing content + images.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { uploadRecordToStorage, createRecordDownloadSignedUrl } from '../lib/supabaseStorage';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

function normalizeSection(raw: unknown): 'Profile' | 'Processing' {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (v.toLowerCase() === 'processing') return 'Processing';
  return 'Profile';
}

router.get(
  '/:farmId/content',
  requirePageAccess('GlobalSupplyFarmers'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmId = String(req.params.farmId ?? '').trim();
    if (!farmId) {
      res.status(400).json({ error: 'farmId is required' });
      return;
    }
    const section = normalizeSection(req.query.section);
    const content = await prisma.farmProfileContent.findUnique({
      where: {
        farmId_section: {
          farmId,
          section,
        },
      },
    });
    res.json(
      content ?? {
        id: null,
        farmId,
        section,
        body: '',
      }
    );
  })
);

router.put(
  '/:farmId/content',
  requirePageAccess('GlobalSupplyFarmers'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmId = String(req.params.farmId ?? '').trim();
    if (!farmId) {
      res.status(400).json({ error: 'farmId is required' });
      return;
    }
    const section = normalizeSection(req.body?.section);
    const body = typeof req.body?.body === 'string' ? req.body.body : '';

    const exists = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true } });
    if (!exists) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }

    const saved = await prisma.farmProfileContent.upsert({
      where: {
        farmId_section: {
          farmId,
          section,
        },
      },
      update: { body },
      create: {
        farmId,
        section,
        body,
      },
    });

    res.json(saved);
  })
);

router.get(
  '/:farmId/images',
  requirePageAccess('GlobalSupplyFarmers'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmId = String(req.params.farmId ?? '').trim();
    if (!farmId) {
      res.status(400).json({ error: 'farmId is required' });
      return;
    }
    const section = normalizeSection(req.query.section);
    const images = await prisma.farmProfileImage.findMany({
      where: { farmId, section },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        section: true,
        fileName: true,
      },
    });
    res.json(images);
  })
);

router.post(
  '/:farmId/images',
  requirePageAccess('GlobalSupplyFarmers'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmId = String(req.params.farmId ?? '').trim();
    if (!farmId) {
      res.status(400).json({ error: 'farmId is required' });
      return;
    }
    const section = normalizeSection(req.body?.section);
    const exists = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true } });
    if (!exists) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileMime: string | null = null;

    try {
      const uploaded = await uploadRecordToStorage({
        supplierId: null,
        recordId: farmId,
        fileName: req.file.originalname || 'profile-image',
        fileMime: req.file.mimetype || null,
        fileBuffer: req.file.buffer,
      });
      filePath = uploaded.storagePath;
      fileName = (req.file.originalname || null)?.slice(0, 255) || null;
      fileMime = (req.file.mimetype || null)?.slice(0, 255) || null;
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Could not save image',
      });
      return;
    }

    const maxSort = await prisma.farmProfileImage.aggregate({
      where: { farmId, section },
      _max: { sortOrder: true },
    });

    const created = await prisma.farmProfileImage.create({
      data: {
        farmId,
        section,
        filePath,
        fileName,
        fileMime,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    res.status(201).json(created);
  })
);

/**
 * Public image download: returns a short-lived signed URL redirected from Supabase.
 * Kept outside of auth so <img> tags can load without Authorization headers.
 */
router.get(
  '/images/:imageId/download',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const imageId = String(req.params.imageId ?? '').trim();
    if (!imageId) {
      res.status(400).json({ error: 'imageId is required' });
      return;
    }
    const img = await prisma.farmProfileImage.findUnique({
      where: { id: imageId },
      select: { filePath: true },
    });
    if (!img || !img.filePath) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }
    const signedUrl = await createRecordDownloadSignedUrl(img.filePath);
    res.redirect(signedUrl);
  })
);

export default router;

