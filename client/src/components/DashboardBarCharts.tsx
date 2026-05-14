/**
 * Shared bar + line chart blocks for Global Supply / Farm dashboards.
 */
import type { ReactNode } from 'react';
import { useId } from 'react';
import { getDocumentLocale } from '../i18n/locale';

export type BarChartRow = { label: string; value: number };
export type TimePointRow = { date: string; count: number };

export function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(getDocumentLocale(), { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Catmull–Rom–style smooth curve through points (open path, no Z). */
function smoothCurvePathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function VerticalBarChart({
  rows,
  valueFormatter,
  positiveColor = 'var(--color-primary)',
  negativeColor = 'var(--color-danger)',
  /** When true, X-axis category labels (e.g. farm names) are rotated and given wider tracks. */
  slantedXAxisLabels = false,
  /** When true, the numeric value above each bar is rotated (farm names stay horizontal). */
  slantedValueLabels = false,
  /** When true (and not slanted), category labels stay on one line with ellipsis instead of wrapping. */
  axisLabelsNoWrap = false,
}: {
  rows: BarChartRow[];
  valueFormatter: (value: number) => string;
  positiveColor?: string;
  negativeColor?: string;
  slantedXAxisLabels?: boolean;
  slantedValueLabels?: boolean;
  axisLabelsNoWrap?: boolean;
}) {
  const topRows = rows.slice(0, 10);
  const maxAbs = Math.max(1, ...topRows.map((row) => Math.abs(row.value)));
  const n = topRows.length;
  const slantedAxis = slantedXAxisLabels;
  const slantedValues = slantedValueLabels;

  /** Slightly wider columns when values are slanted so long currency strings do not collide. */
  const colMinPx = slantedAxis ? 76 : slantedValues ? 68 : 0;
  const colGap = slantedAxis ? 14 : slantedValues ? 12 : 10;
  const columnTemplate =
    slantedAxis || slantedValues
      ? `repeat(${n}, minmax(${colMinPx}px, 1fr))`
      : `repeat(${n}, minmax(0, 1fr))`;
  const innerMinWidth = slantedAxis
    ? Math.max(600, n * colMinPx + Math.max(0, n - 1) * colGap + 48)
    : slantedValues
      ? Math.max(540, n * colMinPx + Math.max(0, n - 1) * colGap + 40)
      : 520;
  const sectionGap = slantedAxis ? 36 : slantedValues ? 12 : 8;
  const axisLabelMinHeight = slantedAxis ? 112 : undefined;

  if (topRows.length === 0) {
    return <p className="table-empty">No data yet.</p>;
  }

  const axisRow = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columnTemplate,
        gap: colGap,
        padding: '0 0.5rem',
        alignItems: slantedAxis ? 'end' : undefined,
        justifyItems: 'center',
        minHeight: axisLabelMinHeight,
      }}
    >
      {topRows.map((row, idx) =>
        slantedAxis ? (
          <div
            key={`${row.label}-axis-${idx}`}
            style={{
              width: '100%',
              minHeight: 104,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              overflow: 'visible',
              paddingBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
                lineHeight: 1.15,
                transform: 'rotate(-50deg)',
                transformOrigin: '50% 100%',
              }}
            >
              {row.label}
            </span>
          </div>
        ) : (
          <span
            key={`${row.label}-axis-${idx}`}
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              textAlign: 'center',
              lineHeight: 1.3,
              minWidth: 0,
              width: '100%',
              maxWidth: '100%',
              ...(axisLabelsNoWrap
                ? {
                    whiteSpace: 'nowrap' as const,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }
                : { wordBreak: 'break-word' as const }),
            }}
            title={axisLabelsNoWrap ? row.label : undefined}
          >
            {row.label}
          </span>
        )
      )}
    </div>
  );

  /** Values above bars in their own row so rotation is not clipped by the fixed bar plot height or `.card { overflow: hidden }` (parent uses overflow visible). */
  if (slantedValues) {
    return (
      <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
        <div
          style={{
            display: 'grid',
            gap: sectionGap,
            minWidth: innerMinWidth,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: columnTemplate,
              gap: colGap,
              alignItems: 'flex-end',
              justifyItems: 'center',
              minHeight: 96,
              padding: '18px 0.5rem 6px',
            }}
          >
            {topRows.map((row, idx) => (
              <div
                key={`val-${row.label}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  minHeight: 88,
                  overflow: 'visible',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                    transform: 'rotate(-44deg)',
                    transformOrigin: '50% 100%',
                  }}
                >
                  {valueFormatter(row.value)}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: columnTemplate,
              alignItems: 'end',
              gap: colGap,
              height: 240,
              padding: '0.75rem 0.5rem 0.25rem',
              borderBottom: '1px solid var(--color-border)',
              borderLeft: '1px solid var(--color-border)',
            }}
          >
            {topRows.map((row, idx) => {
              const height = `${Math.max(6, (Math.abs(row.value) / maxAbs) * 160)}px`;
              const color = row.value >= 0 ? positiveColor : negativeColor;
              return (
                <div
                  key={`bar-${row.label}-${idx}`}
                  style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}
                >
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
          {axisRow}
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: slantedAxis ? 12 : 0 }}>
      <div
        style={{
          display: 'grid',
          gap: sectionGap,
          minWidth: innerMinWidth,
          paddingBottom: slantedAxis ? 20 : 0,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: columnTemplate,
            alignItems: 'end',
            gap: colGap,
            height: 240,
            padding: '0.75rem 0.5rem 0.25rem',
            borderBottom: '1px solid var(--color-border)',
            borderLeft: '1px solid var(--color-border)',
          }}
        >
          {topRows.map((row, idx) => {
            const height = `${Math.max(6, (Math.abs(row.value) / maxAbs) * 160)}px`;
            const color = row.value >= 0 ? positiveColor : negativeColor;
            return (
              <div
                key={`${row.label}-${idx}`}
                style={{ display: 'grid', justifyItems: 'center', alignItems: 'end', gap: 6 }}
              >
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
        {axisRow}
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
  const areaGradId = useId().replace(/:/g, '');
  const width = 880;
  const height = 240;
  const padding = { top: 18, right: 16, bottom: 42, left: 52 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxY = Math.max(1, ...rows.map((row) => row.count));
  const yTickStep = Math.max(1, Math.ceil(maxY / 5));
  const yTickValues: number[] = [];
  for (let v = 0; v < maxY; v += yTickStep) yTickValues.push(v);
  if (yTickValues[yTickValues.length - 1] !== maxY) yTickValues.push(maxY);

  const points = rows.map((row, index) => {
    const x =
      rows.length <= 1
        ? padding.left + innerWidth / 2
        : padding.left + (index / (rows.length - 1)) * innerWidth;
    const y = padding.top + innerHeight - (row.count / maxY) * innerHeight;
    return { ...row, x, y };
  });
  const baselineY = padding.top + innerHeight;
  const xy = points.map((p) => ({ x: p.x, y: p.y }));
  const lineD = smoothCurvePathD(xy);
  const areaD =
    xy.length === 0
      ? ''
      : xy.length === 1
        ? `M ${xy[0].x} ${xy[0].y} L ${xy[0].x} ${baselineY} L ${xy[0].x} ${baselineY} Z`
        : `${lineD} L ${xy[xy.length - 1].x} ${baselineY} L ${xy[0].x} ${baselineY} Z`;

  if (rows.length === 0) return <p className="table-empty">No time-series data yet.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', minWidth: 600, display: 'block' }}
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient
            id={areaGradId}
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={padding.top}
            x2={0}
            y2={baselineY}
          >
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.32} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.04} />
          </linearGradient>
        </defs>
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
        {yTickValues.map((v) => {
          const y = padding.top + innerHeight - (v / maxY) * innerHeight;
          return (
            <g key={`ytick-${v}`}>
              <line
                x1={padding.left - 4}
                y1={y}
                x2={padding.left}
                y2={y}
                stroke="var(--color-border)"
              />
              <text
                x={padding.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="var(--color-text-muted)"
              >
                {v.toLocaleString()}
              </text>
            </g>
          );
        })}
        {areaD ? <path d={areaD} fill={`url(#${areaGradId})`} stroke="none" /> : null}
        {lineD ? (
          <path
            d={lineD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
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
                {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(getDocumentLocale(), {
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
  /** Allow chart labels (e.g. rotated values) to extend past the card border; default cards use overflow hidden. */
  allowContentOverflow = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  allowContentOverflow?: boolean;
}) {
  return (
    <div
      className={`card dashboard-section-card${allowContentOverflow ? ' shipments-metric-card--overflow-visible' : ''}`}
    >
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
