/**
 * Suppliers API: list, get, create (Admin), partial update (Admin), delete (Admin).
 * Scope: Admin all; Buyer assigned; Supplier own.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getAllowedSupplierIds } from '../services/scope';
import { getNextCode } from '../services/idGenerator';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const where = allowedIds === null ? {} : { id: { in: allowedIds } };
    const suppliers = await prisma.supplier.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
      },
      orderBy: { code: 'asc' },
    });
    res.json(suppliers);
  })
);

/** POST /suppliers — Admin: create supplier (auto SUP- code) */
router.post(
  '/',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const city = typeof req.body?.city === 'string' ? req.body.city.trim() || null : null;
    const country = typeof req.body?.country === 'string' ? req.body.country.trim() || null : null;
    const commodityTypeIdRaw = req.body?.commodityTypeId;
    // Omitting the field must mean "no commodity" — do not use String(undefined) → "undefined"
    const commodityTypeId =
      commodityTypeIdRaw === null ||
      commodityTypeIdRaw === undefined ||
      commodityTypeIdRaw === ''
        ? null
        : String(commodityTypeIdRaw);
    if (commodityTypeId !== null) {
      const ct = await prisma.commodityType.findUnique({ where: { id: commodityTypeId } });
      if (!ct) {
        res.status(400).json({ error: 'Invalid commodity type id' });
        return;
      }
    }
    const code = await getNextCode('SUP');
    const created = await prisma.supplier.create({
      data: { code, name, city, country, commodityTypeId },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(created);
  })
);

/** PATCH /suppliers/:id — Admin: optional name, city, country, commodityTypeId */
router.patch(
  '/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const data: {
      name?: string;
      city?: string | null;
      country?: string | null;
      commodityTypeId?: string | null;
    } = {};
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        res.status(400).json({ error: 'name cannot be empty' });
        return;
      }
      data.name = name;
    }
    if (body.city !== undefined) {
      data.city = typeof body.city === 'string' ? body.city.trim() || null : null;
    }
    if (body.country !== undefined) {
      data.country = typeof body.country === 'string' ? body.country.trim() || null : null;
    }
    if (body.commodityTypeId !== undefined) {
      const raw = body.commodityTypeId;
      const commodityTypeId =
        raw === null || raw === undefined || raw === '' ? null : String(raw);
      if (commodityTypeId !== null) {
        const ct = await prisma.commodityType.findUnique({ where: { id: commodityTypeId } });
        if (!ct) {
          res.status(400).json({ error: 'Invalid commodity type id' });
          return;
        }
      }
      data.commodityTypeId = commodityTypeId;
    }
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'Provide at least one of: name, city, country, commodityTypeId' });
      return;
    }
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    const updated = await prisma.supplier.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
      },
    });
    res.json(updated);
  })
);

/** DELETE /suppliers/:idOrCode — Admin only */
router.delete(
  '/:idOrCode',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const idOrCode = req.params.idOrCode;
    const existing = await prisma.supplier.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    });
    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    await prisma.supplier.update({
      where: { id: existing.id },
      data: { userId: null },
    });
    await prisma.supplier.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);

router.get(
  '/:idOrCode',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowedIds = await getAllowedSupplierIds(req.user);
    const idOrCode = req.params.idOrCode;
    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        country: true,
        commodityTypeId: true,
        commodityType: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(supplier.id)) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    res.json(supplier);
  })
);

export default router;
