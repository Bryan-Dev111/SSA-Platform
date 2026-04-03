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

  totalFarmSizeHa: true,
  mainCropAreaHa: true,
  mainCropAnnualOutputKg: true,
  secondaryCrop: true,
  secondaryCropAreaHa: true,
  secondaryCropAnnualOutputKg: true,
  mainVarieties: true,
  secondaryVarieties: true,
  harvestStartMonth: true,
  harvestEndMonth: true,
  secondaryHarvestStartMonth: true,
  secondaryHarvestEndMonth: true,
  mainProcessingMethods: true,
  mainFermentationDays: true,
  mainDryingMethod: true,
  mainBeanSize: true,
  mainQualityScore: true,
  secondaryProcessingMethods: true,
  secondaryFermentationDays: true,
  secondaryDryingMethod: true,
  secondaryBeanSize: true,
  secondaryQualityScore: true,
  language: true,
  samplesOk: true,
  farmerEmail: true,
  farmerMobile: true,
  notes: true,

  firstContactDate: true,
  lastVisitDate: true,
  visitCount: true,
  relationshipStatus: true,
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

// Lightweight payload for map pins
router.get(
  '/map',
  requirePageAccessAny(['GlobalSupplyFarmers', 'GlobalSupplyApproved']),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const farms = await prisma.farm.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        code: true,
        farmName: true,
        latitude: true,
        longitude: true,
      },
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

// Relationship & trust + general farm updates
router.patch(
  '/:id',
  requirePageAccess('GlobalSupplyFarmers'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const {
      farmName,
      farmerName,
      country,
      city,
      latitude,
      longitude,
      region,
      farmCategory,
      mainCrop,
      elevationMeters,
      productionStyle,
      totalFarmSizeHa,
      mainCropAreaHa,
      mainCropAnnualOutputKg,
      secondaryCrop,
      secondaryCropAreaHa,
      secondaryCropAnnualOutputKg,
      mainVarieties,
      secondaryVarieties,
      harvestStartMonth,
      harvestEndMonth,
      secondaryHarvestStartMonth,
      secondaryHarvestEndMonth,
      mainProcessingMethods,
      mainFermentationDays,
      mainDryingMethod,
      mainBeanSize,
      mainQualityScore,
      secondaryProcessingMethods,
      secondaryFermentationDays,
      secondaryDryingMethod,
      secondaryBeanSize,
      secondaryQualityScore,
      language,
      samplesOk,
      farmerEmail,
      farmerMobile,
      notes,
      firstContactDate,
      lastVisitDate,
      visitCount,
      relationshipStatus,
    } = req.body ?? {};

    const data: any = {};

    // Core identity/location fields
    if (typeof farmName === 'string' && farmName.trim()) {
      data.farmName = farmName.trim();
    }
    if (typeof farmerName === 'string' && farmerName.trim()) {
      data.farmerName = farmerName.trim();
    }
    if (typeof country === 'string' && country.trim()) {
      data.country = country.trim();
    }
    if (typeof city === 'string') {
      data.city = city.trim() || null;
    }

    // Optional numeric coordinates
    if (latitude !== undefined) {
      if (latitude === null || latitude === '') {
        data.latitude = null;
      } else {
        const latNum = Number(latitude);
        if (Number.isFinite(latNum) && latNum >= -90 && latNum <= 90) {
          data.latitude = latNum;
        }
      }
    }
    if (longitude !== undefined) {
      if (longitude === null || longitude === '') {
        data.longitude = null;
      } else {
        const lonNum = Number(longitude);
        if (Number.isFinite(lonNum) && lonNum >= -180 && lonNum <= 180) {
          data.longitude = lonNum;
        }
      }
    }

    // Additional descriptive fields
    if (typeof region === 'string') {
      data.region = region.trim() || null;
    }
    if (typeof farmCategory === 'string') {
      data.farmCategory = farmCategory.trim() || null;
    }
    if (typeof mainCrop === 'string') {
      data.mainCrop = mainCrop.trim() || null;
    }
    if (elevationMeters !== undefined) {
      if (elevationMeters === null || elevationMeters === '') {
        data.elevationMeters = null;
      } else {
        const elevNum = Number(elevationMeters);
        if (Number.isFinite(elevNum)) {
          data.elevationMeters = elevNum;
        }
      }
    }
    if (typeof productionStyle === 'string') {
      data.productionStyle = productionStyle.trim() || null;
    }

    // Agronomy / production metrics (simple nullable numerics/strings)
    const toNullableFloat = (val: unknown) => {
      if (val === undefined) return undefined;
      if (val === null || val === '') return null;
      const num = Number(val);
      return Number.isFinite(num) ? num : undefined;
    };
    const toNullableInt = (val: unknown) => {
      if (val === undefined) return undefined;
      if (val === null || val === '') return null;
      const num = Number(val);
      return Number.isFinite(num) ? Math.trunc(num) : undefined;
    };

    const floatFields: [keyof typeof data, unknown][] = [
      ['totalFarmSizeHa', totalFarmSizeHa],
      ['mainCropAreaHa', mainCropAreaHa],
      ['mainCropAnnualOutputKg', mainCropAnnualOutputKg],
      ['secondaryCropAreaHa', secondaryCropAreaHa],
      ['secondaryCropAnnualOutputKg', secondaryCropAnnualOutputKg],
      ['mainQualityScore', mainQualityScore],
      ['secondaryQualityScore', secondaryQualityScore],
    ];
    for (const [key, raw] of floatFields) {
      const v = toNullableFloat(raw);
      if (v !== undefined) (data as any)[key] = v;
    }

    const intFields: [keyof typeof data, unknown][] = [
      ['mainFermentationDays', mainFermentationDays],
      ['secondaryFermentationDays', secondaryFermentationDays],
    ];
    for (const [key, raw] of intFields) {
      const v = toNullableInt(raw);
      if (v !== undefined) (data as any)[key] = v;
    }

    const stringFields: [keyof typeof data, unknown][] = [
      ['secondaryCrop', secondaryCrop],
      ['mainVarieties', mainVarieties],
      ['secondaryVarieties', secondaryVarieties],
      ['harvestStartMonth', harvestStartMonth],
      ['harvestEndMonth', harvestEndMonth],
      ['secondaryHarvestStartMonth', secondaryHarvestStartMonth],
      ['secondaryHarvestEndMonth', secondaryHarvestEndMonth],
      ['mainProcessingMethods', mainProcessingMethods],
      ['mainDryingMethod', mainDryingMethod],
      ['mainBeanSize', mainBeanSize],
      ['secondaryProcessingMethods', secondaryProcessingMethods],
      ['secondaryDryingMethod', secondaryDryingMethod],
      ['secondaryBeanSize', secondaryBeanSize],
      ['language', language],
      ['farmerEmail', farmerEmail],
      ['farmerMobile', farmerMobile],
      ['notes', notes],
    ];
    for (const [key, raw] of stringFields) {
      if (typeof raw === 'string') {
        (data as any)[key] = raw.trim() || null;
      } else if (raw === null) {
        (data as any)[key] = null;
      }
    }

    if (samplesOk !== undefined) {
      (data as any).samplesOk = samplesOk === null ? null : Boolean(samplesOk);
    }

    if (typeof firstContactDate === 'string' && firstContactDate.trim()) {
      data.firstContactDate = new Date(firstContactDate.slice(0, 10) + 'T12:00:00.000Z');
    } else if (firstContactDate === null) {
      data.firstContactDate = null;
    }

    if (typeof lastVisitDate === 'string' && lastVisitDate.trim()) {
      data.lastVisitDate = new Date(lastVisitDate.slice(0, 10) + 'T12:00:00.000Z');
    } else if (lastVisitDate === null) {
      data.lastVisitDate = null;
    }

    if (typeof visitCount === 'number') {
      data.visitCount = visitCount;
    } else if (visitCount === null) {
      data.visitCount = null;
    }

    if (typeof relationshipStatus === 'string') {
      data.relationshipStatus = relationshipStatus.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No updatable fields provided' });
      return;
    }

    const updated = await prisma.farm.update({
      where: { id },
      data,
      select: farmSelect,
    });

    res.json(updated);
  })
);

export default router;
