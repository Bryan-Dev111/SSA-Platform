/**
 * Client History — Internal Management (Admin only).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('InternalManagement'));
router.use(requireRole(['Admin']));

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.clientHistory.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json(list);
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Record<string, unknown>;
    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    if (!clientName || !companyName) {
      res.status(400).json({ error: 'clientName and companyName are required' });
      return;
    }
    const statusRaw = typeof body.status === 'string' ? body.status.trim() : 'Active';
    const status = statusRaw.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    const row = await prisma.clientHistory.create({
      data: {
        clientName,
        companyName,
        clientEmail: typeof body.clientEmail === 'string' ? body.clientEmail.trim() || null : null,
        clientMobile: typeof body.clientMobile === 'string' ? body.clientMobile.trim() || null : null,
        industry: typeof body.industry === 'string' ? body.industry.trim() || null : null,
        country: typeof body.country === 'string' ? body.country.trim() || null : null,
        projectDescription:
          typeof body.projectDescription === 'string' ? body.projectDescription.trim() || null : null,
        periodOfPerformance:
          typeof body.periodOfPerformance === 'string' ? body.periodOfPerformance.trim() || null : null,
        revenue: typeof body.revenue === 'string' ? body.revenue.trim() || null : null,
        status,
      },
    });
    res.status(201).json(row);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.clientHistory.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const data: {
      clientName?: string;
      companyName?: string;
      clientEmail?: string | null;
      clientMobile?: string | null;
      industry?: string | null;
      country?: string | null;
      projectDescription?: string | null;
      periodOfPerformance?: string | null;
      revenue?: string | null;
      status?: string;
    } = {};
    if (typeof body.clientName === 'string') data.clientName = body.clientName.trim();
    if (typeof body.companyName === 'string') data.companyName = body.companyName.trim();
    if (body.clientEmail !== undefined) {
      data.clientEmail = typeof body.clientEmail === 'string' ? body.clientEmail.trim() || null : null;
    }
    if (body.clientMobile !== undefined) {
      data.clientMobile = typeof body.clientMobile === 'string' ? body.clientMobile.trim() || null : null;
    }
    if (body.industry !== undefined) {
      data.industry = typeof body.industry === 'string' ? body.industry.trim() || null : null;
    }
    if (body.country !== undefined) data.country = typeof body.country === 'string' ? body.country.trim() || null : null;
    if (body.projectDescription !== undefined) {
      data.projectDescription =
        typeof body.projectDescription === 'string' ? body.projectDescription.trim() || null : null;
    }
    if (body.periodOfPerformance !== undefined) {
      data.periodOfPerformance =
        typeof body.periodOfPerformance === 'string' ? body.periodOfPerformance.trim() || null : null;
    }
    if (body.revenue !== undefined) data.revenue = typeof body.revenue === 'string' ? body.revenue.trim() || null : null;
    if (typeof body.status === 'string') {
      data.status = body.status.trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    }
    if (data.clientName !== undefined && !data.clientName) {
      res.status(400).json({ error: 'clientName cannot be empty' });
      return;
    }
    if (data.companyName !== undefined && !data.companyName) {
      res.status(400).json({ error: 'companyName cannot be empty' });
      return;
    }
    const row = await prisma.clientHistory.update({
      where: { id },
      data,
    });
    res.json(row);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    const existing = await prisma.clientHistory.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await prisma.clientHistory.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
