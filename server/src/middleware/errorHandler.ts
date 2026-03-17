/**
 * Central API error handler: consistent JSON error responses
 */
import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = (err as { status?: number }).status ?? 500;
  const message =
    err instanceof Error ? err.message : 'Internal server error';
  if (status >= 500) {
    console.error('API error:', err);
  }
  res.status(status).json({ error: message });
}
