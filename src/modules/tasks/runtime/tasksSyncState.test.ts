import { describe, expect, it, vi } from 'vitest';

import {
  observeTasksSyncState,
  resolveTasksSyncState,
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
  });
});
