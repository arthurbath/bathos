import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  snapshotTask,
  type TaskHistoryStorageRow,
} from '@/modules/tasks/domain/taskHistory';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import { useTaskUndo } from './useTaskUndo';

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

describe('useTaskUndo', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.useTasksRuntime.mockReset();
  });

  it('exposes and applies the latest authoritative event at the task current revision', async () => {
    const before = taskTodoFixture({ title: 'Original title', revision: 1 });
    const current = taskTodoFixture({
      title: 'Revised title',
      revision: 2,
      client_mutation_id: 'mutation-revised',
    });
    const event: TaskHistoryStorageRow = {
      id: 'event-update',
      owner_id: 'owner-a',
      task_id: 'task-a',
      client_mutation_id: 'mutation-revised',
      actor_type: 'user',
      mutation_channel: 'web',
      affected_ids: JSON.stringify(['task-a']),
      base_revision: 1,
      result_revision: 2,
      transition: 'update',
      occurred_at: '2026-07-20T04:01:00.000Z',
      outcome: 'accepted',
      code: null,
      before_state: JSON.stringify(snapshotTask(before)),
      after_state: JSON.stringify(snapshotTask(current)),
    };
    let resolveUndo!: (task: typeof before) => void;
    const undoResult = new Promise<typeof before>((resolve) => {
      resolveUndo = resolve;
    });
    const repository = {
      undoTask: vi.fn().mockReturnValue(undoResult),
    };
    mocks.useQuery.mockReturnValue({ data: [event], isLoading: false, error: null });
    mocks.useTasksRuntime.mockReturnValue({ repository });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.available).toBe(true);
      expect(latest.event?.id).toBe('event-update');
      expect(mocks.useQuery).toHaveBeenCalledWith(
        expect.stringContaining('event.result_revision = task.revision'),
        ['owner-a'],
      );
      expect(mocks.useQuery.mock.calls[0][0]).toContain(
        "event.transition NOT IN ('baseline', 'create', 'undo')",
      );

      let undoPromise!: Promise<typeof before>;
      act(() => {
        undoPromise = latest.undo();
      });
      expect(repository.undoTask).toHaveBeenCalledWith('owner-a', 'event-update');
      expect(latest.pending).toBe(true);
      await expect(latest.undo()).rejects.toThrow(
        'There is no current task change available to undo',
      );
      expect(repository.undoTask).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveUndo(before);
        await undoPromise;
      });
      expect(latest.pending).toBe(false);
    } finally {
      cleanup(root, container);
    }
  });

  it('does not expose undo without a current accepted history event', async () => {
    mocks.useQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    mocks.useTasksRuntime.mockReturnValue({ repository: { undoTask: vi.fn() } });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.available).toBe(false);
      await expect(latest.undo()).rejects.toThrow(
        'There is no current task change available to undo',
      );
    } finally {
      cleanup(root, container);
    }
  });
});
