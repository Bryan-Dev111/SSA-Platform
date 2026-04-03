import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RiskDistributionCard } from '../components/RiskDistributionCard';
import { MetricCard } from '../components/MetricCard';
import { ShipmentMetricAlertIcon } from '../components/ShipmentMetricAlertIcon';
import { MonthlyTrendsLineChart, type MonthlyTrendRow } from '../components/MonthlyTrendsLineChart';
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
    openCarsWaitingApproval?: number;
    openRisks: number;
    overdueRisks: number;
    openFindingsTotal?: number;
    openFindingsMajorCritical: number;
    shipmentRequests: number;
    shipmentsRejected: number;
    rejectedDocuments: number;
    shipmentLate?: number;
    shipmentOverdue?: number;
    shipmentShortDeliveryDetails?: Array<{
      purchaseOrder: string | null;
      partNumber: string | null;
      missingQty: number;
    }>;
    shipmentOverdueInspectionDetails?: Array<{ purchaseOrder: string | null; qty: number | null }>;
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
    monthlyTrends: MonthlyTrendRow[];
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
    openCarsWaitingApproval: 0,
    openRisks: 0,
    overdueRisks: 0,
    openFindingsTotal: 0,
    openFindingsMajorCritical: 0,
    shipmentRequests: 0,
    shipmentsRejected: 0,
    rejectedDocuments: 0,
    shipmentLate: 0,
    shipmentOverdue: 0,
    shipmentShortDeliveryDetails: [],
    shipmentOverdueInspectionDetails: [],
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

      <div className="dashboard-metric-grid">
        <MetricCard
          title="Total suppliers"
          value={metrics.totalSuppliers}
          subtitle={`${metrics.highRiskSuppliers} high-risk supplier${metrics.highRiskSuppliers === 1 ? '' : 's'}`}
        />
        <MetricCard
          title="Open CARs"
          value={metrics.openCars}
          subtitle={`${metrics.overdueCars} overdue · ${metrics.openCarsWaitingApproval ?? 0} waiting approval`}
        />
        <MetricCard
          title="Open risks"
          value={metrics.openRisks}
          subtitle={`${metrics.overdueRisks} overdue risk action${metrics.overdueRisks === 1 ? '' : 's'}`}
        />
        <MetricCard
          title="Open findings"
          value={metrics.openFindingsTotal || metrics.openFindingsMajorCritical}
          subtitle={`${metrics.openFindingsMajorCritical} Major/Critical open`}
        />
        <MetricCard
          title="Shipments"
          value={metrics.shipmentRequests}
          subtitle={`${metrics.shipmentLate ?? 0} Late PO · ${metrics.shipmentOverdue ?? 0} Overdue Inspection`}
          customAlert={
            (metrics.shipmentLate ?? 0) > 0 || (metrics.shipmentOverdue ?? 0) > 0 ? (
              <ShipmentMetricAlertIcon
                shortDeliveries={metrics.shipmentLate ?? 0}
                shortDetails={metrics.shipmentShortDeliveryDetails ?? []}
                overdueInspectionCount={metrics.shipmentOverdue ?? 0}
                overdueInspectionDetails={metrics.shipmentOverdueInspectionDetails ?? []}
              />
            ) : undefined
          }
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
                          {e.date
                            ? new Date(e.date).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'N/A'}
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
              <div className="table-wrap" style={{ maxHeight: 265, overflowY: 'auto' }}>
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
                        <td>
                          {new Date(u.date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
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
