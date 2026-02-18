const NETWORK_ERROR_FALLBACK = 'Network request failed. Check your connection or content blocker and try again.';

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

