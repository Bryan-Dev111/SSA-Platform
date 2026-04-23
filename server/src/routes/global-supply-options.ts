import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const READ_ROLES = ['Admin', 'Viewer', 'QualityEngineer', 'QualityManager', 'Auditor', 'Buyer'] as const;

const router = Router();

router.use(authMiddleware);

router.get(
  '/crops',
  requireRole([...READ_ROLES]),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.globalSupplyCrop.findMany({ orderBy: [{ name: 'asc' }] });
    res.json({ list });
  })
);

router.post(
  '/crops',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const created = await prisma.globalSupplyCrop.create({ data: { name } });
      res.status(201).json(created);
    } catch {
      res.status(400).json({ error: 'Duplicate crop or invalid data' });
    }
  })
);

router.patch(
  '/crops/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const updated = await prisma.globalSupplyCrop.update({
        where: { id: String(req.params.id) },
        data: { name },
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Crop not found or duplicate name' });
    }
  })
);

router.delete(
  '/crops/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.globalSupplyCrop.delete({ where: { id: String(req.params.id) } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Crop not found' });
    }
  })
);

router.get(
  '/countries',
  requireRole([...READ_ROLES]),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.globalSupplyCountry.findMany({ orderBy: [{ name: 'asc' }] });
    res.json({ list });
  })
);

router.post(
  '/countries',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const created = await prisma.globalSupplyCountry.create({ data: { name } });
      res.status(201).json(created);
    } catch {
      res.status(400).json({ error: 'Duplicate country or invalid data' });
    }
  })
);

router.patch(
  '/countries/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const updated = await prisma.globalSupplyCountry.update({
        where: { id: String(req.params.id) },
        data: { name },
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Country not found or duplicate name' });
    }
  })
);

router.delete(
  '/countries/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.globalSupplyCountry.delete({ where: { id: String(req.params.id) } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Country not found' });
    }
  })
);

export default router;
