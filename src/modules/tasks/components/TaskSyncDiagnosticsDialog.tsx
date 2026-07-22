import { Cloud, HardDrive } from 'lucide-react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getTasksStorageStatusLabel,
  type TaskSyncActivityState,
  type TasksSyncState,
} from '@/modules/tasks/components/tasksStorageStatus';
import type { TaskSyncHealthEvent } from '@/modules/tasks/data/taskSyncHealthEventStore';
import {
  isTaskSyncDegradationState,
  type TaskSyncHealthState,
} from '@/modules/tasks/domain/taskSyncReliability';
import {
  useTaskSyncDiagnostics,
  type TaskConflictReceipt,
} from '@/modules/tasks/hooks/useTaskSyncDiagnostics';

export function TaskSyncDiagnosticsDialog({
  triggerVariant = 'status',
}: {
  triggerVariant?: 'status' | 'config';
}) {
  const diagnostics = useTaskSyncDiagnostics();
  const label = getTasksStorageStatusLabel(diagnostics);
  const Icon = diagnostics.mode === 'connected' ? Cloud : HardDrive;
  const hasError = diagnostics.uploadState === 'error'
    || diagnostics.downloadState === 'error'
    || isTaskSyncDegradationState(diagnostics.healthState)
    || diagnostics.healthEventsError !== null
    || diagnostics.conflictReceiptsError !== null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {triggerVariant === 'config' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('gap-2', hasError && 'border-destructive/40 text-destructive')}
            aria-label={`Task Sync Status: ${label}. Open Synchronization Details`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span aria-live="polite">{label}</span>
          </Button>
        ) : (
          <button
            type="button"
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-xs font-medium transition-colors hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              hasError ? 'text-destructive' : 'text-info',
            )}
            aria-label={`Task Sync Status: ${label}. Open Synchronization Details`}
            title={`Task Sync Status: ${label}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-sm:sr-only" aria-live="polite">{label}</span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Synchronization Details</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {diagnostics.mode === 'local' ? (
            <p className="pt-2 text-sm text-muted-foreground">
              This installation stores task data locally. Cross-device and MCP changes do not converge.
            </p>
          ) : null}

          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 pt-2 text-sm">
            <DiagnosticRow label="Connection" value={formatConnection(diagnostics.syncState)} />
            <DiagnosticRow
              label="Offline Launch"
              value={formatOfflineLaunch(diagnostics.offlineLaunchState)}
            />
            <DiagnosticRow label="Health" value={formatHealth(diagnostics.healthState)} />
            <DiagnosticRow
              label="Full Synchronization"
              value={diagnostics.hasCompletedSync ? 'Complete' : 'Preparing'}
            />
            <DiagnosticRow
              label="Pending Changes"
              value={String(diagnostics.pendingUploadCount)}
            />
            <DiagnosticRow
              label="Last Successful Sync"
              value={formatLastSuccessfulSync(diagnostics.lastSuccessfulSyncAt)}
            />
            <DiagnosticRow label="Upload" value={formatActivity(diagnostics.uploadState)} />
            <DiagnosticRow label="Download" value={formatActivity(diagnostics.downloadState)} />
          </dl>

          <section className="space-y-2" aria-labelledby="task-sync-reliability-heading">
            <h3 id="task-sync-reliability-heading" className="text-sm font-medium">
              Recent Reliability Events
            </h3>
            <HealthEvents
              events={diagnostics.healthEvents}
              loading={diagnostics.healthEventsLoading}
              error={diagnostics.healthEventsError}
            />
          </section>

          <section className="space-y-2" aria-labelledby="task-sync-conflicts-heading">
            <h3 id="task-sync-conflicts-heading" className="text-sm font-medium">
              Recent Conflict Receipts
            </h3>
            <ConflictReceipts
              receipts={diagnostics.conflictReceipts}
              loading={diagnostics.conflictReceiptsLoading}
              error={diagnostics.conflictReceiptsError}
            />
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function HealthEvents({
  events,
  loading,
  error,
}: {
  events: readonly TaskSyncHealthEvent[];
  loading: boolean;
  error: Error | null;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading reliability history...</p>;
  }
  if (error !== null) {
    return <p className="text-sm text-destructive">Reliability history could not be read.</p>;
  }
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No degradation recorded.</p>;
  }
  return (
    <ol className="divide-y divide-border rounded-md border border-border">
      {events.map((event) => (
        <li key={event.id} className="space-y-1 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-foreground">{formatHealth(event.state)}</span>
            <time className="text-muted-foreground" dateTime={event.startedAt}>
              {formatTaskSyncTimestamp(event.startedAt)}
            </time>
          </div>
          <p className="text-muted-foreground">
            {event.resolvedAt === null
              ? 'Active'
              : `Recovered ${formatTaskSyncTimestamp(event.resolvedAt)}`}
            {' - '}Pending Queue {event.pendingUploadBucket}
            {event.reportedAt === null ? '' : ' - Reported'}
          </p>
        </li>
      ))}
    </ol>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </>
  );
}

function ConflictReceipts({
  receipts,
  loading,
  error,
}: {
  receipts: readonly TaskConflictReceipt[];
  loading: boolean;
  error: Error | null;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading receipts...</p>;
  }
  if (error !== null) {
    return <p className="text-sm text-destructive">Conflict receipts could not be read.</p>;
  }
  if (receipts.length === 0) {
    return <p className="text-sm text-muted-foreground">No conflict receipts.</p>;
  }
  return (
    <ol className="divide-y divide-border rounded-md border border-border">
      {receipts.map((receipt) => (
        <li key={receipt.id} className="space-y-1 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-foreground">{receipt.code}</span>
            <time className="text-muted-foreground" dateTime={receipt.detectedAt}>
              {formatTaskSyncTimestamp(receipt.detectedAt)}
            </time>
          </div>
          <p className="text-muted-foreground">
            {receipt.operation} - Revision {formatRevision(receipt.localRevision)} to{' '}
            {formatRevision(receipt.remoteRevision)}
          </p>
          <p className="break-all font-mono text-[11px] text-muted-foreground">
            {receipt.taskId}
          </p>
        </li>
      ))}
    </ol>
  );
}

function formatConnection(syncState: TasksSyncState): string {
  if (syncState === 'local') return 'Local Only';
  if (syncState === 'connected') return 'Connected';
  if (syncState === 'connecting') return 'Connecting';
  return 'Offline';
}

function formatOfflineLaunch(
  state: 'preparing' | 'ready' | 'unsupported' | 'failed',
): string {
  if (state === 'ready') return 'Ready';
  if (state === 'unsupported') return 'Unavailable';
  if (state === 'failed') return 'Failed';
  return 'Preparing';
}

function formatActivity(state: TaskSyncActivityState): string {
  if (state === 'active') return 'Active';
  if (state === 'error') return 'Error';
  return 'Idle';
}

function formatHealth(state: TaskSyncHealthState): string {
  if (state === 'local-only') return 'Local Only';
  if (state === 'upload-error') return 'Upload Error';
  if (state === 'download-error') return 'Download Error';
  if (state === 'offline') return 'Offline';
  if (state === 'connecting') return 'Connecting';
  if (state === 'first-sync-pending') return 'Preparing Sync';
  if (state === 'synchronizing') return 'Synchronizing';
  return 'Healthy';
}

function formatLastSuccessfulSync(value: string | null): string {
  return value === null ? 'Not Yet' : formatTaskSyncTimestamp(value);
}

function formatTaskSyncTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatRevision(value: number | null): string {
  return value === null ? 'unknown' : String(value);
}
