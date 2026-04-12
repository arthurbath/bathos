import type { EstimatorVoteValue, EstimatorVotingMode } from '@/modules/estimator/types/estimator';

export const ESTIMATOR_ROOM_IDENTITY_STORAGE_PREFIX = 'estimator_room_identity:';
export const ESTIMATOR_SNAPSHOT_POLL_MS = 2_500;
export const ESTIMATOR_HEARTBEAT_MS = 5_000;
export const ESTIMATOR_ACTIVE_WINDOW_MS = 10_000;

export const ESTIMATOR_SHARED_VOTE_MASKS = [
  { rank: '1', fibonacci: '1', ballpark: 'XXS' },
  { rank: '2', fibonacci: '2', ballpark: 'XS' },
  { rank: '3', fibonacci: '3', ballpark: 'S' },
  { rank: '4', fibonacci: '5', ballpark: 'M' },
  { rank: '5', fibonacci: '8', ballpark: 'L' },
  { rank: '6', fibonacci: '13', ballpark: 'XL' },
  { rank: '7', fibonacci: '21+', ballpark: 'XXL+' },
] as const;

export const ESTIMATOR_BALLPARK_OPTIONS: EstimatorVoteValue[] = ESTIMATOR_SHARED_VOTE_MASKS.map(({ ballpark }) => ballpark);
export const ESTIMATOR_FIBONACCI_OPTIONS: EstimatorVoteValue[] = ESTIMATOR_SHARED_VOTE_MASKS.map(({ fibonacci }) => fibonacci);

export function getEstimatorVoteOptions(votingMode: EstimatorVotingMode): EstimatorVoteValue[] {
  return votingMode === 'ballpark' ? ESTIMATOR_BALLPARK_OPTIONS : ESTIMATOR_FIBONACCI_OPTIONS;
}
