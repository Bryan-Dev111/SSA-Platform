import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';
import {
  MAX_RECORD_FILE_BYTES,
  createRecordDownloadSignedUrl,
  uploadRecordToStorage,
} from '../lib/supabaseStorage';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECORD_FILE_BYTES },
});

router.use(authMiddleware);
router.use(requirePageAccess('GlobalSupplyExpenses'));

function parseExpenseDate(val: unknown): Date | null {
  if (typeof val !== 'string' || !val.trim()) return null;
  // YYYY-MM-DD from date inputs
  return new Date(val.trim().slice(0, 10) + 'T12:00:00.000Z');
}

function isPurchaseOrderOpenStatus(status: string | null | undefined): boolean {
  return (status ?? 'Open').trim().toLowerCase() !== 'closed';
}

/** For create/update: null clears link; id must exist and be open (not Closed). */
async function resolvePurchaseOrderIdForWrite(
  raw: unknown,
  res: Response
): Promise<string | null | undefined> {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw === 'string' && !raw.trim()) return null;
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id) return null;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!po) {
    res.status(400).json({ error: 'purchaseOrderId is not a valid purchase order' });
    return undefined;
  }
  if (!isPurchaseOrderOpenStatus(po.status)) {
    res.status(400).json({ error: 'Only open purchase orders can be linked to an expense' });
    return undefined;
  }
  return id;
}

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.expense.findMany({
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        purchaseOrder: { select: { id: true, code: true } },
      },
    });
    res.json({ list });
  })
);

/** Open POs only (status not Closed), for Global Supply expense form. Same auth as other expense routes. */
router.get(
  '/open-purchase-orders',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const rows = await prisma.purchaseOrder.findMany({
      select: { id: true, code: true, status: true },
      orderBy: { code: 'asc' },
      take: 500,
    });
    const list = rows
      .filter((r) => isPurchaseOrderOpenStatus(r.status))
      .map(({ id, code }) => ({ id, code }));
    res.json({ list });
  })
);

router.get(
  '/:id/attachment-url',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { attachmentFilePath: true },
    });
    if (!expense?.attachmentFilePath) {
      res.status(404).json({ error: 'No attachment' });
      return;
    }
    try {
      const url = await createRecordDownloadSignedUrl(expense.attachmentFilePath);
      res.json({ url });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'Could not create download link',
      });
    }
  })
);

router.post(
  '/:id/attachment',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'file is required' });
      return;
    }

    const expense = await prisma.expense.findUnique({ where: { id }, select: { id: true } });
    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    try {
      const uploaded = await uploadRecordToStorage({
        supplierId: null,
        recordId: expense.id,
        fileName: req.file.originalname || 'attachment',
        fileMime: req.file.mimetype || null,
        fileBuffer: req.file.buffer,
      });
      const updated = await prisma.expense.update({
        where: { id },
        data: {
          attachmentFilePath: uploaded.storagePath,
          attachmentFileName: (req.file.originalname || '').slice(0, 255) || null,
          attachmentFileMime: (req.file.mimetype || '').slice(0, 255) || null,
        },
      });
      res.status(201).json(updated);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Could not save attachment',
      });
    }
  })
);

router.delete(
  '/:id/attachment',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        attachmentFilePath: null,
        attachmentFileName: null,
        attachmentFileMime: null,
      },
    });
    res.json(updated);
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const type = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const project = typeof req.body?.project === 'string' ? req.body.project.trim() : '';
    const amountRaw = req.body?.amount;
    const amount = Number(amountRaw);
    const expenseDate = parseExpenseDate(req.body?.expenseDate);
    const paymentMethod =
      typeof req.body?.paymentMethod === 'string' ? req.body.paymentMethod.trim() : '';
    const country = typeof req.body?.country === 'string' ? req.body.country.trim() : '';

    if (!type || !description || !project || !Number.isFinite(amount) || !expenseDate || Number.isNaN(expenseDate.getTime())) {
      res
        .status(400)
        .json({ error: 'type, description, project, numeric amount, and expenseDate (YYYY-MM-DD) are required' });
      return;
    }

    let purchaseOrderId: string | null | undefined;
    if (req.body?.purchaseOrderId !== undefined) {
      const resolved = await resolvePurchaseOrderIdForWrite(req.body.purchaseOrderId, res);
      if (resolved === undefined) return;
      purchaseOrderId = resolved;
    }

    const code = await getNextCode('EXP');

    const created = await prisma.expense.create({
      data: {
        code,
        status: 'Open',
        type,
        description,
        project,
        amount,
        expenseDate,
        paymentMethod,
        country: country || null,
        purchaseOrderId: purchaseOrderId ?? null,
      },
      include: {
        purchaseOrder: { select: { id: true, code: true } },
      },
    });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const data: {
      type?: string;
      description?: string;
      project?: string;
      amount?: number;
      expenseDate?: Date;
      paymentMethod?: string;
      country?: string | null;
      status?: string;
      purchaseOrderId?: string | null;
    } = {};
    if (typeof req.body?.type === 'string') data.type = req.body.type.trim();
    if (typeof req.body?.description === 'string') data.description = req.body.description.trim();
    if (typeof req.body?.project === 'string') data.project = req.body.project.trim();
    if (req.body?.amount !== undefined) {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount)) {
        res.status(400).json({ error: 'amount must be numeric' });
        return;
      }
      data.amount = amount;
    }
    if (req.body?.expenseDate !== undefined) {
      const expenseDate = parseExpenseDate(req.body.expenseDate);
      if (!expenseDate || Number.isNaN(expenseDate.getTime())) {
        res.status(400).json({ error: 'expenseDate must be YYYY-MM-DD' });
        return;
      }
      data.expenseDate = expenseDate;
    }
    if (req.body?.paymentMethod !== undefined) {
      data.paymentMethod =
        typeof req.body.paymentMethod === 'string' ? req.body.paymentMethod.trim() : '';
    }
    if (req.body?.country !== undefined) {
      data.country = typeof req.body.country === 'string' ? req.body.country.trim() || null : null;
    }

    if (req.body?.purchaseOrderId !== undefined) {
      const resolved = await resolvePurchaseOrderIdForWrite(req.body.purchaseOrderId, res);
      if (resolved === undefined) return;
      data.purchaseOrderId = resolved;
    }

    if (req.body?.status !== undefined) {
      const st = typeof req.body.status === 'string' ? req.body.status.trim() : '';
      if (st !== 'Open' && st !== 'Closed') {
        res.status(400).json({ error: 'status must be Open or Closed' });
        return;
      }
      const isAdmin = req.user?.roleNames?.includes('Admin') ?? false;
      if (!isAdmin) {
        res.status(403).json({ error: 'Only administrators can change expense status' });
        return;
      }
      data.status = st;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const updated = await prisma.expense.update({
      where: { id },
      data,
      include: {
        purchaseOrder: { select: { id: true, code: true } },
      },
    });
    res.json(updated);
  })
);

export default router;
