import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskSyncHealthEvent } from '@/modules/tasks/data/taskSyncHealthEventStore';
import { TasksSyncReliabilityObserver } from './TasksSyncReliabilityObserver';

const mocks = vi.hoisted(() => ({
  useStatus: vi.fn(),
  useTasksRuntime: vi.fn(),
}));

vi.mock('@powersync/react', () => ({ useStatus: () => mocks.useStatus() }));
vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

const openEvent: TaskSyncHealthEvent = {
  id: 'health-a',
  state: 'offline',
  startedAt: '2026-07-21T15:00:00.000Z',
  resolvedAt: null,
  pendingUploadBucket: '0',
  hadCompletedSync: true,
  lastSuccessfulSyncAt: '2026-07-21T14:59:00.000Z',
  reportedAt: null,
};

describe('TasksSyncReliabilityObserver', () => {
  beforeEach(() => {
    mocks.useStatus.mockReset().mockReturnValue({
      hasSynced: true,
      lastSyncedAt: new Date('2026-07-21T14:59:00.000Z'),
      dataFlowStatus: {},
    });
    mocks.useTasksRuntime.mockReset().mockReturnValue({
      database: {},
      mode: 'connected',
      syncState: 'offline',
      pendingUploadCount: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not split a persisted outage while initial PowerSync status is loading', async () => {
    mocks.useStatus.mockReturnValue({
      hasSynced: undefined,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    mocks.useTasksRuntime.mockReturnValue({
      database: {}, mode: 'connected', syncState: 'connecting', pendingUploadCount: 0,
    });
    const store = {
      reconcile: vi.fn(),
      reportCurrentIfDue: vi.fn(),
    };

    render(<TasksSyncReliabilityObserver store={store} />);
    await act(async () => Promise.resolve());

    expect(store.reconcile).not.toHaveBeenCalled();
  });

  it('resumes an open outage and reports it after the remaining 2-minute delay', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T15:01:00.000Z'));
    const store = {
      reconcile: vi.fn().mockResolvedValue({ openEvent, resolvedEvent: null }),
      reportCurrentIfDue: vi.fn().mockResolvedValue({
        ...openEvent,
        reportedAt: '2026-07-21T15:02:00.000Z',
      }),
    };
    const capture = vi.fn(() => 'sentry-event');

    render(
      <TasksSyncReliabilityObserver
        store={store}
        production
        capture={capture}
        now={() => new Date(Date.now())}
      />,
    );
    await act(async () => Promise.resolve());
    expect(store.reconcile).toHaveBeenCalledWith(expect.objectContaining({
      state: 'offline',
      hasCompletedSync: true,
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_999);
    });
    expect(store.reportCurrentIfDue).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(store.reportCurrentIfDue).toHaveBeenCalledWith({
      state: 'offline',
      observedAt: '2026-07-21T15:02:00.000Z',
      capture,
    });
  });

  it('records a bounded recovery breadcrumb without scheduling a report', async () => {
    const resolvedEvent = { ...openEvent, resolvedAt: '2026-07-21T15:03:00.000Z' };
    const store = {
      reconcile: vi.fn().mockResolvedValue({ openEvent: null, resolvedEvent }),
      reportCurrentIfDue: vi.fn(),
    };
    const addRecoveryBreadcrumb = vi.fn();
    mocks.useTasksRuntime.mockReturnValue({
      database: {}, mode: 'connected', syncState: 'connected', pendingUploadCount: 0,
    });

    render(
      <TasksSyncReliabilityObserver
        store={store}
        production
        now={() => new Date('2026-07-21T15:03:00.000Z')}
        addRecoveryBreadcrumb={addRecoveryBreadcrumb}
      />,
    );

    await waitFor(() => expect(addRecoveryBreadcrumb).toHaveBeenCalledWith(
      resolvedEvent,
      '2026-07-21T15:03:00.000Z',
    ));
    expect(store.reportCurrentIfDue).not.toHaveBeenCalled();
  });
});
