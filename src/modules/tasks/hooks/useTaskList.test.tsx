import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { getTodayTaskSection, useTaskList, type TaskListView } from './useTaskList';

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

const originalTask: TaskTodo = {
  id: 'task-a',
  owner_id: 'owner-a',
  title: 'Original title',
  notes: '',
  lifecycle: 'open',
  completed_at: null,
  canceled_at: null,
  disposition: 'present',
  deleted_at: null,
  destination: 'today',
  today_section: 'daytime',
  order_key: 'a0',
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
  client_mutation_id: 'mutation-a',
  created_at: '2026-07-20T04:00:00.000Z',
  updated_at: '2026-07-20T04:00:00.000Z',
};

let latest: ReturnType<typeof useTaskList>;
let queryData: TaskTodo[];
let harnessView: TaskListView;

function Harness() {
  latest = useTaskList('owner-a', harnessView);
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useTaskList optimistic display', () => {
  beforeEach(() => {
    harnessView = 'today';
    queryData = [originalTask];
    mocks.useQuery.mockReset().mockImplementation(() => ({
      data: queryData,
      isLoading: false,
      error: null,
    }));
  });

  it('keeps a committed edit visible until the reactive query catches up', async () => {
    const pendingUpdate = deferred<TaskTodo>();
    const repository = {
      createTask: vi.fn(),
      updateTask: vi.fn().mockReturnValue(pendingUpdate.promise),
      transitionTask: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    const { container, root } = renderHookHarness();

    try {
      let updatePromise!: Promise<TaskTodo>;
      act(() => {
        updatePromise = latest.updateTask('task-a', { title: 'Revised title' });
      });
      expect(latest.tasks[0].title).toBe('Revised title');

      rerender(root);
      expect(latest.tasks[0].title).toBe('Revised title');

      const savedTask = {
        ...originalTask,
        title: 'Revised title',
        revision: 2,
        client_mutation_id: 'mutation-b',
        updated_at: '2026-07-20T04:01:00.000Z',
      };
      await act(async () => {
        pendingUpdate.resolve(savedTask);
        await updatePromise;
      });
      expect(latest.tasks[0]).toEqual(savedTask);

      queryData = [originalTask];
      rerender(root);
      expect(latest.tasks[0]).toEqual(savedTask);

      queryData = [savedTask];
      rerender(root);
      expect(latest.tasks[0]).toEqual(savedTask);
    } finally {
      cleanup(root, container);
    }
  });

  it('removes a completed task immediately and restores it when the write fails', async () => {
    const pendingCompletion = deferred<TaskTodo>();
    const repository = {
      createTask: vi.fn(),
      updateTask: vi.fn(),
      transitionTask: vi.fn().mockReturnValue(pendingCompletion.promise),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    const { container, root } = renderHookHarness();

    try {
      let completionPromise!: Promise<TaskTodo>;
      act(() => {
        completionPromise = latest.transitionTask('task-a', 'complete');
      });
      expect(latest.tasks).toEqual([]);

      await act(async () => {
        pendingCompletion.reject(new Error('write failed'));
        await expect(completionPromise).rejects.toThrow('write failed');
      });
      expect(latest.tasks).toEqual([originalTask]);
    } finally {
      cleanup(root, container);
    }
  });

  it('orders deleted tasks newest first and removes a restored task immediately', async () => {
    harnessView = 'trash';
    const olderDeletedTask = {
      ...originalTask,
      id: 'task-older',
      disposition: 'deleted' as const,
      deleted_at: '2026-07-20T04:01:00.000Z',
    };
    const newerDeletedTask = {
      ...originalTask,
      id: 'task-newer',
      disposition: 'deleted' as const,
      deleted_at: '2026-07-20T04:02:00.000Z',
    };
    queryData = [olderDeletedTask, newerDeletedTask];
    const pendingRestore = deferred<TaskTodo>();
    const repository = {
      createTask: vi.fn(),
      updateTask: vi.fn(),
      transitionTask: vi.fn().mockReturnValue(pendingRestore.promise),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.tasks.map((task) => task.id)).toEqual(['task-newer', 'task-older']);

      let restorePromise!: Promise<TaskTodo>;
      act(() => {
        restorePromise = latest.transitionTask('task-newer', 'restore');
      });
      expect(latest.tasks.map((task) => task.id)).toEqual(['task-older']);

      const restoredTask = {
        ...newerDeletedTask,
        disposition: 'present' as const,
        deleted_at: null,
        revision: 2,
        client_mutation_id: 'mutation-restored',
      };
      await act(async () => {
        pendingRestore.resolve(restoredTask);
        await restorePromise;
      });
      expect(latest.tasks.map((task) => task.id)).toEqual(['task-older']);
    } finally {
      cleanup(root, container);
    }
  });

  it('orders Logbook by terminal time and removes a reopened task immediately', async () => {
    harnessView = 'logbook';
    const olderCompletedTask = {
      ...originalTask,
      id: 'task-completed',
      lifecycle: 'completed' as const,
      completed_at: '2026-07-20T04:01:00.000Z',
    };
    const newerCanceledTask = {
      ...originalTask,
      id: 'task-canceled',
      lifecycle: 'canceled' as const,
      canceled_at: '2026-07-20T04:02:00.000Z',
    };
    queryData = [olderCompletedTask, newerCanceledTask];
    const pendingReopen = deferred<TaskTodo>();
    const repository = {
      createTask: vi.fn(),
      updateTask: vi.fn(),
      transitionTask: vi.fn().mockReturnValue(pendingReopen.promise),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.tasks.map((task) => task.id)).toEqual(['task-canceled', 'task-completed']);
      expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toContain(
        "lifecycle IN ('completed', 'canceled')",
      );

      let reopenPromise!: Promise<TaskTodo>;
      act(() => {
        reopenPromise = latest.transitionTask('task-canceled', 'reopen');
      });
      expect(latest.tasks.map((task) => task.id)).toEqual(['task-completed']);

      const reopenedTask = {
        ...newerCanceledTask,
        lifecycle: 'open' as const,
        canceled_at: null,
        revision: 2,
        client_mutation_id: 'mutation-reopened',
      };
      await act(async () => {
        pendingReopen.resolve(reopenedTask);
        await reopenPromise;
      });
      expect(latest.tasks.map((task) => task.id)).toEqual(['task-completed']);
    } finally {
      cleanup(root, container);
    }
  });

  it('derives Upcoming and Today availability from the same planning date', () => {
    const futureTask = {
      ...originalTask,
      id: 'task-future',
      start_date: '2099-01-02',
    };
    const laterTask = {
      ...originalTask,
      id: 'task-later',
      start_date: '2099-01-03',
    };
    queryData = [laterTask, futureTask];
    const repository = {
      createTask: vi.fn(),
      updateTask: vi.fn(),
      transitionTask: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    harnessView = 'upcoming';
    const { container, root } = renderHookHarness();

    try {
      expect(latest.tasks.map((task) => task.id)).toEqual(['task-future', 'task-later']);
      expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toContain('start_date > ?');
      expect(mocks.useQuery.mock.calls.at(-1)?.[1]).toEqual(['owner-a', latest.planningDate]);

      harnessView = 'today';
      rerender(root);
      expect(latest.tasks).toEqual([]);
      expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toContain('start_date <= ?');
    } finally {
      cleanup(root, container);
    }
  });

  it('assigns the canonical planning date when capturing directly into Today', async () => {
    const repository = {
      createTask: vi.fn().mockResolvedValue(originalTask),
      updateTask: vi.fn(),
      moveTask: vi.fn(),
      transitionTask: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    const { container, root } = renderHookHarness();

    try {
      await act(async () => {
        await latest.createTask('Today capture');
      });
      expect(repository.createTask).toHaveBeenCalledWith({
        ownerId: 'owner-a',
        title: 'Today capture',
        destination: 'today',
        startDate: latest.planningDate,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('captures directly into Inbox without scheduling the task', async () => {
    harnessView = 'inbox';
    const repository = {
      createTask: vi.fn().mockResolvedValue({ ...originalTask, destination: 'inbox' }),
      updateTask: vi.fn(),
      moveTask: vi.fn(),
      transitionTask: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    const { container, root } = renderHookHarness();

    try {
      await act(async () => {
        await latest.createTask('Inbox capture');
      });
      expect(repository.createTask).toHaveBeenCalledWith({
        ownerId: 'owner-a',
        title: 'Inbox capture',
        destination: 'inbox',
        startDate: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps future Anytime work in Upcoming while supporting direct Anytime capture', async () => {
    harnessView = 'anytime';
    const availableTask = {
      ...originalTask,
      destination: 'anytime' as const,
      start_date: null,
    };
    const futureTask = {
      ...availableTask,
      id: 'task-future',
      start_date: '2099-01-02',
    };
    queryData = [futureTask, availableTask];
    const repository = {
      createTask: vi.fn().mockResolvedValue({
        ...availableTask,
        id: 'task-created',
        title: 'Anytime capture',
      }),
      updateTask: vi.fn(),
      moveTask: vi.fn(),
      transitionTask: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.tasks.map((item) => item.id)).toEqual(['task-a']);
      expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toContain(
        "? NOT IN ('today', 'anytime')",
      );

      await act(async () => {
        await latest.createTask('Anytime capture');
      });
      expect(repository.createTask).toHaveBeenCalledWith({
        ownerId: 'owner-a',
        title: 'Anytime capture',
        destination: 'anytime',
        startDate: null,
      });

      harnessView = 'upcoming';
      queryData = [futureTask];
      rerender(root);
      expect(latest.tasks.map((item) => item.id)).toEqual(['task-future']);
      expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toContain(
        "destination IN ('today', 'anytime')",
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('removes a Someday task immediately when assigning a start date activates it', async () => {
    harnessView = 'someday';
    const somedayTask = { ...originalTask, destination: 'someday' as const };
    queryData = [somedayTask];
    const activatedTask = {
      ...somedayTask,
      destination: 'anytime' as const,
      start_date: '2099-01-02',
      revision: 2,
      client_mutation_id: 'mutation-activated',
    };
    const repository = {
      createTask: vi.fn(),
      updateTask: vi.fn().mockResolvedValue(activatedTask),
      moveTask: vi.fn(),
      transitionTask: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    const { container, root } = renderHookHarness();

    try {
      let updatePromise!: Promise<TaskTodo>;
      act(() => {
        updatePromise = latest.updateTask('task-a', {
          destination: 'anytime',
          today_section: 'daytime',
          start_date: '2099-01-02',
        });
      });
      expect(latest.tasks).toEqual([]);
      await act(async () => {
        await updatePromise;
      });
      expect(latest.tasks).toEqual([]);
    } finally {
      cleanup(root, container);
    }
  });

  it('groups unfinished, daytime, and evening work while reordering only within a section', async () => {
    const unfinished = {
      ...originalTask,
      id: 'task-unfinished',
      start_date: '2000-01-01',
      order_key: 'a0',
    };
    const daytimeFirst = {
      ...originalTask,
      id: 'task-day-first',
      start_date: null,
      order_key: 'a0',
    };
    const daytimeSecond = {
      ...originalTask,
      id: 'task-day-second',
      start_date: null,
      order_key: 'a1',
    };
    const evening = {
      ...originalTask,
      id: 'task-evening',
      today_section: 'evening' as const,
      start_date: null,
      order_key: 'a0',
    };
    queryData = [evening, daytimeSecond, unfinished, daytimeFirst];
    const repository = {
      createTask: vi.fn(),
      updateTask: vi.fn().mockImplementation(async (_owner: string, id: string, patch: object) => ({
        ...queryData.find((task) => task.id === id)!,
        ...patch,
        revision: 2,
        client_mutation_id: 'mutation-reordered',
      })),
      moveTask: vi.fn(),
      transitionTask: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({ repository, planningTimeZone: 'UTC' });
    const { container, root } = renderHookHarness();

    try {
      expect(latest.tasks.map((task) => task.id)).toEqual([
        'task-unfinished',
        'task-day-first',
        'task-day-second',
        'task-evening',
      ]);
      expect(getTodayTaskSection(unfinished, latest.planningDate)).toBe('unfinished');

      await act(async () => {
        await latest.reorderTask('task-day-second', 'up');
      });
      expect(repository.updateTask).toHaveBeenCalledWith(
        'owner-a',
        'task-day-second',
        { order_key: expect.any(String) },
      );
      expect(repository.updateTask.mock.calls[0][2].order_key < 'a0').toBe(true);
      expect(latest.tasks.map((task) => task.id)).toEqual([
        'task-unfinished',
        'task-day-second',
        'task-day-first',
        'task-evening',
      ]);
    } finally {
      cleanup(root, container);
    }
  });
});
