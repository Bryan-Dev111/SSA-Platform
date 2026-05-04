/**
 * Global Supply Internal Management — calendar: user-added events (subject + date).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('GlobalSupplyInternalManagement'));

function parseEventDate(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split('-').map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.globalSupplyCalendarEvent.findMany({
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        subject: true,
        eventDate: true,
        createdAt: true,
      },
    });
    res.json(list);
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const body = req.body ?? {};
    const subjectRaw = typeof body.subject === 'string' ? body.subject.trim() : '';
    if (!subjectRaw) {
      res.status(400).json({ error: 'subject is required' });
      return;
    }
    if (subjectRaw.length > 500) {
      res.status(400).json({ error: 'subject must be at most 500 characters' });
      return;
    }
    const eventDate = parseEventDate(body.eventDate);
    if (!eventDate) {
      res.status(400).json({ error: 'eventDate is required (YYYY-MM-DD)' });
      return;
    }

    const created = await prisma.globalSupplyCalendarEvent.create({
      data: {
        subject: subjectRaw,
        eventDate,
        createdById: req.user.id,
      },
      select: {
        id: true,
        subject: true,
        eventDate: true,
        createdAt: true,
      },
    });
    res.status(201).json(created);
  })
);

export default router;
