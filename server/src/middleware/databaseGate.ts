/**
 * Blocks data API routes when the database has been disconnected by Super user.
 */
import type { Request, Response, NextFunction } from 'express';
import { isDatabaseConnected } from '../lib/databaseConnection';

const EXEMPT_PREFIXES = [
  '/health',
  '/auth',
  '/super/database',
  '/api/super/database',
  '/legal',
  '/api/legal',
];

export function databaseGateMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isDatabaseConnected()) {
    next();
    return;
  }
  const path = req.path || '';
  if (EXEMPT_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'))) {
    next();
    return;
  }
  res.status(503).json({
    error: 'Database disconnected',
    code: 'DATABASE_DISCONNECTED',
    connected: false,
  });
}
