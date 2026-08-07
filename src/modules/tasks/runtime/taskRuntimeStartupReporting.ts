import * as Sentry from '@sentry/react';

export type TasksRuntimeStartupPhase =
  | 'schema-compatibility'
  | 'owner-binding'
  | 'planning-settings'
  | 'planning-date-activation'
  | 'watchdog';

export type TasksRuntimeStartupDiagnosticContext = {
  phase: TasksRuntimeStartupPhase;
  generation: number;
  outcome: 'automatic-recovery-started' | 'terminal';
  automaticRecoveryAttempted: boolean;
  closedClientError: boolean;
  endpointConfigured: boolean;
  browserOnline: boolean;
};

export type TasksRuntimeStartupDiagnosticReport = {
  event: 'tasks-runtime-startup-failure';
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack: string | null;
  };
  runtime: TasksRuntimeStartupDiagnosticContext;
  environment: {
    hostname: string;
    pathname: string;
    userAgent: string;
  };
  sentryEventId: string | null;
};

export const TASKS_RUNTIME_STARTUP_FAILURE_MESSAGE = 'Tasks runtime startup failed';

function serializeError(error: Error): TasksRuntimeStartupDiagnosticReport['error'] {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack ?? null,
  };
}

export function reportTasksRuntimeStartupFailure(
  error: Error,
  context: TasksRuntimeStartupDiagnosticContext,
): TasksRuntimeStartupDiagnosticReport {
  const safeRuntimeContext: TasksRuntimeStartupDiagnosticContext = {
    phase: context.phase,
    generation: context.generation,
    outcome: context.outcome,
    automaticRecoveryAttempted: context.automaticRecoveryAttempted,
    closedClientError: context.closedClientError,
    endpointConfigured: context.endpointConfigured,
    browserOnline: context.browserOnline,
  };
  const sentryEventId = Sentry.getClient()
    ? Sentry.captureException(error, {
        level: context.outcome === 'terminal' ? 'error' : 'warning',
        tags: {
          module: 'tasks',
          operation: 'runtime-startup',
          startup_outcome: context.outcome,
          startup_phase: context.phase,
          automatic_recovery_attempted: context.automaticRecoveryAttempted ? 'yes' : 'no',
          closed_client_error: context.closedClientError ? 'yes' : 'no',
          endpoint_configured: context.endpointConfigured ? 'yes' : 'no',
          browser_online: context.browserOnline ? 'yes' : 'no',
        },
        contexts: {
          tasks_runtime: {
            generation: safeRuntimeContext.generation,
            phase: safeRuntimeContext.phase,
            outcome: safeRuntimeContext.outcome,
            automaticRecoveryAttempted: safeRuntimeContext.automaticRecoveryAttempted,
            closedClientError: safeRuntimeContext.closedClientError,
            endpointConfigured: safeRuntimeContext.endpointConfigured,
            browserOnline: safeRuntimeContext.browserOnline,
          },
        },
      })
    : null;

  const report: TasksRuntimeStartupDiagnosticReport = {
    event: 'tasks-runtime-startup-failure',
    timestamp: new Date().toISOString(),
    error: serializeError(error),
    runtime: safeRuntimeContext,
    environment: {
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      userAgent: window.navigator.userAgent,
    },
    sentryEventId,
  };

  console.error(
    `[Tasks] ${TASKS_RUNTIME_STARTUP_FAILURE_MESSAGE}`,
    report,
    error,
  );

  return report;
}
