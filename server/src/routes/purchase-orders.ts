/**
 * Global Vendors — Purchase Orders API: list, create, attachments.
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

// Defensive helper so the route fails with a clear error if Prisma client
// hasn't been regenerated for the new PurchaseOrder models yet.
function ensurePurchaseOrderClient() {
  const anyPrisma = prisma as any;
  if (!anyPrisma.purchaseOrder || !anyPrisma.purchaseOrderAttachment) {
    throw new Error(
      'PurchaseOrder models are not available in the Prisma client. Make sure Prisma generate/migrations have been run for the current schema.'
    );
  }
  return anyPrisma;
}

router.get(
  '/',
  requirePageAccess('GlobalSupplyPurchaseOrders'),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const client = ensurePurchaseOrderClient();
    const list = await client.purchaseOrder.findMany({
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
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    res.json(list);
  })
);

router.post(
  '/',
  requirePageAccess('GlobalSupplyPurchaseOrders'),
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
    const quantityKgRaw = req.body?.quantityKg;
    const pricePerKgRaw = req.body?.pricePerKg;
    const quantityKg =
      quantityKgRaw === null || quantityKgRaw === undefined || quantityKgRaw === ''
        ? null
        : Number(quantityKgRaw);
    const pricePerKg =
      pricePerKgRaw === null || pricePerKgRaw === undefined || pricePerKgRaw === ''
        ? null
        : Number(pricePerKgRaw);
    const status =
      typeof req.body?.status === 'string'
        ? req.body.status.trim() || null
        : null;
    const notes =
      typeof req.body?.notes === 'string'
        ? req.body.notes.trim() || null
        : null;

    if (!buyerName) {
      res.status(400).json({ error: 'buyerName is required' });
      return;
    }

    if ((quantityKgRaw !== undefined && quantityKgRaw !== null && !Number.isFinite(quantityKg)) ||
        (pricePerKgRaw !== undefined && pricePerKgRaw !== null && !Number.isFinite(pricePerKg))) {
      res.status(400).json({ error: 'quantityKg and pricePerKg must be numeric when provided' });
      return;
    }

    const totalAmount =
      quantityKg != null && pricePerKg != null
        ? quantityKg * pricePerKg
        : null;

    const code = await getNextCode('PO');

    const client = ensurePurchaseOrderClient();
    const created = await client.purchaseOrder.create({
      data: {
        code,
        farmId,
        buyerName,
        buyerEmail,
        crop,
        quantityKg,
        pricePerKg,
        totalAmount,
        status,
        notes,
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
        attachments: true,
      },
    });

    res.status(201).json(created);
  })
);

router.post(
  '/:id/attachments',
  requirePageAccess('GlobalSupplyPurchaseOrders'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const kind =
      typeof req.body?.kind === 'string' ? req.body.kind.trim() : '';
    if (!kind) {
      res.status(400).json({ error: 'kind is required' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    const client = ensurePurchaseOrderClient();
    const po = await client.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, code: true },
    });
    if (!po) {
      res.status(404).json({ error: 'Purchase order not found' });
      return;
    }

    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileMime: string | null = null;

    try {
      const uploaded = await uploadRecordToStorage({
        supplierId: null,
        recordId: po.id,
        fileName: req.file.originalname || 'attachment',
        fileMime: req.file.mimetype || null,
        fileBuffer: req.file.buffer,
      });
      filePath = uploaded.storagePath;
      fileName = (req.file.originalname || null)?.slice(0, 255) || null;
      fileMime = (req.file.mimetype || null)?.slice(0, 255) || null;
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Could not save attachment',
      });
      return;
    }

    const attachment = await client.purchaseOrderAttachment.create({
      data: {
        purchaseOrderId: po.id,
        kind,
        filePath,
        fileName,
        fileMime,
      },
    });

    res.status(201).json(attachment);
  })
);

export default router;

