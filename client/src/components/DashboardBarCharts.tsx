/**
 * Shared bar + line chart blocks for Global Supply / Farm dashboards.
 */
import type { ReactNode } from 'react';

export type BarChartRow = { label: string; value: number };
export type TimePointRow = { date: string; count: number };

export function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function VerticalBarChart({
  rows,
  valueFormatter,
  positiveColor = 'var(--color-primary)',
  negativeColor = 'var(--color-danger)',
}: {
  rows: BarChartRow[];
  valueFormatter: (value: number) => string;
  positiveColor?: string;
  negativeColor?: string;
}) {
  const topRows = rows.slice(0, 10);
  const maxAbs = Math.max(1, ...topRows.map((row) => Math.abs(row.value)));

  if (topRows.length === 0) {
    return <p className="table-empty">No data yet.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gap: 8, minWidth: 520 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${topRows.length}, minmax(0, 1fr))`,
            alignItems: 'end',
            gap: 10,
            height: 240,
            padding: '0.75rem 0.5rem 0.25rem',
            borderBottom: '1px solid var(--color-border)',
            borderLeft: '1px solid var(--color-border)',
          }}
        >
          {topRows.map((row) => {
            const height = `${Math.max(6, (Math.abs(row.value) / maxAbs) * 160)}px`;
            const color = row.value >= 0 ? positiveColor : negativeColor;
            return (
              <div key={row.label} style={{ display: 'grid', justifyItems: 'center', alignItems: 'end', gap: 6 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {valueFormatter(row.value)}
                </span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 42,
                    minWidth: 20,
                    height,
                    background: color,
                    borderRadius: '6px 6px 0 0',
                  }}
                  title={`${row.label}: ${valueFormatter(row.value)}`}
                />
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${topRows.length}, minmax(0, 1fr))`,
            gap: 10,
            padding: '0 0.5rem',
          }}
        >
          {topRows.map((row) => (
            <span
              key={`${row.label}-axis`}
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                textAlign: 'center',
                lineHeight: 1.3,
                wordBreak: 'break-word',
              }}
            >
              {row.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ContinuousLineChart({
  rows,
  ariaLabel,
  valueLabel,
  strokeColor = 'var(--color-primary)',
}: {
  rows: TimePointRow[];
  ariaLabel: string;
  /** Tooltip / title singular unit, e.g. "open PO(s)" */
  valueLabel: string;
  /** SVG stroke (e.g. blue for Farm Dashboard PO placement). */
  strokeColor?: string;
}) {
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

  if (rows.length === 0) return <p className="table-empty">No time-series data yet.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', minWidth: 600, display: 'block' }}
        aria-label={ariaLabel}
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
          stroke={strokeColor}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={path}
        />
        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle cx={point.x} cy={point.y} r={3.5} fill={strokeColor} />
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
            <title>{`${formatDateLabel(point.date)}: ${point.count} ${valueLabel}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="card dashboard-section-card">
      <div className="card-body">
        <h2 className="dashboard-section-heading" style={{ marginBottom: 4 }}>
          {title}
        </h2>
        {subtitle ? <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--color-text-muted)' }}>{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}
