import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  reportTasksRuntimeStartupFailure,
  TASKS_RUNTIME_STARTUP_FAILURE_MESSAGE,
  type TasksRuntimeStartupDiagnosticContext,
} from './taskRuntimeStartupReporting';

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/react', () => mocks);

const context: TasksRuntimeStartupDiagnosticContext = {
  phase: 'owner-binding',
  generation: 2,
  outcome: 'terminal',
  automaticRecoveryAttempted: true,
  closedClientError: true,
  endpointConfigured: true,
  browserOnline: true,
};

describe('Tasks runtime startup reporting', () => {
  beforeEach(() => {
    mocks.getClient.mockReset().mockReturnValue({});
    mocks.captureException.mockReset().mockReturnValue('sentry-event-id');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.history.replaceState({}, '', '/tasks/today?private=query');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures the original exception with bounded startup context', () => {
    const error = new Error('Client has already been closed');

    const report = reportTasksRuntimeStartupFailure(error, context);

    expect(mocks.captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      tags: {
        module: 'tasks',
        operation: 'runtime-startup',
        startup_outcome: 'terminal',
        startup_phase: 'owner-binding',
        automatic_recovery_attempted: 'yes',
        closed_client_error: 'yes',
        endpoint_configured: 'yes',
        browser_online: 'yes',
      },
      contexts: {
        tasks_runtime: {
          generation: 2,
          phase: 'owner-binding',
          outcome: 'terminal',
          automaticRecoveryAttempted: true,
          closedClientError: true,
          endpointConfigured: true,
          browserOnline: true,
        },
      },
    });
    expect(report.sentryEventId).toBe('sentry-event-id');
  });

  it('prints the full local diagnostic report and original exception', () => {
    const error = new Error('Database startup failed');

    const report = reportTasksRuntimeStartupFailure(error, context);

    expect(console.error).toHaveBeenCalledWith(
      `[Tasks] ${TASKS_RUNTIME_STARTUP_FAILURE_MESSAGE}`,
      report,
      error,
    );
    expect(report.error).toEqual({
      name: 'Error',
      message: 'Database startup failed',
      stack: expect.any(String),
    });
    expect(report.environment.pathname).toBe('/tasks/today');
    expect(report.environment).not.toHaveProperty('search');
  });

  it('reports an automatically recovered closed-client incident as a warning', () => {
    const error = new Error('Client has already been closed');

    reportTasksRuntimeStartupFailure(error, {
      ...context,
      outcome: 'automatic-recovery-started',
    });

    expect(mocks.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({
          startup_outcome: 'automatic-recovery-started',
        }),
      }),
    );
  });

  it('keeps private accidental context properties out of Sentry and the report', () => {
    const privateContext = Object.assign({}, context, {
      ownerId: 'owner-secret',
      taskTitle: 'Private task title',
      credential: 'credential-secret',
      queryResult: 'private row',
    }) as TasksRuntimeStartupDiagnosticContext;

    const report = reportTasksRuntimeStartupFailure(
      new Error('Known safe runtime failure'),
      privateContext,
    );
    const serializedSentryOptions = JSON.stringify(
      mocks.captureException.mock.calls[0]?.[1],
    );
    const serializedReportContext = JSON.stringify(report.runtime);

    for (const privateValue of [
      'owner-secret',
      'Private task title',
      'credential-secret',
      'private row',
    ]) {
      expect(serializedSentryOptions).not.toContain(privateValue);
      expect(serializedReportContext).not.toContain(privateValue);
    }
  });

  it('still logs locally when the Sentry client is unavailable', () => {
    mocks.getClient.mockReturnValue(null);
    const error = new Error('Local-only failure');

    const report = reportTasksRuntimeStartupFailure(error, context);

    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(report.sentryEventId).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      `[Tasks] ${TASKS_RUNTIME_STARTUP_FAILURE_MESSAGE}`,
      report,
      error,
    );
  });
});
