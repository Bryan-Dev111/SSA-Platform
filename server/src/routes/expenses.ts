import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccess } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextCode } from '../services/idGenerator';

const router = Router();

router.use(authMiddleware);
router.use(requirePageAccess('GlobalSupplyExpenses'));

function parseExpenseDate(val: unknown): Date | null {
  if (typeof val !== 'string' || !val.trim()) return null;
  // YYYY-MM-DD from date inputs
  return new Date(val.trim().slice(0, 10) + 'T12:00:00.000Z');
}

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await prisma.expense.findMany({
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ list });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const type = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const project = typeof req.body?.project === 'string' ? req.body.project.trim() : '';
    const amountRaw = req.body?.amount;
    const amount = Number(amountRaw);
    const expenseDate = parseExpenseDate(req.body?.expenseDate);

    if (!type || !description || !project || !Number.isFinite(amount) || !expenseDate || Number.isNaN(expenseDate.getTime())) {
      res
        .status(400)
        .json({ error: 'type, description, project, numeric amount, and expenseDate (YYYY-MM-DD) are required' });
      return;
    }

    const code = await getNextCode('EXP');

    const created = await prisma.expense.create({
      data: { code, type, description, project, amount, expenseDate },
    });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const data: {
      type?: string;
      description?: string;
      project?: string;
      amount?: number;
      expenseDate?: Date;
    } = {};
    if (typeof req.body?.type === 'string') data.type = req.body.type.trim();
    if (typeof req.body?.description === 'string') data.description = req.body.description.trim();
    if (typeof req.body?.project === 'string') data.project = req.body.project.trim();
    if (req.body?.amount !== undefined) {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount)) {
        res.status(400).json({ error: 'amount must be numeric' });
        return;
      }
      data.amount = amount;
    }
    if (req.body?.expenseDate !== undefined) {
      const expenseDate = parseExpenseDate(req.body.expenseDate);
      if (!expenseDate || Number.isNaN(expenseDate.getTime())) {
        res.status(400).json({ error: 'expenseDate must be YYYY-MM-DD' });
        return;
      }
      data.expenseDate = expenseDate;
    }

    const updated = await prisma.expense.update({ where: { id }, data });
    res.json(updated);
  })
);

export default router;
