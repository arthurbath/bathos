import { useQuery, useStatus } from '@powersync/react';
import { useMemo } from 'react';

import type { TaskSyncActivityState } from '@/modules/tasks/components/tasksStorageStatus';
import {
  parseTaskSyncHealthEvent,
  type TaskSyncHealthEvent,
  type TaskSyncHealthEventStorageRow,
} from '@/modules/tasks/data/taskSyncHealthEventStore';
import { deriveTaskSyncHealthState } from '@/modules/tasks/domain/taskSyncReliability';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';

type TaskConflictReceiptStorageRow = {
  id: string;
  task_id: string;
  operation: string;
  local_revision: number | null;
  remote_revision: number | null;
  detected_at: string;
  code: string;
};

export type TaskConflictReceipt = {
  id: string;
  taskId: string;
  operation: string;
  localRevision: number | null;
  remoteRevision: number | null;
  detectedAt: string;
  code: string;
};

const recentConflictReceiptsQuery = `
  SELECT id, task_id, operation, local_revision, remote_revision, detected_at, code
  FROM tasks_sync_issues
  WHERE kind = 'conflict'
  ORDER BY detected_at DESC, id DESC
  LIMIT 10
`;

const recentHealthEventsQuery = `
  SELECT id, state, started_at, resolved_at, pending_upload_bucket,
         had_completed_sync, last_successful_sync_at, reported_at
  FROM tasks_sync_health_events
  ORDER BY started_at DESC, id DESC
  LIMIT 10
`;

export function useTaskSyncDiagnostics() {
  const { mode, syncState, offlineLaunchState, pendingUploadCount } = useTasksRuntime();
  const status = useStatus();
  const conflictsQuery = useQuery<TaskConflictReceiptStorageRow>(recentConflictReceiptsQuery);
  const healthEventsQuery = useQuery<TaskSyncHealthEventStorageRow>(recentHealthEventsQuery);
  const parsedConflicts = useMemo(
    () => parseTaskConflictReceipts(conflictsQuery.data),
    [conflictsQuery.data],
  );
  const parsedHealthEvents = useMemo(
    () => parseTaskSyncHealthEvents(healthEventsQuery.data),
    [healthEventsQuery.data],
  );
  const connected = mode === 'connected';
  const dataFlow = status.dataFlowStatus;
  const hasCompletedSync = connected && status.hasSynced === true;
  const uploadState = connected
    ? deriveTaskSyncActivityState(dataFlow.uploading, dataFlow.uploadError)
    : 'idle';
  const downloadState = connected
    ? deriveTaskSyncActivityState(dataFlow.downloading, dataFlow.downloadError)
    : 'idle';

  return {
    mode,
    syncState,
    offlineLaunchState,
    pendingUploadCount,
    hasCompletedSync,
    lastSuccessfulSyncAt: connected && status.lastSyncedAt instanceof Date
      && !Number.isNaN(status.lastSyncedAt.getTime())
      ? status.lastSyncedAt.toISOString()
      : null,
    uploadState,
    downloadState,
    healthState: deriveTaskSyncHealthState({
      mode,
      syncState,
      pendingUploadCount,
      hasCompletedSync,
      uploadState,
      downloadState,
    }),
    healthEvents: parsedHealthEvents.events,
    healthEventsLoading: healthEventsQuery.isLoading,
    healthEventsError: healthEventsQuery.error ?? parsedHealthEvents.error,
    conflictReceipts: parsedConflicts.receipts,
    conflictReceiptsLoading: conflictsQuery.isLoading,
    conflictReceiptsError: conflictsQuery.error ?? parsedConflicts.error,
  };
}

function parseTaskSyncHealthEvents(rows: readonly TaskSyncHealthEventStorageRow[]): {
  events: TaskSyncHealthEvent[];
  error: Error | null;
} {
  try {
    return { events: rows.map(parseTaskSyncHealthEvent), error: null };
  } catch {
    return {
      events: [],
      error: new Error('Task synchronization health history could not be read'),
    };
  }
}

function deriveTaskSyncActivityState(
  active: boolean | undefined,
  error: Error | undefined,
): TaskSyncActivityState {
  if (error !== undefined) return 'error';
  return active ? 'active' : 'idle';
}

function parseTaskConflictReceipts(rows: readonly TaskConflictReceiptStorageRow[]): {
  receipts: TaskConflictReceipt[];
  error: Error | null;
} {
  try {
    return {
      receipts: rows.map((row) => ({
        id: requireText(row.id),
        taskId: requireText(row.task_id),
        operation: requireText(row.operation),
        localRevision: optionalInteger(row.local_revision),
        remoteRevision: optionalInteger(row.remote_revision),
        detectedAt: requireIsoTimestamp(row.detected_at),
        code: requireText(row.code),
      })),
      error: null,
    };
  } catch {
    return {
      receipts: [],
      error: new Error('Task conflict receipts could not be read'),
    };
  }
}

function requireText(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Expected nonempty text');
  }
  return value;
}

function optionalInteger(value: unknown): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value)) {
    throw new Error('Expected an integer or null');
  }
  return value as number;
}

function requireIsoTimestamp(value: unknown): string {
  const timestamp = requireText(value);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error('Expected an ISO timestamp');
  }
  return timestamp;
}
