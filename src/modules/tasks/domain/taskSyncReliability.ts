export type TasksSyncState = 'local' | 'connecting' | 'connected' | 'offline';
export type TaskSyncActivityState = 'idle' | 'active' | 'error';

export type TaskSyncHealthState =
  | 'local-only'
  | 'upload-error'
  | 'download-error'
  | 'offline'
  | 'connecting'
  | 'first-sync-pending'
  | 'synchronizing'
  | 'healthy';

export type TaskSyncDegradationState = Extract<
  TaskSyncHealthState,
  'upload-error' | 'download-error' | 'offline'
>;

export type TaskSyncQueueCountBucket = '0' | '1' | '2-9' | '10-49' | '50+';
export type TaskSyncDurationBucket = '2-4m' | '5-14m' | '15-59m' | '1-5h' | '6h+';

export interface TaskSyncHealthInput {
  mode: 'local' | 'connected';
  syncState: TasksSyncState;
  hasCompletedSync: boolean;
  pendingUploadCount: number;
  uploadState: TaskSyncActivityState;
  downloadState: TaskSyncActivityState;
}

export function deriveTaskSyncHealthState(input: TaskSyncHealthInput): TaskSyncHealthState {
  if (input.mode === 'local' || input.syncState === 'local') return 'local-only';
  if (input.uploadState === 'error') return 'upload-error';
  if (input.downloadState === 'error') return 'download-error';
  if (input.syncState === 'offline') return 'offline';
  if (input.syncState === 'connecting') return 'connecting';
  if (!input.hasCompletedSync) return 'first-sync-pending';
  if (
    input.uploadState === 'active'
    || input.downloadState === 'active'
    || normalizePendingUploadCount(input.pendingUploadCount) > 0
  ) {
    return 'synchronizing';
  }
  return 'healthy';
}

export function isTaskSyncDegradationState(
  state: TaskSyncHealthState,
): state is TaskSyncDegradationState {
  return state === 'upload-error' || state === 'download-error' || state === 'offline';
}

export function bucketTaskSyncQueueCount(count: number): TaskSyncQueueCountBucket {
  const normalized = normalizePendingUploadCount(count);
  if (normalized === 0) return '0';
  if (normalized === 1) return '1';
  if (normalized < 10) return '2-9';
  if (normalized < 50) return '10-49';
  return '50+';
}

export function bucketTaskSyncDuration(durationMs: number): TaskSyncDurationBucket {
  const minutes = Math.max(0, durationMs) / 60_000;
  if (minutes < 5) return '2-4m';
  if (minutes < 15) return '5-14m';
  if (minutes < 60) return '15-59m';
  if (minutes < 360) return '1-5h';
  return '6h+';
}

function normalizePendingUploadCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}
