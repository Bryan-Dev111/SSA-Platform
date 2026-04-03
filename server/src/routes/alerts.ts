import { AlertCategory } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { prisma, prismaBase } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { requirePageAccess } from '../middleware/rbac';
import { backfillLateShipmentAlerts, backfillOverdueAuditAlerts, backfillOverdueCarAlerts } from '../services/alerts';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('Dashboard'));

const ALERT_CATEGORIES: AlertCategory[] = [
  'overdueAudit',
  'majorCriticalFinding',
  'overdueCAR',
  'shipmentInspectionRequest',
  'rejectedShipmentDocument',
  'lateShipment',
];

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await Promise.all([backfillOverdueAuditAlerts(), backfillOverdueCarAlerts(), backfillLateShipmentAlerts()]);
    const list = await prisma.alert.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(list);
  })
);

router.get(
  '/preferences',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const prefs = await prisma.userAlertPreference.findMany({
      where: { userId: req.user.id },
      select: { alertCategory: true, enabled: true },
    });
    const map: Record<string, boolean> = {};
    for (const c of ALERT_CATEGORIES) map[c] = true;
    for (const p of prefs) map[p.alertCategory] = p.enabled;
    res.json({ categories: ALERT_CATEGORIES, preferences: map });
  })
);

router.put(
  '/preferences',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const prefsRaw = req.body?.preferences as Record<string, boolean> | undefined;
    if (!prefsRaw || typeof prefsRaw !== 'object') {
      res.status(400).json({ error: 'preferences object is required' });
      return;
    }
    const ops = ALERT_CATEGORIES.map((category) =>
      prismaBase.userAlertPreference.upsert({
        where: { userId_alertCategory: { userId: req.user!.id, alertCategory: category } },
        create: { userId: req.user!.id, alertCategory: category, enabled: Boolean(prefsRaw[category]) },
        update: { enabled: Boolean(prefsRaw[category]) },
      })
    );
    await prismaBase.$transaction(ops);
    res.json({ ok: true });
  })
);

export default router;
