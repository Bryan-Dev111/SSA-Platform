/**
 * Supplier Profile (Day 9.5): metrics, tables, upload record metadata, request shipment inspection.
 * Supplier role: full portal from GET /me/supplier-portal. Other roles: short notice.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { apiJson } from '../api/client';
import { parseApiError } from '../utils/apiHelpers';
import { downloadTableXlsx, type ExportRow } from '../utils/exportExcel';
import { MetricCard } from '../components/MetricCard';
import { MonthlyTrendsLineChart, type MonthlyTrendRow } from '../components/MonthlyTrendsLineChart';
import { SortableTh } from '../components/SortableTh';
import { Link, useSearchParams } from 'react-router-dom';
import { formatProfileTableDate } from '../utils/formatDisplayDates';
import { cmpNum, cmpStr, toggleSort, type SortDir } from '../utils/tableSort';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const MAX_RECORD_UPLOAD_BYTES = 75 * 1024 * 1024;

/** Shipment row status for supplier-facing table (matches Records-style labels). */
function normalizeUserDisplayText(s: string): string {
  return s.replace(/\bBuyer User\b/g, 'Buyer').trim();
}

function shipmentInspectionStatusLabel(status: string | undefined | null): string {
  switch (status) {
    case 'Passed':
      return 'Approved';
    case 'Failed':
      return 'Rejected';
    case 'WaitingInspection':
      return 'Pending';
    default:
      return 'Pending';
  }
}

interface Buyer {
  id: string;
  email: string;
  name: string | null;
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface PortalData {
  supplier: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    country: string | null;
    commodityType: { id: string; name: string } | null;
  };
  assignedBuyers: Buyer[];
  audits: Array<{
    id: string;
    code: string;
    auditDate: string;
    result: string | null;
    auditType: { code: string; name: string | null } | null;
  }>;
  findings: Array<{ id: string; code: string; status: string; severity: string; summary: string }>;
  cars: Array<{ id: string; code: string; status: string; severity: string; summary: string }>;
  riskSnapshots: Array<{ id: string; score: number | null; level: string; createdAt: string }>;
  records: Array<{
    id: string;
    name: string;
    notes: string | null;
    internalOrSupplier: string;
    status: string;
    createdAt: string;
    filePath?: string | null;
  }>;
  shipments: Array<{
    id: string;
    code: string | null;
    purchaseOrder: string | null;
    partNumber: string | null;
    lot: string | null;
    qty: number | null;
    inspectionDate: string | null;
    status: string;
    createdBy: string | null;
    createdAt: string;
    notes: string | null;
  }>;
  metrics: {
    assignedBuyerCount: number;
    openCarCount: number;
    overdueCarCount?: number;
    auditCount: number;
    findingCount: number;
    openFindingCount?: number;
    recordCount: number;
    shipmentCount: number;
    waitingInspectionCount?: number;
  };
  charts?: {
    monthlyTrends: MonthlyTrendRow[];
  };
}

interface ShipmentKpis {
  otdPercent: number | null;
  fpyPercent: number | null;
  /** Past-due schedule rows where shipped qty is below plan (late PO lines). */
  shortDeliveries?: number;
}

interface WeeklyRiskPoint {
  weekStartIso: string;
  label: string;
  score: number;
}

export function SupplierProfile() {
  const { token, user } = useAuth();
  const { t, language } = useLanguage();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const supplierIdFromUrl = searchParams.get('supplierId');
  const [data, setData] = useState<PortalData | null>(null);
  const [shipmentKpis, setShipmentKpis] = useState<ShipmentKpis | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordName, setRecordName] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [shipPo, setShipPo] = useState('');
  const [shipPart, setShipPart] = useState('');
  const [shipPartOptions, setShipPartOptions] = useState<string[]>([]);
  const [shipPartLoading, setShipPartLoading] = useState(false);
  const [shipLot, setShipLot] = useState('');
  const [shipQty, setShipQty] = useState('');
  const [shipDate, setShipDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [carSummaryModal, setCarSummaryModal] = useState<{ code: string; summary: string } | null>(null);
  const [shipmentSort, setShipmentSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [recordSort, setRecordSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [auditSort, setAuditSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [findingSort, setFindingSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [carSort, setCarSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: 'asc' });

  const isSupplier = user?.roleNames?.includes('Supplier');
  const roleNames = user?.roleNames ?? [];
  const isAdmin = roleNames.includes('Admin');
  /** Supplier portal or Admin acting on the selected supplier profile. */
  const canShowSupplierRequestAndRecord = isSupplier || isAdmin;
  const canSelectSupplier = !isSupplier && roleNames.some((r) => ['Admin', 'Buyer', 'QualityEngineer', 'QualityManager'].includes(r));

  useEffect(() => {
    if (supplierIdFromUrl && canSelectSupplier) {
      setSelectedSupplierId(supplierIdFromUrl);
    }
  }, [supplierIdFromUrl, canSelectSupplier]);

  useEffect(() => {
    setCarSummaryModal(null);
  }, [data?.supplier?.id]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!canSelectSupplier) return;
    apiJson<SupplierOption[]>('/suppliers', { token })
      .then((list) => setSupplierOptions(list))
      .catch(() => setSupplierOptions([]));
  }, [token, canSelectSupplier]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    if (isSupplier) {
      apiJson<PortalData>('/me/supplier-portal', { token })
        .then(setData)
        .catch((e: unknown) => {
          setData(null);
          setError(parseApiError(e));
        })
        .finally(() => setLoading(false));
      return;
    }
    if (canSelectSupplier && selectedSupplierId) {
      apiJson<PortalData>(`/suppliers/${encodeURIComponent(selectedSupplierId)}/profile`, { token })
        .then(setData)
        .catch((e: unknown) => {
          setData(null);
          setError(parseApiError(e));
        })
        .finally(() => setLoading(false));
      return;
    }
    setData(null);
    setLoading(false);
  }, [token, isSupplier, canSelectSupplier, selectedSupplierId]);

  useEffect(() => {
    if (!token || !data?.supplier?.id) {
      setShipmentKpis(null);
      return;
    }
    apiJson<ShipmentKpis>(`/shipments/metrics?supplierId=${encodeURIComponent(data.supplier.id)}`, { token })
      .then((k) => setShipmentKpis(k))
      .catch(() => setShipmentKpis(null));
  }, [token, data?.supplier?.id]);

  useEffect(() => {
    if (!(isSupplier || isAdmin) || !data?.supplier?.id || !token) return;
    const po = shipPo.trim();
    if (!po) {
      setShipPartOptions([]);
      setShipPart('');
      return;
    }
    const supplierId = data.supplier.id;
    const debounceId = window.setTimeout(() => {
      setShipPartLoading(true);
      const q = new URLSearchParams({ supplierId, purchaseOrder: po });
      apiJson<string[]>(`/shipments/schedule-parts?${q.toString()}`, { token })
        .then((parts) => {
          setShipPartOptions(parts);
          setShipPart((prev) => (prev && parts.includes(prev) ? prev : ''));
        })
        .catch(() => {
          setShipPartOptions([]);
          setShipPart('');
        })
        .finally(() => setShipPartLoading(false));
    }, 400);
    return () => window.clearTimeout(debounceId);
  }, [isSupplier, isAdmin, data?.supplier?.id, shipPo, token]);

  const refresh = () => {
    if (!token) return;
    const url = isSupplier
      ? '/me/supplier-portal'
      : selectedSupplierId
        ? `/suppliers/${encodeURIComponent(selectedSupplierId)}/profile`
        : '';
    if (!url) return;
    apiJson<PortalData>(url, { token }).then(setData).catch(() => {});
  };

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      refresh();
    }, 15000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [token, isSupplier, canSelectSupplier, selectedSupplierId]);

  const weeklyRiskSeries = useMemo(() => {
    if (!data?.riskSnapshots?.length) return [] as WeeklyRiskPoint[];
    return buildWeeklyRiskSeries(data.riskSnapshots);
  }, [data?.riskSnapshots]);

  const sortedShipments = useMemo(() => {
    const rows = data?.shipments ?? [];
    const key = shipmentSort.key;
    if (!key) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      switch (key) {
        case 'code':
          return cmpStr(a.code ?? '', b.code ?? '', shipmentSort.dir);
        case 'po':
          return cmpStr(a.purchaseOrder ?? '', b.purchaseOrder ?? '', shipmentSort.dir);
        case 'partNumber':
          return cmpStr(a.partNumber ?? '', b.partNumber ?? '', shipmentSort.dir);
        case 'qty':
          return cmpNum(a.qty ?? 0, b.qty ?? 0, shipmentSort.dir);
        case 'lot':
          return cmpStr(a.lot ?? '', b.lot ?? '', shipmentSort.dir);
        case 'inspectionDate':
          return cmpStr(a.inspectionDate ?? '', b.inspectionDate ?? '', shipmentSort.dir);
        case 'createdBy':
          return cmpStr(a.createdBy ?? '', b.createdBy ?? '', shipmentSort.dir);
        case 'createdAt':
          return cmpStr(a.createdAt, b.createdAt, shipmentSort.dir);
        case 'status':
          return cmpStr(a.status, b.status, shipmentSort.dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [data?.shipments, shipmentSort]);

  const sortedRecords = useMemo(() => {
    const rows = data?.records ?? [];
    const key = recordSort.key;
    if (!key) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      switch (key) {
        case 'name':
          return cmpStr(a.name, b.name, recordSort.dir);
        case 'notes':
          return cmpStr(a.notes ?? '', b.notes ?? '', recordSort.dir);
        case 'source':
          return cmpStr(a.internalOrSupplier, b.internalOrSupplier, recordSort.dir);
        case 'status':
          return cmpStr(a.status, b.status, recordSort.dir);
        case 'createdAt':
          return cmpStr(a.createdAt, b.createdAt, recordSort.dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [data?.records, recordSort]);

  const sortedAudits = useMemo(() => {
    const rows = data?.audits ?? [];
    const key = auditSort.key;
    if (!key) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      switch (key) {
        case 'code':
          return cmpStr(a.code, b.code, auditSort.dir);
        case 'date':
          return cmpStr(a.auditDate ?? '', b.auditDate ?? '', auditSort.dir);
        case 'type':
          return cmpStr(
            a.auditType?.name ?? a.auditType?.code ?? '',
            b.auditType?.name ?? b.auditType?.code ?? '',
            auditSort.dir
          );
        case 'result':
          return cmpStr(a.result ?? '', b.result ?? '', auditSort.dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [data?.audits, auditSort]);

  const sortedFindings = useMemo(() => {
    const rows = data?.findings ?? [];
    const key = findingSort.key;
    if (!key) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      switch (key) {
        case 'code':
          return cmpStr(a.code, b.code, findingSort.dir);
        case 'status':
          return cmpStr(a.status, b.status, findingSort.dir);
        case 'severity':
          return cmpStr(a.severity, b.severity, findingSort.dir);
        case 'summary':
          return cmpStr(a.summary, b.summary, findingSort.dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [data?.findings, findingSort]);

  const sortedCars = useMemo(() => {
    const rows = data?.cars ?? [];
    const key = carSort.key;
    if (!key) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      switch (key) {
        case 'code':
          return cmpStr(a.code, b.code, carSort.dir);
        case 'status':
          return cmpStr(a.status, b.status, carSort.dir);
        case 'severity':
          return cmpStr(a.severity, b.severity, carSort.dir);
        case 'summary':
          return cmpStr(a.summary, b.summary, carSort.dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [data?.cars, carSort]);

  const monthlyTrends = data?.charts?.monthlyTrends ?? [];
  const profileTrendMax = useMemo(
    () => Math.max(1, ...monthlyTrends.map((r) => Math.max(r.findings, r.cars, r.audits, r.shipments))),
    [monthlyTrends]
  );

  const auditPassPercent = useMemo(() => {
    const audits = data?.audits ?? [];
    if (audits.length === 0) return 0;
    const passed = audits.filter((a) => a.result === 'Passed').length;
    return Math.round((passed / audits.length) * 100);
  }, [data?.audits]);

  const criticalMajorCount = useMemo(() => {
    const findings = data?.findings ?? [];
    return findings.filter((f) => f.severity === 'Critical' || f.severity === 'Major').length;
  }, [data?.findings]);

  const submitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !data || !recordName.trim()) return;
    if (!recordFile) {
      toast.error(t('toast.fileRequired'));
      return;
    }
    if (recordFile.size > MAX_RECORD_UPLOAD_BYTES) {
      toast.error(t('toast.fileExceedsUploadLimit75mb'));
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('name', recordName.trim());
      form.append('notes', recordNotes.trim());
      form.append('internalOrSupplier', 'supplier');
      form.append('supplierId', data.supplier.id);
      form.append('file', recordFile);
      const res = await fetch(`${API_BASE}/records`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text || `HTTP ${res.status}`;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* keep msg */
        }
        throw new Error(msg);
      }
      setRecordName('');
      setRecordNotes('');
      setRecordFile(null);
      toast.success(t('supplierProfile.toast.recordSubmittedPending'));
      refresh();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !data) return;
    if (!shipPo.trim() || !shipPart.trim() || !shipLot.trim() || !shipQty.trim() || !shipDate.trim()) {
      toast.error(t('supplierProfile.toast.inspectionFieldsRequired'));
      return;
    }
    const qtyNum = Number(shipQty);
    if (Number.isNaN(qtyNum) || qtyNum < 0) {
      toast.error(t('supplierProfile.toast.quantityInvalid'));
      return;
    }
    setSubmitting(true);
    try {
      await apiJson('/shipments', {
        token,
        method: 'POST',
        body: JSON.stringify({
          supplierId: data.supplier.id,
          purchaseOrder: shipPo.trim(),
          partNumber: shipPart.trim(),
          lot: shipLot.trim(),
          qty: qtyNum,
          inspectionDate: shipDate.trim(),
        }),
      });
      setShipPo('');
      setShipPart('');
      setShipPartOptions([]);
      setShipLot('');
      setShipQty('');
      setShipDate('');
      toast.success(t('supplierProfile.toast.inspectionSubmitted'));
      refresh();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSupplier && !canSelectSupplier) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">{t('nav.supplierProfile')}</h1>
          <p className="page-description">
            You do not have permission to view supplier profiles from this page.
          </p>
        </header>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">{t('nav.supplierProfile')}</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">{t('nav.supplierProfile')}</h1>
          {canSelectSupplier && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)' }}>{t('filters.supplierColon')}</span>
              <select className="input" style={{ width: 'auto', minWidth: 260 }} value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                <option value="">{t('supplierProfile.selectSupplier')}</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>
        <div className="alert-error" role="alert">
          {error}
          {error?.includes('No supplier linked') ? (
            <p style={{ marginTop: '0.75rem', marginBottom: 0, fontWeight: 400 }}>
              {t('supplierProfile.noSupplierLinkedHint')}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const supplier = data?.supplier;
  const metrics = data?.metrics;
  const latePoCount = shipmentKpis?.shortDeliveries ?? 0;
  const latePoLabel =
    latePoCount === 1
      ? t('dashboard.metric.latePO_one', { count: latePoCount })
      : t('dashboard.metric.latePO_other', { count: latePoCount });
  const fpySubtitle =
    shipmentKpis?.fpyPercent != null
      ? t('shipments.metric.fpySubtitle', { pct: shipmentKpis.fpyPercent })
      : '—';

  const partNumberHint = !shipPo.trim()
    ? t('supplierProfile.shipmentRequest.poFirst')
    : shipPartLoading
      ? t('supplierProfile.shipmentRequest.loadingParts')
      : shipPartOptions.length === 0
        ? t('supplierProfile.shipmentRequest.noParts')
        : '';
  const partSelectRequired = Boolean(shipPo.trim() && shipPartOptions.length > 0);

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('nav.supplierProfile')}</h1>
        <p className="page-description">
          {isSupplier ? t('supplierProfile.introSupplierPortal') : t('supplierProfile.introStaff')}
        </p>
        {canSelectSupplier && (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)' }}>{t('filters.supplierColon')}</span>
            <select className="input" style={{ width: 'auto', minWidth: 280 }} value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
              <option value="">{t('supplierProfile.selectSupplier')}</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {!data && canSelectSupplier ? (
        <div className="placeholder-empty">
          <strong>{t('supplierProfile.emptyTitle')}</strong>
          <div style={{ marginTop: '0.5rem' }}>{t('supplierProfile.emptyHint')}</div>
        </div>
      ) : null}

      {!data || !supplier || !metrics ? null : (
        <>
      <div style={{ marginBottom: '0.75rem' }}>
        <strong>
          {supplier.code}: {supplier.name}
        </strong>
      </div>

      <div
        className="dashboard-metric-grid"
        style={{
          marginBottom: '1.5rem',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        }}
      >
        <MetricCard title={t('supplierProfile.metric.assignedBuyers')} value={metrics.assignedBuyerCount} />
        <MetricCard
          title={t('supplierProfile.metric.totalCars')}
          value={data.cars.length}
          subtitle={t('supplierProfile.metric.openCars', { count: metrics.openCarCount })}
        />
        <MetricCard
          title={t('supplierProfile.metric.totalAudits')}
          value={metrics.auditCount}
          subtitle={t('supplierProfile.metric.passPercent', { percent: auditPassPercent })}
        />
        <MetricCard
          title={t('supplierProfile.metric.totalFindings')}
          value={metrics.findingCount}
          subtitle={t('supplierProfile.metric.criticalMajor', { count: criticalMajorCount })}
        />
        <MetricCard
          title={t('supplierProfile.metric.totalShipments')}
          value={metrics.shipmentCount}
          subtitle={fpySubtitle}
        />
        <MetricCard
          title={t('supplierProfile.metric.otd')}
          value={shipmentKpis?.otdPercent != null ? `${shipmentKpis.otdPercent}%` : '—'}
          subtitle={latePoLabel}
          showAlert={latePoCount > 0}
          alertLabel={latePoLabel}
        />
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>{t('dashboard.monthlyTrends')}</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 0 }}>
            {t('supplierProfile.monthlyTrendsIntro')}
          </p>
          {monthlyTrends.length === 0 ? (
            <p className="table-empty">{t('dashboard.trendsEmpty')}</p>
          ) : (
            <MonthlyTrendsLineChart rows={monthlyTrends} maxY={profileTrendMax} />
          )}
        </div>
      </div>

      <SectionTable
        title={t('supplierProfile.qualityScoreHistory')}
        empty={t('supplierProfile.noQualitySnapshots')}
        rowCount={data.riskSnapshots.length}
      >
        {weeklyRiskSeries.length === 0 ? (
          <p className="table-empty">{t('supplierProfile.noNumericQualityScores')}</p>
          ) : (
          <RiskHistoryLineChart points={weeklyRiskSeries} />
        )}
      </SectionTable>

      {canShowSupplierRequestAndRecord ? (
      <div className="card" style={{ marginBottom: '1rem' }} key={`shipment-request-${language}`}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>{t('supplierProfile.shipmentRequest')}</h2>
          <form onSubmit={submitShipment}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div className="input-group">
                <label className="input-label">{t('supplierProfile.shipmentRequest.po')}</label>
                <input className="input" value={shipPo} onChange={(e) => setShipPo(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">{t('supplierProfile.shipmentRequest.partNumber')}</label>
                <select
                  className="input supplier-profile-part-select"
                  value={shipPart}
                  onChange={(e) => setShipPart(e.target.value)}
                  required={partSelectRequired}
                  disabled={shipPartLoading}
                  aria-describedby="supplier-profile-part-hint"
                >
                  <option value="">{t('supplierProfile.shipmentRequest.selectPartPlaceholder')}</option>
                  {shipPartOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {partNumberHint ? (
                  <p id="supplier-profile-part-hint" className="input-hint">
                    {partNumberHint}
                  </p>
                ) : null}
              </div>
              <div className="input-group">
                <label className="input-label">{t('supplierProfile.shipmentRequest.quantity')}</label>
                <input className="input" type="number" min={0} step="1" value={shipQty} onChange={(e) => setShipQty(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">{t('supplierProfile.shipmentRequest.lot')}</label>
                <input className="input" value={shipLot} onChange={(e) => setShipLot(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ whiteSpace: 'nowrap' }}>
                  {t('supplierProfile.shipmentRequest.inspectionDate')}
                </label>
                <input className="input" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem' }} disabled={submitting}>
              {submitting ? t('records.submitting') : t('records.submit')}
            </button>
          </form>
        </div>
      </div>
      ) : null}

      {canShowSupplierRequestAndRecord ? (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>{t('records.upload.title')}</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            {isAdmin && !isSupplier
              ? t('supplierProfile.uploadIntroAdmin')
              : t('supplierProfile.uploadIntroSupplier')}
          </p>
          <form onSubmit={submitRecord}>
            <div className="input-group">
              <label className="input-label">{t('records.field.recordName')}</label>
              <input className="input" value={recordName} onChange={(e) => setRecordName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">{t('records.field.fileRequired')}</label>
              <input
                className="input"
                type="file"
                onChange={(e) => setRecordFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">{t('records.field.notesOptional')}</label>
              <textarea className="input" rows={2} value={recordNotes} onChange={(e) => setRecordNotes(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('records.submitting') : t('common.upload')}
            </button>
          </form>
        </div>
      </div>
      ) : null}

      <SectionTable
        title={t('shipments.section.requests')}
        empty={t('shipments.emptyRequests')}
        rowCount={data.shipments.length}
      >
        <table className="table">
          <thead>
            <tr style={{ verticalAlign: 'bottom' }}>
              <SortableTh label={t('shipments.col.shipmentId')} columnKey="code" activeKey={shipmentSort.key} dir={shipmentSort.dir} onSort={(k) => setShipmentSort((p) => toggleSort(p, k))} />
              <th>{t('findings.col.supplier')}</th>
              <SortableTh label={t('shipments.col.po')} columnKey="po" activeKey={shipmentSort.key} dir={shipmentSort.dir} onSort={(k) => setShipmentSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('shipments.col.partNumber')} columnKey="partNumber" activeKey={shipmentSort.key} dir={shipmentSort.dir} onSort={(k) => setShipmentSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('shipments.col.quantity')} columnKey="qty" activeKey={shipmentSort.key} dir={shipmentSort.dir} onSort={(k) => setShipmentSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('shipments.col.lot')} columnKey="lot" activeKey={shipmentSort.key} dir={shipmentSort.dir} onSort={(k) => setShipmentSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('shipments.col.requestedDate')} columnKey="inspectionDate" activeKey={shipmentSort.key} dir={shipmentSort.dir} onSort={(k) => setShipmentSort((p) => toggleSort(p, k))} style={{ whiteSpace: 'nowrap' }} />
              <SortableTh label={t('table.col.user')} columnKey="createdBy" activeKey={shipmentSort.key} dir={shipmentSort.dir} onSort={(k) => setShipmentSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('shipments.col.created')} columnKey="createdAt" activeKey={shipmentSort.key} dir={shipmentSort.dir} onSort={(k) => setShipmentSort((p) => toggleSort(p, k))} />
              <th>{t('shipments.col.notes')}</th>
              <SortableTh label={t('table.col.status')} columnKey="status" activeKey={shipmentSort.key} dir={shipmentSort.dir} onSort={(k) => setShipmentSort((p) => toggleSort(p, k))} />
            </tr>
          </thead>
          <tbody>
            {sortedShipments.map((s) => (
              <tr key={s.id}>
                <td>{s.code ?? '—'}</td>
                <td>
                  {supplier?.code ?? '—'}: {supplier?.name ?? ''}
                </td>
                <td>{s.purchaseOrder ?? '—'}</td>
                <td>{s.partNumber ?? '—'}</td>
                <td>{s.qty ?? '—'}</td>
                <td>{s.lot ?? '—'}</td>
                <td>{formatProfileTableDate(s.inspectionDate)}</td>
                <td>{formatShipmentCreatedByLabel(s.createdBy)}</td>
                <td>{formatProfileTableDate(s.createdAt)}</td>
                <td
                  style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={s.notes ?? ''}
                >
                  {s.notes?.trim() ? s.notes : '—'}
                </td>
                <td>{shipmentInspectionStatusLabel(s.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      <SectionTable
        title={t('nav.records')}
        empty={t('records.emptyList')}
        rowCount={data.records.length}
        excelExport={{
          filename: `${safeExportFilePart(supplier.code)}_Records`,
          sheetName: 'Records',
          getRows: () =>
            data.records.map(
              (r): ExportRow => ({
                Name: r.name,
                Notes: r.notes ?? '',
                File: r.filePath ? 'Yes' : '',
                Source: r.internalOrSupplier,
                Status: r.status,
                Created: new Date(r.createdAt).toLocaleString(),
              })
            ),
        }}
      >
        <table className="table">
          <thead>
            <tr>
              <SortableTh label={t('table.col.name')} columnKey="name" activeKey={recordSort.key} dir={recordSort.dir} onSort={(k) => setRecordSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('table.col.notes')} columnKey="notes" activeKey={recordSort.key} dir={recordSort.dir} onSort={(k) => setRecordSort((p) => toggleSort(p, k))} />
              <th>{t('table.col.file')}</th>
              <SortableTh label={t('table.col.source')} columnKey="source" activeKey={recordSort.key} dir={recordSort.dir} onSort={(k) => setRecordSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('table.col.status')} columnKey="status" activeKey={recordSort.key} dir={recordSort.dir} onSort={(k) => setRecordSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('table.col.created')} columnKey="createdAt" activeKey={recordSort.key} dir={recordSort.dir} onSort={(k) => setRecordSort((p) => toggleSort(p, k))} />
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes ?? ''}>
                  {r.notes?.trim() ? r.notes : '—'}
                </td>
                <td>{r.filePath ? t('common.yes') : '—'}</td>
                <td>{r.internalOrSupplier}</td>
                <td>{r.status}</td>
                <td>{formatProfileTableDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      <SectionTable
        title={t('nav.audits')}
        empty={t('supplierProfile.noAudits')}
        rowCount={data.audits.length}
      >
        <table className="table">
          <thead>
            <tr>
              <SortableTh label={t('findings.col.code')} columnKey="code" activeKey={auditSort.key} dir={auditSort.dir} onSort={(k) => setAuditSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('audits.col.date')} columnKey="date" activeKey={auditSort.key} dir={auditSort.dir} onSort={(k) => setAuditSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('audits.col.type')} columnKey="type" activeKey={auditSort.key} dir={auditSort.dir} onSort={(k) => setAuditSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('audits.col.result')} columnKey="result" activeKey={auditSort.key} dir={auditSort.dir} onSort={(k) => setAuditSort((p) => toggleSort(p, k))} />
            </tr>
          </thead>
          <tbody>
            {sortedAudits.map((a) => (
              <tr key={a.id}>
                <td>{a.code}</td>
                <td>{formatProfileTableDate(a.auditDate)}</td>
                <td>{a.auditType?.name?.trim() || a.auditType?.code || '—'}</td>
                <td style={{ color: auditResultColor(a.result), fontWeight: auditResultColor(a.result) ? 600 : undefined }}>
                  {a.result ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      <SectionTable
        title={t('nav.findings')}
        empty={t('supplierProfile.noFindings')}
        rowCount={data.findings.length}
      >
        <table className="table">
          <thead>
            <tr>
              <SortableTh label={t('findings.col.code')} columnKey="code" activeKey={findingSort.key} dir={findingSort.dir} onSort={(k) => setFindingSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('findings.col.status')} columnKey="status" activeKey={findingSort.key} dir={findingSort.dir} onSort={(k) => setFindingSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('findings.col.severity')} columnKey="severity" activeKey={findingSort.key} dir={findingSort.dir} onSort={(k) => setFindingSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('findings.col.summary')} columnKey="summary" activeKey={findingSort.key} dir={findingSort.dir} onSort={(k) => setFindingSort((p) => toggleSort(p, k))} />
            </tr>
          </thead>
          <tbody>
            {sortedFindings.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link to={`/findings-record?id=${f.id}`}>{f.code}</Link>
                </td>
                <td>{f.status}</td>
                <td>{f.severity}</td>
                <td>{f.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>

      <SectionTable
        title={t('nav.correctiveActions')}
        empty={t('supplierProfile.noCorrectiveActions')}
        rowCount={data.cars.length}
      >
        <table className="table">
          <thead>
            <tr>
              <SortableTh label={t('findings.col.code')} columnKey="code" activeKey={carSort.key} dir={carSort.dir} onSort={(k) => setCarSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('findings.col.status')} columnKey="status" activeKey={carSort.key} dir={carSort.dir} onSort={(k) => setCarSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('findings.col.severity')} columnKey="severity" activeKey={carSort.key} dir={carSort.dir} onSort={(k) => setCarSort((p) => toggleSort(p, k))} />
              <SortableTh label={t('findings.col.summary')} columnKey="summary" activeKey={carSort.key} dir={carSort.dir} onSort={(k) => setCarSort((p) => toggleSort(p, k))} />
            </tr>
          </thead>
          <tbody>
            {sortedCars.map((c) => (
              <tr
                key={c.id}
                style={isCarClosed(c.status) ? { opacity: 0.55, color: 'var(--color-text-muted)' } : undefined}
              >
                <td>
                  <Link to={`/car-record?id=${c.id}`}>{c.code}</Link>
                </td>
                <td>{c.status}</td>
                <td>{c.severity}</td>
                <td style={{ maxWidth: 300, whiteSpace: 'normal', verticalAlign: 'top' }}>
                  {(c.summary ?? '').length > 120 ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setCarSummaryModal({ code: c.code, summary: c.summary ?? '' })}
                      style={{
                        padding: 0,
                        textAlign: 'left',
                        lineHeight: 1.35,
                        color: 'inherit',
                        width: '100%',
                        overflow: 'hidden',
                        maxHeight: '2.7em',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                      title={t('supplierProfile.viewFullSummary')}
                    >
                      {c.summary}
                    </button>
                  ) : (
                    <div style={{ lineHeight: 1.35 }}>{c.summary?.trim() ? c.summary : '—'}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionTable>
      </>
      )}

      {carSummaryModal && (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-profile-car-summary-title"
          onClick={() => setCarSummaryModal(null)}
        >
          <div className="confirm-dialog confirm-dialog--wide" onClick={(e) => e.stopPropagation()}>
            <h3 id="supplier-profile-car-summary-title" className="confirm-dialog-title">
              {t('supplierProfile.carSummaryTitle', { code: carSummaryModal.code })}
            </h3>
            <p style={{ marginBottom: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{carSummaryModal.summary}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={() => setCarSummaryModal(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function safeExportFilePart(s: string): string {
  return s.replace(/[/\\?*:[\]"<>|]/g, '_').trim() || 'supplier';
}

/** Strip demo-style role suffix from shipment requester label. */
function formatShipmentCreatedByLabel(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return '—';
  return normalizeUserDisplayText(String(raw));
}

function buildWeeklyRiskSeries(
  snapshots: Array<{ id: string; score: number | null; level: string; createdAt: string }>
): WeeklyRiskPoint[] {
  const sortedAsc = [...snapshots]
    .filter((s): s is { id: string; score: number; level: string; createdAt: string } => typeof s.score === 'number')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (sortedAsc.length === 0) return [];

  const byWeek = new Map<string, number>();
  for (const snap of sortedAsc) {
    const created = new Date(snap.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const iso = toUtcWeekStart(created).toISOString().slice(0, 10);
    byWeek.set(iso, Math.round(snap.score * 100) / 100);
  }

  const weekKeys = [...byWeek.keys()].sort();
  const firstWeek = new Date(`${weekKeys[0]}T12:00:00.000Z`);
  const lastWeek = toUtcWeekStart(new Date());
  const filled: WeeklyRiskPoint[] = [];
  let lastScore = byWeek.get(weekKeys[0]) ?? 0;
  const cursor = new Date(firstWeek);

  while (cursor.getTime() <= lastWeek.getTime()) {
    const iso = cursor.toISOString().slice(0, 10);
    if (byWeek.has(iso)) lastScore = byWeek.get(iso)!;
    filled.push({
      weekStartIso: iso,
      label: `${cursor.toLocaleString('en-US', { month: 'short' })} ${cursor.getUTCDate()}`,
      score: lastScore,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return filled;
}

function auditResultColor(result: string | null | undefined): string | undefined {
  const r = (result ?? '').trim().toLowerCase();
  if (r === 'failed') return 'var(--color-danger, #dc2626)';
  if (r === 'passed') return 'var(--color-success, #16a34a)';
  return undefined;
}

function isCarClosed(status: string): boolean {
  return status.trim().toLowerCase() === 'closed';
}

function toUtcWeekStart(d: Date): Date {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - mondayOffset);
  return dt;
}

function RiskHistoryLineChart({ points }: { points: WeeklyRiskPoint[] }) {
  const { t } = useLanguage();
  const width = 960;
  const height = 280;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const maxY = Math.max(100, ...points.map((p) => p.score));
  const minY = 0;

  const xAt = (i: number) => padLeft + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yAt = (v: number) => padTop + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.score).toFixed(2)}`).join(' ');

  return (
    <div>
      <div style={{ marginBottom: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        {t('supplierProfile.weeklyQualityTrend')}
      </div>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: 680, height: 'auto', display: 'block' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
            const y = padTop + plotH * f;
            const val = Math.round(maxY * (1 - f));
            return (
              <g key={`grid-${idx}`}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                  {val}
                </text>
              </g>
            );
          })}

          <line x1={padLeft} y1={padTop + plotH} x2={width - padRight} y2={padTop + plotH} stroke="#9ca3af" />
          <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#9ca3af" />

          <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" />
          {points.map((p, i) => (
            <circle key={p.weekStartIso} cx={xAt(i)} cy={yAt(p.score)} r="3.5" fill="#2563eb" />
          ))}

          {points.map((p, i) => (
            <text key={`${p.weekStartIso}-x`} x={xAt(i)} y={height - 14} textAnchor="middle" fontSize="11" fill="#6b7280">
              {p.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function SectionTable({
  title,
  empty,
  rowCount,
  children,
  excelExport,
}: {
  title: string;
  empty: string;
  rowCount: number;
  children: ReactNode;
  excelExport?: { filename: string; sheetName: string; getRows: () => ExportRow[] };
}) {
  const toast = useToast();
  const { t } = useLanguage();

  const handleExportExcel = () => {
    if (!excelExport) return;
    if (rowCount === 0) {
      toast.info(t('toast.noDataToExport'));
      return;
    }
    try {
      const rows = excelExport.getRows();
      if (rows.length === 0) {
        toast.info(t('toast.noDataToExport'));
        return;
      }
      downloadTableXlsx(excelExport.filename, excelExport.sheetName, rows);
      toast.success(t('findings.exportDone'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('findings.exportFailed'));
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-body">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>{title}</h2>
          {excelExport ? (
            <button type="button" className="btn btn-ghost" onClick={handleExportExcel} disabled={rowCount === 0}>
              {t('common.exportExcel')}
            </button>
          ) : null}
        </div>
        <div className="table-wrap">
          {rowCount === 0 ? <p className="table-empty">{empty}</p> : children}
        </div>
      </div>
    </div>
  );
}
