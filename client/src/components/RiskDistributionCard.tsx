import { useMemo } from 'react';
import type { RiskDistribution } from '../utils/riskDistribution';
import { RISK_DISTRIBUTION_DONUT_PX } from '../utils/riskDistribution';

const SLICES = [
  { label: 'Low', key: 'low' as const, color: '#22c55e' },
  { label: 'Medium', key: 'medium' as const, color: '#eab308' },
  { label: 'High', key: 'high' as const, color: '#f97316' },
];

export function RiskDistributionCard({ distribution }: { distribution: RiskDistribution }) {
  const distributionSlices = useMemo(
    () => SLICES.map((s) => ({ label: s.label, count: distribution[s.key], color: s.color })),
    [distribution.low, distribution.medium, distribution.high]
  );

  const donut = useMemo(() => {
    const total = distributionSlices.reduce((sum, s) => sum + s.count, 0);
    const nonZero = distributionSlices.filter((s) => s.count > 0);
    const size = 200;
    const cx = 100;
    const cy = 100;
    const radius = 70;
    const strokeWidth = 36;
    const separatorWidth = nonZero.length > 1 ? 3 : 0;
    const innerRadius = radius - strokeWidth / 2;
    const outerRadius = radius + strokeWidth / 2;

    if (total === 0) {
      return {
        size,
        strokeWidth,
        cx,
        cy,
        radius,
        innerRadius,
        outerRadius,
        separatorWidth,
        segments: [] as Array<{ d: string; color: string }>,
        separators: [] as Array<{ x1: number; y1: number; x2: number; y2: number }>,
      };
    }

    if (nonZero.length === 1) {
      const only = nonZero[0];
      return {
        size,
        strokeWidth,
        cx,
        cy,
        radius,
        innerRadius,
        outerRadius,
        separatorWidth,
        segments: [
          {
            d: '',
            color: only.color,
          },
        ],
        separators: [],
      };
    }

    const toPoint = (angleDeg: number) => {
      const rad = ((angleDeg - 90) * Math.PI) / 180;
      return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    };

    let cursor = 0;
    const segments = nonZero
      .map((slice) => {
        const rawDeg = (slice.count / total) * 360;
        const arcDeg = Math.max(0, rawDeg);
        const start = cursor;
        const end = cursor + rawDeg;
        cursor += rawDeg;
        if (arcDeg <= 0) return null;
        const p0 = toPoint(start);
        const p1 = toPoint(end);
        const largeArcFlag = arcDeg > 180 ? 1 : 0;
        const d = `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${p1.x} ${p1.y}`;
        return { d, color: slice.color };
      })
      .filter((s): s is { d: string; color: string } => !!s);

    const separatorAngles = nonZero
      .slice(0, -1)
      .reduce<number[]>((angles, slice, idx) => {
        const prev = idx === 0 ? 0 : angles[idx - 1];
        angles.push(prev + (slice.count / total) * 360);
        return angles;
      }, []);
    separatorAngles.unshift(0);
    const separators = separatorAngles.map((angle) => {
      const outer = {
        x: cx + outerRadius * Math.cos(((angle - 90) * Math.PI) / 180),
        y: cy + outerRadius * Math.sin(((angle - 90) * Math.PI) / 180),
      };
      const innerPoint = {
        x: cx + innerRadius * Math.cos(((angle - 90) * Math.PI) / 180),
        y: cy + innerRadius * Math.sin(((angle - 90) * Math.PI) / 180),
      };
      return { x1: innerPoint.x, y1: innerPoint.y, x2: outer.x, y2: outer.y };
    });

    return { size, strokeWidth, cx, cy, radius, innerRadius, outerRadius, separatorWidth, segments, separators };
  }, [distributionSlices]);

  return (
    <div className="card risk-distribution-card">
      <div className="card-body risk-distribution-card-body">
        <div className="risk-distribution-card-header">
          <h2 className="risk-distribution-card-title">Risk Distribution</h2>
        </div>
        <div className="risk-distribution-donut-wrap" aria-label="Risk distribution donut chart">
          <svg
            className="risk-distribution-donut-ring"
            width={RISK_DISTRIBUTION_DONUT_PX}
            height={RISK_DISTRIBUTION_DONUT_PX}
            viewBox={`0 0 ${donut.size} ${donut.size}`}
            aria-hidden
          >
            {donut.segments.length === 0 ? (
              <circle
                cx={donut.cx}
                cy={donut.cy}
                r={donut.radius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={donut.strokeWidth}
              />
            ) : donut.segments.length === 1 ? (
              <circle
                cx={donut.cx}
                cy={donut.cy}
                r={donut.radius}
                fill="none"
                stroke={donut.segments[0].color}
                strokeWidth={donut.strokeWidth}
              />
            ) : (
              donut.segments.map((segment) => (
                <path
                  key={`${segment.color}-${segment.d}`}
                  d={segment.d}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={donut.strokeWidth}
                  strokeLinecap="butt"
                />
              ))
            )}
            {donut.separators.map((separator, idx) => (
              <line
                key={`sep-${idx}`}
                x1={separator.x1}
                y1={separator.y1}
                x2={separator.x2}
                y2={separator.y2}
                stroke="var(--color-surface)"
                strokeWidth={donut.separatorWidth}
                strokeLinecap="butt"
              />
            ))}
          </svg>
        </div>
        <div className="risk-distribution-legend">
          {distributionSlices.map((s) => (
            <div
              key={s.label}
              className="risk-distribution-legend-item"
              title={`${s.count} register ${s.count === 1 ? 'risk' : 'risks'}`}
            >
              <span className="risk-distribution-legend-dot" style={{ background: s.color }} />
              <span className="risk-distribution-legend-label">{s.label}</span>
              <span className="risk-distribution-legend-count">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
