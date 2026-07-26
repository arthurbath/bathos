import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { supabaseRequest } from '@/lib/supabaseRequest';
import {
  sanitizeTaskQuickFilter,
  type TaskQuickFilter,
} from '@/modules/tasks/domain/taskQuickFilters';

const TASK_QUICK_FILTER_STORAGE_KEY_PREFIX = 'bathos_tasks_quick_filter';
const DEFAULT_UPDATED_AT = '1970-01-01T00:00:00.000Z';

type StoredTaskQuickFilter = {
  value: TaskQuickFilter;
  updatedAt: string;
};

type TaskQuickFilterRow = {
  tasks_quick_filter: string;
  tasks_quick_filter_updated_at: string;
};

function getStorageKey(userId: string): string {
  return `${TASK_QUICK_FILTER_STORAGE_KEY_PREFIX}:${userId}`;
}

function readCachedPreference(userId: string): StoredTaskQuickFilter {
  if (typeof window === 'undefined') {
    return { value: 'all', updatedAt: DEFAULT_UPDATED_AT };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return { value: 'all', updatedAt: DEFAULT_UPDATED_AT };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { value: 'all', updatedAt: DEFAULT_UPDATED_AT };
    }
    const candidate = parsed as Record<string, unknown>;
    return {
      value: sanitizeTaskQuickFilter(candidate.value),
      updatedAt: typeof candidate.updatedAt === 'string'
        && Number.isFinite(Date.parse(candidate.updatedAt))
        ? candidate.updatedAt
        : DEFAULT_UPDATED_AT,
    };
  } catch {
    return { value: 'all', updatedAt: DEFAULT_UPDATED_AT };
  }
}

function writeCachedPreference(userId: string, preference: StoredTaskQuickFilter): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(preference));
  } catch {
    // A database-backed preference still works when localStorage is unavailable.
  }
}

function isNewer(candidate: string, current: string): boolean {
  return Date.parse(candidate) > Date.parse(current);
}

export function useTaskQuickFilterPreference(userId: string) {
  const initial = readCachedPreference(userId);
  const [filter, setFilterState] = useState<TaskQuickFilter>(initial.value);
  const currentRef = useRef(initial);

  const applyPreference = useCallback((
    preference: StoredTaskQuickFilter,
    cache = true,
  ) => {
    currentRef.current = preference;
    setFilterState(preference.value);
    if (cache) writeCachedPreference(userId, preference);
  }, [userId]);

  const persistPreference = useCallback(async (preference: StoredTaskQuickFilter) => {
    await supabaseRequest(async () => (
      await supabase
        .from('bathos_user_settings')
        .upsert([{
          user_id: userId,
          tasks_quick_filter: preference.value,
          tasks_quick_filter_updated_at: preference.updatedAt,
        }], { onConflict: 'user_id' })
    ));
  }, [userId]);

  const reconcilePreference = useCallback(async () => {
    const cached = readCachedPreference(userId);
    if (isNewer(cached.updatedAt, currentRef.current.updatedAt)) {
      applyPreference(cached, false);
    }

    let row: TaskQuickFilterRow | null;
    try {
      row = await supabaseRequest(async () => (
        await supabase
          .from('bathos_user_settings')
          .select('tasks_quick_filter, tasks_quick_filter_updated_at')
          .eq('user_id', userId)
          .maybeSingle()
      ));
    } catch (error) {
      console.error('Failed to load the Tasks quick filter preference:', error);
      return;
    }

    const latestCached = readCachedPreference(userId);
    const databasePreference: StoredTaskQuickFilter = row === null
      ? { value: 'all', updatedAt: DEFAULT_UPDATED_AT }
      : {
        value: sanitizeTaskQuickFilter(row.tasks_quick_filter),
        updatedAt: Number.isFinite(Date.parse(row.tasks_quick_filter_updated_at))
          ? row.tasks_quick_filter_updated_at
          : DEFAULT_UPDATED_AT,
      };

    if (isNewer(databasePreference.updatedAt, latestCached.updatedAt)) {
      applyPreference(databasePreference);
      return;
    }

    if (isNewer(latestCached.updatedAt, databasePreference.updatedAt)) {
      applyPreference(latestCached, false);
      try {
        await persistPreference(latestCached);
      } catch (error) {
        console.error('Failed to persist the Tasks quick filter preference:', error);
      }
      return;
    }

    applyPreference(latestCached, false);
  }, [applyPreference, persistPreference, userId]);

  useEffect(() => {
    const initialCached = readCachedPreference(userId);
    applyPreference(initialCached, false);
    void reconcilePreference();

    const handleRefresh = () => {
      void reconcilePreference();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== getStorageKey(userId)) return;
      const cached = readCachedPreference(userId);
      if (isNewer(cached.updatedAt, currentRef.current.updatedAt)) {
        applyPreference(cached, false);
      }
      void reconcilePreference();
    };

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('online', handleRefresh);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('online', handleRefresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyPreference, reconcilePreference, userId]);

  const setFilter = useCallback((value: TaskQuickFilter) => {
    const preference = {
      value: sanitizeTaskQuickFilter(value),
      updatedAt: new Date().toISOString(),
    } satisfies StoredTaskQuickFilter;
    applyPreference(preference);
    void persistPreference(preference).catch((error) => {
      console.error('Failed to persist the Tasks quick filter preference:', error);
    });
  }, [applyPreference, persistPreference]);

  return { filter, setFilter };
}
