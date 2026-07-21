import type {
  TaskSyncActivityState,
  TasksSyncState,
} from '@/modules/tasks/domain/taskSyncReliability';

export type { TaskSyncActivityState, TasksSyncState };

export function getTasksStorageStatusLabel({
  mode,
  syncState,
  pendingUploadCount,
  hasCompletedSync,
  uploadState = 'idle',
  downloadState = 'idle',
}: {
  mode: 'local' | 'connected';
  syncState: TasksSyncState;
  pendingUploadCount: number;
  hasCompletedSync: boolean;
  uploadState?: TaskSyncActivityState;
  downloadState?: TaskSyncActivityState;
}): string {
  if (mode === 'local' || syncState === 'local') return 'Local';
  if (uploadState === 'error') {
    return pendingUploadCount > 0
      ? `Upload Error - ${pendingUploadCount} Pending`
      : 'Upload Error';
  }
  if (downloadState === 'error') return 'Download Error';
  if (syncState === 'connecting') return 'Connecting';
  if (syncState === 'offline') {
    return pendingUploadCount > 0
      ? `Offline - ${pendingUploadCount} Pending`
      : 'Offline';
  }
  if (!hasCompletedSync) return 'Preparing Sync';
  if (uploadState === 'active') {
    return pendingUploadCount > 0 ? `Syncing ${pendingUploadCount}` : 'Uploading';
  }
  if (pendingUploadCount > 0) return `${pendingUploadCount} Pending`;
  if (downloadState === 'active') return 'Downloading';
  return 'Synced';
}
