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
import { createRecordDownloadSignedUrl, uploadRecordToStorage } from '../lib/supabaseStorage';

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

function parsePoDate(val: unknown): Date | null {
  if (typeof val !== 'string' || !val.trim()) return null;
  return new Date(val.slice(0, 10) + 'T12:00:00.000Z');
}

const purchaseOrderListInclude = {
  farm: {
    select: {
      id: true,
      code: true,
      farmName: true,
      country: true,
    },
  },
  attachments: {
    orderBy: { createdAt: 'asc' as const },
  },
};

router.get(
  '/',
  requirePageAccess('GlobalSupplyPurchaseOrders'),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const client = ensurePurchaseOrderClient();
    const list = await client.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: purchaseOrderListInclude,
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

    const orderDateRaw = req.body?.orderDate;
    const estimatedFarmerDeliveryDateRaw = req.body?.estimatedFarmerDeliveryDate;
    const estimatedArrivalAtBuyerRaw = req.body?.estimatedArrivalAtBuyer;
    const destinationCountry =
      typeof req.body?.destinationCountry === 'string'
        ? req.body.destinationCountry.trim() || null
        : null;
    const portOfDischarge =
      typeof req.body?.portOfDischarge === 'string'
        ? req.body.portOfDischarge.trim() || null
        : null;

    if (!buyerName) {
      res.status(400).json({ error: 'buyerName is required' });
      return;
    }

    if (
      (quantityKgRaw !== undefined &&
        quantityKgRaw !== null &&
        !Number.isFinite(quantityKg)) ||
      (pricePerKgRaw !== undefined &&
        pricePerKgRaw !== null &&
        !Number.isFinite(pricePerKg))
    ) {
      res
        .status(400)
        .json({
          error:
            'quantityKg and pricePerKg must be numeric when provided',
        });
      return;
    }

    const totalAmount =
      quantityKg != null && pricePerKg != null
        ? quantityKg * pricePerKg
        : null;

    const orderDate = parsePoDate(orderDateRaw);
    const estimatedFarmerDeliveryDate = parsePoDate(
      estimatedFarmerDeliveryDateRaw
    );
    const estimatedArrivalAtBuyer = parsePoDate(estimatedArrivalAtBuyerRaw);

    const code = await getNextCode('PO');

    const client = ensurePurchaseOrderClient();
    const created = await client.purchaseOrder.create({
      data: {
        code,
        farmId,
        buyerName,
        buyerEmail,
        orderDate,
        crop,
        quantityKg,
        pricePerKg,
        totalAmount,
        status,
        notes,
        estimatedFarmerDeliveryDate,
        estimatedArrivalAtBuyer,
        destinationCountry,
        portOfDischarge,
      },
      include: purchaseOrderListInclude,
    });

    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requirePageAccess('GlobalSupplyPurchaseOrders'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const client = ensurePurchaseOrderClient();
    const existing = await client.purchaseOrder.findUnique({
      where: { id },
      include: purchaseOrderListInclude,
    });
    if (!existing) {
      res.status(404).json({ error: 'Purchase order not found' });
      return;
    }

    const body = req.body ?? {};

    let farmId: string | null = existing.farmId ?? null;
    if ('farmId' in body) {
      const farmIdRaw = body.farmId;
      farmId =
        farmIdRaw === null || farmIdRaw === undefined || farmIdRaw === ''
          ? null
          : String(farmIdRaw);
      if (farmId) {
        const farmOk = await prisma.farm.findUnique({
          where: { id: farmId },
          select: { id: true },
        });
        if (!farmOk) {
          res.status(400).json({ error: 'farmId is invalid' });
          return;
        }
      }
    }

    const buyerName =
      typeof body.buyerName === 'string'
        ? body.buyerName.trim()
        : existing.buyerName;
    if (!buyerName) {
      res.status(400).json({ error: 'buyerName is required' });
      return;
    }

    const buyerEmail =
      typeof body.buyerEmail === 'string'
        ? body.buyerEmail.trim() || null
        : existing.buyerEmail ?? null;

    const crop =
      typeof body.crop === 'string'
        ? body.crop.trim() || null
        : existing.crop ?? null;

    let quantityKg: number | null = existing.quantityKg ?? null;
    if ('quantityKg' in body) {
      const raw = body.quantityKg;
      if (raw === null || raw === undefined || raw === '') quantityKg = null;
      else {
        quantityKg = Number(raw);
        if (!Number.isFinite(quantityKg)) {
          res.status(400).json({ error: 'quantityKg must be numeric when provided' });
          return;
        }
      }
    }

    let pricePerKg: number | null = existing.pricePerKg ?? null;
    if ('pricePerKg' in body) {
      const raw = body.pricePerKg;
      if (raw === null || raw === undefined || raw === '') pricePerKg = null;
      else {
        pricePerKg = Number(raw);
        if (!Number.isFinite(pricePerKg)) {
          res.status(400).json({ error: 'pricePerKg must be numeric when provided' });
          return;
        }
      }
    }

    const status =
      typeof body.status === 'string'
        ? body.status.trim() || null
        : existing.status ?? null;

    const notes =
      typeof body.notes === 'string'
        ? body.notes.trim() || null
        : existing.notes ?? null;

    let orderDate: Date | null = existing.orderDate;
    if ('orderDate' in body) orderDate = parsePoDate(body.orderDate);

    let estimatedFarmerDeliveryDate: Date | null = existing.estimatedFarmerDeliveryDate;
    if ('estimatedFarmerDeliveryDate' in body) {
      estimatedFarmerDeliveryDate = parsePoDate(body.estimatedFarmerDeliveryDate);
    }

    let estimatedArrivalAtBuyer: Date | null = existing.estimatedArrivalAtBuyer;
    if ('estimatedArrivalAtBuyer' in body) {
      estimatedArrivalAtBuyer = parsePoDate(body.estimatedArrivalAtBuyer);
    }

    const destinationCountry =
      typeof body.destinationCountry === 'string'
        ? body.destinationCountry.trim() || null
        : existing.destinationCountry ?? null;

    const portOfDischarge =
      typeof body.portOfDischarge === 'string'
        ? body.portOfDischarge.trim() || null
        : existing.portOfDischarge ?? null;

    const totalAmount =
      quantityKg != null && pricePerKg != null ? quantityKg * pricePerKg : null;

    const updated = await client.purchaseOrder.update({
      where: { id },
      data: {
        farmId,
        buyerName,
        buyerEmail,
        orderDate,
        crop,
        quantityKg,
        pricePerKg,
        totalAmount,
        status,
        notes,
        estimatedFarmerDeliveryDate,
        estimatedArrivalAtBuyer,
        destinationCountry,
        portOfDischarge,
      },
      include: purchaseOrderListInclude,
    });

    res.json(updated);
  })
);

router.patch(
  '/:id/close',
  requirePageAccess('GlobalSupplyPurchaseOrders'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const client = ensurePurchaseOrderClient();
    const existing = await client.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Purchase order not found' });
      return;
    }

    const currentStatus = (existing.status ?? 'Open').trim().toLowerCase();
    if (currentStatus === 'closed') {
      res.status(400).json({ error: 'Purchase order is already closed' });
      return;
    }

    const updated = await client.purchaseOrder.update({
      where: { id },
      data: { status: 'Closed' },
      include: purchaseOrderListInclude,
    });

    res.json(updated);
  })
);

router.get(
  '/:id/attachments/:attachmentId/url',
  requirePageAccess('GlobalSupplyPurchaseOrders'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    const attachmentId = String(req.params.attachmentId ?? '').trim();
    if (!id || !attachmentId) {
      res.status(400).json({ error: 'id and attachmentId are required' });
      return;
    }

    const client = ensurePurchaseOrderClient();
    const att = await client.purchaseOrderAttachment.findFirst({
      where: { id: attachmentId, purchaseOrderId: id },
      select: { filePath: true },
    });
    if (!att?.filePath) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    try {
      const url = await createRecordDownloadSignedUrl(att.filePath);
      res.json({ url });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'Could not create download link',
      });
    }
  })
);

router.delete(
  '/:id/attachments/:attachmentId',
  requirePageAccess('GlobalSupplyPurchaseOrders'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    const attachmentId = String(req.params.attachmentId ?? '').trim();
    if (!id || !attachmentId) {
      res.status(400).json({ error: 'id and attachmentId are required' });
      return;
    }

    const client = ensurePurchaseOrderClient();
    const deleted = await client.purchaseOrderAttachment.deleteMany({
      where: { id: attachmentId, purchaseOrderId: id },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    res.status(204).send();
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
    const kindRaw =
      typeof req.body?.kind === 'string' ? req.body.kind.trim() : '';
    const kind = kindRaw || 'Document';
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

