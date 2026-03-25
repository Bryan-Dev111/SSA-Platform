/**
 * Employee/Contractor -> Supplier assignments (Admin only).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['Admin']));

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const employeeId = typeof req.body?.employeeId === 'string' ? req.body.employeeId.trim() : '';
    const supplierId = typeof req.body?.supplierId === 'string' ? req.body.supplierId.trim() : '';
    if (!employeeId || !supplierId) {
      res.status(400).json({ error: 'employeeId and supplierId are required' });
      return;
    }
    const [employee, supplier] = await Promise.all([
      prisma.user.findUnique({
        where: { id: employeeId },
        select: { id: true, isEmployee: true, isContractor: true },
      }),
      prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }),
    ]);
    if (!employee || (!employee.isEmployee && !employee.isContractor)) {
      res.status(400).json({ error: 'Selected user must be an employee or contractor' });
      return;
    }
    if (!supplier) {
      res.status(400).json({ error: 'Supplier not found' });
      return;
    }
    const created = await prisma.employeeSupplierAssignment.upsert({
      where: { employeeId_supplierId: { employeeId, supplierId } },
      create: { employeeId, supplierId },
      update: {},
    });
    res.status(201).json(created);
  })
);

router.delete(
  '/:employeeId/:supplierId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const employeeId = req.params.employeeId;
    const supplierId = req.params.supplierId;
    await prisma.employeeSupplierAssignment.delete({
      where: { employeeId_supplierId: { employeeId, supplierId } },
    });
    res.status(204).send();
  })
);

export default router;

