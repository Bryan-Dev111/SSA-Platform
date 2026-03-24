/**
 * Server-side geocoding for the Suppliers map. Browser calls to Nominatim often fail (CORS / usage policy);
 * we call OpenStreetMap Nominatim from the server with a proper User-Agent and rate limiting.
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authMiddleware);

const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT?.trim() ||
  'SSA-Platform/1.0 (supplier map geocoding; +https://www.openstreetmap.org/copyright)';

const BATCH_MAX = Math.min(100, Math.max(1, Number(process.env.GEOCODE_BATCH_MAX) || 50));

let lastNominatimCallMs = 0;
const MIN_INTERVAL_MS = 1100;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function nominatimGeocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastNominatimCallMs);
  if (wait > 0) await sleep(wait);
  lastNominatimCallMs = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!rows?.length) return null;
  const lat = Number(rows[0].lat);
  const lon = Number(rows[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

router.post(
  '/batch',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const raw = req.body?.items;
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: 'items must be a non-empty array of { id, q }' });
      return;
    }
    if (raw.length > BATCH_MAX) {
      res.status(400).json({ error: `too many items (max ${BATCH_MAX})` });
      return;
    }

    const items: { id: string; q: string }[] = [];
    for (const row of raw) {
      const id = typeof row?.id === 'string' ? row.id : '';
      const q = typeof row?.q === 'string' ? row.q : '';
      if (id && q.trim()) items.push({ id, q: q.trim() });
    }

    const out: Record<string, { lat: number; lon: number }> = {};
    const byQuery = new Map<string, { lat: number; lon: number } | null>();

    for (const item of items) {
      let point = byQuery.get(item.q);
      if (point === undefined) {
        // eslint-disable-next-line no-await-in-loop -- Nominatim requires sequential requests
        point = await nominatimGeocode(item.q);
        byQuery.set(item.q, point);
      }
      if (point) out[item.id] = point;
    }

    res.json(out);
  })
);

export default router;
