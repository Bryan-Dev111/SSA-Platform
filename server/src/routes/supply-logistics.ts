/**
 * Global Supply — logistics sites (ports, exporters, warehouses, etc.)
 */
import { Router, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';

const router = Router();

router.use(authMiddleware);

const ALLOWED_TYPES = new Set(['Port', 'Exporter', 'Mill', 'Trucking', 'Warehouse']);

const selectFields = {
  id: true,
  code: true,
  siteType: true,
  company: true,
  country: true,
  registrationNumber: true,
  latitude: true,
  longitude: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

router.get(
  '/',
  requirePageAccess('GlobalSupplyLogistics'),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const rows = await prisma.supplyLogistics.findMany({
      select: selectFields,
      orderBy: [{ code: 'asc' }],
    });
    res.json(rows);
  })
);

router.post(
  '/',
  requirePageAccess('GlobalSupplyLogistics'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const siteType = typeof req.body?.siteType === 'string' ? req.body.siteType.trim() : '';
    const company = typeof req.body?.company === 'string' ? req.body.company.trim() : '';
    const country = typeof req.body?.country === 'string' ? req.body.country.trim() : '';
    const registrationNumber =
      typeof req.body?.registrationNumber === 'string'
        ? req.body.registrationNumber.trim() || null
        : null;
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() || null : null;

    let latitude: number | null = null;
    let longitude: number | null = null;
    if (req.body?.latitude !== undefined && req.body?.latitude !== null && req.body?.latitude !== '') {
      const lat = Number(req.body.latitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        res.status(400).json({ error: 'latitude must be between -90 and 90' });
        return;
      }
      latitude = lat;
    }
    if (req.body?.longitude !== undefined && req.body?.longitude !== null && req.body?.longitude !== '') {
      const lon = Number(req.body.longitude);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        res.status(400).json({ error: 'longitude must be between -180 and 180' });
        return;
      }
      longitude = lon;
    }

    if (!siteType || !ALLOWED_TYPES.has(siteType)) {
      res.status(400).json({ error: 'siteType must be one of: Port, Exporter, Mill, Trucking, Warehouse' });
      return;
    }
    if (!company) {
      res.status(400).json({ error: 'company is required' });
      return;
    }
    if (!country) {
      res.status(400).json({ error: 'country is required' });
      return;
    }

    const code = await getNextCode('LOG');
    const created = await prisma.supplyLogistics.create({
      data: {
        code,
        siteType,
        company,
        country,
        registrationNumber,
        latitude,
        longitude,
        notes,
      },
      select: selectFields,
    });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requirePageAccess('GlobalSupplyLogistics'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const body = req.body ?? {};
    const data: Prisma.SupplyLogisticsUpdateInput = {};

    if (typeof body.siteType === 'string' && body.siteType.trim()) {
      const t = body.siteType.trim();
      if (!ALLOWED_TYPES.has(t)) {
        res.status(400).json({ error: 'Invalid siteType' });
        return;
      }
      data.siteType = t;
    }
    if (typeof body.company === 'string' && body.company.trim()) {
      data.company = body.company.trim();
    }
    if (typeof body.country === 'string' && body.country.trim()) {
      data.country = body.country.trim();
    }
    if (typeof body.registrationNumber === 'string') {
      data.registrationNumber = body.registrationNumber.trim() || null;
    } else if (body.registrationNumber === null) {
      data.registrationNumber = null;
    }
    if (typeof body.notes === 'string') {
      data.notes = body.notes.trim() || null;
    } else if (body.notes === null) {
      data.notes = null;
    }

    if (body.latitude !== undefined) {
      if (body.latitude === null || body.latitude === '') {
        data.latitude = null;
      } else {
        const lat = Number(body.latitude);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          res.status(400).json({ error: 'latitude must be between -90 and 90' });
          return;
        }
        data.latitude = lat;
      }
    }
    if (body.longitude !== undefined) {
      if (body.longitude === null || body.longitude === '') {
        data.longitude = null;
      } else {
        const lon = Number(body.longitude);
        if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
          res.status(400).json({ error: 'longitude must be between -180 and 180' });
          return;
        }
        data.longitude = lon;
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No updatable fields provided' });
      return;
    }

    try {
      const updated = await prisma.supplyLogistics.update({
        where: { id },
        data,
        select: selectFields,
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Record not found' });
    }
  })
);

router.delete(
  '/:id',
  requirePageAccess('GlobalSupplyLogistics'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    try {
      await prisma.supplyLogistics.delete({ where: { id } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Record not found' });
    }
  })
);

export default router;
