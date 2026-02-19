const NETWORK_ERROR_FALLBACK = 'Network request failed. Check your connection or content blocker and try again.';
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return String((error as { message: string }).message);
  }
  return '';
}

export function isLikelyNetworkError(error: unknown): boolean {
  const msg = extractErrorMessage(error).toLowerCase();
  return (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed')
  );
}

export function toUserFacingErrorMessage(error: unknown, fallback = NETWORK_ERROR_FALLBACK): string {
  if (isLikelyNetworkError(error)) return fallback;
  const msg = extractErrorMessage(error);
  return msg || fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export async function retryOnLikelyNetworkError<T>(
  operation: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_RETRY_ATTEMPTS);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS);

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt += 1;

      if (!isLikelyNetworkError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const backoffMs = baseDelayMs * 2 ** (attempt - 1);
      await delay(backoffMs);
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(toUserFacingErrorMessage(lastError)));
}
