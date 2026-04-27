/**
 * Audit Types (TYP-xx): Admin CRUD. Audits reference auditTypeId; list also at GET /audits/types.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getNextCode } from '../services/idGenerator';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const READ_ROLES = ['Admin', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'] as const;

router.use(authMiddleware);

router.get(
  '/',
  requireRole([...READ_ROLES]),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.auditType.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
    res.json({ list });
  })
);

router.post(
  '/',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const codeRaw = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const code = codeRaw || (await getNextCode('TYP', 2));
    try {
      const created = await prisma.auditType.create({
        data: { code, name: name || null },
      });
      res.status(201).json(created);
    } catch {
      res.status(400).json({ error: 'Duplicate code or invalid data' });
    }
  })
);

router.patch(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : undefined;
    const name = req.body?.name !== undefined ? (typeof req.body.name === 'string' ? req.body.name.trim() || null : null) : undefined;
    const data: { code?: string; name?: string | null } = {};
    if (code !== undefined) {
      if (!code) {
        res.status(400).json({ error: 'code cannot be empty' });
        return;
      }
      data.code = code;
    }
    if (name !== undefined) data.name = name;
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    try {
      const updated = await prisma.auditType.update({
        where: { id: req.params.id },
        data,
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Audit type not found' });
    }
  })
);

router.delete(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const n = await prisma.audit.count({ where: { auditTypeId: req.params.id } });
    if (n > 0) {
      res.status(400).json({ error: `Cannot delete: ${n} audit(s) use this type` });
      return;
    }
    try {
      await prisma.auditType.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Audit type not found' });
    }
  })
);

export default router;
