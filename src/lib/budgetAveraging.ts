import type { FrequencyType } from '@/types/fairshare';

export type BudgetValueType = 'simple' | 'monthly_averaged' | 'yearly_averaged';

export interface BudgetAverageRecord {
  year: number;
  month: number | null;
  amount: number;
  date?: string;
}

const VALUE_TYPES: BudgetValueType[] = ['simple', 'monthly_averaged', 'yearly_averaged'];

export function isBudgetValueType(value: unknown): value is BudgetValueType {
  return typeof value === 'string' && VALUE_TYPES.includes(value as BudgetValueType);
}

export function normalizeBudgetValueType(value: unknown): BudgetValueType {
  return isBudgetValueType(value) ? value : 'simple';
}

function normalizeYear(raw: unknown): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded < 0 || rounded > 9999) return null;
  return rounded;
}

function normalizeMonth(raw: unknown): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.trunc(parsed);
  if (rounded < 1 || rounded > 12) return null;
  return rounded;
}

function normalizeAmount(raw: unknown): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return trimmed;
}

function getDerivedPartsFromDate(value: string): { year: number; month: number } {
  const [yearText, monthText] = value.split('-');
  return {
    year: Number(yearText),
    month: Number(monthText),
  };
}

function buildFallbackDate(
  valueType: Exclude<BudgetValueType, 'simple'>,
  year: number,
  month: number | null,
): string {
  const resolvedMonth = valueType === 'monthly_averaged' ? (month ?? 1) : 1;
  return `${String(year).padStart(4, '0')}-${String(resolvedMonth).padStart(2, '0')}-01`;
}

export function normalizeAverageRecords(
  raw: unknown,
  valueType: BudgetValueType,
): BudgetAverageRecord[] {
  if (!Array.isArray(raw) || valueType === 'simple') return [];

  const normalized: BudgetAverageRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const normalizedDate = normalizeDate(row.date);
    const amount = normalizeAmount(row.amount);
    if (amount == null) continue;

    if (normalizedDate) {
      const derived = getDerivedPartsFromDate(normalizedDate);
      if (valueType === 'monthly_averaged') {
        normalized.push({ year: derived.year, month: derived.month, amount, date: normalizedDate });
        continue;
      }

      normalized.push({ year: derived.year, month: null, amount, date: normalizedDate });
      continue;
    }

    const year = normalizeYear(row.year);
    if (year == null) continue;

    if (valueType === 'monthly_averaged') {
      const month = normalizeMonth(row.month);
      if (month == null) continue;
      normalized.push({ year, month, amount, date: buildFallbackDate(valueType, year, month) });
      continue;
    }

    normalized.push({ year, month: null, amount, date: buildFallbackDate(valueType, year, null) });
  }

  return normalized;
}

export function calculateMonthlyAveragedAmount(records: BudgetAverageRecord[]): number {
  const totalsByMonth = new Map<string, number>();
  for (const record of records) {
    if (record.month == null) continue;
    const key = `${record.year}-${String(record.month).padStart(2, '0')}`;
    totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + record.amount);
  }
  if (totalsByMonth.size === 0) return 0;

  const total = Array.from(totalsByMonth.values()).reduce((sum, value) => sum + value, 0);
  return total / totalsByMonth.size;
}

export function calculateYearlyAveragedAmount(records: BudgetAverageRecord[]): number {
  const totalsByYear = new Map<number, number>();
  for (const record of records) {
    totalsByYear.set(record.year, (totalsByYear.get(record.year) ?? 0) + record.amount);
  }
  if (totalsByYear.size === 0) return 0;

  const total = Array.from(totalsByYear.values()).reduce((sum, value) => sum + value, 0);
  return total / totalsByYear.size;
}

export function calculateAmountFromAverageRecords(
  valueType: BudgetValueType,
  records: BudgetAverageRecord[],
): number {
  if (valueType === 'monthly_averaged') return calculateMonthlyAveragedAmount(records);
  if (valueType === 'yearly_averaged') return calculateYearlyAveragedAmount(records);
  return 0;
}

export function getAveragedFrequencyLabel(valueType: BudgetValueType): string {
  if (valueType === 'monthly_averaged') return 'Monthly Avg';
  if (valueType === 'yearly_averaged') return 'Yearly Avg';
  return '';
}

export function convertAverageRecordsForValueType(
  records: BudgetAverageRecord[],
  fromType: BudgetValueType,
  toType: BudgetValueType,
): BudgetAverageRecord[] {
  if (toType === 'simple') return [];
  if (fromType === toType) return normalizeAverageRecords(records, toType);

  if (fromType === 'monthly_averaged' && toType === 'yearly_averaged') {
    return records.map((record) => ({
      year: record.year,
      month: null,
      amount: record.amount,
      date: record.date ?? buildFallbackDate(fromType, record.year, record.month),
    }));
  }

  if (fromType === 'yearly_averaged' && toType === 'monthly_averaged') {
    return records.map((record) => ({
      year: record.year,
      month: 1,
      amount: record.amount,
      date: record.date ?? buildFallbackDate(fromType, record.year, null),
    }));
  }

  return normalizeAverageRecords(records, toType);
}

export function seedAverageRecordsFromSimpleAmount(
  targetType: Extract<BudgetValueType, 'monthly_averaged' | 'yearly_averaged'>,
  amount: number,
  currentDate: Date = new Date(),
): BudgetAverageRecord[] {
  const year = currentDate.getFullYear();
  if (targetType === 'monthly_averaged') {
    return [{ year, month: currentDate.getMonth() + 1, amount, date: buildFallbackDate(targetType, year, currentDate.getMonth() + 1) }];
  }
  return [{ year, month: null, amount, date: buildFallbackDate(targetType, year, null) }];
}

export function sortAverageRecordsForEditor(records: BudgetAverageRecord[]): BudgetAverageRecord[] {
  return [...records].sort((left, right) => {
    const leftDateKey = Number((left.date ?? buildFallbackDate(left.month == null ? 'yearly_averaged' : 'monthly_averaged', left.year, left.month)).replaceAll('-', ''));
    const rightDateKey = Number((right.date ?? buildFallbackDate(right.month == null ? 'yearly_averaged' : 'monthly_averaged', right.year, right.month)).replaceAll('-', ''));
    if (rightDateKey !== leftDateKey) return rightDateKey - leftDateKey;

    return right.amount - left.amount;
  });
}

export function enforceExpenseTypeInvariants(
  valueType: BudgetValueType,
  input: {
    amount: number;
    frequency_type: string;
    frequency_param: number | null;
    is_estimate: boolean;
    average_records: BudgetAverageRecord[];
  },
): {
  amount: number;
  frequency_type: FrequencyType;
  frequency_param: number | null;
  is_estimate: boolean;
  value_type: BudgetValueType;
  average_records: BudgetAverageRecord[];
} {
  if (valueType === 'simple') {
    return {
      ...input,
      frequency_type: input.frequency_type as FrequencyType,
      value_type: valueType,
      average_records: [],
    };
  }

  const amount = calculateAmountFromAverageRecords(valueType, input.average_records);
  return {
    ...input,
    value_type: valueType,
    amount,
    average_records: normalizeAverageRecords(input.average_records, valueType),
    frequency_type: (valueType === 'monthly_averaged' ? 'monthly' : 'annual') as FrequencyType,
    frequency_param: null,
    is_estimate: true,
  };
}

export function enforceIncomeTypeInvariants(
  valueType: BudgetValueType,
  input: {
    amount: number;
    frequency_type: string;
    frequency_param: number | null;
    is_estimate: boolean;
    average_records: BudgetAverageRecord[];
  },
): {
  amount: number;
  frequency_type: FrequencyType;
  frequency_param: number | null;
  is_estimate: boolean;
  value_type: BudgetValueType;
  average_records: BudgetAverageRecord[];
} {
  if (valueType === 'simple') {
    return {
      ...input,
      frequency_type: input.frequency_type as FrequencyType,
      value_type: valueType,
      average_records: [],
    };
  }

  const amount = calculateAmountFromAverageRecords(valueType, input.average_records);
  return {
    ...input,
    value_type: valueType,
    amount,
    average_records: normalizeAverageRecords(input.average_records, valueType),
    frequency_type: (valueType === 'monthly_averaged' ? 'monthly' : 'annual') as FrequencyType,
    frequency_param: null,
    is_estimate: true,
  };
}
