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
  TASK_HISTORY_LIMIT,
  useTaskUndo,
} from './useTaskUndo';

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
    const repository = {
      undoTask: vi.fn().mockResolvedValue(taskTodoFixture({ title: 'Title 0' })),
      redoTask: vi.fn().mockResolvedValue(taskTodoFixture({ title: 'Title 1' })),
    };
    mocks.useQuery.mockReturnValue({ data: [event], isLoading: false, error: null });
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
      expect(latest.redoAvailable).toBe(true);

      await act(async () => {
        await latest.redo();
      });
      expect(repository.redoTask).toHaveBeenCalledWith('owner-a', event.id);
      expect(latest.available).toBe(true);
      expect(latest.redoAvailable).toBe(false);
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
});
