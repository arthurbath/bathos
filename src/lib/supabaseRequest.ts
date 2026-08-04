import { PostgrestError } from '@supabase/supabase-js';
import { showSonnerErrorToast } from '@/components/ui/sonner';
import { toUserFacingErrorMessage } from '@/lib/networkErrors';

/**
 * Result shape returned by every Supabase PostgREST / RPC call.
 * We accept any object that has `data` and `error` fields.
 */
interface SupabaseResult<T> {
  data: T;
  error: PostgrestError | null;
}

/**
 * Normalize the resolved result contract used by Supabase queries and mutations.
 *
 * The Supabase client owns bounded retries for idempotent GET and HEAD requests.
 * This wrapper deliberately performs one operation so it never multiplies those
 * attempts or generically replays a mutation after an ambiguous response.
 */
export async function supabaseRequest<T>(
  operation: () => PromiseLike<SupabaseResult<T>>,
): Promise<T> {
  const result = await operation();
  if (result.error) throw result.error;
  return result.data;
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
  showSonnerErrorToast('Operation Failed', {
    description: toUserFacingErrorMessage(error),
  });
}
