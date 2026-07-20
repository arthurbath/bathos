export type TasksSyncState = 'local' | 'connecting' | 'connected' | 'offline';
export type TaskSyncActivityState = 'idle' | 'active' | 'error';

export function getTasksStorageStatusLabel({
  mode,
  syncState,
  pendingUploadCount,
  uploadState = 'idle',
  downloadState = 'idle',
}: {
  mode: 'local' | 'connected';
  syncState: TasksSyncState;
  pendingUploadCount: number;
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
  if (uploadState === 'active') {
    return pendingUploadCount > 0 ? `Syncing ${pendingUploadCount}` : 'Uploading';
  }
  if (pendingUploadCount > 0 && syncState === 'connected') return `${pendingUploadCount} Pending`;
  if (pendingUploadCount > 0) return `Offline - ${pendingUploadCount} Pending`;
  if (downloadState === 'active') return 'Downloading';
  if (syncState === 'connecting') return 'Connecting';
  if (syncState === 'offline') return 'Offline';
  return 'Synced';
}
