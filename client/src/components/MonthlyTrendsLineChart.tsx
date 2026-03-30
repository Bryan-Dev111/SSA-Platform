import { useState } from 'react';

export type MonthlyTrendRow = {
  month: string;
  findings: number;
  cars: number;
  audits: number;
  shipments: number;
};

const TREND = {
  findings: { stroke: '#c2185b' },
  cars: { stroke: '#c99a17' },
  audits: { stroke: '#1f78c8' },
  shipments: { stroke: '#6e47c8' },
} as const;

export function MonthlyTrendsLineChart({
  rows,
  maxY,
  title,
}: {
  rows: MonthlyTrendRow[];
  maxY: number;
  /** Optional heading (omit when the parent card already provides a title). */
  title?: string;
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

  const findingsVals = rows.map((r) => r.findings);
  const carsVals = rows.map((r) => r.cars);
  const auditsVals = rows.map((r) => r.audits);
  const shipmentsVals = rows.map((r) => r.shipments);

  const hovered = hoverIndex === null ? null : rows[hoverIndex];
  const hoverX = hoverIndex === null ? null : xAt(hoverIndex);

  return (
    <div>
      {title ? (
        <h2 style={{ marginTop: 0, marginBottom: '0.65rem', fontSize: 'var(--text-lg)' }}>{title}</h2>
      ) : null}
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '0.5rem', fontSize: 'var(--text-sm)' }}>
        <LegendItem color={TREND.findings.stroke} label="Findings" />
        <LegendItem color={TREND.cars.stroke} label="CARs" />
        <LegendItem color={TREND.audits.stroke} label="Audits" />
        <LegendItem color={TREND.shipments.stroke} label="Shipments" />
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

          <path
            d={toSmoothPath(findingsVals)}
            fill="none"
            stroke={TREND.findings.stroke}
            strokeWidth="2.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={toSmoothPath(carsVals)}
            fill="none"
            stroke={TREND.cars.stroke}
            strokeWidth="2.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={toSmoothPath(auditsVals)}
            fill="none"
            stroke={TREND.audits.stroke}
            strokeWidth="2.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={toSmoothPath(shipmentsVals)}
            fill="none"
            stroke={TREND.shipments.stroke}
            strokeWidth="2.35"
            strokeLinecap="round"
            strokeLinejoin="round"
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

function LegendItem({ color, label }: { color: string; label: string }) {
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
        />
      </svg>
      {label}
    </span>
  );
}
