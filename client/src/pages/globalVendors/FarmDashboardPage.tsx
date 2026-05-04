/**
 * Global Vendors — Farm Dashboard: country-scoped KPIs, charts, and exportable farm table.
 * Employees with country assignments see only their countries; multi-country users pick from the dropdown.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { MetricCard } from '../../components/MetricCard';
import { SortableTh } from '../../components/SortableTh';
import { ChartCard, ContinuousLineChart, VerticalBarChart } from '../../components/DashboardBarCharts';
import { downloadTableXlsx, type ExportRow } from '../../utils/exportExcel';
import { type SortDir, cmpNum, cmpStr, toggleSort } from '../../utils/tableSort';
import { getDocumentLocale } from '../../i18n/locale';

type FarmDashboardPayload = {
  staffRestricted: boolean;
  allowedCountries: string[];
  selectedCountry: string | null;
  kpis: {
    totalFarms: number;
    totalEmployees: number;
    openPos: number;
    openPoValue: number;
    openExpenses: number;
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

type FarmTableSortKey = 'farmId' | 'country' | 'region' | 'weightKg' | 'revenue' | 'profit' | 'samples';

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatKg(value: number): string {
  return `${value.toLocaleString(getDocumentLocale(), { maximumFractionDigits: 2 })} kg`;
}

function formatCount(value: number): string {
  return `${Math.round(value).toLocaleString()}`;
}

export function FarmDashboardPage() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FarmDashboardPayload | null>(null);
  /** Empty string = all countries (non–country-assigned users). Otherwise ISO-ish / display country string. */
  const [countrySelection, setCountrySelection] = useState('');
  const [sort, setSort] = useState<{ key: FarmTableSortKey | null; dir: SortDir }>({
    key: null,
    dir: 'asc',
  });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
  const displayName = user?.name?.trim() || 'John T.';

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

  const sortedTableRows = useMemo(() => {
    if (!data?.tableRows.length) return [];
    const rows = [...data.tableRows];
    const k = sort.key;
    if (!k) return rows;
    const dir = sort.dir;
    rows.sort((a, b) => {
      let c = 0;
      switch (k) {
        case 'farmId':
          c = cmpStr(a.farmId, b.farmId, dir);
          break;
        case 'country':
          c = cmpStr(a.country, b.country, dir);
          break;
        case 'region':
          c = cmpStr(a.region ?? '', b.region ?? '', dir);
          break;
        case 'weightKg':
          c = cmpNum(a.weightKg, b.weightKg, dir);
          break;
        case 'revenue':
          c = cmpNum(a.revenue, b.revenue, dir);
          break;
        case 'profit':
          c = cmpNum(a.profit, b.profit, dir);
          break;
        case 'samples':
          c = cmpNum(a.samples, b.samples, dir);
          break;
        default:
          break;
      }
      if (c !== 0) return c;
      return cmpStr(a.farmId, b.farmId, 'asc');
    });
    return rows;
  }, [data?.tableRows, sort]);

  const onSortColumn = (columnKey: string) => {
    setSort((prev) => toggleSort(prev, columnKey as FarmTableSortKey));
  };

  const exportTable = () => {
    if (!sortedTableRows.length || !data) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = data.selectedCountry ? `_${data.selectedCountry.replace(/\s+/g, '_')}` : '_all';
    const rows: ExportRow[] = sortedTableRows.map((r) => ({
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

  if (loading && !data) {
    return (
      <div className="page page-dashboard">
        <header className="page-header">
          <h1 className="page-title">Farm Dashboard</h1>
          <p className="page-description" style={{ marginTop: '0.35rem' }}>
            {greeting}, {displayName}. Here is what is happening with your farms today.
          </p>
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
          <p className="page-description" style={{ marginTop: '0.35rem' }}>
            {greeting}, {displayName}. Here is what is happening with your farms today.
          </p>
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
          <p className="page-description" style={{ marginTop: '0.35rem' }}>
            {greeting}, {displayName}. Here is what is happening with your farms today.
          </p>
        </header>
        <p className="table-empty">No data.</p>
      </div>
    );
  }

  const g = data.graphs;
  const scopeLabel =
    !data.staffRestricted && !data.selectedCountry ? 'All countries' : (data.selectedCountry ?? '');
  const openExpenses = typeof data.kpis.openExpenses === 'number' ? data.kpis.openExpenses : 0;

  return (
    <div className="page page-dashboard">
      <header className="page-header">
        <h1 className="page-title">Farm Dashboard</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          {greeting}, {displayName}. Here is what is happening with your farms today.
        </p>
        {data.staffRestricted ? (
          <p className="page-description" style={{ marginTop: '0.35rem' }}>
            {data.allowedCountries.length > 1
              ? 'Farms are limited to your assigned countries. Use the menu below to switch between them.'
              : 'Farms are limited to your assigned country.'}
          </p>
        ) : null}
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

      <div className="dashboard-metric-grid farm-dashboard-metric-grid">
        <MetricCard title="Total Farms" value={data.kpis.totalFarms} />
        <MetricCard title="Total Employees" value={data.kpis.totalEmployees} />
        <MetricCard title="Open POs" value={data.kpis.openPos} />
        <MetricCard title="Open PO Value" value={formatMoney(data.kpis.openPoValue)} />
        <MetricCard title="Open Expenses" value={formatMoney(openExpenses)} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '0.9rem',
          marginBottom: '0.9rem',
        }}
      >
        <ChartCard title="Farms by Weight" allowContentOverflow>
          <VerticalBarChart rows={g.farmsByWeight} valueFormatter={formatKg} slantedValueLabels />
        </ChartCard>
        <ChartCard title="Farms by Revenue" allowContentOverflow>
          <VerticalBarChart rows={g.farmsByRevenue} valueFormatter={formatMoney} slantedValueLabels />
        </ChartCard>
        <ChartCard title="Farms by Profit" allowContentOverflow>
          <VerticalBarChart rows={g.farmsByProfit} valueFormatter={formatMoney} slantedValueLabels />
        </ChartCard>
        <ChartCard title="Farms by PO" allowContentOverflow>
          <VerticalBarChart rows={g.farmsByPoCount} valueFormatter={formatCount} slantedValueLabels />
        </ChartCard>
        <ChartCard title="Farms by Sample" allowContentOverflow>
          <VerticalBarChart rows={g.farmsBySample} valueFormatter={formatCount} slantedValueLabels />
        </ChartCard>
        <ChartCard title="PO Placement">
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
            <button type="button" className="btn btn-primary" onClick={exportTable} disabled={!sortedTableRows.length}>
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
                    <SortableTh
                      label="Farm ID"
                      columnKey="farmId"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSortColumn}
                    />
                    <SortableTh
                      label="Country"
                      columnKey="country"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSortColumn}
                    />
                    <SortableTh
                      label="Region"
                      columnKey="region"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSortColumn}
                    />
                    <SortableTh
                      label="Weight (kg)"
                      columnKey="weightKg"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSortColumn}
                    />
                    <SortableTh
                      label="Revenue"
                      columnKey="revenue"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSortColumn}
                    />
                    <SortableTh
                      label="Profit"
                      columnKey="profit"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSortColumn}
                    />
                    <SortableTh
                      label="Samples"
                      columnKey="samples"
                      activeKey={sort.key}
                      dir={sort.dir}
                      onSort={onSortColumn}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedTableRows.map((r) => (
                    <tr key={r.farmId}>
                      <td>{r.farmId}</td>
                      <td>{r.country}</td>
                      <td>{r.region?.trim() ? r.region : '—'}</td>
                      <td>{r.weightKg.toLocaleString(getDocumentLocale(), { maximumFractionDigits: 2 })}</td>
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
    </div>
  );
}
