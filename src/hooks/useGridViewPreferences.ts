import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { SortingState, Updater } from '@tanstack/react-table';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRequest } from '@/lib/supabaseRequest';
import type { GridKey } from '@/lib/gridColumnWidths';

const GRID_VIEW_PREFERENCES_STORAGE_KEY_PREFIX = 'bathos_grid_view_preferences';
const LEGACY_UPDATED_AT = '1970-01-01T00:00:00.000Z';
export const EMPTY_GRID_VIEW_FILTERS: Record<string, never> = {};

type PreferenceKind = 'filters' | 'sorting';

interface StoredPreferenceSlice<TValue> {
  value: TValue;
  updatedAt: string;
}

interface StoredGridViewPreferences<TFilters, TSorting> {
  filters?: StoredPreferenceSlice<TFilters>;
  sorting?: StoredPreferenceSlice<TSorting>;
}

interface InitialPreferences<TFilters, TSorting> {
  filters: TFilters;
  sorting: TSorting;
  filtersUpdatedAt: string;
  sortingUpdatedAt: string;
  allPreferences: Record<string, unknown>;
}

interface UseGridViewPreferencesOptions<TFilters extends object, TSorting extends SortingState = SortingState> {
  userId?: string;
  gridKey: GridKey;
  defaultFilters: TFilters;
  defaultSorting: TSorting;
  sanitizeFilters?: (raw: unknown) => TFilters;
  sanitizeSorting?: (raw: unknown) => TSorting;
  getLegacyPreferences?: () => {
    filters?: unknown;
    sorting?: unknown;
  };
}

function applyUpdater<T>(updater: SetStateAction<T>, current: T): T {
  return typeof updater === 'function'
    ? (updater as (previous: T) => T)(current)
    : updater;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStorageUserKey(userId?: string): string {
  return userId ?? 'anonymous';
}

function getGridViewPreferencesStorageKey(userId?: string): string {
  return `${GRID_VIEW_PREFERENCES_STORAGE_KEY_PREFIX}:${getStorageUserKey(userId)}`;
}

function readCachedGridViewPreferences(userId?: string): Record<string, unknown> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(getGridViewPreferencesStorageKey(userId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeCachedGridViewPreferences(
  userId: string | undefined,
  allPreferences: unknown,
): void {
  if (typeof window === 'undefined') return;

  const safePreferences = isRecord(allPreferences) ? allPreferences : {};
  const storageKey = getGridViewPreferencesStorageKey(userId);

  try {
    const serialized = JSON.stringify(safePreferences);
    if (window.localStorage.getItem(storageKey) !== serialized) {
      window.localStorage.setItem(storageKey, serialized);
    }
  } catch {
    // Ignore localStorage quota / serialization errors.
  }
}

function isStoredPreferenceSlice(value: unknown): value is StoredPreferenceSlice<unknown> {
  if (!isRecord(value)) return false;
  return 'value' in value && typeof value.updatedAt === 'string';
}

function getStoredGridPreferences<TFilters, TSorting>(
  allPreferences: Record<string, unknown>,
  gridKey: GridKey,
): StoredGridViewPreferences<TFilters, TSorting> {
  const rawGridPreferences = allPreferences[gridKey];
  if (!isRecord(rawGridPreferences)) return {};

  const filters = isStoredPreferenceSlice(rawGridPreferences.filters)
    ? rawGridPreferences.filters as StoredPreferenceSlice<TFilters>
    : undefined;
  const sorting = isStoredPreferenceSlice(rawGridPreferences.sorting)
    ? rawGridPreferences.sorting as StoredPreferenceSlice<TSorting>
    : undefined;

  return { filters, sorting };
}

function mergeGridViewPreferences<TFilters, TSorting>(
  existing: unknown,
  gridKey: GridKey,
  preferences: StoredGridViewPreferences<TFilters, TSorting>,
): Record<string, unknown> {
  const base = isRecord(existing) ? { ...existing } : {};
  const currentGridPreferences = isRecord(base[gridKey]) ? { ...base[gridKey] } : {};

  if (preferences.filters) {
    currentGridPreferences.filters = preferences.filters;
  }
  if (preferences.sorting) {
    currentGridPreferences.sorting = preferences.sorting;
  }

  base[gridKey] = currentGridPreferences;
  return base;
}

function isNewerPreference(candidateUpdatedAt?: string, currentUpdatedAt?: string) {
  if (!candidateUpdatedAt) return false;
  if (!currentUpdatedAt) return true;
  return Date.parse(candidateUpdatedAt) > Date.parse(currentUpdatedAt);
}

export function sanitizeSortingState<TSorting extends SortingState = SortingState>(
  raw: unknown,
  defaultSorting: TSorting,
  allowedColumnIds?: ReadonlySet<string>,
): TSorting {
  if (!Array.isArray(raw)) return defaultSorting;

  const validSorting = raw.filter((entry): entry is { id: string; desc: boolean } => {
    if (!isRecord(entry)) return false;
    return typeof entry.id === 'string'
      && typeof entry.desc === 'boolean'
      && (!allowedColumnIds || allowedColumnIds.has(entry.id));
  });

  return validSorting as TSorting;
}

function createDefaultInitialPreferences<TFilters extends object, TSorting extends SortingState>(
  options: UseGridViewPreferencesOptions<TFilters, TSorting>,
): InitialPreferences<TFilters, TSorting> {
  const sanitizeFilters = options.sanitizeFilters ?? ((raw: unknown) => (
    isRecord(raw) ? { ...options.defaultFilters, ...raw } : options.defaultFilters
  ));
  const sanitizeSorting = options.sanitizeSorting ?? ((raw: unknown) => (
    sanitizeSortingState(raw, options.defaultSorting) as TSorting
  ));
  const allPreferences = readCachedGridViewPreferences(options.userId);
  const storedPreferences = getStoredGridPreferences<TFilters, TSorting>(allPreferences, options.gridKey);
  const legacyPreferences = options.getLegacyPreferences?.();

  return {
    filters: storedPreferences.filters
      ? sanitizeFilters(storedPreferences.filters.value)
      : legacyPreferences && 'filters' in legacyPreferences
        ? sanitizeFilters(legacyPreferences.filters)
        : options.defaultFilters,
    sorting: storedPreferences.sorting
      ? sanitizeSorting(storedPreferences.sorting.value)
      : legacyPreferences && 'sorting' in legacyPreferences
        ? sanitizeSorting(legacyPreferences.sorting)
        : options.defaultSorting,
    filtersUpdatedAt: storedPreferences.filters?.updatedAt ?? (
      legacyPreferences && 'filters' in legacyPreferences ? LEGACY_UPDATED_AT : LEGACY_UPDATED_AT
    ),
    sortingUpdatedAt: storedPreferences.sorting?.updatedAt ?? (
      legacyPreferences && 'sorting' in legacyPreferences ? LEGACY_UPDATED_AT : LEGACY_UPDATED_AT
    ),
    allPreferences,
  };
}

export function useGridViewPreferences<TFilters extends object, TSorting extends SortingState = SortingState>(
  options: UseGridViewPreferencesOptions<TFilters, TSorting>,
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const initialPreferences = createDefaultInitialPreferences(options);
  const [filters, setFiltersState] = useState<TFilters>(initialPreferences.filters);
  const [sorting, setSortingState] = useState<TSorting>(initialPreferences.sorting);
  const allPreferencesRef = useRef<Record<string, unknown>>(initialPreferences.allPreferences);
  const filtersUpdatedAtRef = useRef(initialPreferences.filtersUpdatedAt);
  const sortingUpdatedAtRef = useRef(initialPreferences.sortingUpdatedAt);

  const persistPreferences = useCallback((
    nextPreferences: StoredGridViewPreferences<TFilters, TSorting>,
  ) => {
    const { userId, gridKey } = optionsRef.current;
    const latestCachedPreferences = readCachedGridViewPreferences(userId);
    const mergedPreferences = mergeGridViewPreferences(
      { ...allPreferencesRef.current, ...latestCachedPreferences },
      gridKey,
      nextPreferences,
    );
    allPreferencesRef.current = mergedPreferences;
    writeCachedGridViewPreferences(userId, mergedPreferences);

    if (!userId) return;

    void (async () => {
      try {
        await supabaseRequest(async () =>
          await supabase
            .from('bathos_user_settings')
            .upsert(
              [{
                user_id: userId,
                grid_view_preferences: mergedPreferences as unknown as import('@/integrations/supabase/types').Json,
              }],
              { onConflict: 'user_id' },
            ),
        );
      } catch (error) {
        console.error('Failed to persist grid view preferences:', error);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const {
      userId,
      gridKey,
      defaultFilters,
      defaultSorting,
      getLegacyPreferences,
    } = optionsRef.current;
    const sanitizeFilters = optionsRef.current.sanitizeFilters ?? ((raw: unknown) => (
      isRecord(raw) ? { ...defaultFilters, ...raw } : defaultFilters
    ));
    const sanitizeSorting = optionsRef.current.sanitizeSorting ?? ((raw: unknown) => (
      sanitizeSortingState(raw, defaultSorting) as TSorting
    ));

    const cachedPreferences = readCachedGridViewPreferences(userId);
    const cachedGridPreferences = getStoredGridPreferences<TFilters, TSorting>(cachedPreferences, gridKey);
    const legacyPreferences = getLegacyPreferences?.();
    const nextFilters = cachedGridPreferences.filters
      ? sanitizeFilters(cachedGridPreferences.filters.value)
      : legacyPreferences && 'filters' in legacyPreferences
        ? sanitizeFilters(legacyPreferences.filters)
        : defaultFilters;
    const nextSorting = cachedGridPreferences.sorting
      ? sanitizeSorting(cachedGridPreferences.sorting.value)
      : legacyPreferences && 'sorting' in legacyPreferences
        ? sanitizeSorting(legacyPreferences.sorting)
        : defaultSorting;

    allPreferencesRef.current = cachedPreferences;
    filtersUpdatedAtRef.current = cachedGridPreferences.filters?.updatedAt ?? LEGACY_UPDATED_AT;
    sortingUpdatedAtRef.current = cachedGridPreferences.sorting?.updatedAt ?? LEGACY_UPDATED_AT;
    setFiltersState(nextFilters);
    setSortingState(nextSorting);

    if (!userId) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      let data: { grid_view_preferences: unknown } | null = null;
      try {
        data = await supabaseRequest(async () =>
          await supabase
            .from('bathos_user_settings')
            .select('grid_view_preferences')
            .eq('user_id', userId)
            .maybeSingle(),
        );
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load grid view preferences:', error);
        }
        return;
      }

      if (cancelled) return;

      const rawDatabasePreferences = isRecord(data?.grid_view_preferences)
        ? data?.grid_view_preferences as Record<string, unknown>
        : {};
      const databaseGridPreferences = getStoredGridPreferences<TFilters, TSorting>(
        rawDatabasePreferences,
        gridKey,
      );

      let mergedFilters = nextFilters;
      let mergedSorting = nextSorting;
      let mergedFiltersUpdatedAt = filtersUpdatedAtRef.current;
      let mergedSortingUpdatedAt = sortingUpdatedAtRef.current;

      if (databaseGridPreferences.filters && isNewerPreference(
        databaseGridPreferences.filters.updatedAt,
        mergedFiltersUpdatedAt,
      )) {
        mergedFilters = sanitizeFilters(databaseGridPreferences.filters.value);
        mergedFiltersUpdatedAt = databaseGridPreferences.filters.updatedAt;
      }

      if (databaseGridPreferences.sorting && isNewerPreference(
        databaseGridPreferences.sorting.updatedAt,
        mergedSortingUpdatedAt,
      )) {
        mergedSorting = sanitizeSorting(databaseGridPreferences.sorting.value);
        mergedSortingUpdatedAt = databaseGridPreferences.sorting.updatedAt;
      }

      filtersUpdatedAtRef.current = mergedFiltersUpdatedAt;
      sortingUpdatedAtRef.current = mergedSortingUpdatedAt;
      setFiltersState(mergedFilters);
      setSortingState(mergedSorting);

      const databaseHasFilters = Boolean(databaseGridPreferences.filters);
      const databaseHasSorting = Boolean(databaseGridPreferences.sorting);
      const shouldPromoteFilters = !databaseHasFilters;
      const shouldPromoteSorting = !databaseHasSorting;
      const promotedAt = shouldPromoteFilters || shouldPromoteSorting ? new Date().toISOString() : null;
      const nextFiltersUpdatedAt = shouldPromoteFilters && promotedAt ? promotedAt : mergedFiltersUpdatedAt;
      const nextSortingUpdatedAt = shouldPromoteSorting && promotedAt ? promotedAt : mergedSortingUpdatedAt;

      filtersUpdatedAtRef.current = nextFiltersUpdatedAt;
      sortingUpdatedAtRef.current = nextSortingUpdatedAt;

      const nextAllPreferences = mergeGridViewPreferences(rawDatabasePreferences, gridKey, {
        filters: {
          value: mergedFilters,
          updatedAt: nextFiltersUpdatedAt,
        },
        sorting: {
          value: mergedSorting,
          updatedAt: nextSortingUpdatedAt,
        },
      });
      allPreferencesRef.current = nextAllPreferences;
      writeCachedGridViewPreferences(userId, nextAllPreferences);

      const databaseFiltersUpdatedAt = databaseGridPreferences.filters?.updatedAt;
      const databaseSortingUpdatedAt = databaseGridPreferences.sorting?.updatedAt;
      if (
        databaseFiltersUpdatedAt !== nextFiltersUpdatedAt
        || databaseSortingUpdatedAt !== nextSortingUpdatedAt
      ) {
        persistPreferences({
          filters: {
            value: mergedFilters,
            updatedAt: nextFiltersUpdatedAt,
          },
          sorting: {
            value: mergedSorting,
            updatedAt: nextSortingUpdatedAt,
          },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [options.userId, options.gridKey, persistPreferences]);

  const setFilters = useCallback<Dispatch<SetStateAction<TFilters>>>((updater) => {
    setFiltersState((current) => {
      const next = applyUpdater(updater, current);
      const updatedAt = new Date().toISOString();
      filtersUpdatedAtRef.current = updatedAt;
      persistPreferences({
        filters: {
          value: next,
          updatedAt,
        },
      });
      return next;
    });
  }, [persistPreferences]);

  const setSorting = useCallback<Dispatch<SetStateAction<TSorting>>>((updater) => {
    setSortingState((current) => {
      const next = applyUpdater(updater, current);
      const updatedAt = new Date().toISOString();
      sortingUpdatedAtRef.current = updatedAt;
      persistPreferences({
        sorting: {
          value: next,
          updatedAt,
        },
      });
      return next;
    });
  }, [persistPreferences]);

  return {
    filters,
    setFilters,
    sorting,
    setSorting: setSorting as (updater: Updater<TSorting>) => void,
  };
}
