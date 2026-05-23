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
  const errObj = err as { status?: number; code?: string; message?: string };
  let status = errObj.status ?? 500;
  let message = err instanceof Error ? err.message : 'Internal server error';

  // Prisma DB connectivity failures should be surfaced as service unavailable.
  if (
    errObj.code === 'P1001' ||
    errObj.code === 'P1017' ||
    /Can't reach database server/i.test(message) ||
    /Server has closed the connection/i.test(message)
  ) {
    status = 503;
    message = 'Database is temporarily unavailable. Please try again shortly.';
  }

  if (errObj.code === 'P2022' || /column.*does not exist/i.test(message)) {
    status = 500;
    message =
      'Database schema is out of date. Run `npx prisma migrate deploy` in the server folder, then restart the API.';
  }

  // Avoid noisy stack traces when DB is temporarily unreachable.
  if (status >= 500 && status !== 503) {
    console.error('API error:', err);
  } else if (status === 503) {
    console.warn('API warning:', message);
  }
  res.status(status).json({ error: message });
}
