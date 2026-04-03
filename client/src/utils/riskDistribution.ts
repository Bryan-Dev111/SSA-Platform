/**
 * Risk-register distribution (Low / Medium / High), matching the Risk page:
 * Mitigated risks use the opportunity row; otherwise latest closed action residual overrides when present.
 */

export type RiskDistribution = { low: number; medium: number; high: number };

export type RiskLikelihood = 'VeryUnlikely' | 'Unlikely' | 'Possible' | 'Likely' | 'VeryLikely';
export type RiskSeverity = 'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Severe';

export interface RiskRegisterItem {
  id: string;
  type: 'risk' | 'opportunity';
  likelihood: RiskLikelihood | null;
  severity: RiskSeverity | null;
  riskLevel: 'Low' | 'Medium' | 'High' | null;
  /** When Mitigated, use risk row level (matches Risk page matrix after table edits). */
  status?: 'Open' | 'Mitigated' | 'Closed' | 'Realized';
}

export interface RiskRegisterAction {
  riskId: string;
  status: 'Open' | 'Closed';
  residualLikelihood: RiskLikelihood | null;
  residualSeverity: RiskSeverity | null;
  residualRiskLevel: 'Low' | 'Medium' | 'High' | null;
  createdAt: string;
}

export function computeRiskRegisterDistribution(items: RiskRegisterItem[], actions: RiskRegisterAction[]): RiskDistribution {
  const sorted = [...actions].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const latestActionByRisk = new Map<string, RiskRegisterAction>();
  for (const action of sorted) {
    if (!latestActionByRisk.has(action.riskId)) latestActionByRisk.set(action.riskId, action);
  }

  const effectiveRisks = items
    .filter((r) => r.type === 'risk')
    .map((r) => {
      if (r.status === 'Mitigated') {
        return { effectiveRiskLevel: r.riskLevel };
      }
      const action = latestActionByRisk.get(r.id);
      const useResidual =
        action?.status === 'Closed' &&
        !!action.residualLikelihood &&
        !!action.residualSeverity &&
        !!action.residualRiskLevel;
      const effectiveRiskLevel = useResidual ? action.residualRiskLevel : r.riskLevel;
      return { effectiveRiskLevel };
    });

  return {
    low: effectiveRisks.filter((r) => r.effectiveRiskLevel === 'Low').length,
    medium: effectiveRisks.filter((r) => r.effectiveRiskLevel === 'Medium').length,
    high: effectiveRisks.filter((r) => r.effectiveRiskLevel === 'High').length,
  };
}

export const RISK_DISTRIBUTION_DONUT_PX = 200;
export const RISK_DISTRIBUTION_GAP_PCT = 0.85;

/** Donut ring: coloured arcs separated by thin gaps (surface-colour). */
export function buildRiskDistributionDonutGradient(
  slices: readonly { color: string; count: number }[],
  gapPct: number,
  gapColor: string
): string {
  const total = slices.reduce((sum, x) => sum + x.count, 0);
  if (total === 0) return 'conic-gradient(#e5e7eb 0% 100%)';
  const n = slices.length;
  const available = 100 - n * gapPct;
  const stops: string[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const w = (slices[i].count / total) * available;
    const segEnd = cursor + w;
    const gapEnd = segEnd + gapPct;
    stops.push(`${slices[i].color} ${cursor}% ${segEnd}%`);
    stops.push(`${gapColor} ${segEnd}% ${gapEnd}%`);
    cursor = gapEnd;
  }
  return `conic-gradient(${stops.join(', ')})`;
}
