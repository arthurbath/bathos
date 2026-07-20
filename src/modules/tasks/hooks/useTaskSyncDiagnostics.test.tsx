import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTaskSyncDiagnostics } from './useTaskSyncDiagnostics';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useStatus: vi.fn(),
  useTasksRuntime: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
  useStatus: () => mocks.useStatus(),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

describe('useTaskSyncDiagnostics', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset().mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    mocks.useStatus.mockReset().mockReturnValue({
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });
    mocks.useTasksRuntime.mockReset().mockReturnValue({
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 0,
    });
  });

  it('reports independent transfer state, last success, queue depth, and content-free conflicts', () => {
    const lastSyncedAt = new Date('2026-07-20T16:30:00.000Z');
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 2,
    });
    mocks.useStatus.mockReturnValue({
      lastSyncedAt,
      dataFlowStatus: {
        uploading: true,
        downloading: false,
        downloadError: new Error('Private remote detail must not be exposed'),
      },
    });
    mocks.useQuery.mockReturnValue({
      data: [{
        id: 'crud-2',
        task_id: 'task-a',
        operation: 'PATCH',
        local_revision: 2,
        remote_revision: 3,
        detected_at: '2026-07-20T16:31:00.000Z',
        code: 'revision_conflict',
      }],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(useTaskSyncDiagnostics);

    expect(mocks.useQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE kind = 'conflict'"));
    expect(result.current).toEqual(expect.objectContaining({
      pendingUploadCount: 2,
      lastSuccessfulSyncAt: lastSyncedAt.toISOString(),
      uploadState: 'active',
      downloadState: 'error',
      conflictReceipts: [{
        id: 'crud-2',
        taskId: 'task-a',
        operation: 'PATCH',
        localRevision: 2,
        remoteRevision: 3,
        detectedAt: '2026-07-20T16:31:00.000Z',
        code: 'revision_conflict',
      }],
    }));
    expect(JSON.stringify(result.current)).not.toContain('Private remote detail');
  });

  it('does not imply remote activity or convergence in local-only mode', () => {
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'local',
      syncState: 'local',
      pendingUploadCount: 0,
    });
    mocks.useStatus.mockReturnValue({
      lastSyncedAt: new Date('2026-07-20T16:30:00.000Z'),
      dataFlowStatus: {
        uploading: true,
        downloading: true,
        uploadError: new Error('stale'),
      },
    });

    const { result } = renderHook(useTaskSyncDiagnostics);

    expect(result.current.lastSuccessfulSyncAt).toBeNull();
    expect(result.current.uploadState).toBe('idle');
    expect(result.current.downloadState).toBe('idle');
  });

  it('withholds malformed conflict rows behind a content-free read error', () => {
    mocks.useQuery.mockReturnValue({
      data: [{
        id: 'crud-2',
        task_id: 'task-a',
        operation: 'PATCH',
        local_revision: 2,
        remote_revision: 3,
        detected_at: 'not-a-time',
        code: 'revision_conflict',
      }],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(useTaskSyncDiagnostics);

    expect(result.current.conflictReceipts).toEqual([]);
    expect(result.current.conflictReceiptsError?.message)
      .toBe('Task conflict receipts could not be read');
  });
});
