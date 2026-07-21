import type { TasksSyncState } from '@/modules/tasks/components/tasksStorageStatus';

export type TasksPowerSyncStatus = {
  connected: boolean;
  connecting: boolean;
};

type TasksPowerSyncStatusSource = {
  currentStatus: TasksPowerSyncStatus;
  registerListener(listener: {
    statusChanged: (status: TasksPowerSyncStatus) => void;
  }): () => void;
};

export function resolveTasksSyncState(status: TasksPowerSyncStatus): TasksSyncState {
  if (status.connected) return 'connected';
  if (status.connecting) return 'connecting';
  return 'offline';
}

export function observeTasksSyncState(
  source: TasksPowerSyncStatusSource,
  onStateChanged: (state: TasksSyncState) => void,
): () => void {
  const emit = (status: TasksPowerSyncStatus) => {
    onStateChanged(resolveTasksSyncState(status));
  };
  const dispose = source.registerListener({ statusChanged: emit });

  // A shared PowerSync worker may have published its latest status before this
  // tab registered. Reconcile after subscribing so a concurrent update cannot
  // be missed between reading currentStatus and installing the listener.
  emit(source.currentStatus);
  return dispose;
}
