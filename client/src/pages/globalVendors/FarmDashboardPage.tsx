/**
 * Global Vendors — Farm Dashboard: country-scoped KPIs, charts, and exportable farm table.
 * Employees with country assignments see only their countries; multi-country users pick from the dropdown.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { MetricCard } from '../../components/MetricCard';
import { ChartCard, ContinuousLineChart, VerticalBarChart } from '../../components/DashboardBarCharts';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';

type FarmDashboardPayload = {
  staffRestricted: boolean;
  allowedCountries: string[];
  selectedCountry: string | null;
  kpis: {
    totalFarms: number;
    totalEmployees: number;
    openPos: number;
    openPoValue: number;
  };
  graphs: {
    farmsByWeight: { label: string; value: number }[];
    farmsByRevenue: { label: string; value: number }[];
    farmsByProfit: { label: string; value: number }[];
    farmsByPoCount: { label: string; value: number }[];
    farmsBySample: { label: string; value: number }[];
    poPlacementOverTime: { date: string; count: number }[];
  };
  tableRows: {
    farmId: string;
    country: string;
    region: string;
    weightKg: number;
    revenue: number;
    profit: number;
    samples: number;
  }[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatKg(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
}

function formatCount(value: number): string {
  return `${Math.round(value).toLocaleString()}`;
}

export function FarmDashboardPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FarmDashboardPayload | null>(null);
  /** Empty string = all countries (non–country-assigned users). Otherwise ISO-ish / display country string. */
  const [countrySelection, setCountrySelection] = useState('');

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const qs = countrySelection ? `?country=${encodeURIComponent(countrySelection)}` : '';
      const d = await apiJson<FarmDashboardPayload>(`/farm-dashboard${qs}`, { token });
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load farm dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, countrySelection]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const selectValue = useMemo(() => {
    if (!data) return countrySelection;
    if (data.staffRestricted) {
      return countrySelection || data.selectedCountry || '';
    }
    return countrySelection;
  }, [countrySelection, data]);

  const showCountryDropdown = Boolean(
    data && (data.staffRestricted ? data.allowedCountries.length > 1 : data.allowedCountries.length > 0)
  );

  const exportTable = () => {
    if (!data?.tableRows.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = data.selectedCountry ? `_${data.selectedCountry.replace(/\s+/g, '_')}` : '_all';
    const rows: ExportRow[] = data.tableRows.map((r) => ({
      'Farm ID': r.farmId,
      Country: r.country,
      Region: r.region || '—',
      'Weight (kg)': r.weightKg,
      Revenue: r.revenue,
      Profit: r.profit,
      Samples: r.samples,
    }));
    downloadTableXlsx(`Farm_Dashboard${scope}_${stamp}`, 'Farms', rows);
  };

  const quickLinks: { to: string; label: string; hint: string }[] = [
    { to: '/global-vendors/farmers', label: 'Farm Information', hint: 'Full register, add farms, export' },
    { to: '/global-vendors/farm-profile', label: 'Farm profile', hint: 'Photos, processing, narrative' },
    { to: '/global-vendors/map', label: 'Farms map', hint: 'Geocoded locations' },
    { to: '/global-vendors/approved', label: 'Approved farms list', hint: 'Approved view' },
    { to: '/global-vendors/relationship', label: 'Relationship & trust', hint: 'Visits and relationship status' },
    { to: '/global-vendors/dashboard', label: 'Business dashboard', hint: 'PO, revenue, and samples KPIs' },
  ];

  if (loading && !data) {
    return (
      <div className="page page-dashboard">
        <header className="page-header">
          <h1 className="page-title">Farm Dashboard</h1>
        </header>
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading farm dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page page-dashboard">
        <header className="page-header">
          <h1 className="page-title">Farm Dashboard</h1>
        </header>
        <div className="alert-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page page-dashboard">
        <header className="page-header">
          <h1 className="page-title">Farm Dashboard</h1>
        </header>
        <p className="table-empty">No data.</p>
      </div>
    );
  }

  const g = data.graphs;
  const scopeLabel =
    !data.staffRestricted && !data.selectedCountry ? 'All countries' : (data.selectedCountry ?? '');

  return (
    <div className="page page-dashboard">
      <header className="page-header">
        <h1 className="page-title">Farm Dashboard</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          {data.staffRestricted
            ? data.allowedCountries.length > 1
              ? 'Farms are limited to your assigned countries. Use the menu below to switch between them.'
              : 'Farms are limited to your assigned country.'
            : 'Use the country filter to focus one country, or leave “All countries” for the full register.'}
        </p>
        {data.staffRestricted && data.allowedCountries.length === 1 ? (
          <p className="page-description" style={{ marginTop: '0.25rem' }}>
            Assigned country: <strong>{data.allowedCountries[0]}</strong>
          </p>
        ) : null}
      </header>

      {showCountryDropdown ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0, minWidth: 260 }}>
              <label className="input-label" htmlFor="farm-dashboard-country">
                {data.staffRestricted ? 'Country' : 'Country filter'}
              </label>
              <select
                id="farm-dashboard-country"
                className="input"
                value={selectValue}
                onChange={(e) => setCountrySelection(e.target.value)}
                style={{ minWidth: 260 }}
              >
                {!data.staffRestricted ? (
                  <option value="">All countries</option>
                ) : null}
                {data.allowedCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {scopeLabel ? (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                Scope: <strong>{scopeLabel}</strong>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="dashboard-metric-grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          marginBottom: '1rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <MetricCard title="Total Farms" value={data.kpis.totalFarms} subtitle="Farms in current scope" />
        <MetricCard
          title="Total Employees"
          value={data.kpis.totalEmployees}
          subtitle={
            data.selectedCountry
              ? `Staff assigned to ${data.selectedCountry}`
              : 'Employees & contractors (all regions)'
          }
        />
        <MetricCard title="Open POs" value={data.kpis.openPos} subtitle="Purchase orders not closed" />
        <MetricCard
          title="Open PO Value"
          value={formatMoney(data.kpis.openPoValue)}
          subtitle="Sum of open PO amounts (est.)"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '0.9rem',
          marginBottom: '0.9rem',
        }}
      >
        <ChartCard title="Farms by Weight" subtitle="Total kg on purchase orders per farm (all statuses)">
          <VerticalBarChart rows={g.farmsByWeight} valueFormatter={formatKg} />
        </ChartCard>
        <ChartCard title="Farms by Revenue" subtitle="Closed purchase orders only">
          <VerticalBarChart rows={g.farmsByRevenue} valueFormatter={formatMoney} />
        </ChartCard>
        <ChartCard title="Farms by Profit" subtitle="Closed PO revenue − linked Global Vendors expenses">
          <VerticalBarChart rows={g.farmsByProfit} valueFormatter={formatMoney} />
        </ChartCard>
        <ChartCard title="Farms by PO" subtitle="Number of purchase orders per farm">
          <VerticalBarChart rows={g.farmsByPoCount} valueFormatter={formatCount} />
        </ChartCard>
        <ChartCard title="Farms by Sample" subtitle="Sample records linked to each farm">
          <VerticalBarChart rows={g.farmsBySample} valueFormatter={formatCount} />
        </ChartCard>
        <ChartCard title="PO Placement" subtitle="Purchase orders placed over time (count per day)">
          <ContinuousLineChart
            rows={g.poPlacementOverTime}
            ariaLabel="PO placement over time"
            valueLabel="PO(s) placed"
            strokeColor="#2563eb"
          />
        </ChartCard>
      </div>

      <div className="card dashboard-section-card" style={{ marginBottom: '1rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem', marginBottom: 12 }}>
            <h2 className="dashboard-section-heading" style={{ margin: 0 }}>
              Farm summary
            </h2>
            <button type="button" className="btn btn-primary" onClick={exportTable} disabled={!data.tableRows.length}>
              Export to Excel
            </button>
          </div>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            {data.tableRows.length === 0 ? (
              <p className="table-empty">No farms in this scope.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Farm ID</th>
                    <th>Country</th>
                    <th>Region</th>
                    <th>Weight (kg)</th>
                    <th>Revenue</th>
                    <th>Profit</th>
                    <th>Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tableRows.map((r) => (
                    <tr key={r.farmId}>
                      <td>{r.farmId}</td>
                      <td>{r.country}</td>
                      <td>{r.region?.trim() ? r.region : '—'}</td>
                      <td>{r.weightKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>{formatMoney(r.revenue)}</td>
                      <td>{formatMoney(r.profit)}</td>
                      <td>{r.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card dashboard-section-card">
        <div className="card-body">
          <h2 className="dashboard-section-heading" style={{ marginBottom: 12 }}>
            Quick links
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {quickLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="link" style={{ fontWeight: 600 }}>
                  {item.label}
                </Link>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {item.hint}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
