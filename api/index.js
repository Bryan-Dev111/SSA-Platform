/**
 * Vercel serverless entry: forward /api/* to the Express app.
 * Build must run from repo root so server/dist/app.js exists (see vercel.json buildCommand).
 */
const path = require('path');
const appPath = path.resolve(__dirname, '../server/dist/app.js');
const app = require(appPath).default;

module.exports = (req, res) => {
  // Strip /api prefix so Express sees /auth/login, /cars, etc.
  const path = req.url.replace(/^\/api/, '') || '/';
  req.url = path;
  app(req, res);
};
