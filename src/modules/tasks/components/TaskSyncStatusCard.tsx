import { useStatus } from '@powersync/react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  deriveTaskSyncHealthState,
  type TaskSyncActivityState,
  type TaskSyncHealthState,
} from '@/modules/tasks/domain/taskSyncReliability';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';

import {
  formatTaskSyncHealth,
  formatTaskSyncStatusTimestamp,
} from './taskSyncStatusPresentation';

export function TaskSyncStatusCard() {
  const { mode, syncState, pendingUploadCount } = useTasksRuntime();
  const status = useStatus();
  const connected = mode === 'connected';
  const dataFlow = status.dataFlowStatus;
  const hasCompletedSync = connected && status.hasSynced === true;
  const uploadState = connected
    ? deriveActivityState(dataFlow.uploading, dataFlow.uploadError)
    : 'idle';
  const downloadState = connected
    ? deriveActivityState(dataFlow.downloading, dataFlow.downloadError)
    : 'idle';
  const health = deriveTaskSyncHealthState({
    mode,
    syncState,
    pendingUploadCount,
    hasCompletedSync,
    uploadState,
    downloadState,
  });
  const lastSuccessfulSync = connected
    && status.lastSyncedAt instanceof Date
    && !Number.isNaN(status.lastSyncedAt.getTime())
    ? status.lastSyncedAt
    : null;

  return (
    <Card aria-labelledby="task-config-sync-status" data-task-sync-status>
      <CardHeader>
        <CardTitle id="task-config-sync-status">Sync Status</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 text-sm">
          <SyncStatusRow
            label="Health"
            value={formatTaskSyncHealth(health)}
            valueClassName={getTaskSyncHealthClassName(health)}
          />
          <SyncStatusRow label="Pending Changes" value={String(pendingUploadCount)} />
          <SyncStatusRow
            label="Last Successful Sync"
            value={formatTaskSyncStatusTimestamp(lastSuccessfulSync)}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function SyncStatusRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right font-medium text-foreground', valueClassName)}>{value}</dd>
    </>
  );
}

function deriveActivityState(
  active: boolean | undefined,
  error: Error | undefined,
): TaskSyncActivityState {
  if (error !== undefined) return 'error';
  return active ? 'active' : 'idle';
}

function getTaskSyncHealthClassName(state: TaskSyncHealthState): string | undefined {
  if (state === 'healthy') return 'text-success';
  if (state === 'upload-error' || state === 'download-error') return 'text-destructive';
  if (state === 'connecting' || state === 'first-sync-pending' || state === 'synchronizing') {
    return 'text-warning';
  }
  return undefined;
}
