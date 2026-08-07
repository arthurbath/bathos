import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
  type TaskActionJournalEntry,
} from '@/modules/tasks/domain/taskActionJournal';
import {
  taskChecklistItemFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';
import { useTaskActionHistory } from './useTaskActionHistory';

const mocks = vi.hoisted(() => ({
  append: vi.fn(),
  next: vi.fn(),
  mark: vi.fn(),
  useQuery: vi.fn(),
  useTasksRuntime: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('@/modules/tasks/data/taskActionJournalRepository', () => ({
  TaskActionJournalRepository: class {
    append = mocks.append;
    next = mocks.next;
    mark = mocks.mark;
  },
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

describe('useTaskActionHistory', () => {
  const replayChecklistItemSnapshot = vi.fn();
  const replayTaskSnapshot = vi.fn();
  const request = vi.fn();
  const getOptional = vi.fn();
  const refresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refresh,
    });
    mocks.useTasksRuntime.mockReturnValue({
      database: { getOptional },
      repository: { replayTaskSnapshot },
      hierarchyRepository: { replayChecklistItemSnapshot },
      hierarchyOperationsRepository: { request },
    });
    mocks.append.mockResolvedValue(null);
    mocks.mark.mockResolvedValue(undefined);
    refresh.mockResolvedValue(undefined);
  });

  it('undoes checklist completion and automatic sinking as one immediate local action', async () => {
    const before = taskChecklistItemFixture({
      id: 'item-a',
      completed: false,
      completed_at: null,
      order_key: 'a1',
    });
    const after = taskChecklistItemFixture({
      ...before,
      completed: true,
      completed_at: '2026-08-06T23:00:00.000Z',
      order_key: 'z9',
    });
    const entry: TaskActionJournalEntry = {
      id: 'journal-a',
      owner_id: 'owner-a',
      sequence: 1,
      action_id: 'action-a',
      occurred_at: after.updated_at,
      expires_at: '2026-08-06T23:30:00.000Z',
      state: 'applied',
      snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
      changes: [{
        entityType: 'checklist_item',
        entityId: 'item-a',
        before: {
          task_id: before.task_id,
          title: before.title,
          completed: false,
          completed_at: null,
          order_key: 'a1',
        },
        after: {
          task_id: after.task_id,
          title: after.title,
          completed: true,
          completed_at: after.completed_at,
          order_key: 'z9',
        },
      }],
    };
    getOptional.mockResolvedValue(after);
    mocks.next.mockResolvedValue(entry);
    replayChecklistItemSnapshot.mockResolvedValue(before);
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));
    let settleAction: (changes: typeof entry.changes) => void = () => undefined;
    const settled = new Promise<typeof entry.changes>((resolve) => {
      settleAction = resolve;
    });

    act(() => {
      result.current.registerChecklistForwardAction({
        actionId: entry.action_id,
        occurredAt: entry.occurred_at,
        settled,
      });
    });

    let undo: Promise<TaskActionJournalEntry | null>;
    act(() => {
      undo = result.current.undoWhenAvailable();
    });
    expect(mocks.next).not.toHaveBeenCalled();

    await act(async () => {
      settleAction(entry.changes);
      await expect(undo).resolves.toEqual(entry);
    });

    expect(mocks.append).toHaveBeenCalledWith(
      'owner-a',
      entry.action_id,
      entry.occurred_at,
      entry.changes,
    );
    expect(replayChecklistItemSnapshot).toHaveBeenCalledWith(
      'owner-a',
      'item-a',
      {
        task_id: after.task_id,
        title: after.title,
        completed: true,
        completed_at: after.completed_at,
        order_key: 'z9',
      },
      {
        task_id: before.task_id,
        title: before.title,
        completed: false,
        completed_at: null,
        order_key: 'a1',
      },
      expect.objectContaining({ operationId: 'undo-action-a' }),
    );
    expect(mocks.mark).toHaveBeenCalledWith(entry, 'undo');
    expect(request).not.toHaveBeenCalled();
  });

  it('does not convert an unsafe replay conflict into an empty-history result', async () => {
    const entry: TaskActionJournalEntry = {
      id: 'journal-a',
      owner_id: 'owner-a',
      sequence: 1,
      action_id: 'action-a',
      occurred_at: '2026-08-06T23:00:00.000Z',
      expires_at: '2026-08-06T23:30:00.000Z',
      state: 'applied',
      snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
      changes: [{
        entityType: 'checklist_item',
        entityId: 'item-a',
        before: null,
        after: {
          task_id: 'task-a',
          title: 'Original',
          completed: false,
          completed_at: null,
          order_key: 'a1',
        },
      }],
    };
    getOptional.mockResolvedValue(taskChecklistItemFixture({
      id: 'item-a',
      title: 'Changed elsewhere',
    }));
    mocks.next.mockResolvedValue(entry);
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));

    await act(async () => {
      await expect(result.current.undoWhenAvailable()).rejects.toMatchObject({
        name: 'UnsafeTaskUndoError',
      });
    });

    expect(mocks.mark).not.toHaveBeenCalled();
  });

  it('rolls back an already replayed member when a grouped action fails', async () => {
    const firstBefore = taskChecklistItemFixture({ id: 'item-a', title: 'First before' });
    const firstAfter = taskChecklistItemFixture({ ...firstBefore, title: 'First after' });
    const secondBefore = taskChecklistItemFixture({ id: 'item-b', title: 'Second before' });
    const secondAfter = taskChecklistItemFixture({ ...secondBefore, title: 'Second after' });
    const entry: TaskActionJournalEntry = {
      id: 'journal-group',
      owner_id: 'owner-a',
      sequence: 1,
      action_id: 'action-group',
      occurred_at: '2026-08-06T23:00:00.000Z',
      expires_at: '2026-08-06T23:30:00.000Z',
      state: 'applied',
      snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
      changes: [firstAfter, secondAfter].map((after, index) => ({
        entityType: 'checklist_item' as const,
        entityId: after.id,
        before: {
          task_id: after.task_id,
          title: index === 0 ? firstBefore.title : secondBefore.title,
          completed: after.completed,
          completed_at: after.completed_at,
          order_key: after.order_key,
        },
        after: {
          task_id: after.task_id,
          title: after.title,
          completed: after.completed,
          completed_at: after.completed_at,
          order_key: after.order_key,
        },
      })),
    };
    getOptional
      .mockResolvedValueOnce(secondAfter)
      .mockResolvedValueOnce(firstAfter);
    mocks.next.mockResolvedValue(entry);
    replayChecklistItemSnapshot
      .mockResolvedValueOnce(secondBefore)
      .mockRejectedValueOnce(new Error('local write failed'))
      .mockResolvedValueOnce(secondAfter);
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));

    await act(async () => {
      await expect(result.current.undoWhenAvailable()).rejects.toThrow('local write failed');
    });

    expect(replayChecklistItemSnapshot).toHaveBeenCalledTimes(3);
    expect(replayChecklistItemSnapshot.mock.calls[2]?.[2]).toEqual(entry.changes[1].before);
    expect(replayChecklistItemSnapshot.mock.calls[2]?.[3]).toEqual(entry.changes[1].after);
    expect(replayChecklistItemSnapshot.mock.calls[2]?.[4]).toEqual(expect.objectContaining({
      operationId: 'rollback-undo-action-group',
    }));
    expect(mocks.mark).not.toHaveBeenCalled();
  });

  it('records a reserved task mutation once when the accepted-task callback also arrives', async () => {
    const before = taskTodoFixture({
      id: 'task-a',
      title: 'Before',
      client_mutation_id: 'mutation-before',
    });
    const after = taskTodoFixture({
      ...before,
      title: 'After',
      client_mutation_id: 'mutation-after',
      last_operation_id: 'action-a',
      updated_at: '2026-08-06T23:00:00.000Z',
    });
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));

    act(() => {
      const reservation = result.current.reserveForwardMutation(before);
      reservation.commit(after);
      result.current.registerForwardMutation(after);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.append).toHaveBeenCalledOnce();
    expect(mocks.append).toHaveBeenCalledWith(
      'owner-a',
      'action-a',
      after.updated_at,
      [expect.objectContaining({
        entityType: 'task',
        entityId: 'task-a',
        before: expect.objectContaining({ title: 'Before' }),
        after: expect.objectContaining({ title: 'After' }),
      })],
    );
  });

  it('records a multi-task creation as one atomic journal action', async () => {
    const createdAt = '2026-08-06T23:00:00.000Z';
    const first = taskTodoFixture({
      id: 'task-a',
      title: 'First',
      last_operation_id: 'clipboard-action',
      updated_at: createdAt,
    });
    const second = taskTodoFixture({
      id: 'task-b',
      title: 'Second',
      last_operation_id: 'clipboard-action',
      updated_at: createdAt,
    });
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));

    act(() => result.current.registerForwardMutations([first, second]));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.append).toHaveBeenCalledOnce();
    expect(mocks.append).toHaveBeenCalledWith(
      'owner-a',
      'clipboard-action',
      createdAt,
      [
        expect.objectContaining({ entityId: 'task-a', before: null }),
        expect.objectContaining({ entityId: 'task-b', before: null }),
      ],
    );
  });

  it('replays ordinary task metadata from the local snapshot without server history', async () => {
    const before = taskTodoFixture({ id: 'task-a', title: 'Before' });
    const after = taskTodoFixture({ ...before, title: 'After' });
    const beforeSnapshot = {
      ...after,
      title: before.title,
    };
    const { snapshotTask } = await import('@/modules/tasks/domain/taskHistory');
    const entry: TaskActionJournalEntry = {
      id: 'journal-task',
      owner_id: 'owner-a',
      sequence: 1,
      action_id: 'action-task',
      occurred_at: after.updated_at,
      expires_at: '2026-08-06T23:30:00.000Z',
      state: 'applied',
      snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
      changes: [{
        entityType: 'task',
        entityId: after.id,
        before: snapshotTask(beforeSnapshot),
        after: snapshotTask(after),
      }],
    };
    getOptional.mockResolvedValue(after);
    mocks.next.mockResolvedValue(entry);
    replayTaskSnapshot.mockResolvedValue(before);
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));

    await act(async () => {
      await result.current.undoWhenAvailable();
    });

    expect(replayTaskSnapshot).toHaveBeenCalledWith(
      'owner-a',
      after.id,
      snapshotTask(after),
      snapshotTask(beforeSnapshot),
      expect.objectContaining({ operationId: 'undo-action-task' }),
    );
    expect(mocks.mark).toHaveBeenCalledWith(entry, 'undo');
  });

  it('redoes ordinary task metadata from the same local chronological cursor', async () => {
    const before = taskTodoFixture({ id: 'task-a', title: 'Before' });
    const after = taskTodoFixture({ ...before, title: 'After' });
    const { snapshotTask } = await import('@/modules/tasks/domain/taskHistory');
    const entry: TaskActionJournalEntry = {
      id: 'journal-task',
      owner_id: 'owner-a',
      sequence: 1,
      action_id: 'action-task',
      occurred_at: after.updated_at,
      expires_at: '2026-08-06T23:30:00.000Z',
      state: 'undone',
      snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
      changes: [{
        entityType: 'task',
        entityId: after.id,
        before: snapshotTask(before),
        after: snapshotTask(after),
      }],
    };
    getOptional.mockResolvedValue(before);
    mocks.next.mockResolvedValue(entry);
    replayTaskSnapshot.mockResolvedValue(after);
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));

    await act(async () => {
      await result.current.redoWhenAvailable();
    });

    expect(replayTaskSnapshot).toHaveBeenCalledWith(
      'owner-a',
      after.id,
      snapshotTask(before),
      snapshotTask(after),
      expect.objectContaining({ operationId: 'redo-action-task' }),
    );
    expect(mocks.mark).toHaveBeenCalledWith(entry, 'redo');
  });

  it('undoes locally created tasks through the existing guarded hierarchy path', async () => {
    const created = taskTodoFixture({ id: 'task-created', title: 'Created' });
    const { snapshotTask } = await import('@/modules/tasks/domain/taskHistory');
    const entry: TaskActionJournalEntry = {
      id: 'journal-create',
      owner_id: 'owner-a',
      sequence: 1,
      action_id: 'action-create',
      occurred_at: created.updated_at,
      expires_at: '2026-08-06T23:30:00.000Z',
      state: 'applied',
      snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
      changes: [{
        entityType: 'task',
        entityId: created.id,
        before: null,
        after: snapshotTask(created),
      }],
    };
    getOptional.mockResolvedValue(created);
    mocks.next.mockResolvedValue(entry);
    request.mockResolvedValue({ id: 'delete-operation', affectedIds: [created.id] });
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));

    await act(async () => {
      await result.current.undoWhenAvailable();
    });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-a',
      rootType: 'todo',
      rootId: created.id,
      operation: 'delete',
      descendantPolicy: 'cascade',
    }));
    expect(mocks.mark).toHaveBeenCalledWith(entry, 'undo');
  });

  it('redoes a locally created task after its undo left a soft-deleted row', async () => {
    const created = taskTodoFixture({ id: 'task-created', title: 'Created' });
    const deleted = taskTodoFixture({
      ...created,
      disposition: 'deleted',
      deleted_at: '2026-08-06T23:01:00.000Z',
    });
    const { snapshotTask } = await import('@/modules/tasks/domain/taskHistory');
    const entry: TaskActionJournalEntry = {
      id: 'journal-create',
      owner_id: 'owner-a',
      sequence: 1,
      action_id: 'action-create',
      occurred_at: created.updated_at,
      expires_at: '2026-08-06T23:30:00.000Z',
      state: 'undone',
      snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
      changes: [{
        entityType: 'task',
        entityId: created.id,
        before: null,
        after: snapshotTask(created),
      }],
    };
    getOptional.mockResolvedValue(deleted);
    mocks.next.mockResolvedValue(entry);
    request.mockResolvedValue({ id: 'restore-operation', affectedIds: [created.id] });
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));

    await act(async () => {
      await result.current.redoWhenAvailable();
    });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-a',
      rootType: 'todo',
      rootId: created.id,
      operation: 'restore',
      descendantPolicy: 'cascade',
    }));
    expect(mocks.mark).toHaveBeenCalledWith(entry, 'redo');
  });

  it('redoes a locally created checklist item after its undo left a soft-deleted row', async () => {
    const created = taskChecklistItemFixture({ id: 'item-created', title: 'Created' });
    const deleted = taskChecklistItemFixture({
      ...created,
      disposition: 'deleted',
      deleted_at: '2026-08-06T23:01:00.000Z',
    });
    const entry: TaskActionJournalEntry = {
      id: 'journal-create-item',
      owner_id: 'owner-a',
      sequence: 1,
      action_id: 'action-create-item',
      occurred_at: created.updated_at,
      expires_at: '2026-08-06T23:30:00.000Z',
      state: 'undone',
      snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
      changes: [{
        entityType: 'checklist_item',
        entityId: created.id,
        before: null,
        after: {
          task_id: created.task_id,
          title: created.title,
          completed: created.completed,
          completed_at: created.completed_at,
          order_key: created.order_key,
        },
      }],
    };
    getOptional.mockResolvedValue(deleted);
    mocks.next.mockResolvedValue(entry);
    request.mockResolvedValue({ id: 'restore-operation', affectedIds: [created.id] });
    const { result } = renderHook(() => useTaskActionHistory('owner-a'));

    await act(async () => {
      await result.current.redoWhenAvailable();
    });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-a',
      rootType: 'checklist_item',
      rootId: created.id,
      operation: 'restore',
      descendantPolicy: 'reject',
    }));
    expect(mocks.mark).toHaveBeenCalledWith(entry, 'redo');
  });
});
