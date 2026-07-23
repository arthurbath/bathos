import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { taskChecklistItemFixture, taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskChecklistItem, TaskTodo } from '@/modules/tasks/types/tasks';
import { useTaskProjectDetail } from './useTaskProjectDetail';

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

const alpha = projectTask('task-alpha', 'Alpha', 'a0');
const beta = projectTask('task-beta', 'Beta', 'a1');
const gamma = projectTask('task-gamma', 'Gamma', 'a2');
const item = checklistItem('item-a', false);
let taskRows: TaskTodo[];
let checklistRows: TaskChecklistItem[];
let latest: ReturnType<typeof useTaskProjectDetail>;

function Harness() {
  latest = useTaskProjectDetail('owner-a', 'project-a');
  return null;
}

function renderHarness() {
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

describe('useTaskProjectDetail', () => {
  beforeEach(() => {
    taskRows = [beta, gamma, alpha];
    checklistRows = [item];
    mocks.useQuery.mockReset().mockImplementation((query: string) => ({
      data: query.includes('FROM tasks_todos') ? taskRows : checklistRows,
      isLoading: false,
      error: null,
    }));
  });

  it('creates project work at the structural tail without changing its planning pool', async () => {
    const created = projectTask('task-created', 'Created', 'a3');
    const repository = {
      createTask: vi.fn().mockResolvedValue(created),
      updateTask: vi.fn(),
      moveTaskToContainer: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      repository,
      hierarchyRepository: hierarchyRepository(),
    });
    const { container, root } = renderHarness();

    try {
      await act(async () => {
        await latest.createTask('Created');
      });
      expect(repository.createTask).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: 'owner-a',
        title: 'Created',
        destination: 'anytime',
        projectId: 'project-a',
        hierarchyOrderKey: expect.any(String),
      }));
      const input = repository.createTask.mock.calls[0][0];
      expect(input.hierarchyOrderKey > gamma.hierarchy_order_key!).toBe(true);
      expect(latest.tasks.map(({ id }) => id)).toContain(created.id);
    } finally {
      cleanup(root, container);
    }
  });

  it('reorders only the task hierarchy key', async () => {
    const repository = {
      createTask: vi.fn(),
      moveTaskToContainer: vi.fn(),
      updateTask: vi.fn().mockImplementation(
        async (_ownerId: string, taskId: string, patch: Partial<TaskTodo>) => ({
          ...taskRows.find(({ id }) => id === taskId)!,
          ...patch,
          revision: 2,
          client_mutation_id: `${taskId}-reordered`,
        }),
      ),
    };
    mocks.useTasksRuntime.mockReturnValue({
      repository,
      hierarchyRepository: hierarchyRepository(),
    });
    const { container, root } = renderHarness();

    try {
      await act(async () => {
        await latest.reorderTask(beta.id, 'up');
      });
      expect(repository.updateTask).toHaveBeenCalledWith(
        'owner-a',
        beta.id,
        { hierarchy_order_key: expect.any(String) },
      );
      const patch = repository.updateTask.mock.calls[0][2];
      expect(patch.hierarchy_order_key < alpha.hierarchy_order_key!).toBe(true);
      expect(patch).not.toHaveProperty('order_key');
      expect(patch).not.toHaveProperty('destination');
    } finally {
      cleanup(root, container);
    }
  });

  it('shows checklist completion immediately while its save is pending', async () => {
    const pending = deferred<TaskChecklistItem>();
    const hierarchy = hierarchyRepository();
    hierarchy.completeChecklistItem.mockReturnValue(pending.promise);
    mocks.useTasksRuntime.mockReturnValue({
      repository: {
        createTask: vi.fn(),
        updateTask: vi.fn(),
        moveTaskToContainer: vi.fn(),
      },
      hierarchyRepository: hierarchy,
    });
    const { container, root } = renderHarness();

    try {
      let promise!: Promise<TaskChecklistItem>;
      act(() => {
        promise = latest.completeChecklistItem(item.id, true);
      });
      expect(latest.checklistItems[0].completed).toBe(true);

      await act(async () => {
        pending.resolve({ ...item, completed: true, completed_at: '2026-07-20T05:00:00.000Z' });
        await promise;
      });
      expect(latest.checklistItems[0].completed).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('removes a checklist item immediately through the recoverable hierarchy path', async () => {
    const pending = deferred<{ id: string; affectedIds: string[] }>();
    const hierarchyOperationsRepository = {
      request: vi.fn().mockReturnValue(pending.promise),
    };
    mocks.useTasksRuntime.mockReturnValue({
      repository: {
        createTask: vi.fn(),
        updateTask: vi.fn(),
        moveTaskToContainer: vi.fn(),
      },
      hierarchyRepository: hierarchyRepository(),
      hierarchyOperationsRepository,
    });
    const { container, root } = renderHarness();

    try {
      let promise!: Promise<{ id: string; affectedIds: string[] }>;
      act(() => {
        promise = latest.deleteChecklistItem(item.id);
      });
      expect(latest.checklistItems).toEqual([]);
      expect(hierarchyOperationsRepository.request).toHaveBeenCalledWith({
        ownerId: 'owner-a',
        rootType: 'checklist_item',
        rootId: item.id,
        operation: 'delete',
        descendantPolicy: 'cascade',
      });

      await act(async () => {
        pending.resolve({ id: 'operation-a', affectedIds: [item.id] });
        await promise;
      });
      expect(latest.checklistItems).toEqual([]);
    } finally {
      cleanup(root, container);
    }
  });

  it('restores an optimistically removed checklist item when deletion fails', async () => {
    const hierarchyOperationsRepository = {
      request: vi.fn().mockRejectedValue(new Error('offline write failed')),
    };
    mocks.useTasksRuntime.mockReturnValue({
      repository: {
        createTask: vi.fn(),
        updateTask: vi.fn(),
        moveTaskToContainer: vi.fn(),
      },
      hierarchyRepository: hierarchyRepository(),
      hierarchyOperationsRepository,
    });
    const { container, root } = renderHarness();

    try {
      await expect(act(async () => {
        await latest.deleteChecklistItem(item.id);
      })).rejects.toThrow('offline write failed');
      expect(latest.checklistItems).toEqual([item]);
    } finally {
      cleanup(root, container);
    }
  });

  it('normalizes SQLite checklist booleans for React controls', () => {
    checklistRows = [{ ...item, completed: 0 as unknown as boolean }];
    mocks.useTasksRuntime.mockReturnValue({
      repository: {
        createTask: vi.fn(),
        updateTask: vi.fn(),
        moveTaskToContainer: vi.fn(),
      },
      hierarchyRepository: hierarchyRepository(),
    });
    const { container, root } = renderHarness();

    try {
      expect(latest.checklistItems[0].completed).toBe(false);
    } finally {
      cleanup(root, container);
    }
  });
});

function hierarchyRepository() {
  return {
    createChecklistItem: vi.fn(),
    updateChecklistItem: vi.fn(),
    completeChecklistItem: vi.fn(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function projectTask(
  id: string,
  title: string,
  hierarchyOrderKey: string,
): TaskTodo {
  return taskTodoFixture({
    id,
    project_id: 'project-a',
    title,
    destination: 'anytime',
    order_key: `planning-${id}`,
    hierarchy_order_key: hierarchyOrderKey,
    client_mutation_id: `${id}-mutation`,
  });
}

function checklistItem(id: string, completed: boolean): TaskChecklistItem {
  return taskChecklistItemFixture({
    id,
    task_id: 'task-alpha',
    title: 'Step one',
    completed,
    client_mutation_id: `${id}-mutation`,
  });
}
