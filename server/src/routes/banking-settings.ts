/**
 * Sentinel Global Supply — Internal Management → Banking: org-level API keys for bank / treasury integrations.
 * Secrets encrypted with PASSWORD_ENCRYPTION_KEY (same helper as user password storage).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePageAccessAny, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { encryptPassword, decryptPassword } from '../lib/passwordCrypto';

const router = Router();
const SINGLETON_ID = 'singleton';

router.use(authMiddleware);
router.use(requirePageAccessAny(['InternalManagement', 'GlobalSupplyInternalManagement']));
/** Bank credentials: Admin only. */
router.use(requireRole(['Admin']));

function maskHint(plain: string | null): string | null {
  if (!plain) return null;
  const t = plain.trim();
  if (!t) return null;
  if (t.length <= 4) return '****';
  return `…${t.slice(-4)}`;
}

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const row = await prisma.bankingSettings.findUnique({
      where: { id: SINGLETON_ID },
      select: {
        provider: true,
        institutionLabel: true,
        apiKeyEncrypted: true,
        apiSecretEncrypted: true,
        updatedAt: true,
      },
    });
    if (!row) {
      res.json({
        provider: 'custom',
        institutionLabel: null,
        apiKeyHint: null,
        apiSecretConfigured: false,
        updatedAt: null,
      });
      return;
    }
    const apiKeyPlain = decryptPassword(row.apiKeyEncrypted);
    res.json({
      provider: row.provider,
      institutionLabel: row.institutionLabel,
      apiKeyHint: maskHint(apiKeyPlain),
      apiSecretConfigured: Boolean(decryptPassword(row.apiSecretEncrypted)),
      updatedAt: row.updatedAt.toISOString(),
    });
  })
);

router.put(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Record<string, unknown>;

    const providerRaw = typeof body.provider === 'string' ? body.provider.trim() : '';
    const provider = providerRaw || 'custom';

    const institutionLabel =
      typeof body.institutionLabel === 'string'
        ? body.institutionLabel.trim() || null
        : body.institutionLabel === null
          ? null
          : undefined;

    const patch: {
      provider: string;
      institutionLabel?: string | null;
      apiKeyEncrypted?: string | null;
      apiSecretEncrypted?: string | null;
    } = { provider };

    if (institutionLabel !== undefined) {
      patch.institutionLabel = institutionLabel;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      const v = body.apiKey;
      if (v === null || v === '') {
        patch.apiKeyEncrypted = null;
      } else if (typeof v === 'string' && v.trim()) {
        patch.apiKeyEncrypted = encryptPassword(v.trim());
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'apiSecret')) {
      const v = body.apiSecret;
      if (v === null || v === '') {
        patch.apiSecretEncrypted = null;
      } else if (typeof v === 'string' && v.trim()) {
        patch.apiSecretEncrypted = encryptPassword(v.trim());
      }
    }

    await prisma.bankingSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        provider: patch.provider,
        institutionLabel: patch.institutionLabel ?? null,
        apiKeyEncrypted: patch.apiKeyEncrypted ?? null,
        apiSecretEncrypted: patch.apiSecretEncrypted ?? null,
      },
      update: {
        provider: patch.provider,
        ...(patch.institutionLabel !== undefined ? { institutionLabel: patch.institutionLabel } : {}),
        ...(patch.apiKeyEncrypted !== undefined ? { apiKeyEncrypted: patch.apiKeyEncrypted } : {}),
        ...(patch.apiSecretEncrypted !== undefined ? { apiSecretEncrypted: patch.apiSecretEncrypted } : {}),
      },
    });

    const row = await prisma.bankingSettings.findUnique({
      where: { id: SINGLETON_ID },
      select: {
        provider: true,
        institutionLabel: true,
        apiKeyEncrypted: true,
        apiSecretEncrypted: true,
        updatedAt: true,
      },
    });
    const apiKeyPlain = row ? decryptPassword(row.apiKeyEncrypted) : null;
    res.json({
      ok: true,
      provider: row?.provider ?? 'custom',
      institutionLabel: row?.institutionLabel ?? null,
      apiKeyHint: maskHint(apiKeyPlain),
      apiSecretConfigured: Boolean(row && decryptPassword(row.apiSecretEncrypted)),
      updatedAt: row?.updatedAt.toISOString() ?? null,
    });
  })
);

export default router;
