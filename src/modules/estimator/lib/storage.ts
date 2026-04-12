import { ESTIMATOR_ROOM_IDENTITY_STORAGE_PREFIX } from '@/modules/estimator/lib/constants';
import type { EstimatorStoredIdentity } from '@/modules/estimator/types/estimator';

function getEstimatorIdentityStorageKey(roomToken: string): string {
  return `${ESTIMATOR_ROOM_IDENTITY_STORAGE_PREFIX}${roomToken}`;
}

export function readEstimatorStoredIdentity(roomToken: string): EstimatorStoredIdentity | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getEstimatorIdentityStorageKey(roomToken));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<EstimatorStoredIdentity> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.memberId !== 'string' || typeof parsed.memberSecret !== 'string' || typeof parsed.nickname !== 'string') {
      return null;
    }

    const memberId = parsed.memberId.trim();
    const memberSecret = parsed.memberSecret.trim();
    const nickname = parsed.nickname.trim();

    if (!memberId || !memberSecret || !nickname) return null;

    return { memberId, memberSecret, nickname };
  } catch {
    return null;
  }
}

export function writeEstimatorStoredIdentity(roomToken: string, identity: EstimatorStoredIdentity): void {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    getEstimatorIdentityStorageKey(roomToken),
    JSON.stringify(identity),
  );
}

export function clearEstimatorStoredIdentity(roomToken: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getEstimatorIdentityStorageKey(roomToken));
}

