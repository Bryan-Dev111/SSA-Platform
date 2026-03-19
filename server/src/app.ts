/**
 * Express app (no listen) — used by index.ts for local dev and by Vercel serverless.
 */
import path from 'path';
import { config } from 'dotenv';

// Load .env: repo root and server/ so DATABASE_URL works from server/ or from Vercel (cwd = repo root)
config({ path: path.resolve(process.cwd(), '..', '.env') });
config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), 'server', '.env') });

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import usersRoutes from './routes/users';
import suppliersRoutes from './routes/suppliers';
import auditsRoutes from './routes/audits';
import findingsRoutes from './routes/findings';
import carsRoutes from './routes/cars';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sentinel-api' });
});

app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/users', usersRoutes);
app.use('/suppliers', suppliersRoutes);
app.use('/audits', auditsRoutes);
app.use('/findings', findingsRoutes);
app.use('/cars', carsRoutes);

app.use(errorHandler);

export default app;
