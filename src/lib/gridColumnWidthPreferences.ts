const DEFAULT_GRID_COLUMN_WIDTHS_ONLY_STORAGE_KEY_PREFIX = 'bathos_default_grid_column_widths_only';

function getDefaultGridColumnWidthsOnlyStorageKey(userId: string): string {
  return `${DEFAULT_GRID_COLUMN_WIDTHS_ONLY_STORAGE_KEY_PREFIX}:${userId}`;
}

export function readCachedDefaultGridColumnWidthsOnly(userId?: string): boolean {
  if (!userId || typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(getDefaultGridColumnWidthsOnlyStorageKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function writeCachedDefaultGridColumnWidthsOnly(
  userId: string | undefined,
  enabled: boolean,
): void {
  if (!userId || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      getDefaultGridColumnWidthsOnlyStorageKey(userId),
      enabled ? 'true' : 'false',
    );
  } catch {
    // Ignore storage errors.
  }
}

function extractErrorText(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === 'string') return error.toLowerCase();
  if (error && typeof error === 'object') {
    const parts = [
      'message' in error ? error.message : '',
      'details' in error ? error.details : '',
      'hint' in error ? error.hint : '',
    ];
    return parts
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ')
      .toLowerCase();
  }
  return '';
}

export function isMissingDefaultGridWidthsOnlyColumnError(error: unknown): boolean {
  const text = extractErrorText(error);
  return text.includes('use_default_grid_column_widths')
    && (text.includes('column') || text.includes('schema cache'));
}

export function getDefaultGridWidthsOnlyColumnErrorMessage(): string {
  return 'Apply migration 20260307110000_add_default_grid_widths_admin_setting.sql, then retry.';
}
