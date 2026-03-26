/**
 * Defect codes: Admin CRUD; GET for Findings/CAR dropdowns (active only unless Admin ?all=1).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const READ_ROLES = ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'] as const;

router.use(authMiddleware);

router.get(
  '/',
  requireRole([...READ_ROLES]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const all = req.query.all === '1' && req.user.roleNames.includes('Admin');
    const list = await prisma.defectCode.findMany({
      where: all ? {} : { active: true },
      orderBy: [{ code: 'asc' }],
    });
    res.json({ list });
  })
);

router.post(
  '/',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const active = req.body?.active === false ? false : true;
    if (!code) {
      res.status(400).json({ error: 'code is required' });
      return;
    }
    try {
      const created = await prisma.defectCode.create({
        data: { code, name: name || null, active },
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
    const active = typeof req.body?.active === 'boolean' ? req.body.active : undefined;
    const data: { code?: string; name?: string | null; active?: boolean } = {};
    if (code !== undefined) {
      if (!code) {
        res.status(400).json({ error: 'code cannot be empty' });
        return;
      }
      data.code = code;
    }
    if (name !== undefined) data.name = name;
    if (active !== undefined) data.active = active;
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    try {
      const updated = await prisma.defectCode.update({
        where: { id: req.params.id },
        data,
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Defect code not found' });
    }
  })
);

router.delete(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.defectCode.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Defect code not found' });
    }
  })
);

export default router;
