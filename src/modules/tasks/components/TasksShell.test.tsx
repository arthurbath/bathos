import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeTaskEditorPlanningPatch } from './taskEditorPlanning';
import { TasksShell } from './TasksShell';

const mockTaskList = vi.fn();
const mockPrepareForSignOut = vi.fn();

vi.mock('@/modules/tasks/hooks/useTaskList', () => ({
  useTaskList: (...args: unknown[]) => mockTaskList(...args),
  getTodayTaskSection: (value: { start_date: string | null; today_section: string }, date: string) => (
    value.start_date !== null && value.start_date < date ? 'unfinished' : value.today_section
  ),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => ({
    mode: 'local',
    planningTimeZone: 'America/Los_Angeles',
    prepareForSignOut: mockPrepareForSignOut,
  }),
}));

vi.mock('@/platform/components/ToplineHeader', () => ({
  ToplineHeader: ({ title, onSignOut }: { title: string; onSignOut: () => void }) => (
    <header>
      <span>{title}</span>
      <button type="button" onClick={onSignOut}>Sign Out</button>
    </header>
  ),
}));

vi.mock('@/platform/components/MobileBottomNav', () => ({
  MobileBottomNav: () => <nav data-testid="mobile-nav" />,
}));

const task = {
  id: 'task-a',
  owner_id: 'owner-a',
  title: 'Existing task',
  notes: 'Existing notes',
  lifecycle: 'open' as const,
  completed_at: null,
  canceled_at: null,
  disposition: 'present' as const,
  deleted_at: null,
  destination: 'today' as const,
  today_section: 'daytime' as const,
  order_key: 'a0',
  start_date: null,
  deadline: null,
  entry_channel: 'web' as const,
  last_mutation_channel: 'web' as const,
  last_actor_type: 'user' as const,
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

function defaultTaskList() {
  return {
    tasks: [task],
    loading: false,
    error: null,
    createTask: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
    moveTask: vi.fn().mockResolvedValue(undefined),
    reorderTask: vi.fn().mockResolvedValue(undefined),
    transitionTask: vi.fn().mockResolvedValue(undefined),
    planningDate: '2026-07-20',
  };
}

function renderShell(initialEntry = '/tasks/today') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <TasksShell
          userId="owner-a"
          displayName="Owner"
          onSignOut={vi.fn()}
        />
      </MemoryRouter>,
    );
  });

  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('TasksShell', () => {
  beforeEach(() => {
    mockPrepareForSignOut.mockReset().mockResolvedValue(undefined);
    mockTaskList.mockReset();
  });

  it('creates a task from the keyboard-first capture field', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const input = container.querySelector<HTMLInputElement>('input[aria-label="Add a Task"]');
      expect(input).toBeTruthy();
      await act(async () => {
        setInputValue(input!, 'New local task');
      });
      await act(async () => {
        input?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
        );
      });

      expect(taskList.createTask).toHaveBeenCalledWith('New local task');
    } finally {
      cleanup(root, container);
    }
  });

  it('processes an Inbox task into a chosen planning destination', async () => {
    const inboxTask = { ...task, destination: 'inbox' as const };
    const taskList = { ...defaultTaskList(), tasks: [inboxTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/inbox');

    try {
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      );
      await act(async () => {
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const moveAnytime = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Move to Anytime');
      await act(async () => {
        moveAnytime?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(taskList.moveTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        todaySection: 'daytime',
        startDate: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('completes an open task from its accessible completion control', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const complete = container.querySelector<HTMLButtonElement>('button[aria-label="Complete Existing task"]');
      await act(async () => {
        complete?.click();
      });

      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
    } finally {
      cleanup(root, container);
    }
  });

  it('expands a row in place and saves changed title and notes', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const titleButton = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Existing task',
      );
      await act(async () => {
        titleButton?.click();
      });

      const title = container.querySelector<HTMLInputElement>('#task-title-task-a');
      const notes = container.querySelector<HTMLTextAreaElement>('#task-notes-task-a');
      expect(document.activeElement).toBe(title);
      await act(async () => {
        setInputValue(title!, 'Revised task');
        setInputValue(notes!, 'Revised notes');
      });
      await act(async () => {
        title?.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        title: 'Revised task',
        notes: 'Revised notes',
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const restoredTitleButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent === 'Existing task',
      );
      expect(document.activeElement).toBe(restoredTitleButton);
    } finally {
      cleanup(root, container);
    }
  });

  it('clears a date-only deadline through the task editor', async () => {
    const datedTask = {
      ...task,
      start_date: '2026-07-20',
      deadline: '2026-07-24',
    };
    const taskList = { ...defaultTaskList(), tasks: [datedTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const titleButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.getAttribute('aria-expanded') === 'false',
      );
      await act(async () => {
        titleButton?.click();
      });

      const clearDeadline = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Clear Deadline"]',
      );
      await act(async () => {
        clearDeadline?.click();
      });
      const form = container.querySelector<HTMLFormElement>(`#task-title-${task.id}`)?.form;
      await act(async () => {
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', { deadline: null });
    } finally {
      cleanup(root, container);
    }
  });

  it('moves an evening task back to daytime when its Today date is cleared', async () => {
    const eveningTask = {
      ...task,
      today_section: 'evening' as const,
      start_date: '2026-07-20',
    };
    const taskList = { ...defaultTaskList(), tasks: [eveningTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const titleButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.getAttribute('aria-expanded') === 'false',
      );
      await act(async () => {
        titleButton?.click();
      });

      const clearStartDate = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Clear Start Date"]',
      );
      await act(async () => {
        clearStartDate?.click();
      });
      const form = container.querySelector<HTMLFormElement>(`#task-title-${task.id}`)?.form;
      await act(async () => {
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        start_date: null,
        today_section: 'daytime',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('closes editing with Escape and restores focus to the task title', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const titleButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent === 'Existing task',
      );
      await act(async () => {
        titleButton?.click();
      });

      const editorTitle = container.querySelector<HTMLInputElement>('#task-title-task-a');
      await act(async () => {
        editorTitle?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(container.querySelector('#task-title-task-a')).toBeNull();
      const restoredTitleButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent === 'Existing task',
      );
      expect(document.activeElement).toBe(restoredTitleButton);
    } finally {
      cleanup(root, container);
    }
  });

  it('clears local task data before signing out', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/tasks/today']}>
          <TasksShell userId="owner-a" displayName="Owner" onSignOut={onSignOut} />
        </MemoryRouter>,
      );
    });

    try {
      const signOut = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Sign Out',
      );
      await act(async () => {
        signOut?.click();
      });

      expect(mockPrepareForSignOut).toHaveBeenCalledOnce();
      expect(onSignOut).toHaveBeenCalledOnce();
      expect(mockPrepareForSignOut.mock.invocationCallOrder[0]).toBeLessThan(
        onSignOut.mock.invocationCallOrder[0],
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('shows deleted tasks in Trash and restores them without exposing task capture', async () => {
    const deletedTask = {
      ...task,
      disposition: 'deleted' as const,
      deleted_at: '2026-07-20T04:05:00.000Z',
    };
    const taskList = {
      ...defaultTaskList(),
      tasks: [deletedTask],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/trash');

    try {
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      const restore = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Restore Existing task"]',
      );
      await act(async () => {
        restore?.click();
      });

      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'trash');
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'restore');
    } finally {
      cleanup(root, container);
    }
  });

  it('shows future-start work in Upcoming and can make it available today', async () => {
    const upcomingTask = { ...task, start_date: '2026-07-24' };
    const taskList = { ...defaultTaskList(), tasks: [upcomingTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'upcoming');
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      );
      await act(async () => {
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const makeAvailable = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Make Available Today');
      await act(async () => {
        makeAvailable?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(taskList.moveTask).toHaveBeenCalledWith('task-a', {
        destination: 'today',
        todaySection: 'daytime',
        startDate: '2026-07-20',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('captures and manually plans active work in Anytime', async () => {
    const anytimeTask = { ...task, destination: 'anytime' as const };
    const taskList = { ...defaultTaskList(), tasks: [anytimeTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/anytime');

    try {
      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'anytime');
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeTruthy();
      expect(container.querySelector('section[aria-label="Anytime Tasks"]')).toBeTruthy();

      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      );
      await act(async () => {
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const moveSomeday = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Move to Someday');
      await act(async () => {
        moveSomeday?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(taskList.moveTask).toHaveBeenCalledWith('task-a', {
        destination: 'someday',
        todaySection: 'daytime',
        startDate: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('captures inactive work in Someday and activates it when a start date is assigned', () => {
    const somedayTask = { ...task, destination: 'someday' as const };
    const taskList = { ...defaultTaskList(), tasks: [somedayTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/someday');

    try {
      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'someday');
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeTruthy();
      expect(container.querySelector('section[aria-label="Someday Tasks"]')).toBeTruthy();
      expect(normalizeTaskEditorPlanningPatch(
        somedayTask,
        { start_date: '2026-07-24' },
        '2026-07-20',
      )).toEqual({
        destination: 'anytime',
        today_section: 'daytime',
        start_date: '2026-07-24',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('shows terminal work in Logbook and reopens it without exposing task capture', async () => {
    const completedTask = {
      ...task,
      lifecycle: 'completed' as const,
      completed_at: '2026-07-20T04:05:00.000Z',
    };
    const taskList = {
      ...defaultTaskList(),
      tasks: [completedTask],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/logbook');

    try {
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      expect(container.querySelector('section[aria-label="Logbook Tasks"]')).toBeTruthy();
      const reopen = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Reopen Existing task"]',
      );
      await act(async () => {
        reopen?.click();
      });

      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'logbook');
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'reopen');
    } finally {
      cleanup(root, container);
    }
  });

  it('renders Unfinished, Today, and This Evening as distinct sections and reschedules carryover', async () => {
    const unfinishedTask = {
      ...task,
      id: 'task-unfinished',
      title: 'Carryover task',
      start_date: '2026-07-19',
    };
    const eveningTask = {
      ...task,
      id: 'task-evening',
      title: 'Evening task',
      start_date: '2026-07-20',
      today_section: 'evening' as const,
    };
    const taskList = {
      ...defaultTaskList(),
      tasks: [unfinishedTask, { ...task, start_date: '2026-07-20' }, eveningTask],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/today');

    try {
      expect(container.querySelector('#tasks-unfinished-heading')?.textContent).toContain('Unfinished (1)');
      expect(container.querySelector('#tasks-daytime-heading')?.textContent).toContain('Today (1)');
      expect(container.querySelector('#tasks-evening-heading')?.textContent).toContain('This Evening (1)');

      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Carryover task"]',
      );
      await act(async () => {
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const moveEvening = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Move to This Evening');
      await act(async () => {
        moveEvening?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(taskList.moveTask).toHaveBeenCalledWith('task-unfinished', {
        destination: 'today',
        todaySection: 'evening',
        startDate: '2026-07-20',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('offers section-scoped manual reorder actions', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
    };
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/today');

    try {
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Second task"]',
      );
      await act(async () => {
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const moveUp = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Move Up');
      await act(async () => {
        moveUp?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(taskList.reorderTask).toHaveBeenCalledWith('task-b', 'up');
    } finally {
      cleanup(root, container);
    }
  });
});
