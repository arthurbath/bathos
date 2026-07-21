import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const roleCacheByUserId = new Map<string, boolean>();
const ROLE_RETRY_INITIAL_DELAY_MS = 500;
const ROLE_RETRY_MAX_DELAY_MS = 30_000;
const FALSE_CONFIRMATION_ATTEMPTS = 4;
const ADMIN_ROLE_PERSIST_KEY = 'bathos_admin_role_v1';
const ADMIN_ROLE_PERSIST_TTL_MS = 12 * 60 * 60 * 1000;

function readPersistedAdminUserIds(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(ADMIN_ROLE_PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function writePersistedAdminUserIds(cache: Record<string, number>) {
  try {
    window.localStorage.setItem(ADMIN_ROLE_PERSIST_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors.
  }
}

function getPersistedAdminRole(userId: string): boolean | undefined {
  const cache = readPersistedAdminUserIds();
  const updatedAt = cache[userId];
  if (typeof updatedAt !== 'number') return undefined;

  if (Date.now() - updatedAt > ADMIN_ROLE_PERSIST_TTL_MS) {
    delete cache[userId];
    writePersistedAdminUserIds(cache);
    return undefined;
  }

  return true;
}

function persistAdminRole(userId: string) {
  const cache = readPersistedAdminUserIds();
  cache[userId] = Date.now();
  writePersistedAdminUserIds(cache);
}

function clearPersistedAdminRole(userId: string) {
  const cache = readPersistedAdminUserIds();
  if (!(userId in cache)) return;
  delete cache[userId];
  writePersistedAdminUserIds(cache);
}

export function useIsAdmin(userId: string | undefined) {
  const initialCachedRole = userId
    ? (roleCacheByUserId.get(userId) ?? getPersistedAdminRole(userId))
    : undefined;
  const [isAdmin, setIsAdmin] = useState(initialCachedRole ?? false);
  const [loading, setLoading] = useState(userId ? initialCachedRole === undefined : false);
  const [resolved, setResolved] = useState(userId ? initialCachedRole !== undefined : true);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      setResolved(true);
      return;
    }

    const cachedRole = roleCacheByUserId.get(userId) ?? getPersistedAdminRole(userId);
    if (cachedRole !== undefined) {
      roleCacheByUserId.set(userId, cachedRole);
      setIsAdmin(cachedRole);
      setLoading(false);
      setResolved(true);
    } else {
      setIsAdmin(false);
      setLoading(true);
      setResolved(false);
    }

    let cancelled = false;
    let retryTimer: number | null = null;
    let retryAttempt = 0;
    let consecutiveFalseCount = 0;
    let seenAdmin = cachedRole === true;

    const scheduleRetry = () => {
      if (cancelled || window.navigator.onLine === false) return;
      const delay = Math.min(
        ROLE_RETRY_INITIAL_DELAY_MS * (2 ** retryAttempt),
        ROLE_RETRY_MAX_DELAY_MS,
      );
      retryAttempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void check();
      }, delay);
    };

    const check = async () => {
      if (cancelled || window.navigator.onLine === false) return;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (cancelled) return;

      const authUserId = authData.user?.id ?? null;
      if (authError || authUserId !== userId) {
        // Role reads can race auth restoration on hard refresh. Wait for identity to settle first.
        scheduleRetry();
        return;
      }

      const { data, error } = await supabase
        .from('bathos_user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // During HMR and token refresh windows, this query can transiently fail.
        // Keep unresolved state and retry rather than incorrectly treating user as non-admin.
        if (cachedRole === undefined || seenAdmin) scheduleRetry();
        return;
      }

      const nextIsAdmin = !!data;
      if (nextIsAdmin) {
        retryAttempt = 0;
        consecutiveFalseCount = 0;
        seenAdmin = true;
        roleCacheByUserId.set(userId, true);
        persistAdminRole(userId);
        setIsAdmin(true);
        setLoading(false);
        setResolved(true);
        return;
      }

      consecutiveFalseCount += 1;
      if (consecutiveFalseCount < FALSE_CONFIRMATION_ATTEMPTS) {
        // A single false result can occur during auth/token churn. Confirm before downgrading.
        if (cachedRole === undefined && !seenAdmin) {
          setLoading(true);
          setResolved(false);
        }
        scheduleRetry();
        return;
      }

      roleCacheByUserId.set(userId, false);
      retryAttempt = 0;
      clearPersistedAdminRole(userId);
      setIsAdmin(false);
      setLoading(false);
      setResolved(true);
    };

    const handleOffline = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const handleOnline = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      retryAttempt = 0;
      void check();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    void check();

    return () => {
      cancelled = true;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [userId]);

  return { isAdmin, loading, resolved };
}
