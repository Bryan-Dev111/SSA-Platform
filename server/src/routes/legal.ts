import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import type { AppLanguage } from '../lib/locale';

const router = Router();

function legalTitleByLanguage(key: string, language: AppLanguage): string | null {
  if (key === 'terms') {
    if (language === 'es') return 'Términos y condiciones';
    if (language === 'fr') return 'Conditions générales';
    return 'Terms and Conditions';
  }
  if (key === 'privacy') {
    if (language === 'es') return 'Política de privacidad';
    if (language === 'fr') return 'Politique de confidentialité';
    return 'Privacy Policy';
  }
  return null;
}

// Public read: login page needs to show terms/privacy without auth.
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const language = res.locals.language;
    const docs = await (prisma as any).legalDocument.findMany();
    res.json(
      docs.map((d: any) => ({
        key: d.key,
        title: legalTitleByLanguage(d.key, language) ?? d.title,
        content: d.content,
        updatedAt: d.updatedAt,
      }))
    );
  })
);

router.get(
  '/:key',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const language = res.locals.language;
    const key = req.params.key;
    const doc = await (prisma as any).legalDocument.findUnique({ where: { key } });
    if (!doc) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({
      key: doc.key,
      title: legalTitleByLanguage(doc.key, language) ?? doc.title,
      content: doc.content,
      updatedAt: doc.updatedAt,
    });
  })
);

// Admin-only write/update
const adminOnly = [authMiddleware, requireRole(['Admin'])] as const;

router.put(
  '/:key',
  ...adminOnly,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const key = req.params.key === 'privacy' ? 'privacy' : 'terms';
    const title =
      key === 'terms'
        ? 'Terms and Conditions'
        : 'Privacy Policy';
    const content =
      typeof req.body?.content === 'string' && req.body.content.trim()
        ? req.body.content
        : '';
    if (!content.trim()) {
      res.status(400).json({ error: 'content is required' });
      return;
    }
    const doc = await (prisma as any).legalDocument.upsert({
      where: { key },
      update: { title, content },
      create: { key, title, content },
    });
    res.json({
      key: doc.key,
      title: doc.title,
      content: doc.content,
      updatedAt: doc.updatedAt,
    });
  })
);

export default router;

