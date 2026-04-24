/**
 * Employee / contractor profile: text body + gallery images (Global Supply & Internal Management).
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  FARM_PROFILE_IMAGE_MAX_BYTES,
  createSignedUrlForPath,
  deleteObjectFromStorage,
  uploadEmployeeProfileImageToStorage,
} from '../lib/supabaseStorage';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FARM_PROFILE_IMAGE_MAX_BYTES },
});

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BODY_CHARS = 120_000;

router.use(authMiddleware);

async function loadTargetStaff(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isEmployee: true,
      isContractor: true,
      country: true,
      assignedCountries: { select: { country: true }, orderBy: { country: 'asc' } },
    },
  });
}

function isStaffRow(u: { isEmployee: boolean; isContractor: boolean }): boolean {
  return u.isEmployee || u.isContractor;
}

function canView(viewer: NonNullable<Request['user']>, target: { id: string; isEmployee: boolean; isContractor: boolean }): boolean {
  if (!isStaffRow(target)) return false;
  if (viewer.roleNames.includes('Admin') || viewer.roleNames.includes('QualityManager')) return true;
  if (viewer.id === target.id) return true;
  return false;
}

function canEdit(viewer: NonNullable<Request['user']>, target: { id: string; isEmployee: boolean; isContractor: boolean }): boolean {
  if (!isStaffRow(target)) return false;
  if (viewer.roleNames.includes('Admin') || viewer.roleNames.includes('QualityManager')) return true;
  if (viewer.id === target.id) return true;
  return false;
}

router.get(
  '/:userId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId ?? '').trim();
    if (!userId || !req.user) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const target = await loadTargetStaff(userId);
    if (!target || !canView(req.user, target)) {
      res.status(target ? 403 : 404).json({ error: target ? 'Forbidden' : 'Profile not found' });
      return;
    }

    const [profile, images] = await Promise.all([
      prisma.employeeProfile.findUnique({ where: { userId } }),
      prisma.employeeProfileImage.findMany({
        where: { userId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, filePath: true, fileName: true, fileMime: true, sortOrder: true, createdAt: true },
      }),
    ]);

    const withUrls = await Promise.all(
      images.map(async (img) => {
        let url: string | null = null;
        if (img.filePath) {
          try {
            url = await createSignedUrlForPath(img.filePath, 3600);
          } catch {
            url = null;
          }
        }
        return { ...img, url };
      })
    );

    const fromRows = target.assignedCountries.map((r) => r.country).filter(Boolean);
    const assignedCountryNames =
      fromRows.length > 0
        ? [...new Set(fromRows)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        : target.country?.trim()
          ? [target.country.trim()]
          : [];

    res.json({
      user: {
        id: target.id,
        email: target.email,
        name: target.name,
        isEmployee: target.isEmployee,
        isContractor: target.isContractor,
        assignedCountryNames,
      },
      body: profile?.body ?? '',
      canEdit: canEdit(req.user, target),
      images: withUrls,
    });
  })
);

router.put(
  '/:userId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId ?? '').trim();
    if (!userId || !req.user) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const target = await loadTargetStaff(userId);
    if (!target || !canEdit(req.user, target)) {
      res.status(target ? 403 : 404).json({ error: target ? 'Forbidden' : 'Profile not found' });
      return;
    }

    const bodyRaw = req.body?.body;
    const body = typeof bodyRaw === 'string' ? bodyRaw.slice(0, MAX_BODY_CHARS) : '';

    const saved = await prisma.employeeProfile.upsert({
      where: { userId },
      create: { userId, body },
      update: { body },
      select: { userId: true, body: true, updatedAt: true },
    });

    res.json(saved);
  })
);

router.post(
  '/:userId/images',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId ?? '').trim();
    if (!userId || !req.user) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const target = await loadTargetStaff(userId);
    if (!target || !canEdit(req.user, target)) {
      res.status(target ? 403 : 404).json({ error: target ? 'Forbidden' : 'Profile not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'file is required (multipart field "file")' });
      return;
    }

    const mime = (req.file.mimetype || '').toLowerCase();
    if (!IMAGE_MIMES.has(mime)) {
      res.status(400).json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed' });
      return;
    }

    const uploadName = req.file.originalname || 'image';
    try {
      const uploaded = await uploadEmployeeProfileImageToStorage({
        userId,
        fileName: uploadName,
        fileMime: mime || null,
        fileBuffer: req.file.buffer,
      });

      const created = await prisma.employeeProfileImage.create({
        data: {
          userId,
          filePath: uploaded.storagePath,
          fileName: uploadName.slice(0, 255) || null,
          fileMime: mime ? mime.slice(0, 255) : null,
        },
        select: {
          id: true,
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
  '/:userId/images/:imageId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId ?? '').trim();
    const imageId = String(req.params.imageId ?? '').trim();
    if (!userId || !imageId || !req.user) {
      res.status(400).json({ error: 'userId and imageId are required' });
      return;
    }

    const target = await loadTargetStaff(userId);
    if (!target || !canEdit(req.user, target)) {
      res.status(target ? 403 : 404).json({ error: target ? 'Forbidden' : 'Profile not found' });
      return;
    }

    const row = await prisma.employeeProfileImage.findFirst({
      where: { id: imageId, userId },
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
        // continue
      }
    }

    await prisma.employeeProfileImage.delete({ where: { id: row.id } });
    res.status(204).send();
  })
);

export default router;
