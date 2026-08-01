import * as Sentry from '@sentry/react';

import { TaskHistoryReconstructionError } from '@/modules/tasks/domain/taskHistory';

export type TaskHistoryDiagnosticReport = {
  event: 'tasks-history-reconstruction-failure';
  timestamp: string;
  history: {
    eventId: string;
    synchronizedRowCount: number;
    reason: string;
  };
  sentryEventId: string | null;
};

export const TASK_HISTORY_RECONSTRUCTION_FAILURE_MESSAGE =
  'Tasks history could not be reconstructed';

export function reportTaskHistoryReconstructionFailure(
  error: TaskHistoryReconstructionError,
  synchronizedRowCount: number,
): TaskHistoryDiagnosticReport {
  const safeHistory = {
    eventId: error.eventId,
    synchronizedRowCount,
    reason: error.reason,
  };
  const sentryEventId = Sentry.getClient()
    ? Sentry.captureException(error, {
        level: 'error',
        tags: {
          module: 'tasks',
          operation: 'history-reconstruction',
        },
        contexts: {
          tasks_history: safeHistory,
        },
      })
    : null;
  const report: TaskHistoryDiagnosticReport = {
    event: 'tasks-history-reconstruction-failure',
    timestamp: new Date().toISOString(),
    history: safeHistory,
    sentryEventId,
  };

  console.error(
    `[Tasks] ${TASK_HISTORY_RECONSTRUCTION_FAILURE_MESSAGE}`,
    report,
    error,
  );

  return report;
}
