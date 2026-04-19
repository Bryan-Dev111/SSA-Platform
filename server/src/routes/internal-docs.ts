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

type ProjectHistoryIdResolved =
  | { skip: true }
  | { skip: false; value: string | null };

const internalDocUserPick = { select: { id: true, name: true, email: true } as const };

async function resolveOptionalBuyerId(
  body: Record<string, unknown>
): Promise<{ ok: true; skip: true } | { ok: true; skip: false; value: string | null } | { ok: false; error: string }> {
  if (!Object.prototype.hasOwnProperty.call(body, 'buyerId')) {
    return { ok: true, skip: true };
  }
  const raw = body.buyerId;
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return { ok: true, skip: false, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'buyerId must be a string or null' };
  }
  const id = raw.trim();
  const buyerRole = await prisma.role.findFirst({ where: { name: 'Buyer' }, select: { id: true } });
  if (!buyerRole) {
    return { ok: false, error: 'Buyer role not configured' };
  }
  const u = await prisma.user.findFirst({
    where: { id, userRoles: { some: { roleId: buyerRole.id } } },
    select: { id: true },
  });
  if (!u) {
    return { ok: false, error: 'buyerId must reference a user with the Buyer role' };
  }
  return { ok: true, skip: false, value: id };
}

async function resolveOptionalEmployeeUserId(
  body: Record<string, unknown>
): Promise<{ ok: true; skip: true } | { ok: true; skip: false; value: string | null } | { ok: false; error: string }> {
  if (!Object.prototype.hasOwnProperty.call(body, 'employeeUserId')) {
    return { ok: true, skip: true };
  }
  const raw = body.employeeUserId;
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return { ok: true, skip: false, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'employeeUserId must be a string or null' };
  }
  const id = raw.trim();
  const u = await prisma.user.findFirst({
    where: { id, OR: [{ isEmployee: true }, { isContractor: true }] },
    select: { id: true },
  });
  if (!u) {
    return { ok: false, error: 'employeeUserId must reference an employee or contractor user' };
  }
  return { ok: true, skip: false, value: id };
}

async function resolveProjectHistoryId(
  body: Record<string, unknown> | null | undefined
): Promise<{ ok: true } & ProjectHistoryIdResolved | { ok: false; error: string }> {
  if (!body || !Object.prototype.hasOwnProperty.call(body, 'projectHistoryId')) {
    return { ok: true, skip: true };
  }
  const raw = body.projectHistoryId;
  if (raw === null || raw === undefined) {
    return { ok: true, skip: false, value: null };
  }
  if (typeof raw === 'string' && raw.trim() === '') {
    return { ok: true, skip: false, value: null };
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const ch = await prisma.clientHistory.findUnique({ where: { id: raw.trim() }, select: { id: true } });
    if (!ch) {
      return { ok: false, error: 'projectHistoryId is invalid' };
    }
    return { ok: true, skip: false, value: raw.trim() };
  }
  return { ok: false, error: 'projectHistoryId must be a string or null' };
}

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.internalDoc.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        projectHistory: { select: { id: true, projectCode: true, companyName: true } },
        buyer: internalDocUserPick,
        employee: internalDocUserPick,
      },
    });
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
    const projRes = await resolveProjectHistoryId(req.body as Record<string, unknown>);
    if (!projRes.ok) {
      res.status(400).json({ error: projRes.error });
      return;
    }
    const buyerRes = await resolveOptionalBuyerId(req.body as Record<string, unknown>);
    if (!buyerRes.ok) {
      res.status(400).json({ error: buyerRes.error });
      return;
    }
    const empRes = await resolveOptionalEmployeeUserId(req.body as Record<string, unknown>);
    if (!empRes.ok) {
      res.status(400).json({ error: empRes.error });
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
    const createData: {
      name: string;
      category: string | null;
      note: string | null;
      filePath: string | null;
      projectHistoryId?: string | null;
      buyerId?: string | null;
      employeeUserId?: string | null;
    } = { name, category, note, filePath };
    if (!projRes.skip) {
      createData.projectHistoryId = projRes.value;
    }
    if (!buyerRes.skip) {
      createData.buyerId = buyerRes.value;
    }
    if (!empRes.skip) {
      createData.employeeUserId = empRes.value;
    }
    const created = await prisma.internalDoc.create({
      data: createData,
      include: {
        projectHistory: { select: { id: true, projectCode: true, companyName: true } },
        buyer: internalDocUserPick,
        employee: internalDocUserPick,
      },
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
    const data: {
      name?: string;
      category?: string | null;
      note?: string | null;
      filePath?: string | null;
      projectHistoryId?: string | null;
      buyerId?: string | null;
      employeeUserId?: string | null;
    } = {};
    if (typeof req.body?.name === 'string') data.name = req.body.name.trim();
    if (typeof req.body?.category === 'string') data.category = req.body.category.trim() || null;
    if (typeof req.body?.note === 'string') data.note = req.body.note.trim() || null;
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'projectHistoryId')) {
      const projRes = await resolveProjectHistoryId(req.body as Record<string, unknown>);
      if (!projRes.ok) {
        res.status(400).json({ error: projRes.error });
        return;
      }
      if (!projRes.skip) {
        data.projectHistoryId = projRes.value;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'buyerId')) {
      const buyerRes = await resolveOptionalBuyerId(req.body as Record<string, unknown>);
      if (!buyerRes.ok) {
        res.status(400).json({ error: buyerRes.error });
        return;
      }
      if (!buyerRes.skip) {
        data.buyerId = buyerRes.value;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'employeeUserId')) {
      const empRes = await resolveOptionalEmployeeUserId(req.body as Record<string, unknown>);
      if (!empRes.ok) {
        res.status(400).json({ error: empRes.error });
        return;
      }
      if (!empRes.skip) {
        data.employeeUserId = empRes.value;
      }
    }
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
    const updated = await prisma.internalDoc.update({
      where: { id },
      data,
      include: {
        projectHistory: { select: { id: true, projectCode: true, companyName: true } },
        buyer: internalDocUserPick,
        employee: internalDocUserPick,
      },
    });
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
