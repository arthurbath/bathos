import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parseTaskHistoryEvent,
  snapshotTask,
  type TaskHistoryStorageRow,
} from '@/modules/tasks/domain/taskHistory';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import {
  replayTaskHistory,
  taskHistoryMovementIsSafe,
  TASK_HISTORY_LIMIT,
  useTaskUndo,
} from './useTaskUndo';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useTasksRuntime: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

let latest: ReturnType<typeof useTaskUndo>;

function Harness() {
  latest = useTaskUndo('owner-a');
  return null;
}

function renderHookHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Harness />));
  return { container, root };
}

function rerender(root: Root) {
  act(() => root.render(<Harness />));
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

function historyRow(
  index: number,
  overrides: Partial<TaskHistoryStorageRow> = {},
): TaskHistoryStorageRow {
  const before = taskTodoFixture({ title: `Title ${index}`, revision: index + 1 });
  const after = taskTodoFixture({ title: `Title ${index + 1}`, revision: index + 2 });
  return {
    id: `event-${String(index).padStart(3, '0')}`,
    owner_id: 'owner-a',
    task_id: 'task-a',
    client_mutation_id: `mutation-${index}`,
    actor_type: 'user',
    mutation_channel: 'web',
    affected_ids: JSON.stringify(['task-a']),
    base_revision: index + 1,
    result_revision: index + 2,
    transition: 'update',
    occurred_at: new Date(Date.UTC(2026, 6, 20, 4) + index * 60_000).toISOString(),
    outcome: 'accepted',
    code: null,
    before_state: JSON.stringify(snapshotTask(before)),
    after_state: JSON.stringify(snapshotTask(after)),
    ...overrides,
  };
}

describe('useTaskUndo', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.useTasksRuntime.mockReset();
  });

  it('applies undo and redo optimistically from the authoritative source event', async () => {
    const event = historyRow(0);
    const historyData = [event];
    let taskData = [taskTodoFixture({ title: 'Title 1' })];
    const repository = {
      undoTask: vi.fn().mockResolvedValue(taskTodoFixture({ title: 'Title 0' })),
      redoTask: vi.fn().mockResolvedValue(taskTodoFixture({ title: 'Title 1' })),
    };
    mocks.useQuery.mockImplementation((sql: string) => ({
      data: sql.includes('tasks_history_events') ? historyData : taskData,
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({ repository });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.available).toBe(true);
      expect(latest.redoAvailable).toBe(false);
      expect(latest.undoDepth).toBe(1);
      expect(mocks.useQuery.mock.calls[0][0]).toContain('LIMIT 500');

      await act(async () => {
        await latest.undo();
      });
      expect(repository.undoTask).toHaveBeenCalledWith('owner-a', event.id);
      expect(latest.available).toBe(false);
      expect(latest.redoAvailable).toBe(false);

      taskData = [taskTodoFixture({ title: 'Title 0' })];
      rerender(root);
      expect(latest.redoAvailable).toBe(true);

      await act(async () => {
        await latest.redo();
      });
      expect(repository.redoTask).toHaveBeenCalledWith('owner-a', event.id);
      expect(latest.available).toBe(false);
      expect(latest.redoAvailable).toBe(false);

      taskData = [taskTodoFixture({ title: 'Title 1' })];
      rerender(root);
      expect(latest.available).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('reconstructs inverse direction and caps the visible cursor at 100 steps', () => {
    const rows = Array.from({ length: TASK_HISTORY_LIMIT + 5 }, (_, index) => historyRow(index));
    const forward = rows.map(parseTaskHistoryEvent);
    const source = forward.at(-1)!;
    const undo = parseTaskHistoryEvent(historyRow(200, {
      id: 'event-undo',
      transition: 'undo',
      task_id: source.task_id,
      before_state: JSON.stringify(source.after_state),
      after_state: JSON.stringify(source.before_state),
      occurred_at: '2026-07-21T00:00:00.000Z',
    }));
    const redo = parseTaskHistoryEvent(historyRow(201, {
      id: 'event-redo',
      transition: 'redo',
      task_id: source.task_id,
      before_state: JSON.stringify(source.before_state),
      after_state: JSON.stringify(source.after_state),
      occurred_at: '2026-07-21T00:01:00.000Z',
    }));

    const undone = replayTaskHistory([...forward, undo]);
    expect(undone.undo).toHaveLength(TASK_HISTORY_LIMIT - 1);
    expect(undone.redo.map(({ id }) => id)).toEqual([source.id]);

    const redone = replayTaskHistory([...forward, undo, redo]);
    expect(redone.undo).toHaveLength(TASK_HISTORY_LIMIT);
    expect(redone.undo.at(-1)?.id).toBe(source.id);
    expect(redone.redo).toHaveLength(0);

    const branchedForward = parseTaskHistoryEvent(historyRow(202, {
      id: 'event-branch',
      occurred_at: '2026-07-21T00:02:00.000Z',
    }));
    const branched = replayTaskHistory([...forward, undo, branchedForward]);
    expect(branched.redo).toHaveLength(0);
    expect(branched.undo.at(-1)?.id).toBe('event-branch');
  });

  it('treats same-operation task events as one atomic undo step', async () => {
    const first = historyRow(0, {
      task_id: 'task-a',
      operation_id: 'operation-bulk',
    });
    const second = historyRow(1, {
      task_id: 'task-b',
      operation_id: 'operation-bulk',
    });
    const historyData = [second, first];
    const taskData = [
      taskTodoFixture({ id: 'task-a', title: 'Title 1' }),
      taskTodoFixture({ id: 'task-b', title: 'Title 2' }),
    ];
    const repository = {
      undoTask: vi.fn(),
      redoTask: vi.fn(),
      undoTaskOperation: vi.fn().mockResolvedValue(taskData),
      redoTaskOperation: vi.fn().mockResolvedValue(taskData),
    };
    mocks.useQuery.mockImplementation((sql: string) => ({
      data: sql.includes('tasks_history_events') ? historyData : taskData,
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({ repository });
    const { container, root } = renderHookHarness();
    try {
      expect(latest.undoDepth).toBe(1);
      await act(async () => {
        await latest.undo();
      });
      expect(repository.undoTaskOperation).toHaveBeenCalledWith(
        'owner-a',
        [first.id, second.id],
      );
      expect(repository.undoTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('exposes task creation for recoverable undo and exact redo', async () => {
    const created = taskTodoFixture({ title: 'Pasted task' });
    const event = historyRow(0, {
      transition: 'create',
      before_state: null,
      after_state: JSON.stringify(snapshotTask(created)),
    });
    const historyData = [event];
    let taskData = [created];
    const repository = {
      undoTask: vi.fn().mockResolvedValue(taskTodoFixture({
        ...created,
        disposition: 'deleted',
        deleted_at: '2026-07-20T04:31:00.000Z',
        deletion_root_id: created.id,
      })),
      redoTask: vi.fn().mockResolvedValue(created),
    };
    mocks.useQuery.mockImplementation((sql: string) => ({
      data: sql.includes('tasks_history_events') ? historyData : taskData,
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({ repository });
    const { container, root } = renderHookHarness();
    try {
      expect(latest.available).toBe(true);
      await act(async () => {
        await latest.undo();
      });
      expect(repository.undoTask).toHaveBeenCalledWith('owner-a', event.id);

      taskData = [taskTodoFixture({
        ...created,
        disposition: 'deleted',
        deleted_at: '2026-07-20T04:31:00.000Z',
        deletion_root_id: created.id,
      })];
      rerender(root);
      expect(latest.redoAvailable).toBe(true);
      await act(async () => {
        await latest.redo();
      });
      expect(repository.redoTask).toHaveBeenCalledWith('owner-a', event.id);
    } finally {
      cleanup(root, container);
    }
  });

  it('does not expose history movement without a supported source event', async () => {
    mocks.useQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    mocks.useTasksRuntime.mockReturnValue({
      repository: { undoTask: vi.fn(), redoTask: vi.fn() },
    });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.available).toBe(false);
      expect(latest.redoAvailable).toBe(false);
      await expect(latest.undo()).rejects.toThrow('no current task change');
      await expect(latest.redo()).rejects.toThrow('no current task change');
    } finally {
      cleanup(root, container);
    }
  });

  it('rebuilds the cursor when older history arrives after a newer event', () => {
    const older = historyRow(0);
    const newer = historyRow(1);
    let historyData = [newer];
    const taskData = [taskTodoFixture({ title: 'Title 2' })];
    mocks.useQuery.mockImplementation((sql: string) => ({
      data: sql.includes('tasks_history_events') ? historyData : taskData,
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({
      repository: { undoTask: vi.fn(), redoTask: vi.fn() },
    });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.event?.id).toBe(newer.id);
      expect(latest.undoDepth).toBe(1);
      historyData = [newer, older];
      rerender(root);
      expect(latest.event?.id).toBe(newer.id);
      expect(latest.undoDepth).toBe(2);
      expect(latest.available).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('withholds the latest movement during projection skew without skipping it', () => {
    const older = historyRow(0);
    const newer = historyRow(1);
    let taskData = [taskTodoFixture({ title: 'Title 1' })];
    mocks.useQuery.mockImplementation((sql: string) => ({
      data: sql.includes('tasks_history_events') ? [newer, older] : taskData,
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({
      repository: { undoTask: vi.fn(), redoTask: vi.fn() },
    });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.event?.id).toBe(newer.id);
      expect(latest.available).toBe(false);
      expect(taskHistoryMovementIsSafe(
        taskTodoFixture({ title: 'Title 1' }),
        parseTaskHistoryEvent(newer),
        'undo',
      )).toBe(false);

      taskData = [taskTodoFixture({ title: 'Title 2' })];
      rerender(root);
      expect(latest.event?.id).toBe(newer.id);
      expect(latest.available).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('anchors completion undo before the forward write returns', async () => {
    const older = historyRow(0);
    const beforeCompletion = taskTodoFixture({
      title: 'Title 1',
      revision: 2,
      client_mutation_id: 'mutation-0',
    });
    const completedTask = taskTodoFixture({
      ...beforeCompletion,
      lifecycle: 'completed',
      completed_at: '2026-07-20T05:00:00.000Z',
      revision: 3,
      client_mutation_id: 'mutation-complete',
      updated_at: '2026-07-20T05:00:00.000Z',
    });
    const completionEvent = historyRow(1, {
      id: 'event-complete',
      client_mutation_id: completedTask.client_mutation_id,
      base_revision: 2,
      result_revision: 3,
      transition: 'complete',
      occurred_at: completedTask.updated_at,
      before_state: JSON.stringify(snapshotTask(beforeCompletion)),
      after_state: JSON.stringify({
        ...snapshotTask(completedTask),
        completed_at: '2026-07-20T05:00:00.000+00:00',
      }),
    });
    const reopenedTask = taskTodoFixture({
      ...beforeCompletion,
      revision: 4,
      client_mutation_id: 'mutation-undo',
    });
    let historyData = [older];
    let taskData = [beforeCompletion];
    const repository = {
      undoTask: vi.fn().mockResolvedValue(reopenedTask),
      redoTask: vi.fn(),
    };
    mocks.useQuery.mockImplementation((sql: string) => ({
      data: sql.includes('tasks_history_events') ? historyData : taskData,
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({ repository });
    const { container, root } = renderHookHarness();

    try {
      let reservation!: ReturnType<typeof latest.reserveForwardMutation>;
      act(() => {
        reservation = latest.reserveForwardMutation(beforeCompletion);
      });

      let undoPromise!: Promise<TaskTodo | null>;
      act(() => {
        undoPromise = latest.undoWhenAvailable(500);
      });
      expect(repository.undoTask).not.toHaveBeenCalled();

      act(() => {
        reservation.commit(completedTask);
      });
      expect(repository.undoTask).not.toHaveBeenCalled();

      historyData = [completionEvent, older];
      taskData = [completedTask];
      rerender(root);

      await act(async () => {
        await expect(undoPromise).resolves.toEqual(reopenedTask);
      });
      expect(repository.undoTask).toHaveBeenCalledOnce();
      expect(repository.undoTask).toHaveBeenCalledWith('owner-a', completionEvent.id);
    } finally {
      cleanup(root, container);
    }
  });

  it('cancels a failed forward reservation without undoing older history', async () => {
    const older = historyRow(0);
    const taskData = [taskTodoFixture({ title: 'Title 1' })];
    const repository = {
      undoTask: vi.fn(),
      redoTask: vi.fn(),
    };
    mocks.useQuery.mockImplementation((sql: string) => ({
      data: sql.includes('tasks_history_events') ? [older] : taskData,
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({ repository });
    const { container, root } = renderHookHarness();

    try {
      let reservation!: ReturnType<typeof latest.reserveForwardMutation>;
      act(() => {
        reservation = latest.reserveForwardMutation(taskData[0]);
      });
      let undoPromise!: Promise<TaskTodo | null>;
      act(() => {
        undoPromise = latest.undoWhenAvailable(500);
      });
      act(() => {
        reservation.cancel();
      });

      await act(async () => {
        await expect(undoPromise).resolves.toBeNull();
      });
      expect(repository.undoTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('retains an immediate completion undo until the exact history event projects', async () => {
    const older = historyRow(0);
    const beforeCompletion = taskTodoFixture({
      title: 'Title 1',
      revision: 2,
      client_mutation_id: 'mutation-0',
    });
    const completedTask = taskTodoFixture({
      ...beforeCompletion,
      lifecycle: 'completed',
      completed_at: '2026-07-20T05:00:00.000Z',
      revision: 3,
      client_mutation_id: 'mutation-complete',
      updated_at: '2026-07-20T05:00:00.000Z',
    });
    const completionEvent = historyRow(1, {
      id: 'event-complete',
      client_mutation_id: completedTask.client_mutation_id,
      base_revision: 2,
      result_revision: 3,
      transition: 'complete',
      occurred_at: completedTask.updated_at,
      before_state: JSON.stringify(snapshotTask(beforeCompletion)),
      after_state: JSON.stringify(snapshotTask(completedTask)),
    });
    const reopenedTask = taskTodoFixture({
      ...beforeCompletion,
      revision: 4,
      client_mutation_id: 'mutation-undo',
    });
    let historyData = [older];
    let taskData = [beforeCompletion];
    const repository = {
      undoTask: vi.fn().mockResolvedValue(reopenedTask),
      redoTask: vi.fn(),
    };
    mocks.useQuery.mockImplementation((sql: string) => ({
      data: sql.includes('tasks_history_events') ? historyData : taskData,
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({ repository });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.available).toBe(true);
      act(() => {
        latest.registerForwardMutation(completedTask);
      });
      expect(latest.available).toBe(false);

      let undoPromise!: Promise<TaskTodo | null>;
      act(() => {
        undoPromise = latest.undoWhenAvailable(500);
      });

      historyData = [completionEvent, older];
      taskData = [completedTask];
      rerender(root);

      let undone: TaskTodo | null = null;
      await act(async () => {
        undone = await undoPromise;
      });
      expect(undone).toEqual(reopenedTask);
      expect(repository.undoTask).toHaveBeenCalledTimes(1);
      expect(repository.undoTask).toHaveBeenCalledWith('owner-a', completionEvent.id);
    } finally {
      cleanup(root, container);
    }
  });

  it('does not substitute an older or unrelated event while a completion is unprojected', async () => {
    const older = historyRow(0);
    const completedTask = taskTodoFixture({
      title: 'Completed task',
      lifecycle: 'completed',
      completed_at: '2026-07-20T05:00:00.000Z',
      revision: 2,
      client_mutation_id: 'mutation-complete',
      updated_at: '2026-07-20T05:00:00.000Z',
    });
    let historyData = [older];
    const repository = {
      undoTask: vi.fn(),
      redoTask: vi.fn(),
    };
    mocks.useQuery.mockImplementation((sql: string) => ({
      data: sql.includes('tasks_history_events') ? historyData : [completedTask],
      isLoading: false,
      error: null,
    }));
    mocks.useTasksRuntime.mockReturnValue({ repository });
    const { container, root } = renderHookHarness();

    try {
      act(() => {
        latest.registerForwardMutation(completedTask);
      });

      const unrelated = historyRow(2, {
        id: 'event-unrelated',
        task_id: 'task-other',
        client_mutation_id: 'mutation-unrelated',
      });
      historyData = [unrelated, older];
      rerender(root);

      let result: TaskTodo | null = completedTask;
      await act(async () => {
        result = await latest.undoWhenAvailable(40);
      });
      expect(result).toBeNull();
      expect(repository.undoTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });
});
