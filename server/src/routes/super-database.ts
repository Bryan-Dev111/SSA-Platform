/**
 * Super user: database connection status and connect/disconnect controls.
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
} from '../lib/databaseConnection';
import { isSuperUserEmail } from '../lib/superUser';
import { changeSuperPassword } from '../lib/superUserCredentials';

const router = Router();

function requireSuperUser(req: Request, res: Response): boolean {
  if (!req.user || !isSuperUserEmail(req.user.email)) {
    res.status(403).json({ error: 'Super user required' });
    return false;
  }
  return true;
}

router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.json({ connected: isDatabaseConnected() });
  })
);

router.use(authMiddleware);

router.post(
  '/connect',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireSuperUser(req, res)) return;
    await connectDatabase();
    res.json({ connected: true });
  })
);

router.post(
  '/disconnect',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireSuperUser(req, res)) return;
    await disconnectDatabase();
    res.json({ connected: false });
  })
);

router.post(
  '/change-password',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!requireSuperUser(req, res)) return;
    const body = req.body as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };
    const currentPassword =
      typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword =
      typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
    if (!confirmPassword || newPassword !== confirmPassword) {
      res.status(400).json({ error: 'New password and confirmation do not match' });
      return;
    }
    const result = await changeSuperPassword(currentPassword, newPassword);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, message: 'Password updated successfully' });
  })
);

export default router;
