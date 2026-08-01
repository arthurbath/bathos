import { describe, expect, it, vi } from 'vitest';

import {
  observeTasksSyncState,
  resolveTasksSyncState,
  shouldReleaseTasksStartupRefresh,
  type TasksPowerSyncStatus,
} from './tasksSyncState';

describe('tasksSyncState', () => {
  it('immediately observes status already published by a shared PowerSync worker', () => {
    const statusChanged = vi.fn();
    const dispose = vi.fn();
    const source = {
      currentStatus: { connected: true, connecting: false },
      registerListener: vi.fn((listener: {
        statusChanged: (status: TasksPowerSyncStatus) => void;
      }) => {
        statusChanged.mockImplementation(listener.statusChanged);
        return dispose;
      }),
    };
    const onStateChanged = vi.fn();

    const stopObserving = observeTasksSyncState(source, onStateChanged);

    expect(onStateChanged).toHaveBeenCalledWith('connected');
    statusChanged({ connected: false, connecting: false });
    expect(onStateChanged).toHaveBeenLastCalledWith('offline');
    stopObserving();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('resolves connecting and offline states without reporting false connectivity', () => {
    expect(resolveTasksSyncState({ connected: false, connecting: true })).toBe('connecting');
    expect(resolveTasksSyncState({ connected: false, connecting: false })).toBe('offline');
    expect(resolveTasksSyncState({ connected: true, connecting: false }, false)).toBe('offline');
  });

  it('lets browser connectivity override a stale shared-worker connection', () => {
    const statusChanged = vi.fn();
    const source = {
      currentStatus: { connected: true, connecting: false },
      registerListener: vi.fn((listener: {
        statusChanged: (status: TasksPowerSyncStatus) => void;
      }) => {
        statusChanged.mockImplementation(listener.statusChanged);
        return vi.fn();
      }),
    };
    const onStateChanged = vi.fn();

    observeTasksSyncState(source, onStateChanged, () => false);

    expect(onStateChanged).toHaveBeenCalledWith('offline');
  });

  it('forwards raw status so startup freshness can distinguish cached and current syncs', () => {
    const baseline = new Date('2026-07-31T16:00:00.000Z');
    const currentStatus = {
      connected: false,
      connecting: false,
      hasSynced: true,
      lastSyncedAt: baseline,
    };
    const observed = vi.fn();
    const source = {
      currentStatus,
      registerListener: vi.fn(() => vi.fn()),
    };

    observeTasksSyncState(source, vi.fn(), () => true, observed);

    expect(observed).toHaveBeenCalledWith(currentStatus);
  });

  it('keeps startup loading through cached status and releases on a new completed sync', () => {
    const baseline = new Date('2026-07-31T16:00:00.000Z');

    expect(shouldReleaseTasksStartupRefresh({
      browserOnline: true,
      baselineCaptured: true,
      baselineLastSyncedAt: baseline.getTime(),
      status: {
        connected: true,
        connecting: false,
        hasSynced: true,
        lastSyncedAt: baseline,
      },
    })).toBe(false);
    expect(shouldReleaseTasksStartupRefresh({
      browserOnline: true,
      baselineCaptured: true,
      baselineLastSyncedAt: baseline.getTime(),
      status: {
        connected: true,
        connecting: false,
        hasSynced: true,
        lastSyncedAt: new Date('2026-07-31T16:00:02.000Z'),
      },
    })).toBe(true);
  });

  it('releases startup loading for offline and download-failure fallbacks', () => {
    const baseline = Date.parse('2026-07-31T16:00:00.000Z');
    const cachedStatus = {
      connected: false,
      connecting: false,
      hasSynced: true,
      lastSyncedAt: new Date(baseline),
    };

    expect(shouldReleaseTasksStartupRefresh({
      browserOnline: false,
      baselineCaptured: true,
      baselineLastSyncedAt: baseline,
      status: cachedStatus,
    })).toBe(true);
    expect(shouldReleaseTasksStartupRefresh({
      browserOnline: true,
      baselineCaptured: true,
      baselineLastSyncedAt: baseline,
      status: {
        ...cachedStatus,
        dataFlowStatus: { downloadError: new Error('unavailable') },
      },
    })).toBe(true);
  });
});
