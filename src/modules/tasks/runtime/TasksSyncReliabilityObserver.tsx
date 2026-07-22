import { useStatus } from '@powersync/react';
import { useEffect, useMemo } from 'react';

import {
  TASK_SYNC_DEGRADATION_REPORT_DELAY_MS,
  TaskSyncHealthEventStore,
  type TaskSyncHealthEvent,
  type TaskSyncHealthEventStoreDatabase,
  type TaskSyncHealthReport,
} from '@/modules/tasks/data/taskSyncHealthEventStore';
import {
  deriveTaskSyncHealthState,
  isTaskSyncDegradationState,
  type TaskSyncActivityState,
} from '@/modules/tasks/domain/taskSyncReliability';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import {
  addTaskSyncRecoveryBreadcrumb,
  captureTaskSyncDegradation,
} from '@/modules/tasks/runtime/taskSyncReliabilityReporting';

type TaskSyncHealthEventStoreLike = Pick<
  TaskSyncHealthEventStore,
  'reconcile' | 'reportCurrentIfDue'
>;

export const TASK_SYNC_DEGRADATION_CONFIRM_DELAY_MS = 30_000;

type TasksSyncReliabilityObserverProps = {
  store?: TaskSyncHealthEventStoreLike;
  now?: () => Date;
  production?: boolean;
  capture?: (report: TaskSyncHealthReport) => string | null;
  addRecoveryBreadcrumb?: (event: TaskSyncHealthEvent, resolvedAt: string) => void;
};

export function TasksSyncReliabilityObserver({
  store: providedStore,
  now = defaultNow,
  production = import.meta.env.PROD,
  capture = captureTaskSyncDegradation,
  addRecoveryBreadcrumb = addTaskSyncRecoveryBreadcrumb,
}: TasksSyncReliabilityObserverProps = {}) {
  const { database, mode, syncState, pendingUploadCount } = useTasksRuntime();
  const status = useStatus();
  const store = useMemo(
    () => providedStore ?? new TaskSyncHealthEventStore(
      database as TaskSyncHealthEventStoreDatabase,
    ),
    [database, providedStore],
  );
  const uploadState = deriveActivityState(
    mode === 'connected',
    status.dataFlowStatus.uploading,
    status.dataFlowStatus.uploadError,
  );
  const downloadState = deriveActivityState(
    mode === 'connected',
    status.dataFlowStatus.downloading,
    status.dataFlowStatus.downloadError,
  );
  const hasCompletedSync = mode === 'connected' && status.hasSynced === true;
  const lastSuccessfulSyncAt = mode === 'connected'
    && status.lastSyncedAt instanceof Date
    && !Number.isNaN(status.lastSyncedAt.getTime())
    ? status.lastSyncedAt.toISOString()
    : null;
  const healthState = deriveTaskSyncHealthState({
    mode,
    syncState,
    pendingUploadCount,
    hasCompletedSync,
    uploadState,
    downloadState,
  });
  const statusLoaded = mode === 'local'
    || status.hasSynced !== undefined
    || syncState === 'offline';

  useEffect(() => {
    if (!statusLoaded) return undefined;

    let active = true;
    let confirmationTimer: ReturnType<typeof setTimeout> | undefined;
    let reportTimer: ReturnType<typeof setTimeout> | undefined;

    const observedAt = now().toISOString();
    const reconcile = async () => {
      const result = await store.reconcile({
        state: healthState,
        pendingUploadCount,
        hasCompletedSync,
        lastSuccessfulSyncAt,
        observedAt,
      });
      if (!active) return;

      const reconciledAt = now().toISOString();
      if (result.resolvedEvent !== null) {
        addRecoveryBreadcrumb(result.resolvedEvent, reconciledAt);
      }
      if (
        !production
        || result.openEvent === null
        || !isTaskSyncDegradationState(healthState)
      ) {
        return;
      }

      const elapsedMs = Date.parse(reconciledAt) - Date.parse(result.openEvent.startedAt);
      const remainingMs = Math.max(0, TASK_SYNC_DEGRADATION_REPORT_DELAY_MS - elapsedMs);
      reportTimer = setTimeout(() => {
        if (!active) return;
        void store.reportCurrentIfDue({
          state: healthState,
          observedAt: now().toISOString(),
          capture,
        }).catch(() => undefined);
      }, remainingMs);
    };

    if (isTaskSyncDegradationState(healthState)) {
      confirmationTimer = setTimeout(() => {
        if (!active) return;
        void reconcile().catch(() => undefined);
      }, TASK_SYNC_DEGRADATION_CONFIRM_DELAY_MS);
    } else {
      void reconcile().catch(() => undefined);
    }

    return () => {
      active = false;
      if (confirmationTimer !== undefined) clearTimeout(confirmationTimer);
      if (reportTimer !== undefined) clearTimeout(reportTimer);
    };
  }, [
    addRecoveryBreadcrumb,
    capture,
    hasCompletedSync,
    healthState,
    lastSuccessfulSyncAt,
    now,
    pendingUploadCount,
    production,
    statusLoaded,
    store,
  ]);

  return null;
}

function deriveActivityState(
  connected: boolean,
  active: boolean | undefined,
  error: Error | undefined,
): TaskSyncActivityState {
  if (!connected) return 'idle';
  if (error !== undefined) return 'error';
  return active ? 'active' : 'idle';
}

function defaultNow() {
  return new Date();
}
