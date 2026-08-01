import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidTaskHistoryError, TaskHistoryReconstructionError } from '@/modules/tasks/domain/taskHistory';
import {
  reportTaskHistoryReconstructionFailure,
  TASK_HISTORY_RECONSTRUCTION_FAILURE_MESSAGE,
} from './taskHistoryReporting';

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/react', () => mocks);

describe('task history reporting', () => {
  beforeEach(() => {
    mocks.getClient.mockReset().mockReturnValue({});
    mocks.captureException.mockReset().mockReturnValue('sentry-event-id');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports only content-free reconstruction context', () => {
    const error = new TaskHistoryReconstructionError(
      'event-a',
      new InvalidTaskHistoryError('Task history contains an invalid mutation channel'),
    );
    const report = reportTaskHistoryReconstructionFailure(error, 500);

    expect(mocks.captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      tags: {
        module: 'tasks',
        operation: 'history-reconstruction',
      },
      contexts: {
        tasks_history: {
          eventId: 'event-a',
          synchronizedRowCount: 500,
          reason: 'Task history contains an invalid mutation channel',
        },
      },
    });
    expect(report).toMatchObject({
      event: 'tasks-history-reconstruction-failure',
      history: {
        eventId: 'event-a',
        synchronizedRowCount: 500,
      },
      sentryEventId: 'sentry-event-id',
    });
    expect(console.error).toHaveBeenCalledWith(
      `[Tasks] ${TASK_HISTORY_RECONSTRUCTION_FAILURE_MESSAGE}`,
      report,
      error,
    );
  });
});
