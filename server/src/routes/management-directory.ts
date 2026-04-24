/**
 * Minimal user directory for Internal Management assignment UIs (Admin + Quality Manager).
 * Avoids exposing password fields from GET /users.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['Admin', 'QualityManager']));

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isEmployee: true,
        isContractor: true,
        country: true,
        hourlyRate: true,
        currency: true,
        employmentResponsibilities: true,
        employmentNotes: true,
        userRoles: { include: { role: true } },
        qmQes: { select: { qualityEngineerId: true } },
        sourcingDirectorStaffAsDirector: { select: { staffUserId: true } },
        assignedCountries: { select: { country: true }, orderBy: { country: 'asc' } },
      },
      orderBy: { email: 'asc' },
    });
    res.json(
      users.map((u) => {
        const fromRows = u.assignedCountries.map((r) => r.country).filter(Boolean);
        const assignedCountryNames =
          fromRows.length > 0
            ? [...new Set(fromRows)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
            : u.country?.trim()
              ? [u.country.trim()]
              : [];
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          isEmployee: u.isEmployee,
          isContractor: u.isContractor,
          country: u.country,
          assignedCountryNames,
          hourlyRate: u.hourlyRate,
          currency: u.currency,
          employmentResponsibilities: u.employmentResponsibilities,
          employmentNotes: u.employmentNotes,
          roleNames: u.userRoles.map((ur) => ur.role.name),
          qmAssignedQeIds: u.qmQes.map((q) => q.qualityEngineerId),
          sourcingDirectorAssignedStaffIds: u.sourcingDirectorStaffAsDirector.map((r) => r.staffUserId),
        };
      })
    );
  })
);

export default router;
