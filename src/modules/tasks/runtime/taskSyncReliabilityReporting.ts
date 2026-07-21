import * as Sentry from '@sentry/react';

import type {
  TaskSyncHealthEvent,
  TaskSyncHealthReport,
} from '@/modules/tasks/data/taskSyncHealthEventStore';
import { bucketTaskSyncDuration } from '@/modules/tasks/domain/taskSyncReliability';

export const TASK_SYNC_DEGRADATION_MESSAGE = 'Tasks synchronization remains degraded';
export const TASK_SYNC_RECOVERY_MESSAGE = 'Tasks synchronization recovered';

export function captureTaskSyncDegradation(report: TaskSyncHealthReport): string | null {
  if (!Sentry.getClient()) return null;
  return Sentry.captureMessage(TASK_SYNC_DEGRADATION_MESSAGE, {
    level: 'warning',
    tags: {
      module: 'tasks',
      sync_health_state: report.event.state,
      queue_count_bucket: report.event.pendingUploadBucket,
      had_completed_sync: report.event.hadCompletedSync ? 'yes' : 'no',
      duration_bucket: report.durationBucket,
    },
  });
}

export function addTaskSyncRecoveryBreadcrumb(
  event: TaskSyncHealthEvent,
  resolvedAt: string,
): void {
  if (!Sentry.getClient()) return;
  Sentry.addBreadcrumb({
    category: 'tasks.sync',
    level: 'info',
    message: TASK_SYNC_RECOVERY_MESSAGE,
    data: {
      syncHealthState: event.state,
      durationBucket: bucketTaskSyncDuration(
        Date.parse(resolvedAt) - Date.parse(event.startedAt),
      ),
      reported: event.reportedAt === null ? 'no' : 'yes',
    },
  });
}
