import type { TasksSyncState } from '@/modules/tasks/domain/taskSyncReliability';

export type TasksPowerSyncStatus = {
  connected: boolean;
  connecting: boolean;
  hasSynced?: boolean;
  lastSyncedAt?: Date;
  dataFlowStatus?: {
    downloadError?: Error;
  };
};

type TasksPowerSyncStatusSource = {
  currentStatus: TasksPowerSyncStatus;
  registerListener(listener: {
    statusChanged: (status: TasksPowerSyncStatus) => void;
  }): () => void;
};

export function resolveTasksSyncState(
  status: TasksPowerSyncStatus,
  browserOnline = true,
): TasksSyncState {
  if (!browserOnline) return 'offline';
  if (status.connected) return 'connected';
  if (status.connecting) return 'connecting';
  return 'offline';
}

export function shouldReleaseTasksStartupRefresh({
  browserOnline,
  baselineCaptured,
  baselineLastSyncedAt,
  status,
}: {
  browserOnline: boolean;
  baselineCaptured: boolean;
  baselineLastSyncedAt: number | null;
  status: TasksPowerSyncStatus;
}): boolean {
  if (!browserOnline || status.dataFlowStatus?.downloadError !== undefined) {
    return true;
  }
  if (!baselineCaptured) return false;
  const lastSyncedAt = status.lastSyncedAt instanceof Date
    && !Number.isNaN(status.lastSyncedAt.getTime())
    ? status.lastSyncedAt.getTime()
    : null;
  return lastSyncedAt !== null && lastSyncedAt !== baselineLastSyncedAt;
}

export function observeTasksSyncState(
  source: TasksPowerSyncStatusSource,
  onStateChanged: (state: TasksSyncState) => void,
  isBrowserOnline: () => boolean = () => true,
  onStatusObserved?: (status: TasksPowerSyncStatus) => void,
): () => void {
  const emit = (status: TasksPowerSyncStatus) => {
    onStateChanged(resolveTasksSyncState(status, isBrowserOnline()));
    onStatusObserved?.(status);
  };
  const dispose = source.registerListener({ statusChanged: emit });

  // A shared PowerSync worker may have published its latest status before this
  // tab registered. Reconcile after subscribing so a concurrent update cannot
  // be missed between reading currentStatus and installing the listener.
  emit(source.currentStatus);
  return dispose;
}
