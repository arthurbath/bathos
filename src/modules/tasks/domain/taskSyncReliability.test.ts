import { describe, expect, it } from 'vitest';

import {
  bucketTaskSyncDuration,
  bucketTaskSyncQueueCount,
  deriveTaskSyncHealthState,
  isTaskSyncDegradationState,
  type TaskSyncHealthInput,
} from './taskSyncReliability';

const healthyInput: TaskSyncHealthInput = {
  mode: 'connected',
  syncState: 'connected',
  hasCompletedSync: true,
  pendingUploadCount: 0,
  uploadState: 'idle',
  downloadState: 'idle',
};

describe('task synchronization reliability', () => {
  it.each([
    [{ mode: 'local', syncState: 'local' }, 'local-only'],
    [{ uploadState: 'error', downloadState: 'error', syncState: 'offline' }, 'upload-error'],
    [{ downloadState: 'error', syncState: 'offline' }, 'download-error'],
    [{ syncState: 'offline' }, 'offline'],
    [{ syncState: 'connecting' }, 'connecting'],
    [{ hasCompletedSync: false }, 'first-sync-pending'],
    [{ uploadState: 'active' }, 'synchronizing'],
    [{ downloadState: 'active' }, 'synchronizing'],
    [{ pendingUploadCount: 1 }, 'synchronizing'],
    [{}, 'healthy'],
  ] as const)('classifies %o as %s', (patch, expected) => {
    expect(deriveTaskSyncHealthState({ ...healthyInput, ...patch })).toBe(expected);
  });

  it('recognizes only the three persisted degradation states', () => {
    expect(isTaskSyncDegradationState('upload-error')).toBe(true);
    expect(isTaskSyncDegradationState('download-error')).toBe(true);
    expect(isTaskSyncDegradationState('offline')).toBe(true);
    expect(isTaskSyncDegradationState('connecting')).toBe(false);
    expect(isTaskSyncDegradationState('healthy')).toBe(false);
  });

  it('bounds queue depth and duration without preserving exact large values', () => {
    expect([-1, 0, Number.NaN].map(bucketTaskSyncQueueCount)).toEqual(['0', '0', '0']);
    expect([1, 9, 10, 49, 50, 50_000].map(bucketTaskSyncQueueCount))
      .toEqual(['1', '2-9', '10-49', '10-49', '50+', '50+']);
    expect([120_000, 300_000, 900_000, 3_600_000, 21_600_000].map(bucketTaskSyncDuration))
      .toEqual(['2-4m', '5-14m', '15-59m', '1-5h', '6h+']);
  });
});
