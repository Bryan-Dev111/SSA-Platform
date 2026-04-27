import type { Request, Response, NextFunction } from 'express';
import { parseRequestLanguage, parseRequestLocale } from '../lib/locale';

/**
 * Resolve locale once per request so routes can localize payload text
 * without reparsing Accept-Language repeatedly.
 */
export function requestLocaleMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('accept-language');
  res.locals.language = parseRequestLanguage(header);
  res.locals.locale = parseRequestLocale(header);
  next();
}
