/**
 * Global Vendors — Samples API: list + create + update with optional notes file.
 */
import type { NextFunction } from 'express';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';
import { uploadRecordToStorage } from '../lib/supabaseStorage';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

/** Multipart only when replacing notes file; JSON body otherwise. */
function conditionalNotesFileUpload(req: Request, res: Response, next: NextFunction): void {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    upload.single('notesFile')(req, res, next);
    return;
  }
  next();
}

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
    const expenseCode = await getNextCode('EXP');

    let sampleCountry: string | null = null;
    if (farmId) {
      const farm = await prisma.farm.findUnique({
        where: { id: farmId },
        select: { country: true },
      });
      sampleCountry = farm?.country?.trim() || null;
    }

    const created = await prisma.$transaction(async (tx) => {
      const sample = await tx.sample.create({
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

      // Every sample shipment creates an "Open" Global Vendors expense placeholder.
      await tx.expense.create({
        data: {
          code: expenseCode,
          status: 'Open',
          type: 'Sample',
          description: code,
          project: 'Global Vendors',
          amount: 0,
          expenseDate: sentDate ?? new Date(),
          paymentMethod: '',
          country: sampleCountry,
        },
      });

      return sample;
    });

    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requirePageAccess('GlobalSupplySamples'),
  conditionalNotesFileUpload,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.sample.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Sample not found' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const data: Prisma.SampleUncheckedUpdateInput = {};

    if ('buyerName' in body && typeof body.buyerName === 'string') {
      const t = body.buyerName.trim();
      if (!t) {
        res.status(400).json({ error: 'buyerName cannot be empty' });
        return;
      }
      data.buyerName = t;
    }

    if ('buyerEmail' in body) {
      data.buyerEmail =
        typeof body.buyerEmail === 'string' ? body.buyerEmail.trim() || null : null;
    }

    if ('crop' in body) {
      data.crop = typeof body.crop === 'string' ? body.crop.trim() || null : null;
    }

    if ('shipmentAddress' in body) {
      data.shipmentAddress =
        typeof body.shipmentAddress === 'string'
          ? body.shipmentAddress.trim() || null
          : null;
    }

    if ('notes' in body) {
      data.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    }

    if ('farmId' in body) {
      const raw = body.farmId;
      if (raw === null || raw === undefined || raw === '') {
        data.farmId = null;
      } else {
        const fid = String(raw).trim();
        const farm = await prisma.farm.findUnique({ where: { id: fid }, select: { id: true } });
        if (!farm) {
          res.status(400).json({ error: 'Farm not found' });
          return;
        }
        data.farmId = fid;
      }
    }

    if ('sentDate' in body && body.sentDate !== null && body.sentDate !== undefined && body.sentDate !== '') {
      const sentDateRaw =
        typeof body.sentDate === 'string' ? body.sentDate.trim() : String(body.sentDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sentDateRaw)) {
        res.status(400).json({ error: 'sentDate must be YYYY-MM-DD' });
        return;
      }
      const parsed = new Date(`${sentDateRaw}T12:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ error: 'Invalid sentDate' });
        return;
      }
      data.sentDate = parsed;
    }

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
        data.notesFilePath = uploaded.storagePath;
        data.notesFileName = (req.file.originalname || null)?.slice(0, 255) || null;
        data.notesFileMime = (req.file.mimetype || null)?.slice(0, 255) || null;
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : 'Could not save notes file',
        });
        return;
      }
    }

    const keys = Object.keys(data as object);
    if (keys.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const updated = await prisma.sample.update({
      where: { id },
      data,
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

    res.json(updated);
  })
);

export default router;

