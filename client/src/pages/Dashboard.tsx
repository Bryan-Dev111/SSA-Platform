import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../api/client';

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface DashboardResponse {
  metrics: {
    totalSuppliers: number;
    highRiskSuppliers: number;
    openCars: number;
    overdueCars: number;
    openFindingsMajorCritical: number;
    shipmentsOnHold: number;
    rejectedDocuments: number;
  };
  charts: {
    topRiskSuppliers: Array<{
      supplierId: string;
      code: string;
      name: string;
      score: number;
      level: 'Low' | 'Medium' | 'High';
    }>;
    upcomingEvents: Array<{
      id: string;
      type: 'Audit' | 'Shipment';
      code: string;
      date: string | null;
      supplierCode: string;
      supplierName: string;
    }>;
    monthlyTrends: Array<{
      month: string;
      findings: number;
      cars: number;
      audits: number;
      shipments: number;
    }>;
  };
}

type AlertCategory =
  | 'overdueAudit'
  | 'majorCriticalFinding'
  | 'overdueCAR'
  | 'shipmentInspectionRequest'
  | 'rejectedShipmentDocument'
  | 'lateShipment';

interface AlertRow {
  id: string;
  category: AlertCategory;
  entityType: string | null;
  entityId: string | null;
  message: string | null;
  createdAt: string;
}

export function Dashboard() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [alertPrefs, setAlertPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiJson<SupplierOption[]>('/suppliers', { token })
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const q = filterSupplierId ? `?supplierId=${encodeURIComponent(filterSupplierId)}` : '';
    apiJson<DashboardResponse>(`/dashboard${q}`, { token })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [token, filterSupplierId]);

  useEffect(() => {
    if (!token) return;
    apiJson<AlertRow[]>('/alerts', { token })
      .then(setAlerts)
      .catch(() => setAlerts([]));
    apiJson<{ categories: AlertCategory[]; preferences: Record<string, boolean> }>('/alerts/preferences', { token })
      .then((v) => setAlertPrefs(v.preferences))
      .catch(() => setAlertPrefs({}));
  }, [token]);

  const trendMax = useMemo(() => {
    const rows = data?.charts.monthlyTrends ?? [];
    return Math.max(1, ...rows.map((r) => Math.max(r.findings, r.cars, r.audits, r.shipments)));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="page">
        <header className="page-header">
          <h1 className="page-title">Dashboard</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics ?? {
    totalSuppliers: 0,
    highRiskSuppliers: 0,
    openCars: 0,
    overdueCars: 0,
    openFindingsMajorCritical: 0,
    shipmentsOnHold: 0,
    rejectedDocuments: 0,
  };
  const topRisk = data?.charts.topRiskSuppliers ?? [];
  const upcoming = data?.charts.upcomingEvents ?? [];
  const monthly = data?.charts.monthlyTrends ?? [];
  const maxTopRisk = Math.max(1, ...topRisk.map((r) => r.score));

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">
          Metrics and trends for supplier quality performance. Buyer view is automatically scoped to assigned suppliers.
        </p>
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div style={{ marginBottom: '1rem' }}>
        <label>
          <span style={{ marginRight: 8, fontSize: 'var(--text-sm)' }}>Supplier filter:</span>
          <select
            className="input"
            style={{ minWidth: 220, width: 'auto' }}
            value={filterSupplierId}
            onChange={(e) => setFilterSupplierId(e.target.value)}
          >
            <option value="">All in scope</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          marginBottom: '1rem',
        }}
      >
        <MetricCard title="Total suppliers" value={metrics.totalSuppliers} />
        <MetricCard title="High-risk suppliers" value={metrics.highRiskSuppliers} />
        <MetricCard title="Open CARs" value={metrics.openCars} />
        <MetricCard title="Overdue CARs" value={metrics.overdueCars} />
        <MetricCard title="Open findings (Major/Critical)" value={metrics.openFindingsMajorCritical} />
        <MetricCard title="Shipments on hold" value={metrics.shipmentsOnHold} />
        <MetricCard title="Rejected documents" value={metrics.rejectedDocuments} />
      </div>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          marginBottom: '1rem',
        }}
      >
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Top risk suppliers</h2>
            {topRisk.length === 0 ? (
              <p className="table-empty">No data.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {topRisk.map((r) => (
                  <div key={r.supplierId}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 'var(--text-sm)',
                        marginBottom: 4,
                        gap: '0.75rem',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.code} — {r.name}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {r.score} ({r.level})
                      </span>
                    </div>
                    <div style={{ height: 8, background: 'var(--color-border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(r.score / maxTopRisk) * 100}%`,
                          height: '100%',
                          background: '#4f46e5',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Upcoming events</h2>
            {upcoming.length === 0 ? (
              <p className="table-empty">No upcoming audits or shipment inspections.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {upcoming.map((e) => (
                  <div
                    key={`${e.type}-${e.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr',
                      gap: '0.5rem',
                      fontSize: 'var(--text-sm)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      paddingBottom: '0.4rem',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {e.date ? new Date(e.date).toLocaleDateString() : 'N/A'}
                    </span>
                    <span>
                      <strong>{e.type}</strong> {e.code} - {e.supplierCode} — {e.supplierName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Monthly trends</h2>
          {monthly.length === 0 ? (
            <p className="table-empty">No trend data yet.</p>
          ) : (
            <MonthlyTrendsLineChart rows={monthly} maxY={trendMax} />
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          marginTop: '1rem',
        }}
      >
        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Alerts</h2>
            {alerts.length === 0 ? (
              <p className="table-empty">No alerts.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {alerts.slice(0, 12).map((a) => (
                  <div key={a.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.45rem' }}>
                    <div style={{ fontSize: 'var(--text-sm)' }}>{a.message || a.category}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>Alert preferences</h2>
            {Object.keys(alertPrefs).length === 0 ? (
              <p className="table-empty">No preference data.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {Object.entries(alertPrefs).map(([k, v]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(v)}
                      onChange={async (e) => {
                        if (!token) return;
                        const next = { ...alertPrefs, [k]: e.target.checked };
                        setAlertPrefs(next);
                        try {
                          await apiJson('/alerts/preferences', {
                            token,
                            method: 'PUT',
                            body: JSON.stringify({ preferences: next }),
                          });
                        } catch {
                          setAlertPrefs(alertPrefs);
                        }
                      }}
                    />
                    <span style={{ fontSize: 'var(--text-sm)' }}>{formatAlertCategory(k as AlertCategory)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="card">
      <div className="card-body" style={{ padding: '0.9rem' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

function formatAlertCategory(category: AlertCategory): string {
  switch (category) {
    case 'overdueAudit':
      return 'Overdue audit';
    case 'majorCriticalFinding':
      return 'Major/Critical finding';
    case 'overdueCAR':
      return 'Overdue CAR';
    case 'shipmentInspectionRequest':
      return 'Shipment inspection request';
    case 'rejectedShipmentDocument':
      return 'Rejected shipment/document';
    case 'lateShipment':
      return 'Late shipment';
    default:
      return category;
  }
}

function MonthlyTrendsLineChart({
  rows,
  maxY,
}: {
  rows: Array<{ month: string; findings: number; cars: number; audits: number; shipments: number }>;
  maxY: number;
}) {
  const width = 960;
  const height = 320;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 44;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const safeMax = Math.max(1, maxY);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const xAt = (i: number) => padLeft + (rows.length <= 1 ? 0 : (i / (rows.length - 1)) * plotW);
  const yAt = (v: number) => padTop + plotH - (v / safeMax) * plotH;

  const toPath = (values: number[]): string => {
    return values
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`)
      .join(' ');
  };

  const findingsVals = rows.map((r) => r.findings);
  const carsVals = rows.map((r) => r.cars);
  const auditsVals = rows.map((r) => r.audits);
  const shipmentsVals = rows.map((r) => r.shipments);

  const hovered = hoverIndex === null ? null : rows[hoverIndex];
  const hoverX = hoverIndex === null ? null : xAt(hoverIndex);

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '0.5rem', fontSize: 'var(--text-sm)' }}>
        <LegendItem color="#2563eb" label="Findings" />
        <LegendItem color="#f59e0b" label="CARs" />
        <LegendItem color="#16a34a" label="Audits" />
        <LegendItem color="#7c3aed" label="Shipments" />
      </div>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', minWidth: 680, height: 'auto', display: 'block' }}
          onMouseLeave={() => setHoverIndex(null)}
          role="img"
          aria-label="Monthly trends line chart for Findings, CARs, Audits, and Shipments"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
            const y = padTop + plotH * f;
            const val = Math.round(safeMax * (1 - f));
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

          <path d={toPath(findingsVals)} fill="none" stroke="#2563eb" strokeWidth="2.5" />
          <path d={toPath(carsVals)} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
          <path d={toPath(auditsVals)} fill="none" stroke="#16a34a" strokeWidth="2.5" />
          <path d={toPath(shipmentsVals)} fill="none" stroke="#7c3aed" strokeWidth="2.5" />

          {rows.map((r, i) => (
            <g key={`x-${r.month}`}>
              <line
                x1={xAt(i)}
                y1={padTop}
                x2={xAt(i)}
                y2={padTop + plotH}
                stroke="transparent"
                strokeWidth="18"
                onMouseMove={() => setHoverIndex(i)}
              />
              <text x={xAt(i)} y={height - 16} textAnchor="middle" fontSize="11" fill="#6b7280">
                {r.month}
              </text>
            </g>
          ))}

          {hovered && hoverX !== null ? (
            <>
              <line x1={hoverX} y1={padTop} x2={hoverX} y2={padTop + plotH} stroke="#9ca3af" strokeDasharray="4 3" />
              <circle cx={hoverX} cy={yAt(hovered.findings)} r="3.8" fill="#2563eb" />
              <circle cx={hoverX} cy={yAt(hovered.cars)} r="3.8" fill="#f59e0b" />
              <circle cx={hoverX} cy={yAt(hovered.audits)} r="3.8" fill="#16a34a" />
              <circle cx={hoverX} cy={yAt(hovered.shipments)} r="3.8" fill="#7c3aed" />
              <g transform={`translate(${Math.min(hoverX + 10, width - 220)}, ${padTop + 8})`}>
                <rect width="200" height="92" rx="8" fill="#111827" opacity="0.93" />
                <text x="10" y="18" fill="#ffffff" fontSize="12" fontWeight="700">
                  {hovered.month}
                </text>
                <text x="10" y="36" fill="#93c5fd" fontSize="12">
                  Findings: {hovered.findings}
                </text>
                <text x="10" y="52" fill="#fcd34d" fontSize="12">
                  CARs: {hovered.cars}
                </text>
                <text x="10" y="68" fill="#86efac" fontSize="12">
                  Audits: {hovered.audits}
                </text>
                <text x="10" y="84" fill="#c4b5fd" fontSize="12">
                  Shipments: {hovered.shipments}
                </text>
              </g>
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 14, height: 2.5, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
