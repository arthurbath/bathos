export interface WageGapSettings {
  enabled: boolean;
  partnerXCentsPerDollar: number | null;
  partnerYCentsPerDollar: number | null;
}

export interface IncomeNormalizationResult {
  incomeX: number;
  incomeY: number;
  adjustedIncomeX: number;
  adjustedIncomeY: number;
  incomeRatioX: number;
  incomeRatioY: number;
  partnerXFactor: number;
  partnerYFactor: number;
  isWageGapApplied: boolean;
}

function normalizeCents(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0 || value > 100) return null;
  return value;
}

export function computeIncomeNormalization(
  incomeX: number,
  incomeY: number,
  wageGap: WageGapSettings,
): IncomeNormalizationResult {
  const normalizedCentsX = normalizeCents(wageGap.partnerXCentsPerDollar);
  const normalizedCentsY = normalizeCents(wageGap.partnerYCentsPerDollar);
  const partnerXFactor = wageGap.enabled && normalizedCentsX != null ? normalizedCentsX / 100 : 1;
  const partnerYFactor = wageGap.enabled && normalizedCentsY != null ? normalizedCentsY / 100 : 1;
  const adjustedIncomeX = incomeX * partnerXFactor;
  const adjustedIncomeY = incomeY * partnerYFactor;
  const totalAdjusted = adjustedIncomeX + adjustedIncomeY;
  const incomeRatioX = totalAdjusted > 0 ? adjustedIncomeX / totalAdjusted : 0.5;
  const incomeRatioY = 1 - incomeRatioX;

  return {
    incomeX,
    incomeY,
    adjustedIncomeX,
    adjustedIncomeY,
    incomeRatioX,
    incomeRatioY,
    partnerXFactor,
    partnerYFactor,
    isWageGapApplied: wageGap.enabled && (partnerXFactor !== 1 || partnerYFactor !== 1),
  };
}

export function computeFairShares(
  monthlyAmount: number,
  benefitXPercent: number,
  incomeRatioX: number,
): { fairX: number; fairY: number } {
  const benefitX = benefitXPercent / 100;
  const benefitY = 1 - benefitX;
  const incomeRatioY = 1 - incomeRatioX;
  const weightX = benefitX * incomeRatioX;
  const weightY = benefitY * incomeRatioY;
  const totalWeight = weightX + weightY || 1;

  return {
    fairX: monthlyAmount * (weightX / totalWeight),
    fairY: monthlyAmount * (weightY / totalWeight),
  };
}
