import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const alpha = projectTask('task-alpha', 'Alpha', null, 'a0');
const beta = projectTask('task-beta', 'Beta', null, 'a1');
const headed = projectTask('task-headed', 'Headed', 'heading-a', 'a0');
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
    taskRows = [beta, headed, alpha];
    checklistRows = [item];
    mocks.useQuery.mockReset().mockImplementation((query: string) => ({
      data: query.includes('FROM tasks_todos') ? taskRows : checklistRows,
      isLoading: false,
      error: null,
    }));
  });

  it('creates project work at the structural tail without changing its planning pool', async () => {
    const created = projectTask('task-created', 'Created', null, 'a2');
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
        await latest.createTask('Created', null);
      });
      expect(repository.createTask).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: 'owner-a',
        title: 'Created',
        destination: 'anytime',
        projectId: 'project-a',
        headingId: null,
        hierarchyOrderKey: expect.any(String),
      }));
      const input = repository.createTask.mock.calls[0][0];
      expect(input.hierarchyOrderKey > beta.hierarchy_order_key!).toBe(true);
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

  it('moves a task to the tail of one heading without planning changes', async () => {
    const moved = { ...alpha, heading_id: 'heading-a', hierarchy_order_key: 'a1' };
    const repository = {
      createTask: vi.fn(),
      updateTask: vi.fn(),
      moveTaskToContainer: vi.fn().mockResolvedValue(moved),
    };
    mocks.useTasksRuntime.mockReturnValue({
      repository,
      hierarchyRepository: hierarchyRepository(),
    });
    const { container, root } = renderHarness();

    try {
      await act(async () => {
        await latest.moveTaskToHeading(alpha.id, 'heading-a');
      });
      expect(repository.moveTaskToContainer).toHaveBeenCalledWith(
        'owner-a',
        alpha.id,
        {
          projectId: 'project-a',
          headingId: 'heading-a',
          hierarchyOrderKey: expect.any(String),
        },
      );
      const input = repository.moveTaskToContainer.mock.calls[0][2];
      expect(input.hierarchyOrderKey > headed.hierarchy_order_key!).toBe(true);
      expect(input).not.toHaveProperty('destination');
      expect(input).not.toHaveProperty('orderKey');
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
  headingId: string | null,
  hierarchyOrderKey: string,
): TaskTodo {
  return {
    id,
    owner_id: 'owner-a',
    area_id: null,
    project_id: 'project-a',
    heading_id: headingId,
    title,
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    destination: 'anytime',
    today_section: 'daytime',
    order_key: `planning-${id}`,
    hierarchy_order_key: hierarchyOrderKey,
    start_date: null,
    deadline: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    undo_source_event_id: null,
    source_kind: null,
    source_url: null,
    source_title: null,
    source_external_id: null,
    revision: 1,
    client_mutation_id: `${id}-mutation`,
    created_at: '2026-07-20T04:00:00.000Z',
    updated_at: '2026-07-20T04:00:00.000Z',
  };
}

function checklistItem(id: string, completed: boolean): TaskChecklistItem {
  return {
    id,
    owner_id: 'owner-a',
    task_id: 'task-alpha',
    title: 'Step one',
    completed,
    completed_at: null,
    order_key: 'a0',
    disposition: 'present',
    deleted_at: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: `${id}-mutation`,
    created_at: '2026-07-20T04:00:00.000Z',
    updated_at: '2026-07-20T04:00:00.000Z',
  };
}
