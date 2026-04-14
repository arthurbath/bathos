import { PostgrestError } from '@supabase/supabase-js';
import { isLikelyNetworkError, toUserFacingErrorMessage } from '@/lib/networkErrors';
import { toast } from 'sonner';

/**
 * Checks whether a Supabase PostgREST error payload looks like a transient
 * network / transport failure that is safe to retry automatically.
 *
 * PostgREST often resolves the promise with `{ data: null, error }` instead of
 * throwing when the underlying fetch fails.  The previous `retryOnLikelyNetworkError`
 * helper only caught thrown exceptions, so these resolved-error cases were never
 * retried — which is the root cause of the "single-attempt failure" bug.
 */
function isRetriablePostgrestError(error: PostgrestError | null): boolean {
  if (!error) return false;

  const msg = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toLowerCase();

  // Network-level failures surfaced as PostgREST errors
  if (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('fetch error') ||
    msg.includes('aborted') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound')
  ) {
    return true;
  }

  // HTTP 5xx from PostgREST gateway
  if (code === '500' || code === '502' || code === '503' || code === '504') {
    return true;
  }

  // Supabase occasionally returns PGRST-prefixed codes for transport issues
  if (code.startsWith('pgrst') && msg.includes('could not')) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Jittered exponential backoff
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 5_000;

function jitteredDelay(attempt: number, baseMs: number): number {
  const exponential = baseMs * 2 ** attempt;
  const capped = Math.min(exponential, MAX_DELAY_MS);
  // Add ±25 % jitter
  const jitter = capped * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ---------------------------------------------------------------------------
// Core helper: supabaseRequest
// ---------------------------------------------------------------------------

/**
 * Result shape returned by every Supabase PostgREST / RPC call.
 * We accept any object that has `data` and `error` fields.
 */
interface SupabaseResult<T> {
  data: T;
  error: PostgrestError | null;
}

interface RequestOptions {
  /** Maximum total attempts (default 4). */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff (default 300). */
  baseDelayMs?: number;
}

/**
 * Execute a Supabase operation with automatic retry for transient failures.
 *
 * Unlike `retryOnLikelyNetworkError`, this helper inspects both:
 * - thrown exceptions (fetch-level network errors), and
 * - resolved `{ error }` payloads (PostgREST-level network errors).
 *
 * Returns `data` directly on success.  Throws the error on permanent failure.
 */
export async function supabaseRequest<T>(
  operation: () => PromiseLike<SupabaseResult<T>>,
  options?: RequestOptions,
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);

  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      const result = await operation();

      // Happy path — no error
      if (!result.error) {
        return result.data;
      }

      // Resolved error — check if retriable
      if (isRetriablePostgrestError(result.error) && attempt < maxAttempts) {
        const delayMs = jitteredDelay(attempt - 1, baseDelayMs);
        if (import.meta.env.DEV) {
          console.debug(
            `[supabaseRequest] retriable resolved error (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`,
            result.error.message,
          );
        }
        await sleep(delayMs);
        continue;
      }

      // Non-retriable or exhausted attempts — throw
      throw result.error;
    } catch (thrown: unknown) {
      // If it's a PostgrestError we already threw above, check if we should retry
      if (thrown && typeof thrown === 'object' && 'code' in thrown && 'message' in thrown) {
        // Already handled above — re-throw
        if (attempt >= maxAttempts || !isRetriablePostgrestError(thrown as PostgrestError)) {
          throw thrown;
        }
      } else if (isLikelyNetworkError(thrown) && attempt < maxAttempts) {
        // Fetch-level thrown error (e.g., TypeError: Load failed)
        const delayMs = jitteredDelay(attempt - 1, baseDelayMs);
        if (import.meta.env.DEV) {
          console.debug(
            `[supabaseRequest] retriable thrown error (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`,
            thrown instanceof Error ? thrown.message : thrown,
          );
        }
        await sleep(delayMs);
        continue;
      } else {
        throw thrown;
      }

      // Retry after backoff for retriable PostgREST errors that were thrown
      const delayMs = jitteredDelay(attempt - 1, baseDelayMs);
      await sleep(delayMs);
    }
  }
}

/**
 * Convenience: execute a Supabase RPC call with retry.  RPC calls return
 * `{ data, error }` just like table operations.
 */
export { supabaseRequest as supabaseRpc };

/**
 * Show a user-facing toast for a mutation error.
 * Re-exported from networkErrors for convenience so callers don't need two imports.
 */
export function showMutationError(error: unknown): void {
  toast.error(toUserFacingErrorMessage(error));
}
