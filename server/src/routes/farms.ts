/**
 * Global Vendors — farms API: list (read for farmers or approved pages), create.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requirePageAccessAny, requireRole } from '../middleware/rbac';
import { getNextCode } from '../services/idGenerator';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  FARM_PROFILE_IMAGE_MAX_BYTES,
  createSignedUrlForPath,
  deleteObjectFromStorage,
  uploadFarmProfileImageToStorage,
} from '../lib/supabaseStorage';

const router = Router();

const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FARM_PROFILE_IMAGE_MAX_BYTES },
});

const FARM_PROFILE_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function parseProfileSection(raw: unknown): 'Profile' | 'Processing' | null {
  if (raw === 'Profile' || raw === 'Processing') return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t === 'Profile' || t === 'Processing') return t;
  }
  return null;
}

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
  requirePageAccessAny([
    'GlobalSupplyFarmers',
    'GlobalSupplyFarmDashboard',
    'GlobalSupplyFarmProfile',
    'GlobalSupplyProcessingQuality',
    'GlobalSupplyApproved',
  ]),
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
  requirePageAccessAny([
    'GlobalSupplyFarmers',
    'GlobalSupplyFarmProfile',
    'GlobalSupplyProcessingQuality',
    'GlobalSupplyApproved',
  ]),
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
        farmCategory: true,
      },
      orderBy: { code: 'asc' },
    });
    res.json(farms);
  })
);

router.get(
  '/:farmId/profile-images',
  requirePageAccessAny([
    'GlobalSupplyFarmers',
    'GlobalSupplyFarmProfile',
    'GlobalSupplyProcessingQuality',
    'GlobalSupplyApproved',
  ]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmId = req.params.farmId;
    const sectionFilter = parseProfileSection(req.query.section);

    const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true } });
    if (!farm) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }

    const rows = await prisma.farmProfileImage.findMany({
      where: {
        farmId,
        ...(sectionFilter ? { section: sectionFilter } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        section: true,
        filePath: true,
        fileName: true,
        fileMime: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    const images: {
      id: string;
      section: string;
      fileName: string | null;
      fileMime: string | null;
      sortOrder: number | null;
      createdAt: Date;
      url: string | null;
    }[] = [];

    for (const row of rows) {
      let url: string | null = null;
      if (row.filePath) {
        try {
          url = await createSignedUrlForPath(row.filePath, 3600);
        } catch {
          url = null;
        }
      }
      images.push({
        id: row.id,
        section: row.section,
        fileName: row.fileName,
        fileMime: row.fileMime,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        url,
      });
    }

    res.json({ images });
  })
);

router.get(
  '/:farmId/profile-content',
  requirePageAccessAny([
    'GlobalSupplyFarmers',
    'GlobalSupplyFarmProfile',
    'GlobalSupplyProcessingQuality',
    'GlobalSupplyApproved',
  ]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmId = req.params.farmId;
    const section = parseProfileSection(req.query.section);
    if (!section) {
      res.status(400).json({ error: 'section query must be Profile or Processing' });
      return;
    }

    const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true } });
    if (!farm) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }

    const row = await prisma.farmProfileContent.findUnique({
      where: {
        farmId_section: { farmId, section },
      },
      select: { body: true, updatedAt: true },
    });

    res.json({
      section,
      body: row?.body ?? '',
      updatedAt: row?.updatedAt ?? null,
    });
  })
);

router.patch(
  '/:farmId/profile-content',
  requirePageAccessAny([
    'GlobalSupplyFarmers',
    'GlobalSupplyFarmProfile',
    'GlobalSupplyProcessingQuality',
  ]),
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmId = req.params.farmId;
    const section = parseProfileSection(req.body?.section);
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    if (!section) {
      res.status(400).json({ error: 'section must be Profile or Processing' });
      return;
    }

    const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true } });
    if (!farm) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }

    const saved = await prisma.farmProfileContent.upsert({
      where: { farmId_section: { farmId, section } },
      create: { farmId, section, body },
      update: { body },
      select: { section: true, body: true, updatedAt: true },
    });

    res.json(saved);
  })
);

router.post(
  '/:farmId/profile-images',
  requirePageAccessAny([
    'GlobalSupplyFarmers',
    'GlobalSupplyFarmProfile',
    'GlobalSupplyProcessingQuality',
  ]),
  requireRole(['Admin']),
  profileImageUpload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmId = req.params.farmId;
    const section = parseProfileSection(req.body?.section);

    if (!req.file) {
      res.status(400).json({ error: 'file is required (multipart field "file")' });
      return;
    }
    if (!section) {
      res.status(400).json({ error: 'section must be Profile or Processing' });
      return;
    }

    const mime = (req.file.mimetype || '').toLowerCase();
    if (!FARM_PROFILE_IMAGE_MIMES.has(mime)) {
      res.status(400).json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed' });
      return;
    }

    const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true } });
    if (!farm) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }

    const uploadName = req.file.originalname || 'image';
    try {
      const uploaded = await uploadFarmProfileImageToStorage({
        farmId,
        section,
        fileName: uploadName,
        fileMime: mime || null,
        fileBuffer: req.file.buffer,
      });

      const created = await prisma.farmProfileImage.create({
        data: {
          farmId,
          section,
          filePath: uploaded.storagePath,
          fileName: uploadName.slice(0, 255) || null,
          fileMime: mime ? mime.slice(0, 255) : null,
        },
        select: {
          id: true,
          section: true,
          filePath: true,
          fileName: true,
          fileMime: true,
          sortOrder: true,
          createdAt: true,
        },
      });

      let url: string | null = null;
      if (created.filePath) {
        try {
          url = await createSignedUrlForPath(created.filePath, 3600);
        } catch {
          url = null;
        }
      }

      res.status(201).json({
        image: {
          id: created.id,
          section: created.section,
          fileName: created.fileName,
          fileMime: created.fileMime,
          sortOrder: created.sortOrder,
          createdAt: created.createdAt,
          url,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Could not upload image',
      });
    }
  })
);

router.delete(
  '/:farmId/profile-images/:imageId',
  requirePageAccessAny([
    'GlobalSupplyFarmers',
    'GlobalSupplyFarmProfile',
    'GlobalSupplyProcessingQuality',
  ]),
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const farmId = req.params.farmId;
    const imageId = req.params.imageId;

    const row = await prisma.farmProfileImage.findFirst({
      where: { id: imageId, farmId },
      select: { id: true, filePath: true },
    });
    if (!row) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    if (row.filePath) {
      try {
        await deleteObjectFromStorage(row.filePath);
      } catch {
        // Continue with DB delete so operators are not blocked if the object was already removed.
      }
    }

    await prisma.farmProfileImage.delete({ where: { id: row.id } });
    res.status(204).send();
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

    const code = await getNextCode('FARM', 4);
    const created = await prisma.farm.create({
      data: { code, farmName, farmerName, country, city },
      select: farmSelect,
    });
    res.status(201).json(created);
  })
);

// Farm updates: general fields for GlobalSupplyFarmers; relationship/trust fields Admin-only.
router.patch(
  '/:id',
  requirePageAccess('GlobalSupplyFarmers'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.farm.findUnique({
      where: { id },
      select: { firstContactDate: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }
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

    if (Object.prototype.hasOwnProperty.call(data, 'firstContactDate') && existing.firstContactDate != null) {
      if (data.firstContactDate === null) {
        res.status(400).json({ error: 'First contact date cannot be cleared once set.' });
        return;
      }
      const existingDay = existing.firstContactDate.toISOString().slice(0, 10);
      const newDay =
        data.firstContactDate instanceof Date
          ? data.firstContactDate.toISOString().slice(0, 10)
          : null;
      if (newDay && newDay !== existingDay) {
        res.status(400).json({ error: 'First contact date cannot be changed once set.' });
        return;
      }
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

    const relationshipFieldKeys = new Set([
      'firstContactDate',
      'lastVisitDate',
      'visitCount',
      'relationshipStatus',
    ]);
    const touchesRelationship = Object.keys(data).some((k) => relationshipFieldKeys.has(k));
    if (touchesRelationship && !req.user?.roleNames.includes('Admin')) {
      res.status(403).json({ error: 'Only administrators can update relationship fields.' });
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

router.delete(
  '/:id',
  requirePageAccess('GlobalSupplyFarmers'),
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.farm.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      res.status(404).json({ error: 'Farm not found' });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.updateMany({ where: { farmId: id }, data: { farmId: null } });
      await tx.sample.updateMany({ where: { farmId: id }, data: { farmId: null } });
      await tx.farm.delete({ where: { id } });
    });
    res.status(204).send();
  })
);

export default router;
