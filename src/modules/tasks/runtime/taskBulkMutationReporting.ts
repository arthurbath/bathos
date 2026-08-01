import * as Sentry from '@sentry/react';

export type TaskBulkDeleteDiagnosticContext = {
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  view: string;
  browserOnline: boolean;
};

export type TaskBulkDeleteDiagnosticReport = {
  event: 'tasks-bulk-delete-failure';
  timestamp: string;
  operation: TaskBulkDeleteDiagnosticContext;
  sentryEventId: string | null;
};

export const TASK_BULK_DELETE_FAILURE_MESSAGE = 'Selected task deletion failed';

export function reportTaskBulkDeleteFailure(
  context: TaskBulkDeleteDiagnosticContext,
  technicalErrors: readonly unknown[],
): TaskBulkDeleteDiagnosticReport {
  const safeContext: TaskBulkDeleteDiagnosticContext = {
    requestedCount: context.requestedCount,
    succeededCount: context.succeededCount,
    failedCount: context.failedCount,
    view: context.view,
    browserOnline: context.browserOnline,
  };
  const diagnosticError = new Error(
    `${safeContext.failedCount} of ${safeContext.requestedCount} selected task deletions failed`,
  );
  const sentryEventId = Sentry.getClient()
    ? Sentry.captureException(diagnosticError, {
        level: 'error',
        tags: {
          module: 'tasks',
          operation: 'bulk-delete',
          active_view: safeContext.view,
          browser_online: safeContext.browserOnline ? 'yes' : 'no',
        },
        contexts: {
          tasks_bulk_delete: {
            requestedCount: safeContext.requestedCount,
            succeededCount: safeContext.succeededCount,
            failedCount: safeContext.failedCount,
            view: safeContext.view,
            browserOnline: safeContext.browserOnline,
          },
        },
      })
    : null;

  const report: TaskBulkDeleteDiagnosticReport = {
    event: 'tasks-bulk-delete-failure',
    timestamp: new Date().toISOString(),
    operation: safeContext,
    sentryEventId,
  };

  console.error(
    `[Tasks] ${TASK_BULK_DELETE_FAILURE_MESSAGE}`,
    report,
    technicalErrors,
  );

  return report;
}
