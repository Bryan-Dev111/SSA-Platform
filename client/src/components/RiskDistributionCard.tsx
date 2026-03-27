import { useMemo } from 'react';
import type { RiskDistribution } from '../utils/riskDistribution';
import {
  RISK_DISTRIBUTION_DONUT_PX,
  RISK_DISTRIBUTION_GAP_PCT,
  buildRiskDistributionDonutGradient,
} from '../utils/riskDistribution';

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

  const distributionDonutBackground = useMemo(
    () => buildRiskDistributionDonutGradient(distributionSlices, RISK_DISTRIBUTION_GAP_PCT, 'var(--color-surface)'),
    [distributionSlices]
  );

  return (
    <div className="card risk-distribution-card">
      <div className="card-body risk-distribution-card-body">
        <div className="risk-distribution-card-header">
          <h2 className="risk-distribution-card-title">Risk Distribution</h2>
          <p className="risk-distribution-card-subtitle">Risks by risk level</p>
        </div>
        <div className="risk-distribution-donut-wrap" aria-label="Risk distribution donut chart">
          <div
            className="risk-distribution-donut-ring"
            style={{
              width: RISK_DISTRIBUTION_DONUT_PX,
              height: RISK_DISTRIBUTION_DONUT_PX,
              background: distributionDonutBackground,
            }}
          />
          <div className="risk-distribution-donut-hole" />
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
