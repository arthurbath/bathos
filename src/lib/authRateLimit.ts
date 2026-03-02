import { supabase } from '@/integrations/supabase/client';

export type AuthActionType = 'sign_in' | 'sign_up' | 'forgot_password';

interface RateLimitResult {
  rateLimited: boolean;
  retryAfterSeconds: number;
}

/**
 * Checks server-side IP-based rate limit for an auth action.
 * Returns { rateLimited, retryAfterSeconds }.
 * Fails open on network errors (returns not-limited).
 */
export async function checkAuthRateLimit(actionType: AuthActionType): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.functions.invoke('check-auth-rate-limit', {
      body: { actionType },
    });

    if (error) {
      console.warn('Rate limit check failed:', error);
      return { rateLimited: false, retryAfterSeconds: 0 };
    }

    return {
      rateLimited: !!data?.rateLimited,
      retryAfterSeconds: data?.retryAfterSeconds ?? 0,
    };
  } catch {
    return { rateLimited: false, retryAfterSeconds: 0 };
  }
}

/**
 * Formats a retry-after duration into a human-readable string.
 */
export function formatRetryAfter(seconds: number): string {
  if (seconds <= 0) return 'a moment';
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
