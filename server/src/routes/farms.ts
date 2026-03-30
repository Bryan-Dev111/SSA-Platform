/**
 * Global Vendors — farms API: list (read for farmers or approved pages), create.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requirePageAccessAny } from '../middleware/rbac';
import { getNextCode } from '../services/idGenerator';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);

const farmSelect = {
  id: true,
  code: true,
  farmName: true,
  farmerName: true,
  country: true,
  city: true,
  latitude: true,
  longitude: true,
  region: true,
  farmCategory: true,
  mainCrop: true,
  elevationMeters: true,
  productionStyle: true,
  createdAt: true,
  updatedAt: true,
} as const;

router.get(
  '/',
  requirePageAccessAny(['GlobalSupplyFarmers', 'GlobalSupplyApproved']),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const farms = await prisma.farm.findMany({
      select: farmSelect,
      orderBy: { code: 'asc' },
    });
    res.json(farms);
  })
);

router.post(
  '/',
  requirePageAccess('GlobalSupplyFarmers'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmName = typeof req.body?.farmName === 'string' ? req.body.farmName.trim() : '';
    const farmerName = typeof req.body?.farmerName === 'string' ? req.body.farmerName.trim() : '';
    const country = typeof req.body?.country === 'string' ? req.body.country.trim() : '';
    const city = typeof req.body?.city === 'string' ? req.body.city.trim() || null : null;

    if (!farmName) {
      res.status(400).json({ error: 'farmName is required' });
      return;
    }
    if (!farmerName) {
      res.status(400).json({ error: 'farmerName is required' });
      return;
    }
    if (!country) {
      res.status(400).json({ error: 'country is required' });
      return;
    }

    const code = await getNextCode('FARM');
    const created = await prisma.farm.create({
      data: { code, farmName, farmerName, country, city },
      select: farmSelect,
    });
    res.status(201).json(created);
  })
);

export default router;
