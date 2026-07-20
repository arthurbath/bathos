import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TasksShell } from './TasksShell';

const mockTaskList = vi.fn();
const mockPrepareForSignOut = vi.fn();

vi.mock('@/modules/tasks/hooks/useTaskList', () => ({
  useTaskList: (...args: unknown[]) => mockTaskList(...args),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => ({ mode: 'local', prepareForSignOut: mockPrepareForSignOut }),
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
    transitionTask: vi.fn().mockResolvedValue(undefined),
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
});
