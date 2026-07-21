import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskSyncHealthEvent } from '@/modules/tasks/data/taskSyncHealthEventStore';
import {
  addTaskSyncRecoveryBreadcrumb,
  captureTaskSyncDegradation,
  TASK_SYNC_DEGRADATION_MESSAGE,
  TASK_SYNC_RECOVERY_MESSAGE,
} from './taskSyncReliabilityReporting';

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('@sentry/react', () => mocks);

const event: TaskSyncHealthEvent = {
  id: 'local-event-id',
  state: 'upload-error',
  startedAt: '2026-07-21T15:00:00.000Z',
  resolvedAt: null,
  pendingUploadBucket: '2-9',
  hadCompletedSync: true,
  lastSuccessfulSyncAt: '2026-07-21T14:59:00.000Z',
  reportedAt: null,
};

describe('task synchronization reliability reporting', () => {
  beforeEach(() => {
    mocks.getClient.mockReset().mockReturnValue({});
    mocks.captureMessage.mockReset().mockReturnValue('sentry-event');
    mocks.addBreadcrumb.mockReset();
  });

  it('does not capture or mark success when Sentry is unavailable', () => {
    mocks.getClient.mockReturnValue(null);

    expect(captureTaskSyncDegradation({ event, durationBucket: '2-4m' })).toBeNull();
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });

  it('sends only fixed copy and allowlisted bounded tags', () => {
    const privateEvent = Object.assign({}, event, {
      taskTitle: 'Private task title',
      rawError: 'Provider secret',
      ownerId: 'owner-secret',
    }) as TaskSyncHealthEvent;

    expect(captureTaskSyncDegradation({
      event: privateEvent,
      durationBucket: '2-4m',
    })).toBe('sentry-event');

    expect(mocks.captureMessage).toHaveBeenCalledWith(TASK_SYNC_DEGRADATION_MESSAGE, {
      level: 'warning',
      tags: {
        module: 'tasks',
        sync_health_state: 'upload-error',
        queue_count_bucket: '2-9',
        had_completed_sync: 'yes',
        duration_bucket: '2-4m',
      },
    });
    const serialized = JSON.stringify(mocks.captureMessage.mock.calls);
    expect(serialized).not.toContain('Private task title');
    expect(serialized).not.toContain('Provider secret');
    expect(serialized).not.toContain('owner-secret');
    expect(serialized).not.toContain('local-event-id');
  });

  it('adds one bounded recovery breadcrumb only with an initialized client', () => {
    addTaskSyncRecoveryBreadcrumb(
      { ...event, reportedAt: '2026-07-21T15:02:00.000Z' },
      '2026-07-21T15:06:00.000Z',
    );

    expect(mocks.addBreadcrumb).toHaveBeenCalledWith({
      category: 'tasks.sync',
      level: 'info',
      message: TASK_SYNC_RECOVERY_MESSAGE,
      data: {
        syncHealthState: 'upload-error',
        durationBucket: '5-14m',
        reported: 'yes',
      },
    });
  });
});
