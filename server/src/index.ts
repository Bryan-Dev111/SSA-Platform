/**
 * Sentinel Supplier Assurance Platform — API Server
 * Local dev: runs Express with listen(). For Vercel, the app is exported from app.ts and used by api/index.js.
 */
import app from './app';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Sentinel API listening on http://localhost:${PORT}`);
});
