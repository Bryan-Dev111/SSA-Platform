/**
 * Global Vendors — Samples API: list + create with optional notes file.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';
import { uploadRecordToStorage } from '../lib/supabaseStorage';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

router.get(
  '/',
  requirePageAccess('GlobalSupplySamples'),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.sample.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        farm: {
          select: {
            id: true,
            code: true,
            farmName: true,
            country: true,
          },
        },
      },
    });
    res.json(list);
  })
);

router.post(
  '/',
  requirePageAccess('GlobalSupplySamples'),
  upload.single('notesFile'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmIdRaw = req.body?.farmId;
    const farmId =
      farmIdRaw === null || farmIdRaw === undefined || farmIdRaw === ''
        ? null
        : String(farmIdRaw);
    const buyerName =
      typeof req.body?.buyerName === 'string' ? req.body.buyerName.trim() : '';
    const buyerEmail =
      typeof req.body?.buyerEmail === 'string'
        ? req.body.buyerEmail.trim() || null
        : null;
    const crop =
      typeof req.body?.crop === 'string' ? req.body.crop.trim() || null : null;
    const shipmentAddress =
      typeof req.body?.shipmentAddress === 'string'
        ? req.body.shipmentAddress.trim() || null
        : null;
    const notes =
      typeof req.body?.notes === 'string'
        ? req.body.notes.trim() || null
        : null;

    const sentDateRaw =
      typeof req.body?.sentDate === 'string' ? req.body.sentDate.trim() : '';
    let sentDate: Date | undefined;
    if (!sentDateRaw || !/^\d{4}-\d{2}-\d{2}$/.test(sentDateRaw)) {
      res.status(400).json({ error: 'sentDate is required (YYYY-MM-DD)' });
      return;
    }
    const parsed = new Date(`${sentDateRaw}T12:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      res.status(400).json({ error: 'Invalid sentDate' });
      return;
    }
    sentDate = parsed;

    if (!buyerName) {
      res.status(400).json({ error: 'buyerName is required' });
      return;
    }

    let notesFilePath: string | null = null;
    let notesFileName: string | null = null;
    let notesFileMime: string | null = null;

    if (req.file) {
      try {
        const tmpId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const uploaded = await uploadRecordToStorage({
          supplierId: null,
          recordId: tmpId,
          fileName: req.file.originalname || 'notes-file',
          fileMime: req.file.mimetype || null,
          fileBuffer: req.file.buffer,
        });
        notesFilePath = uploaded.storagePath;
        notesFileName =
          (req.file.originalname || null)?.slice(0, 255) || null;
        notesFileMime = (req.file.mimetype || null)?.slice(0, 255) || null;
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Could not save notes file',
        });
        return;
      }
    }

    const code = await getNextCode('SAMP');

    const created = await prisma.sample.create({
      data: {
        code,
        farmId,
        buyerName,
        buyerEmail,
        crop,
        shipmentAddress,
        notes,
        sentDate,
        notesFilePath,
        notesFileName,
        notesFileMime,
      },
      include: {
        farm: {
          select: {
            id: true,
            code: true,
            farmName: true,
            country: true,
          },
        },
      },
    });

    res.status(201).json(created);
  })
);

export default router;

