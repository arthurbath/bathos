import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  reportTaskBulkDeleteFailure,
  TASK_BULK_DELETE_FAILURE_MESSAGE,
  type TaskBulkDeleteDiagnosticContext,
} from './taskBulkMutationReporting';

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/react', () => mocks);

const context: TaskBulkDeleteDiagnosticContext = {
  requestedCount: 3,
  succeededCount: 2,
  failedCount: 1,
  view: 'today',
  browserOnline: true,
};

describe('task bulk mutation reporting', () => {
  beforeEach(() => {
    mocks.getClient.mockReset().mockReturnValue({});
    mocks.captureException.mockReset().mockReturnValue('sentry-event-id');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures one sanitized exception with bounded operational context', () => {
    const report = reportTaskBulkDeleteFailure(context, [new Error('write failed')]);

    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Error',
        message: '1 of 3 selected task deletions failed',
      }),
      {
        level: 'error',
        tags: {
          module: 'tasks',
          operation: 'bulk-delete',
          active_view: 'today',
          browser_online: 'yes',
        },
        contexts: {
          tasks_bulk_delete: {
            requestedCount: 3,
            succeededCount: 2,
            failedCount: 1,
            view: 'today',
            browserOnline: true,
          },
        },
      },
    );
    expect(report.sentryEventId).toBe('sentry-event-id');
  });

  it('keeps accidental task content out of Sentry and the structured report', () => {
    const privateContext = Object.assign({}, context, {
      taskId: 'task-secret',
      taskTitle: 'Private task title',
      notes: 'Private task notes',
    }) as TaskBulkDeleteDiagnosticContext;

    const report = reportTaskBulkDeleteFailure(
      privateContext,
      [new Error('Private repository detail for local console only')],
    );
    const serializedSentryCall = JSON.stringify(mocks.captureException.mock.calls[0]);
    const serializedReport = JSON.stringify(report);

    for (const privateValue of [
      'task-secret',
      'Private task title',
      'Private task notes',
      'Private repository detail for local console only',
    ]) {
      expect(serializedSentryCall).not.toContain(privateValue);
      expect(serializedReport).not.toContain(privateValue);
    }
    expect(console.error).toHaveBeenCalledWith(
      `[Tasks] ${TASK_BULK_DELETE_FAILURE_MESSAGE}`,
      report,
      expect.any(Array),
    );
  });

  it('still logs locally when the Sentry client is unavailable', () => {
    mocks.getClient.mockReturnValue(null);

    const report = reportTaskBulkDeleteFailure(context, [new Error('write failed')]);

    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(report.sentryEventId).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      `[Tasks] ${TASK_BULK_DELETE_FAILURE_MESSAGE}`,
      report,
      expect.any(Array),
    );
  });
});
