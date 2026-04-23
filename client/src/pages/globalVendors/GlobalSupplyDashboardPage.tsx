import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiJson } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

type CountryValueRow = { country: string; value: number };
type TimePointRow = { date: string; count: number };

type DashboardPayload = {
  revenueByCountry: CountryValueRow[];
  profitByCountry: CountryValueRow[];
  kgCountryCoffee: CountryValueRow[];
  kgCountryCocoa: CountryValueRow[];
  poCreationOverTimeOpen: TimePointRow[];
  sampleCountByCountry: CountryValueRow[];
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

function formatSampleCount(value: number): string {
  return `${Math.round(value).toLocaleString()} samples`;
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function HorizontalBarChart({
  rows,
  valueFormatter,
  positiveColor = 'var(--color-primary)',
  negativeColor = 'var(--color-danger)',
}: {
  rows: CountryValueRow[];
  valueFormatter: (value: number) => string;
  positiveColor?: string;
  negativeColor?: string;
}) {
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.value)));

  if (rows.length === 0) {
    return <p className="table-empty">No data yet.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((row) => {
        const width = `${Math.max(2, (Math.abs(row.value) / maxAbs) * 100)}%`;
        const color = row.value >= 0 ? positiveColor : negativeColor;
        return (
          <div key={row.country} style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.country}
              </strong>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                {valueFormatter(row.value)}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                background: 'var(--color-bg-muted)',
                borderRadius: 6,
                overflow: 'hidden',
                height: 12,
              }}
            >
              <div style={{ width, height: '100%', background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContinuousLineChart({ rows }: { rows: TimePointRow[] }) {
  const width = 880;
  const height = 240;
  const padding = { top: 18, right: 16, bottom: 42, left: 42 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxY = Math.max(1, ...rows.map((row) => row.count));
  const points = rows.map((row, index) => {
    const x =
      rows.length <= 1
        ? padding.left + innerWidth / 2
        : padding.left + (index / (rows.length - 1)) * innerWidth;
    const y = padding.top + innerHeight - (row.count / maxY) * innerHeight;
    return { ...row, x, y };
  });
  const path = points.map((p) => `${p.x},${p.y}`).join(' ');

  if (rows.length === 0) return <p className="table-empty">No open PO trend data yet.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', minWidth: 600, display: 'block' }}
        aria-label="Open PO creation over time"
      >
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={padding.left + innerWidth}
          y2={padding.top + innerHeight}
          stroke="var(--color-border)"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + innerHeight}
          stroke="var(--color-border)"
        />
        <polyline
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={path}
        />
        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle cx={point.x} cy={point.y} r={3.5} fill="var(--color-primary)" />
            {index % Math.max(1, Math.ceil(points.length / 7)) === 0 || index === points.length - 1 ? (
              <text
                x={point.x}
                y={padding.top + innerHeight + 18}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-text-muted)"
              >
                {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </text>
            ) : null}
            <title>{`${formatDateLabel(point.date)}: ${point.count} open PO(s)`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="card dashboard-section-card">
      <div className="card-body">
        <h2 className="dashboard-section-heading" style={{ marginBottom: 4 }}>
          {title}
        </h2>
        <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--color-text-muted)' }}>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export function GlobalSupplyDashboardPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiJson<DashboardPayload>('/global-supply-dashboard', { token })
      .then((response) => setData(response))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load Global Supply dashboard');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const topRevenue = useMemo(() => (data?.revenueByCountry ?? []).slice(0, 12), [data]);
  const topProfit = useMemo(() => (data?.profitByCountry ?? []).slice(0, 12), [data]);
  const coffeeKg = useMemo(() => (data?.kgCountryCoffee ?? []).slice(0, 12), [data]);
  const cocoaKg = useMemo(() => (data?.kgCountryCocoa ?? []).slice(0, 12), [data]);
  const sampleByCountry = useMemo(() => (data?.sampleCountByCountry ?? []).slice(0, 24), [data]);
  const openPoTrend = data?.poCreationOverTimeOpen ?? [];

  return (
    <div className="page page-dashboard">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          Global Supply analytics for purchase orders and expenses.
        </p>
      </header>

      {error ? <div className="alert-error">{error}</div> : null}
      {loading && !data ? (
        <div className="loading-message">
          <div className="loading-spinner" />
          <p style={{ marginTop: 12 }}>Loading global supply dashboard…</p>
        </div>
      ) : null}

      <div className="dashboard-trio-grid dashboard-trio-grid--spaced">
        <div className="card dashboard-section-card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-body">
            <h2 className="dashboard-section-heading" style={{ marginBottom: 4 }}>
              Bar graph: Sample count by country
            </h2>
            <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--color-text-muted)' }}>
              Count of samples grouped by the linked farm&apos;s country (samples without a farm appear as{' '}
              <strong>None</strong>).
            </p>
            <HorizontalBarChart rows={sampleByCountry} valueFormatter={formatSampleCount} />
          </div>
        </div>
      </div>

      <div className="dashboard-trio-grid dashboard-trio-grid--spaced">
        <ChartCard
          title="Bar Graph: Revenue by Country"
          subtitle="Closed purchase orders only."
        >
          <HorizontalBarChart rows={topRevenue} valueFormatter={formatMoney} />
        </ChartCard>

        <ChartCard
          title="Bar Graph: Profit by Country"
          subtitle="Closed purchase orders and closed/final Global Supply expenses."
        >
          <HorizontalBarChart rows={topProfit} valueFormatter={formatMoney} />
        </ChartCard>

        <ChartCard
          title="Bar Graph: Kg Country (Coffee)"
          subtitle="Closed purchase orders only."
        >
          <HorizontalBarChart rows={coffeeKg} valueFormatter={formatKg} />
        </ChartCard>
      </div>

      <div className="dashboard-trio-grid dashboard-trio-grid--spaced">
        <ChartCard
          title="Bar Graph: Kg Country (Cocoa)"
          subtitle="Closed purchase orders only."
        >
          <HorizontalBarChart rows={cocoaKg} valueFormatter={formatKg} />
        </ChartCard>

        <div className="card dashboard-section-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-body">
            <h2 className="dashboard-section-heading" style={{ marginBottom: 4 }}>
              Continuous Line Graph: PO Creation over time
            </h2>
            <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--color-text-muted)' }}>
              Open purchase orders only.
            </p>
            <ContinuousLineChart rows={openPoTrend} />
          </div>
        </div>
      </div>
    </div>
  );
}
