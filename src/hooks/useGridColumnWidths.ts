import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ColumnSizingInfoState,
  ColumnSizingState,
  OnChangeFn,
  Updater,
} from '@tanstack/react-table';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRequest } from '@/lib/supabaseRequest';
import {
  mergeGridColumnWidths,
  sanitizeColumnWidths,
  type ColumnWidthMap,
  type GridKey,
} from '@/lib/gridColumnWidths';
import {
  isMissingDefaultGridWidthsOnlyColumnError,
  readCachedDefaultGridColumnWidthsOnly,
  writeCachedDefaultGridColumnWidthsOnly,
} from '@/lib/gridColumnWidthPreferences';

const EMPTY_COLUMN_SIZING_INFO: ColumnSizingInfoState = {
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: [],
};

function applyUpdater<T>(updater: Updater<T>, current: T): T {
  return typeof updater === 'function'
    ? (updater as (old: T) => T)(current)
    : updater;
}

const GRID_COLUMN_WIDTHS_STORAGE_KEY_PREFIX = 'bathos_grid_column_widths';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeAllGridWidthRecords(...sources: unknown[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (!isRecord(source)) continue;
    Object.assign(merged, source);
  }
  return merged;
}

function getGridColumnWidthsStorageKey(userId: string): string {
  return `${GRID_COLUMN_WIDTHS_STORAGE_KEY_PREFIX}:${userId}`;
}

function readCachedGridColumnWidths(userId?: string): Record<string, unknown> {
  if (!userId || typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(getGridColumnWidthsStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeCachedGridColumnWidths(
  userId: string | undefined,
  allGridWidths: unknown,
): void {
  if (!userId || typeof window === 'undefined') return;

  const safeWidths = isRecord(allGridWidths) ? allGridWidths : {};
  const storageKey = getGridColumnWidthsStorageKey(userId);

  try {
    const serialized = JSON.stringify(safeWidths);
    if (window.localStorage.getItem(storageKey) !== serialized) {
      window.localStorage.setItem(storageKey, serialized);
    }
  } catch {
    // Ignore localStorage quota / serialization errors.
  }
}

interface UseGridColumnWidthsOptions {
  userId?: string;
  gridKey: GridKey;
  defaults: ColumnWidthMap;
  fixedColumnIds?: string[];
}

export function useGridColumnWidths({
  userId,
  gridKey,
  defaults,
  fixedColumnIds = [],
}: UseGridColumnWidthsOptions) {
  const cachedDefaultWidthsOnly = readCachedDefaultGridColumnWidthsOnly(userId);
  const fixedColumnIdsKey = useMemo(
    () => fixedColumnIds.slice().sort().join('|'),
    [fixedColumnIds],
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    if (cachedDefaultWidthsOnly) {
      return sanitizeColumnWidths(undefined, defaults, fixedColumnIds);
    }

    const cachedGridWidths = readCachedGridColumnWidths(userId);
    return sanitizeColumnWidths(cachedGridWidths[gridKey], defaults, fixedColumnIds);
  });
  const [columnSizingInfo, setColumnSizingInfo] = useState<ColumnSizingInfoState>(
    EMPTY_COLUMN_SIZING_INFO,
  );
  const [loaded, setLoaded] = useState(false);
  const [defaultWidthsOnly, setDefaultWidthsOnly] = useState(cachedDefaultWidthsOnly);
  const widthsByGridRef = useRef<Record<string, unknown>>(
    readCachedGridColumnWidths(userId),
  );
  const wasResizingRef = useRef(false);
  const lastPersistedWidthsRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    const cachedAllGridWidths = readCachedGridColumnWidths(userId);
    const cachedDefaultWidthsOnlyValue = readCachedDefaultGridColumnWidthsOnly(userId);
    const optimisticSizing = cachedDefaultWidthsOnlyValue
      ? sanitizeColumnWidths(undefined, defaults, fixedColumnIds)
      : sanitizeColumnWidths(
          cachedAllGridWidths[gridKey],
          defaults,
          fixedColumnIds,
        );

    setColumnSizing(optimisticSizing);
    setDefaultWidthsOnly(cachedDefaultWidthsOnlyValue);
    setColumnSizingInfo(EMPTY_COLUMN_SIZING_INFO);
    setLoaded(false);
    widthsByGridRef.current = cachedAllGridWidths;
    lastPersistedWidthsRef.current = JSON.stringify(optimisticSizing);

    if (!userId) {
      setLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const cachedAllGridWidthsSerialized = JSON.stringify(cachedAllGridWidths);
      let data: {
        grid_column_widths: unknown;
        use_default_grid_column_widths: boolean | null;
      } | null = null;
      try {
        data = await supabaseRequest(async () =>
          await supabase
            .from('bathos_user_settings')
            .select('grid_column_widths, use_default_grid_column_widths')
            .eq('user_id', userId)
            .maybeSingle(),
        );
      } catch (error) {
        if (isMissingDefaultGridWidthsOnlyColumnError(error)) {
          try {
            const fallbackData = await supabaseRequest(async () =>
              await supabase
                .from('bathos_user_settings')
                .select('grid_column_widths')
                .eq('user_id', userId)
                .maybeSingle(),
            );
            if (cancelled) return;

            const fallbackGridWidths =
              fallbackData?.grid_column_widths &&
              typeof fallbackData.grid_column_widths === 'object' &&
              !Array.isArray(fallbackData.grid_column_widths)
                ? (fallbackData.grid_column_widths as Record<string, unknown>)
                : {};

            if (JSON.stringify(fallbackGridWidths) !== cachedAllGridWidthsSerialized) {
              writeCachedGridColumnWidths(userId, fallbackGridWidths);
            }

            writeCachedDefaultGridColumnWidthsOnly(userId, false);
            widthsByGridRef.current = fallbackGridWidths;
            setDefaultWidthsOnly(false);
            const fallbackSizing = sanitizeColumnWidths(
              fallbackGridWidths[gridKey],
              defaults,
              fixedColumnIds,
            );
            setColumnSizing(fallbackSizing);
            setColumnSizingInfo(EMPTY_COLUMN_SIZING_INFO);
            lastPersistedWidthsRef.current = JSON.stringify(fallbackSizing);
            setLoaded(true);
            return;
          } catch (fallbackError) {
            if (cancelled) return;
            console.error(
              'Failed to load grid column widths after missing-column fallback:',
              fallbackError,
            );
            setLoaded(true);
            return;
          }
        }
        if (cancelled) return;
        console.error('Failed to load grid column widths:', error);
        setLoaded(true);
        return;
      }

      if (cancelled) return;

      const rawAllGridWidths =
        data?.grid_column_widths &&
        typeof data.grid_column_widths === 'object' &&
        !Array.isArray(data.grid_column_widths)
          ? (data.grid_column_widths as Record<string, unknown>)
          : {};
      const nextDefaultWidthsOnly = data?.use_default_grid_column_widths === true;

      if (JSON.stringify(rawAllGridWidths) !== cachedAllGridWidthsSerialized) {
        writeCachedGridColumnWidths(userId, rawAllGridWidths);
      }
      writeCachedDefaultGridColumnWidthsOnly(userId, nextDefaultWidthsOnly);

      widthsByGridRef.current = rawAllGridWidths;
      setDefaultWidthsOnly(nextDefaultWidthsOnly);
      const loadedSizing = nextDefaultWidthsOnly
        ? sanitizeColumnWidths(undefined, defaults, fixedColumnIds)
        : sanitizeColumnWidths(
            rawAllGridWidths[gridKey],
            defaults,
            fixedColumnIds,
          );
      setColumnSizing(loadedSizing);
      setColumnSizingInfo(EMPTY_COLUMN_SIZING_INFO);
      lastPersistedWidthsRef.current = JSON.stringify(loadedSizing);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, gridKey, defaults, fixedColumnIds, fixedColumnIdsKey]);

  const onColumnSizingChange = useCallback<OnChangeFn<ColumnSizingState>>(
    (updater) => {
      if (defaultWidthsOnly) return;
      setColumnSizing((current) => {
        const next = applyUpdater(updater, current);
        return sanitizeColumnWidths(
          { ...current, ...next },
          defaults,
          fixedColumnIds,
        );
      });
    },
    [defaultWidthsOnly, defaults, fixedColumnIds],
  );

  const onColumnSizingInfoChange = useCallback<OnChangeFn<ColumnSizingInfoState>>(
    (updater) => {
      if (defaultWidthsOnly) {
        setColumnSizingInfo(EMPTY_COLUMN_SIZING_INFO);
        return;
      }
      setColumnSizingInfo((current) => applyUpdater(updater, current));
    },
    [defaultWidthsOnly],
  );

  useEffect(() => {
    if (!defaultWidthsOnly) return;

    setColumnSizing(sanitizeColumnWidths(undefined, defaults, fixedColumnIds));
    setColumnSizingInfo(EMPTY_COLUMN_SIZING_INFO);
    lastPersistedWidthsRef.current = JSON.stringify(
      sanitizeColumnWidths(undefined, defaults, fixedColumnIds),
    );
  }, [defaultWidthsOnly, defaults, fixedColumnIds, fixedColumnIdsKey]);

  useEffect(() => {
    const isResizing = Boolean(columnSizingInfo.isResizingColumn);

    if (!loaded || !userId || defaultWidthsOnly) {
      wasResizingRef.current = isResizing;
      return;
    }

    if (wasResizingRef.current && !isResizing) {
      const sanitizedWidths = sanitizeColumnWidths(
        columnSizing,
        defaults,
        fixedColumnIds,
      );
      const serialized = JSON.stringify(sanitizedWidths);

      if (serialized !== lastPersistedWidthsRef.current) {
        lastPersistedWidthsRef.current = serialized;
        void (async () => {
          const latestCachedGridWidths = readCachedGridColumnWidths(userId);
          const latestKnownGridWidths = mergeAllGridWidthRecords(
            widthsByGridRef.current,
            latestCachedGridWidths,
          );
          const mergedGridWidths = mergeGridColumnWidths(
            latestKnownGridWidths,
            gridKey,
            sanitizedWidths,
          );
          widthsByGridRef.current = mergedGridWidths;
          writeCachedGridColumnWidths(userId, mergedGridWidths);

          try {
            await supabaseRequest(async () =>
              await supabase
                .from('bathos_user_settings')
                .upsert(
                  [{
                    user_id: userId,
                    grid_column_widths: mergedGridWidths as unknown as import('@/integrations/supabase/types').Json,
                  }],
                  { onConflict: 'user_id' },
                ),
            );
          } catch (error) {
            console.error('Failed to persist grid column widths:', error);
            lastPersistedWidthsRef.current = '';
          }
        })();
      }
    }

    wasResizingRef.current = isResizing;
  }, [
    columnSizingInfo.isResizingColumn,
    columnSizing,
    defaults,
    fixedColumnIds,
    gridKey,
    loaded,
    userId,
    defaultWidthsOnly,
  ]);

  return {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled: !defaultWidthsOnly,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  };
}
