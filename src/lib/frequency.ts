import { FrequencyType } from '@/types/fairshare';

const WEEKS_PER_MONTH = 4.33;

export function toMonthly(amount: number, type: FrequencyType, param?: number): number {
  switch (type) {
    case 'monthly':
      return amount;
    case 'twice_monthly':
      return amount * 2;
    case 'weekly':
      return amount * WEEKS_PER_MONTH;
    case 'every_n_weeks':
      return param && param > 0 ? (amount * WEEKS_PER_MONTH) / param : 0;
    case 'annual':
      return amount / 12;
    case 'k_times_annually':
      return param && param > 0 ? (amount * param) / 12 : 0;
    default:
      return 0;
  }
}

export const frequencyLabels: Record<FrequencyType, string> = {
  monthly: 'Monthly',
  twice_monthly: 'Twice monthly',
  weekly: 'Weekly',
  every_n_weeks: 'Every X weeks',
  annual: 'Annual',
  k_times_annually: 'X/year',
};

export function needsParam(type: FrequencyType): boolean {
  return type === 'every_n_weeks' || type === 'k_times_annually';
}
