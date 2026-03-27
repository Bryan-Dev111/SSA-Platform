import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RiskDistributionCard } from '../components/RiskDistributionCard';
import { apiJson } from '../api/client';
import { computeRiskRegisterDistribution } from '../utils/riskDistribution';

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface DashboardResponse {
  metrics: {
    totalSuppliers: number;
    highRiskSuppliers: number;
    mediumRiskSuppliers?: number;
    openCars: number;
    overdueCars: number;
    openFindingsMajorCritical: number;
    shipmentRequests: number;
    shipmentsRejected: number;
    rejectedDocuments: number;
  };
  charts: {
    upcomingEvents: Array<{
      id: string;
      type: 'Audit' | 'Shipment';
      code: string;
      date: string | null;
      supplierCode: string;
      supplierName: string;
    }>;
    recentUpdates: Array<{
      id: string;
      type: 'Shipment Request' | 'Finding' | 'CAR' | 'Audit';
      code: string;
      date: string;
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

type DashboardLikelihood = 'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely' | null;
type DashboardSeverity = 'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe' | null;

interface DashboardOpportunityRow {
  id: string;
  type: 'risk' | 'opportunity';
  likelihood: DashboardLikelihood;
  severity: DashboardSeverity;
  riskLevel: 'Low' | 'Medium' | 'High' | null;
  createdAt: string;
}

interface DashboardRiskActionRow {
  riskId: string;
  status: 'Open' | 'Closed';
  residualLikelihood: DashboardLikelihood;
  residualSeverity: DashboardSeverity;
  residualRiskLevel: 'Low' | 'Medium' | 'High' | null;
  createdAt: string;
}

export function Dashboard() {
  const { token, user } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [riskRegisterItems, setRiskRegisterItems] = useState<DashboardOpportunityRow[]>([]);
  const [riskRegisterActions, setRiskRegisterActions] = useState<DashboardRiskActionRow[]>([]);
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
    (async () => {
      try {
        const [dashData, opportunities, riskActions] = await Promise.all([
          apiJson<DashboardResponse>(`/dashboard${q}`, { token }),
          apiJson<DashboardOpportunityRow[]>(`/opportunities${q}`, { token }),
          apiJson<DashboardRiskActionRow[]>(`/risk-actions${q}`, { token }),
        ]);
        setData(dashData);
        setRiskRegisterItems(
          [...opportunities].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        );
        setRiskRegisterActions(
          [...riskActions].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
        setData(null);
        setRiskRegisterItems([]);
        setRiskRegisterActions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, filterSupplierId]);

  const trendMax = useMemo(() => {
    const rows = data?.charts.monthlyTrends ?? [];
    return Math.max(1, ...rows.map((r) => Math.max(r.findings, r.cars, r.audits, r.shipments)));
  }, [data]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const riskRegisterDistribution = useMemo(
    () => computeRiskRegisterDistribution(riskRegisterItems, riskRegisterActions),
    [riskRegisterItems, riskRegisterActions]
  );

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
    mediumRiskSuppliers: 0,
    openCars: 0,
    overdueCars: 0,
    openFindingsMajorCritical: 0,
    shipmentRequests: 0,
    shipmentsRejected: 0,
    rejectedDocuments: 0,
  };
  const upcoming = data?.charts.upcomingEvents ?? [];
  const recentUpdates = data?.charts.recentUpdates ?? [];
  const monthly = data?.charts.monthlyTrends ?? [];

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">
          {greeting}
          {user?.name?.trim() ? `, ${user.name.trim()}` : user?.email ? `, ${user.email}` : ''}. Here is what is happening with
          your suppliers today.
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
        <MetricCard
          title="Total suppliers"
          value={metrics.totalSuppliers}
          subtitle={`${metrics.highRiskSuppliers} high-risk supplier${metrics.highRiskSuppliers === 1 ? '' : 's'}`}
        />
        <MetricCard
          title="Open CARs"
          value={metrics.openCars}
          subtitle={`${metrics.overdueCars} overdue CAR${metrics.overdueCars === 1 ? '' : 's'}`}
        />
        <MetricCard
          title="Open findings"
          value={metrics.openFindingsMajorCritical}
          subtitle="Open Major or Critical findings"
        />
        <MetricCard
          title="Shipment Requests"
          value={metrics.shipmentRequests}
          subtitle="Awaiting inspection"
        />
      </div>

      <div className="dashboard-split" style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            height: '100%',
          }}
        >
            <RiskDistributionCard distribution={riskRegisterDistribution} />

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
            <h2 style={{ marginTop: 0 }}>Recent Updates</h2>
            {recentUpdates.length === 0 ? (
              <p className="table-empty">No updates in last 7 days.</p>
            ) : (
              <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
                <table className="table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Code</th>
                      <th>Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUpdates.map((u) => (
                      <tr key={u.id}>
                        <td>{new Date(u.date).toLocaleDateString()}</td>
                        <td>{u.type}</td>
                        <td title={u.code} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.code}
                        </td>
                        <td title={u.supplierCode ? `${u.supplierCode} — ${u.supplierName}` : u.supplierName} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.supplierCode} — {u.supplierName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Monthly trends</h2>
          {monthly.length === 0 ? (
            <p className="table-empty">No trend data yet.</p>
          ) : (
            <MonthlyTrendsLineChart rows={monthly} maxY={trendMax} />
          )}
        </div>
      </div>

    </div>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: number; subtitle?: string }) {
  return (
    <div className="card">
      <div className="card-body" style={{ padding: '0.9rem' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{value}</div>
        {subtitle ? (
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', lineHeight: 1.35 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const TREND = {
  findings: { stroke: '#c2185b', fill: 'rgba(194, 24, 91, 0.14)' },
  cars: { stroke: '#c99a17', fill: 'rgba(201, 154, 23, 0.18)' },
  audits: { stroke: '#1f78c8', fill: 'rgba(31, 120, 200, 0.16)' },
  shipments: { stroke: '#6e47c8', fill: 'rgba(110, 71, 200, 0.12)' },
} as const;

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
  const baselineY = padTop + plotH;

  const toSmoothPath = (values: number[]): string => {
    if (values.length === 0) return '';
    if (values.length === 1) return `M ${xAt(0).toFixed(2)} ${yAt(values[0]).toFixed(2)}`;
    let d = `M ${xAt(0).toFixed(2)} ${yAt(values[0]).toFixed(2)}`;
    for (let i = 0; i < values.length - 1; i += 1) {
      const x0 = xAt(i);
      const y0 = yAt(values[i]);
      const x1 = xAt(i + 1);
      const y1 = yAt(values[i + 1]);
      const cx1 = x0 + (x1 - x0) * 0.42;
      const cx2 = x1 - (x1 - x0) * 0.42;
      d += ` C ${cx1.toFixed(2)} ${y0.toFixed(2)}, ${cx2.toFixed(2)} ${y1.toFixed(2)}, ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    }
    return d;
  };

  const toAreaPath = (values: number[]): string => {
    if (values.length === 0) return '';
    const line = toSmoothPath(values);
    const startX = xAt(0);
    const endX = xAt(values.length - 1);
    return `${line} L ${endX.toFixed(2)} ${baselineY.toFixed(2)} L ${startX.toFixed(2)} ${baselineY.toFixed(2)} Z`;
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
        <LegendItem color={TREND.findings.stroke} label="Findings" />
        <LegendItem color={TREND.cars.stroke} label="CARs" />
        <LegendItem color={TREND.audits.stroke} label="Audits" />
        <LegendItem color={TREND.shipments.stroke} label="Shipments" dashed />
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

          <path d={toAreaPath(findingsVals)} fill={TREND.findings.fill} stroke="none" />
          <path d={toAreaPath(carsVals)} fill={TREND.cars.fill} stroke="none" />
          <path d={toAreaPath(auditsVals)} fill={TREND.audits.fill} stroke="none" />
          <path d={toAreaPath(shipmentsVals)} fill={TREND.shipments.fill} stroke="none" />

          <path d={toSmoothPath(findingsVals)} fill="none" stroke={TREND.findings.stroke} strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" />
          <path d={toSmoothPath(carsVals)} fill="none" stroke={TREND.cars.stroke} strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" />
          <path d={toSmoothPath(auditsVals)} fill="none" stroke={TREND.audits.stroke} strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d={toSmoothPath(shipmentsVals)}
            fill="none"
            stroke={TREND.shipments.stroke}
            strokeWidth="2.35"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 3"
          />

          {rows.map((r, i) => (
            <g key={`x-${r.month}-${i}`}>
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
              <circle cx={hoverX} cy={yAt(hovered.findings)} r="3.8" fill={TREND.findings.stroke} />
              <circle cx={hoverX} cy={yAt(hovered.cars)} r="3.8" fill={TREND.cars.stroke} />
              <circle cx={hoverX} cy={yAt(hovered.audits)} r="3.8" fill={TREND.audits.stroke} />
              <circle cx={hoverX} cy={yAt(hovered.shipments)} r="3.8" fill={TREND.shipments.stroke} />
              <g transform={`translate(${Math.min(hoverX + 10, width - 220)}, ${padTop + 8})`}>
                <rect width="200" height="92" rx="8" fill="#111827" opacity="0.93" />
                <text x="10" y="18" fill="#ffffff" fontSize="12" fontWeight="700">
                  {hovered.month}
                </text>
                <text x="10" y="36" fill={TREND.findings.stroke} fontSize="12">
                  Findings: {hovered.findings}
                </text>
                <text x="10" y="52" fill={TREND.cars.stroke} fontSize="12">
                  CARs: {hovered.cars}
                </text>
                <text x="10" y="68" fill={TREND.audits.stroke} fontSize="12">
                  Audits: {hovered.audits}
                </text>
                <text x="10" y="84" fill={TREND.shipments.stroke} fontSize="12">
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

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width={22} height={10} style={{ flexShrink: 0 }} aria-hidden>
        <line
          x1={1}
          y1={5}
          x2={21}
          y2={5}
          stroke={color}
          strokeWidth={2.35}
          strokeLinecap="round"
          strokeDasharray={dashed ? '5 3' : undefined}
        />
      </svg>
      {label}
    </span>
  );
}
