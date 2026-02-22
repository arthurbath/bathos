export const GRID_RESIZE_STEP = 20;
export const GRID_MIN_COLUMN_WIDTH = 60;

export type GridKey = 'expenses' | 'incomes';
export type ColumnWidthMap = Record<string, number>;

export const EXPENSES_GRID_DEFAULT_WIDTHS: ColumnWidthMap = {
  name: 240,
  category: 220,
  amount: 120,
  estimate: 80,
  frequency: 220,
  monthly: 120,
  payment_method: 240,
  payer: 140,
  benefit_x: 120,
  benefit_y: 120,
  fair_x: 120,
  fair_y: 120,
  actions: 60,
};

export const INCOMES_GRID_DEFAULT_WIDTHS: ColumnWidthMap = {
  name: 240,
  partner_label: 200,
  amount: 120,
  frequency_type: 220,
  monthly: 120,
  actions: 60,
};

export const GRID_FIXED_COLUMNS: Record<GridKey, string[]> = {
  expenses: ['actions'],
  incomes: ['actions'],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function snapColumnWidth(value: number): number {
  if (!Number.isFinite(value)) return GRID_MIN_COLUMN_WIDTH;
  return Math.max(
    GRID_MIN_COLUMN_WIDTH,
    Math.round(value / GRID_RESIZE_STEP) * GRID_RESIZE_STEP,
  );
}

export function sanitizeColumnWidths(
  rawWidths: unknown,
  defaults: ColumnWidthMap,
  fixedColumnIds: string[] = [],
): ColumnWidthMap {
  const normalizedDefaults: ColumnWidthMap = {};
  for (const [columnId, defaultWidth] of Object.entries(defaults)) {
    normalizedDefaults[columnId] = snapColumnWidth(defaultWidth);
  }

  if (isPlainObject(rawWidths)) {
    for (const [columnId, rawValue] of Object.entries(rawWidths)) {
      if (!(columnId in normalizedDefaults)) continue;
      const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      if (!Number.isFinite(parsed)) continue;
      normalizedDefaults[columnId] = snapColumnWidth(parsed);
    }
  }

  for (const fixedColumnId of fixedColumnIds) {
    const fallback = defaults[fixedColumnId] ?? GRID_MIN_COLUMN_WIDTH;
    normalizedDefaults[fixedColumnId] = snapColumnWidth(fallback);
  }

  return normalizedDefaults;
}

export function mergeGridColumnWidths(
  existing: unknown,
  gridKey: GridKey,
  widths: ColumnWidthMap,
): Record<string, unknown> {
  const base = isPlainObject(existing) ? { ...existing } : {};
  base[gridKey] = widths;
  return base;
}
