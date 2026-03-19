/**
 * Opportunities / risk items: list (scoped); Admin delete (Day 9.4).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Risk'));

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    if (allowedIds !== null && allowedIds.length === 0) {
      res.json([]);
      return;
    }
    const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
    if (supplierId && allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.json([]);
      return;
    }
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const where = {
      ...(allowedIds === null ? {} : { supplierId: { in: allowedIds } }),
      ...(supplierId ? { supplierId } : {}),
      ...(type ? { type } : {}),
    };
    const list = await prisma.opportunity.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  })
);

router.post(
  '/',
  requireRole(['Admin', 'QualityEngineer', 'Buyer']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const typeRaw = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
    if (!supplierId || !description) {
      res.status(400).json({ error: 'supplierId and description are required' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(supplierId)) {
      res.status(403).json({ error: 'Supplier not in scope' });
      return;
    }
    if (!['risk', 'opportunity', 'mitigated'].includes(typeRaw)) {
      res.status(400).json({ error: 'type must be risk, opportunity, or mitigated' });
      return;
    }
    const created = await prisma.opportunity.create({
      data: {
        supplierId,
        description,
        type: typeRaw,
        createdById: req.user.id,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requireRole(['Admin', 'QualityEngineer', 'Buyer']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const existing = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(existing.supplierId)) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    const data: { description?: string; type?: string } = {};
    if (req.body?.description !== undefined) {
      const d = typeof req.body.description === 'string' ? req.body.description.trim() : '';
      if (!d) {
        res.status(400).json({ error: 'description cannot be empty' });
        return;
      }
      data.description = d;
    }
    if (req.body?.type !== undefined) {
      const t = typeof req.body.type === 'string' ? req.body.type.trim() : '';
      if (!['risk', 'opportunity', 'mitigated'].includes(t)) {
        res.status(400).json({ error: 'type must be risk, opportunity, or mitigated' });
        return;
      }
      data.type = t;
    }
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'Provide description or type' });
      return;
    }
    const updated = await prisma.opportunity.update({
      where: { id: req.params.id },
      data,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const allowedIds = await getAllowedSupplierIds(req.user!);
    const row = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(row.supplierId)) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    await prisma.opportunity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
