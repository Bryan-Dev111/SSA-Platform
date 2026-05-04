/**
 * Sentinel Supplier Assurance reference data (separate from Global Supply options).
 */
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccessAny, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);

/** List types for Internal Management → Expenses and Admin → Expense types. */
const expenseTypeRead = requirePageAccessAny(['InternalManagement', 'Admin']);

router.get(
  '/expense-types',
  expenseTypeRead,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.supplierAssuranceExpenseType.findMany({ orderBy: [{ name: 'asc' }] });
    res.json({ list });
  })
);

router.post(
  '/expense-types',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const created = await prisma.supplierAssuranceExpenseType.create({ data: { name } });
      res.status(201).json(created);
    } catch {
      res.status(400).json({ error: 'Duplicate expense type or invalid data' });
    }
  })
);

router.patch(
  '/expense-types/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const updated = await prisma.supplierAssuranceExpenseType.update({
        where: { id: String(req.params.id) },
        data: { name },
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Expense type not found or duplicate name' });
    }
  })
);

router.delete(
  '/expense-types/:id',
  requireRole(['Admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.supplierAssuranceExpenseType.delete({ where: { id: String(req.params.id) } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: 'Expense type not found' });
    }
  })
);

export default router;
