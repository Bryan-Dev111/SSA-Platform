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
import commodityTypesRoutes from './routes/commodity-types';
import defectCodesRoutes from './routes/defect-codes';
import dispositionCodesRoutes from './routes/disposition-codes';
import auditTypesRoutes from './routes/audit-types';
import riskWeightsRoutes from './routes/risk-weights';
import buyerSuppliersRoutes from './routes/buyer-suppliers';
import qeSuppliersRoutes from './routes/qe-suppliers';
import auditorSuppliersRoutes from './routes/auditor-suppliers';
import qeBuyersRoutes from './routes/qe-buyers';
import qmQesRoutes from './routes/qm-qes';
import recordsRoutes from './routes/records';
import shipmentsRoutes from './routes/shipments';
import shipmentScheduleRoutes from './routes/shipment-schedule';
import documentsRoutes from './routes/documents';
import internalDocsRoutes from './routes/internal-docs';
import opportunitiesRoutes from './routes/opportunities';
import riskSnapshotsRoutes from './routes/risk-snapshots';
import riskActionsRoutes from './routes/risk-actions';
import dashboardRoutes from './routes/dashboard';
import alertsRoutes from './routes/alerts';
import geocodeRoutes from './routes/geocode';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
// Allow larger optional base64 file payloads on uploads.
app.use(express.json({ limit: '100mb' }));

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
app.use('/commodity-types', commodityTypesRoutes);
app.use('/defect-codes', defectCodesRoutes);
app.use('/disposition-codes', dispositionCodesRoutes);
app.use('/audit-types', auditTypesRoutes);
app.use('/risk-weights', riskWeightsRoutes);
app.use('/buyer-suppliers', buyerSuppliersRoutes);
app.use('/qe-suppliers', qeSuppliersRoutes);
app.use('/auditor-suppliers', auditorSuppliersRoutes);
app.use('/qe-buyers', qeBuyersRoutes);
app.use('/qm-qes', qmQesRoutes);
app.use('/records', recordsRoutes);
app.use('/shipments', shipmentsRoutes);
app.use('/shipment-schedule', shipmentScheduleRoutes);
app.use('/documents', documentsRoutes);
app.use('/internal-docs', internalDocsRoutes);
app.use('/opportunities', opportunitiesRoutes);
app.use('/risk-snapshots', riskSnapshotsRoutes);
app.use('/risk-actions', riskActionsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/alerts', alertsRoutes);
app.use('/geocode', geocodeRoutes);
/** Same router: supports clients whose VITE_API_URL includes /api while hitting Express directly (no Vercel strip). */
app.use('/api/geocode', geocodeRoutes);

app.use(errorHandler);

export default app;
