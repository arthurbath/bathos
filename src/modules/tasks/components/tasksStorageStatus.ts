export type TasksSyncState = 'local' | 'connecting' | 'connected' | 'offline';

export function getTasksStorageStatusLabel({
  mode,
  syncState,
  pendingUploadCount,
}: {
  mode: 'local' | 'connected';
  syncState: TasksSyncState;
  pendingUploadCount: number;
}): string {
  if (mode === 'local' || syncState === 'local') return 'Local';
  if (pendingUploadCount > 0 && syncState === 'connected') return `Syncing ${pendingUploadCount}`;
  if (pendingUploadCount > 0) return `Offline - ${pendingUploadCount} Pending`;
  if (syncState === 'connecting') return 'Connecting';
  if (syncState === 'offline') return 'Offline';
  return 'Synced';
}
