import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ColumnSizingInfoState,
  ColumnSizingState,
  OnChangeFn,
  Updater,
} from '@tanstack/react-table';
import { supabase } from '@/integrations/supabase/client';
import {
  mergeGridColumnWidths,
  sanitizeColumnWidths,
  type ColumnWidthMap,
  type GridKey,
} from '@/lib/gridColumnWidths';

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
  const fixedColumnIdsKey = useMemo(
    () => fixedColumnIds.slice().sort().join('|'),
    [fixedColumnIds],
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    const cachedGridWidths = readCachedGridColumnWidths(userId);
    return sanitizeColumnWidths(cachedGridWidths[gridKey], defaults, fixedColumnIds);
  });
  const [columnSizingInfo, setColumnSizingInfo] = useState<ColumnSizingInfoState>(
    EMPTY_COLUMN_SIZING_INFO,
  );
  const [loaded, setLoaded] = useState(false);
  const widthsByGridRef = useRef<Record<string, unknown>>(
    readCachedGridColumnWidths(userId),
  );
  const wasResizingRef = useRef(false);
  const lastPersistedWidthsRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    const cachedAllGridWidths = readCachedGridColumnWidths(userId);
    const optimisticSizing = sanitizeColumnWidths(
      cachedAllGridWidths[gridKey],
      defaults,
      fixedColumnIds,
    );

    setColumnSizing(optimisticSizing);
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
      const { data, error } = await supabase
        .from('bathos_user_settings')
        .select('grid_column_widths')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Failed to load grid column widths:', error);
        setLoaded(true);
        return;
      }

      const rawAllGridWidths =
        data?.grid_column_widths &&
        typeof data.grid_column_widths === 'object' &&
        !Array.isArray(data.grid_column_widths)
          ? (data.grid_column_widths as Record<string, unknown>)
          : {};

      if (JSON.stringify(rawAllGridWidths) !== cachedAllGridWidthsSerialized) {
        writeCachedGridColumnWidths(userId, rawAllGridWidths);
      }

      widthsByGridRef.current = rawAllGridWidths;
      const loadedSizing = sanitizeColumnWidths(
        rawAllGridWidths[gridKey],
        defaults,
        fixedColumnIds,
      );
      setColumnSizing(loadedSizing);
      lastPersistedWidthsRef.current = JSON.stringify(loadedSizing);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, gridKey, defaults, fixedColumnIds, fixedColumnIdsKey]);

  const onColumnSizingChange = useCallback<OnChangeFn<ColumnSizingState>>(
    (updater) => {
      setColumnSizing((current) => {
        const next = applyUpdater(updater, current);
        return sanitizeColumnWidths(
          { ...current, ...next },
          defaults,
          fixedColumnIds,
        );
      });
    },
    [defaults, fixedColumnIds],
  );

  const onColumnSizingInfoChange = useCallback<OnChangeFn<ColumnSizingInfoState>>(
    (updater) => {
      setColumnSizingInfo((current) => applyUpdater(updater, current));
    },
    [],
  );

  useEffect(() => {
    const isResizing = Boolean(columnSizingInfo.isResizingColumn);

    if (!loaded || !userId) {
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
          const mergedGridWidths = mergeGridColumnWidths(
            widthsByGridRef.current,
            gridKey,
            sanitizedWidths,
          );
          widthsByGridRef.current = mergedGridWidths;
          writeCachedGridColumnWidths(userId, mergedGridWidths);

          const { error } = await supabase
            .from('bathos_user_settings')
            .upsert(
              {
                user_id: userId,
                grid_column_widths: mergedGridWidths,
              },
              { onConflict: 'user_id' },
            );

          if (error) {
            console.error('Failed to persist grid column widths:', error);
            lastPersistedWidthsRef.current = '';
            return;
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
  ]);

  return {
    columnSizing,
    columnSizingInfo,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  };
}
