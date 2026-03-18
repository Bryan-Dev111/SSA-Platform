/**
 * Sentinel Supplier Assurance Platform — API Server
 * Day 5: Core API structure, users, suppliers (read), error handling
 */
import path from 'path';
import { config } from 'dotenv';

// Load .env: root first, then server/ so DATABASE_URL (Supabase) is set when running from server/
config({ path: path.resolve(process.cwd(), '..', '.env') });
config({ path: path.resolve(process.cwd(), '.env') });

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import usersRoutes from './routes/users';
import suppliersRoutes from './routes/suppliers';
import auditsRoutes from './routes/audits';
import findingsRoutes from './routes/findings';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 4000;

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

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Sentinel API listening on http://localhost:${PORT}`);
});
