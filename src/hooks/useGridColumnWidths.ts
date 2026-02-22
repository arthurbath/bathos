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
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    sanitizeColumnWidths(undefined, defaults, fixedColumnIds),
  );
  const [columnSizingInfo, setColumnSizingInfo] = useState<ColumnSizingInfoState>(
    EMPTY_COLUMN_SIZING_INFO,
  );
  const [loaded, setLoaded] = useState(false);
  const widthsByGridRef = useRef<Record<string, unknown>>({});
  const wasResizingRef = useRef(false);
  const lastPersistedWidthsRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    const defaultSizing = sanitizeColumnWidths(undefined, defaults, fixedColumnIds);
    setColumnSizing(defaultSizing);
    setLoaded(false);
    widthsByGridRef.current = {};
    lastPersistedWidthsRef.current = JSON.stringify(defaultSizing);

    if (!userId) {
      setLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
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

          widthsByGridRef.current = mergedGridWidths;
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
