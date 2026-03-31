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
import employeeSuppliersRoutes from './routes/employee-suppliers';
import qeBuyersRoutes from './routes/qe-buyers';
import qmQesRoutes from './routes/qm-qes';
import workLogsRoutes from './routes/work-logs';
import laborCostsRoutes from './routes/labor-costs';
import recordsRoutes from './routes/records';
import shipmentsRoutes from './routes/shipments';
import shipmentScheduleRoutes from './routes/shipment-schedule';
import documentsRoutes from './routes/documents';
import internalDocsRoutes from './routes/internal-docs';
import clientHistoryRoutes from './routes/client-history';
import opportunitiesRoutes from './routes/opportunities';
import riskSnapshotsRoutes from './routes/risk-snapshots';
import riskActionsRoutes from './routes/risk-actions';
import dashboardRoutes from './routes/dashboard';
import alertsRoutes from './routes/alerts';
import geocodeRoutes from './routes/geocode';
import farmsRoutes from './routes/farms';
import farmProfileRoutes from './routes/farm-profile';
import expensesRoutes from './routes/expenses';
import purchaseOrdersRoutes from './routes/purchase-orders';
import samplesRoutes from './routes/samples';
import legalRoutes from './routes/legal';
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
app.use('/employee-suppliers', employeeSuppliersRoutes);
app.use('/qe-buyers', qeBuyersRoutes);
app.use('/qm-qes', qmQesRoutes);
app.use('/work-logs', workLogsRoutes);
app.use('/labor-costs', laborCostsRoutes);
app.use('/records', recordsRoutes);
app.use('/shipments', shipmentsRoutes);
app.use('/shipment-schedule', shipmentScheduleRoutes);
app.use('/documents', documentsRoutes);
app.use('/internal-docs', internalDocsRoutes);
app.use('/client-history', clientHistoryRoutes);
app.use('/project-history', clientHistoryRoutes);
app.use('/opportunities', opportunitiesRoutes);
app.use('/risk-snapshots', riskSnapshotsRoutes);
app.use('/risk-actions', riskActionsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/alerts', alertsRoutes);
app.use('/geocode', geocodeRoutes);
app.use('/farms', farmsRoutes);
app.use('/farm-profile', farmProfileRoutes);
app.use('/expenses', expensesRoutes);
app.use('/purchase-orders', purchaseOrdersRoutes);
app.use('/samples', samplesRoutes);
app.use('/legal', legalRoutes);
/** Same router: supports clients whose VITE_API_URL includes /api while hitting Express directly (no Vercel strip). */
app.use('/api/geocode', geocodeRoutes);
app.use('/api/farms', farmsRoutes);
app.use('/api/farm-profile', farmProfileRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/samples', samplesRoutes);
app.use('/api/legal', legalRoutes);

app.use(errorHandler);

export default app;
