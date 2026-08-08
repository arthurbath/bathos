import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PlatformModuleId } from '@/platform/modules';

export interface ModuleAccessState {
  isRestricted: boolean;
  hasAccess: boolean;
  hasExplicitAccess: boolean;
}

export type ModuleAccessMap = Partial<Record<PlatformModuleId, ModuleAccessState>>;

const accessCache = new Map<string, ModuleAccessMap>();
const ACCESS_CACHE_KEY = 'bathos_module_access_v1';

function readPersistedAccess(userId: string): ModuleAccessMap | undefined {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCESS_CACHE_KEY) ?? '{}') as Record<string, ModuleAccessMap>;
    return parsed[userId];
  } catch {
    return undefined;
  }
}

function persistAccess(userId: string, access: ModuleAccessMap) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCESS_CACHE_KEY) ?? '{}') as Record<string, ModuleAccessMap>;
    parsed[userId] = access;
    window.localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Offline access remains best-effort when storage is unavailable.
  }
}

export function useModuleAccess(userId: string | undefined) {
  const cached = userId ? (accessCache.get(userId) ?? readPersistedAccess(userId)) : undefined;
  const [access, setAccess] = useState<ModuleAccessMap>(cached ?? {});
  const [loading, setLoading] = useState(Boolean(userId && !cached));
  const [resolved, setResolved] = useState(Boolean(!userId || cached));

  useEffect(() => {
    if (!userId) {
      setAccess({});
      setLoading(false);
      setResolved(true);
      return;
    }

    const initial = accessCache.get(userId) ?? readPersistedAccess(userId);
    if (initial) {
      setAccess(initial);
      setLoading(false);
      setResolved(true);
    } else {
      setLoading(true);
      setResolved(false);
    }

    let cancelled = false;

    const refresh = async () => {
      if (window.navigator.onLine === false) {
        if (!initial) {
          setLoading(false);
          setResolved(true);
        }
        return;
      }
      const { data, error } = await supabase.rpc('bathos_read_current_module_access');
      if (cancelled) return;
      if (error) {
        if (!initial) {
          setLoading(false);
          setResolved(true);
        }
        return;
      }

      const next = (data ?? []).reduce<ModuleAccessMap>((result, row) => {
        result[row.module_id as PlatformModuleId] = {
          isRestricted: row.is_restricted,
          hasAccess: row.has_access,
          hasExplicitAccess: row.has_explicit_access,
        };
        return result;
      }, {});
      accessCache.set(userId, next);
      persistAccess(userId, next);
      setAccess(next);
      setLoading(false);
      setResolved(true);
    };

    const handleOnline = () => void refresh();
    window.addEventListener('online', handleOnline);
    void refresh();

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, [userId]);

  return useMemo(() => ({ access, loading, resolved }), [access, loading, resolved]);
}

export function clearModuleAccessCache(userId?: string) {
  if (userId) accessCache.delete(userId);
  else accessCache.clear();
}
