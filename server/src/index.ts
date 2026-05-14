/**
 * Sentinel Supplier Assurance Platform — API Server
 * Local dev: runs Express with listen(). For Vercel, the app is exported from app.ts and used by api/index.js.
 */
import app from './app';

const PORT = process.env.PORT || 4000;

const dbUrl = process.env.DATABASE_URL?.trim();
const directUrl = process.env.DIRECT_URL?.trim();
if (!dbUrl || !directUrl) {
  console.error(
    '[sentinel-api] Missing DATABASE_URL and/or DIRECT_URL. Prisma needs both (set them in server/.env or the repo root .env). Copy server/env.template to server/.env and fill in values, then restart the server.'
  );
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Sentinel API listening on http://localhost:${PORT}`);
});
