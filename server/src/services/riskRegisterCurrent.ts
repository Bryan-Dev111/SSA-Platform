/**
 * "Current" risk level for register + chart: latest closed (mitigated) action's residual,
 * otherwise the opportunity's inherent riskLevel (never overwritten by actions).
 */
import type { Opportunity, RiskAction } from '@prisma/client';

type RiskLevel = 'Low' | 'Medium' | 'High';

export function computeCurrentRiskLevelForRisk(
  risk: Pick<Opportunity, 'type' | 'riskLevel'>,
  actionsNewestFirst: Pick<RiskAction, 'status' | 'residualLikelihood' | 'residualSeverity' | 'residualRiskLevel'>[],
): RiskLevel | null {
  if (risk.type !== 'risk') return risk.riskLevel;
  const latestClosed = actionsNewestFirst.find(
    (a) =>
      a.status === 'Mitigated' &&
      a.residualLikelihood != null &&
      a.residualSeverity != null &&
      a.residualRiskLevel != null,
  );
  return latestClosed?.residualRiskLevel ?? risk.riskLevel;
}
