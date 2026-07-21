import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  taskProjectFixture,
  taskReminderFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';
import { normalizeTaskEditorPlanningPatch } from './taskEditorPlanning';
import { getTasksStorageStatusLabel } from './tasksStorageStatus';
import { TasksShell } from './TasksShell';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
const mockTaskList = vi.fn();
const mockTaskSearch = vi.fn();
const mockTaskHierarchy = vi.fn();
const mockTaskHierarchyTrash = vi.fn();
const mockTaskReminders = vi.fn();
const mockTaskUndo = vi.fn();
const mockPrepareForSignOut = vi.fn();
const mockTasksRuntime = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  toast: mockToast,
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/modules/tasks/hooks/useTaskList', () => ({
  useTaskList: (...args: unknown[]) => mockTaskList(...args),
  getTodayTaskSection: (value: { start_date: string | null; today_section: string }, date: string) => (
    value.start_date !== null && value.start_date < date ? 'unfinished' : value.today_section
  ),
}));

vi.mock('@/modules/tasks/hooks/useTaskSearch', () => ({
  useTaskSearch: (...args: unknown[]) => mockTaskSearch(...args),
}));

vi.mock('@/modules/tasks/hooks/useTaskHierarchy', () => ({
  useTaskHierarchy: (...args: unknown[]) => mockTaskHierarchy(...args),
}));

vi.mock('@/modules/tasks/hooks/useTaskHierarchyTrash', () => ({
  useTaskHierarchyTrash: (...args: unknown[]) => mockTaskHierarchyTrash(...args),
}));

vi.mock('@/modules/tasks/hooks/useTaskReminders', () => ({
  useTaskReminders: (...args: unknown[]) => mockTaskReminders(...args),
}));

vi.mock('@/modules/tasks/hooks/useTaskUndo', () => ({
  useTaskUndo: (...args: unknown[]) => mockTaskUndo(...args),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mockTasksRuntime(),
}));

describe('getTasksStorageStatusLabel', () => {
  it('distinguishes local, connected, pending, and offline states', () => {
    expect(getTasksStorageStatusLabel({ mode: 'local', syncState: 'local', pendingUploadCount: 0, hasCompletedSync: false }))
      .toBe('Local');
    expect(getTasksStorageStatusLabel({ mode: 'connected', syncState: 'connected', pendingUploadCount: 0, hasCompletedSync: false }))
      .toBe('Preparing Sync');
    expect(getTasksStorageStatusLabel({ mode: 'connected', syncState: 'connected', pendingUploadCount: 0, hasCompletedSync: true }))
      .toBe('Synced');
    expect(getTasksStorageStatusLabel({ mode: 'connected', syncState: 'connected', pendingUploadCount: 2, hasCompletedSync: true }))
      .toBe('2 Pending');
    expect(getTasksStorageStatusLabel({
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 2,
      hasCompletedSync: true,
      uploadState: 'active',
    })).toBe('Syncing 2');
    expect(getTasksStorageStatusLabel({
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 0,
      hasCompletedSync: true,
      downloadState: 'active',
    })).toBe('Downloading');
    expect(getTasksStorageStatusLabel({ mode: 'connected', syncState: 'offline', pendingUploadCount: 2, hasCompletedSync: true }))
      .toBe('Offline - 2 Pending');
    expect(getTasksStorageStatusLabel({ mode: 'connected', syncState: 'offline', pendingUploadCount: 0, hasCompletedSync: true }))
      .toBe('Offline');
    expect(getTasksStorageStatusLabel({
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 2,
      hasCompletedSync: true,
      uploadState: 'error',
    })).toBe('Upload Error - 2 Pending');
    expect(getTasksStorageStatusLabel({
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 0,
      hasCompletedSync: true,
      downloadState: 'error',
    })).toBe('Download Error');
  });
});

vi.mock('./TaskProjectsView', () => ({
  TaskProjectsView: () => (
    <section data-testid="projects-view">Projects</section>
  ),
}));

vi.mock('./TaskAreaDetailView', () => ({
  TaskAreaDetailView: ({ areaId }: { areaId: string }) => (
    <section data-testid="area-detail-view">Area {areaId}</section>
  ),
}));

vi.mock('./TaskProjectDetailView', () => ({
  TaskProjectDetailView: ({
    projectId,
    onSaveReminder,
    onCancelReminder,
  }: {
    projectId: string;
    onSaveReminder: (input: {
      localDate: string;
      localTime: string;
      ambiguityChoice: 'earlier' | 'later';
    }) => Promise<void>;
    onCancelReminder: () => Promise<void>;
  }) => (
    <section data-testid="project-detail-view">
      Project {projectId}
      <button
        type="button"
        aria-label="Save Project Reminder"
        onClick={() => void onSaveReminder({
          localDate: '2026-07-21',
          localTime: '10:30',
          ambiguityChoice: 'later',
        })}
      />
      <button
        type="button"
        aria-label="Cancel Project Reminder"
        onClick={() => void onCancelReminder()}
      />
    </section>
  ),
}));

vi.mock('./TaskTemplatesView', () => ({
  TaskTemplatesView: () => (
    <section data-testid="templates-view">Templates</section>
  ),
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

vi.mock('@/platform/hooks/useHostModule', () => ({
  useModuleBasePath: () => '/tasks',
}));

const task = taskTodoFixture({
  id: 'task-a',
  title: 'Existing task',
  notes: 'Existing notes',
  destination: 'today',
});

const planningProject = taskProjectFixture({
  id: 'project-plan',
  title: 'Plan the launch',
  destination: 'today',
  start_date: '2026-07-20',
  client_mutation_id: 'project-plan-mutation',
});

function defaultTaskList() {
  return {
    tasks: [task],
    loading: false,
    error: null,
    createTask: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
    moveTask: vi.fn().mockResolvedValue(undefined),
    moveTasks: vi.fn().mockResolvedValue([]),
    reorderTask: vi.fn().mockResolvedValue(undefined),
    transitionTask: vi.fn().mockResolvedValue(undefined),
    planningDate: '2026-07-20',
  };
}

function defaultTasksRuntime() {
  return {
    mode: 'local' as const,
    syncState: 'local' as const,
    pendingUploadCount: 0,
    planningTimeZone: 'America/Los_Angeles',
    permanentDeletionService: { preview: vi.fn(), execute: vi.fn() },
    prepareForSignOut: mockPrepareForSignOut,
  };
}

function renderShell(initialEntry = '/tasks/today') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = () => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <TasksShell
          userId="owner-a"
          displayName="Owner"
          onSignOut={vi.fn()}
        />
      </MemoryRouter>,
    );
  };

  act(() => {
    render();
  });

  return {
    container,
    root,
    rerender: render,
  };
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

function setSelectValue(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function expectInteractiveControlsToHaveNames(scope: ParentNode) {
  const controls = Array.from(new Set(scope.querySelectorAll<HTMLElement>([
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[role="checkbox"]',
    '[role="menuitem"]',
  ].join(','))));
  expect(controls.length).toBeGreaterThan(0);
  controls.forEach((control) => {
    expect(control, control.outerHTML).not.toHaveAccessibleName('');
  });
}

async function openTaskMenuSurface(
  container: HTMLElement,
  taskTitle: string,
  surfaceLabel: 'Move...' | 'When...',
) {
  const actions = container.querySelector<HTMLButtonElement>(
    `button[aria-label="Actions for ${taskTitle}"]`,
  );
  await act(async () => {
    actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const surface = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .find((item) => item.textContent === surfaceLabel);
  await act(async () => {
    surface?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('TasksShell', () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockPrepareForSignOut.mockReset().mockResolvedValue(undefined);
    mockTasksRuntime.mockReset().mockReturnValue(defaultTasksRuntime());
    mockTaskList.mockReset();
    mockTaskUndo.mockReset().mockReturnValue({
      available: false,
      pending: false,
      loading: false,
      error: null,
      event: null,
      undo: vi.fn(),
    });
    mockTaskSearch.mockReset().mockReturnValue({
      tasks: [task],
      loading: false,
      error: null,
    });
    mockTaskHierarchy.mockReset().mockReturnValue({
      areas: [],
      projects: [],
      headings: [],
      loading: false,
      error: null,
      moveProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      reorderProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      transitionProject: vi.fn().mockResolvedValue(undefined),
    });
    mockTaskHierarchyTrash.mockReset().mockReturnValue({
      roots: [],
      loading: false,
      error: null,
      restore: vi.fn().mockResolvedValue(undefined),
    });
    mockTaskReminders.mockReset().mockReturnValue({
      reminders: [],
      byRootId: new Map(),
      dueItems: [],
      claimError: null,
      projectionError: null,
      mode: 'local',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      acknowledge: vi.fn().mockResolvedValue(undefined),
      claimDue: vi.fn().mockResolvedValue(undefined),
    });
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

  it('focuses capture with N and ignores app commands inside editable controls', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const titleButton = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      const capture = container.querySelector<HTMLInputElement>('input[aria-label="Add a Task"]')!;
      titleButton.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
      });
      expect(document.activeElement).toBe(capture);

      await act(async () => {
        capture.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
        capture.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));
      });
      expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain('Today');
    } finally {
      cleanup(root, container);
    }
  });

  it('navigates task views with a web-safe G sequence', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));
      });
      expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain('Upcoming');
      expect(mockTaskList).toHaveBeenLastCalledWith('owner-a', 'upcoming');
    } finally {
      cleanup(root, container);
    }
  });

  it('opens unified search with slash and filters on structured source data', async () => {
    const mailTask = {
      ...task,
      id: 'task-mail',
      title: 'Reply to the architect',
      destination: 'inbox' as const,
      source_kind: 'mail_message' as const,
      source_title: 'Project update',
      actionability: 'waiting' as const,
    };
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskSearch.mockReturnValue({
      tasks: [task, mailTask],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      const titleButton = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      titleButton.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '/', bubbles: true, cancelable: true,
        }));
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Search Tasks');
      const sourceFilter = Array.from(dialog.querySelectorAll<HTMLLabelElement>('label'))
        .find((label) => label.textContent?.startsWith('Source'))
        ?.querySelector('select');
      await act(async () => {
        setSelectValue(sourceFilter!, 'mail_message');
      });
      expect(dialog.textContent).toContain('Reply to the architect');
      expect(dialog.textContent).not.toContain('Existing task');
      const actionabilityFilter = Array.from(dialog.querySelectorAll<HTMLLabelElement>('label'))
        .find((label) => label.textContent?.startsWith('Actionability'))
        ?.querySelector('select');
      await act(async () => {
        setSelectValue(sourceFilter!, 'all');
        setSelectValue(actionabilityFilter!, 'waiting');
      });
      expect(dialog.textContent).toContain('Reply to the architect');
      expect(dialog.textContent).not.toContain('Existing task');
    } finally {
      cleanup(root, container);
    }
  });

  it('exposes a captured webpage as a named real link in the active task row', () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [{
        ...task,
        source_kind: 'webpage',
        source_url: 'https://example.test/source',
        source_title: 'Synthetic source',
      }],
    });
    const { container, root } = renderShell();

    try {
      const link = container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Webpage for Existing task"]',
      );
      expect(link?.getAttribute('href')).toBe('https://example.test/source');
      expect(link?.target).toBe('_blank');
      expect(link?.title).toBe('Webpage: Synthetic source');
    } finally {
      cleanup(root, container);
    }
  });

  it('navigates from search to a future task and opens it for editing', async () => {
    const futureTask = {
      ...task,
      id: 'task-future',
      title: 'Book the inspection',
      start_date: '2026-07-24',
    };
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [futureTask] });
    mockTaskSearch.mockReturnValue({ tasks: [futureTask], loading: false, error: null });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '/', bubbles: true, cancelable: true,
        }));
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      const search = dialog.querySelector<HTMLInputElement>('[aria-label="Search Tasks and Views"]')!;
      await act(async () => {
        setInputValue(search, 'inspection');
      });
      const result = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('a'))
        .find((link) => link.textContent?.includes('Book the inspection'));
      await act(async () => {
        result?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(mockTaskList).toHaveBeenLastCalledWith('owner-a', 'upcoming');
      expect(container.querySelector('#task-title-task-future')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('opens keyboard help with question mark and closes it with Escape', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const titleButton = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      titleButton.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '?', shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Keyboard Commands');
      expect(dialog.textContent).toContain('Move to an Area, Project, or Heading');
      await act(async () => {
        (document.activeElement ?? dialog).dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(dialog.dataset.state).toBe('closed');
    } finally {
      cleanup(root, container);
    }
  });

  it('exposes authoritative task undo while preserving native editor undo', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    mockTaskUndo.mockReturnValue({
      available: true,
      pending: false,
      loading: false,
      error: null,
      event: { id: 'event-update' },
      undo,
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const undoButton = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Undo Last Task Change"]',
      );
      expect(undoButton).toHaveAttribute('aria-keyshortcuts', 'Meta+Z Control+Z');
      await act(async () => {
        undoButton?.click();
      });
      expect(undo).toHaveBeenCalledTimes(1);

      const capture = container.querySelector<HTMLInputElement>('input[aria-label="Add a Task"]')!;
      capture.focus();
      await act(async () => {
        capture.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'z', metaKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(undo).toHaveBeenCalledTimes(1);

      const title = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      title.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'z', metaKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(undo).toHaveBeenCalledTimes(2);

      title.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '?', shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(document.querySelector<HTMLElement>('[role="dialog"]')?.textContent)
        .toContain('Undo the Last Task Change');
    } finally {
      cleanup(root, container);
    }
  });

  it('opens distinct structural Move and temporal When surfaces from task focus', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [],
      projects: [{ id: 'project-a', title: 'House' }],
      headings: [{ id: 'heading-a', project_id: 'project-a', title: 'Repairs' }],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      const titleButton = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      titleButton.focus();
      await act(async () => {
        titleButton.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'm', bubbles: true, cancelable: true,
        }));
      });
      const heading = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'House / Repairs');
      await act(async () => {
        heading?.click();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        area_id: null,
        project_id: 'project-a',
        heading_id: 'heading-a',
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(titleButton);

      titleButton.focus();
      await act(async () => {
        titleButton.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'w', bubbles: true, cancelable: true,
        }));
      });
      const someday = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Move to Someday');
      await act(async () => {
        someday?.click();
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

  it('focuses the same-position row when temporal planning removes the invoked task', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    let resolveMove: (() => void) | undefined;
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    taskList.moveTask.mockImplementation(() => new Promise<void>((resolve) => {
      resolveMove = resolve;
    }));
    mockTaskList.mockReturnValue(taskList);
    const { container, root, rerender } = renderShell();

    try {
      const first = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      first.focus();
      await act(async () => {
        first.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'w', bubbles: true, cancelable: true,
        }));
      });
      const someday = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Move to Someday');

      await act(async () => {
        someday?.click();
        taskList.tasks = [secondTask];
        rerender();
        resolveMove?.();
        await Promise.resolve();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(taskList.moveTask).toHaveBeenCalledWith('task-a', {
        destination: 'someday',
        todaySection: 'daytime',
        startDate: null,
      });
      expect(document.activeElement).toBe(
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('moves row focus, reorders, and completes through scoped task commands', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const first = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      const second = container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')!;
      first.focus();
      await act(async () => {
        first.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown', bubbles: true, cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(second);

      await act(async () => {
        second.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(taskList.reorderTask).toHaveBeenCalledWith('task-b', 'up');
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(second);

      first.focus();
      await act(async () => {
        first.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'c', bubbles: true, cancelable: true,
        }));
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(second);
    } finally {
      cleanup(root, container);
    }
  });

  it('selects multiple tasks and applies one approved bulk planning action', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const selectMode = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Select Tasks"]',
      );
      await act(async () => selectMode?.click());
      expect(container.querySelector('section[aria-label="Task Selection"]')?.textContent)
        .toContain('0 Tasks Selected');
      expect(container.querySelector('[aria-label="Add a Task"]')).toBeNull();

      const first = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Select Existing task"]',
      );
      const second = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Select Second task"]',
      );
      await act(async () => {
        first?.click();
        second?.click();
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')?.textContent)
        .toContain('2 Tasks Selected');

      const plan = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Plan Selected');
      await act(async () => plan?.click());
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Plan Selected Tasks');
      expect(dialog.textContent).toContain('2 Tasks');
      const evening = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Move to This Evening');
      await act(async () => evening?.click());

      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a', 'task-b'], {
        destination: 'today',
        todaySection: 'evening',
        startDate: '2026-07-20',
      });
      expect(container.querySelector('[aria-label="Add a Task"]')).toBeTruthy();
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(
        container.querySelector('[aria-label="Add a Task"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps bulk selection available when atomic planning fails', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Deadline-constrained task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    taskList.moveTasks.mockRejectedValueOnce(
      new Error('Deadline cannot be earlier than the start date'),
    );
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[aria-label="Select Tasks"]')?.click();
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Select Existing task"]',
        )?.click();
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Select Deadline-constrained task"]',
        )?.click();
      });
      const plan = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Plan Selected');
      await act(async () => plan?.click());
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      const tomorrow = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Move to Tomorrow');
      await act(async () => {
        tomorrow?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a', 'task-b'], {
        destination: 'today',
        todaySection: 'daytime',
        startDate: '2026-07-21',
      });
      expect(dialog.isConnected).toBe(true);
      expect(container.querySelector('section[aria-label="Task Selection"]')?.textContent)
        .toContain('2 Tasks Selected');
      expect(container.querySelector('[aria-label="Add a Task"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('marks a task waiting from its quick actions without changing placement', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      );
      await act(async () => {
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const waiting = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Mark as Waiting');
      await act(async () => {
        waiting?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        actionability: 'waiting',
      });
      expect(taskList.moveTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('provides a real mobile link into Projects and a Today return link', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const today = renderShell('/tasks/today');

    try {
      const projectsLink = today.container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Projects"]',
      );
      expect(projectsLink?.getAttribute('href')).toBe('/tasks/projects');
    } finally {
      cleanup(today.root, today.container);
    }

    const projects = renderShell('/tasks/projects');
    try {
      expect(projects.container.querySelector('[data-testid="projects-view"]')?.textContent)
        .toBe('Projects');
      const todayLink = projects.container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Return to Today"]',
      );
      expect(todayLink?.getAttribute('href')).toBe('/tasks/today');
    } finally {
      cleanup(projects.root, projects.container);
    }
  });

  it('keeps narrow mobile hierarchy links compact without losing their names', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const today = renderShell('/tasks/today');

    try {
      for (const label of ['Open Projects', 'Open Templates']) {
        const link = today.container.querySelector<HTMLAnchorElement>(
          `a[aria-label="${label}"]`,
        );
        expect(link).not.toBeNull();
        expect(link?.querySelector('span')?.className).toContain('sr-only sm:not-sr-only');
      }
    } finally {
      cleanup(today.root, today.container);
    }
  });

  it('provides a real Templates route on desktop and mobile without task capture', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const templates = renderShell('/tasks/templates');
    try {
      expect(templates.container.querySelector('[data-testid="templates-view"]')?.textContent)
        .toBe('Templates');
      expect(templates.container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      expect(templates.container.querySelector<HTMLAnchorElement>(
        'nav[aria-label="Task views"] a[href="/tasks/templates"]',
      )?.getAttribute('aria-current')).toBe('page');
      expect(templates.container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Return to Today"]',
      )?.getAttribute('href')).toBe('/tasks/today');
    } finally {
      cleanup(templates.root, templates.container);
    }
  });

  it('routes a project detail path without exposing task capture', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const project = renderShell('/tasks/projects/project-alpha');
    try {
      expect(project.container.querySelector('[data-testid="project-detail-view"]')?.textContent)
        .toBe('Project project-alpha');
      expect(project.container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      expect(project.container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Return to Projects"]',
      )?.getAttribute('href')).toBe('/tasks/projects');
    } finally {
      cleanup(project.root, project.container);
    }
  });

  it('uses the project-root reminder contract from project detail', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const reminder = taskReminderFixture({
      root_type: 'project',
      task_id: null,
      project_id: 'project-alpha',
    });
    const save = vi.fn().mockResolvedValue(undefined);
    const cancel = vi.fn().mockResolvedValue(undefined);
    mockTaskReminders.mockReturnValue({
      reminders: [reminder],
      byRootId: new Map([[reminder.project_id!, reminder]]),
      dueItems: [],
      mode: 'connected',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save,
      cancel,
      acknowledge: vi.fn().mockResolvedValue(undefined),
      claimDue: vi.fn().mockResolvedValue(undefined),
      webPush: null,
    });
    const project = renderShell('/tasks/projects/project-alpha');

    try {
      await act(async () => {
        project.container.querySelector<HTMLButtonElement>(
          '[aria-label="Save Project Reminder"]',
        )?.click();
      });
      expect(save).toHaveBeenCalledWith({
        rootType: 'project',
        rootId: 'project-alpha',
        reminder,
        localDate: '2026-07-21',
        localTime: '10:30',
        ambiguityChoice: 'later',
      });

      await act(async () => {
        project.container.querySelector<HTMLButtonElement>(
          '[aria-label="Cancel Project Reminder"]',
        )?.click();
      });
      expect(cancel).toHaveBeenCalledWith(reminder);
    } finally {
      cleanup(project.root, project.container);
    }
  });

  it('routes an area detail path as part of Projects without exposing task capture', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const area = renderShell('/tasks/areas/area-work');
    try {
      expect(area.container.querySelector('[data-testid="area-detail-view"]')?.textContent)
        .toBe('Area area-work');
      expect(area.container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      expect(area.container.querySelector<HTMLAnchorElement>(
        'nav[aria-label="Task views"] a[href="/tasks/projects"]',
      )?.getAttribute('aria-current')).toBe('page');
      expect(area.container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Return to Projects"]',
      )?.getAttribute('href')).toBe('/tasks/projects');
    } finally {
      cleanup(area.root, area.container);
    }
  });

  it('processes an Inbox task into a chosen planning destination', async () => {
    const inboxTask = { ...task, destination: 'inbox' as const };
    const taskList = { ...defaultTaskList(), tasks: [inboxTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/inbox');

    try {
      await openTaskMenuSurface(container, 'Existing task', 'When...');
      const moveAnytime = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
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
      const capture = container.querySelector<HTMLInputElement>('input[aria-label="Add a Task"]');
      complete?.focus();
      await act(async () => {
        complete?.click();
      });

      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(capture);
    } finally {
      cleanup(root, container);
    }
  });

  it.each([
    ['Cancel', 'cancel'],
    ['Delete', 'delete'],
  ] as const)('%ss an active task from its actions and focuses the next row', async (
    actionLabel,
    transition,
  ) => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      );
      await act(async () => {
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const action = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === actionLabel);
      await act(async () => {
        action?.click();
      });

      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', transition);
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('traverses task rows and the complete editor in browser tab order', async () => {
    const user = userEvent.setup();
    const tab = async (shift = false) => {
      await act(async () => {
        await user.tab({ shift });
      });
    };
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const complete = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete Existing task"]',
      )!;
      const title = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      )!;

      complete.focus();
      await tab();
      expect(document.activeElement).toBe(title);
      await tab();
      expect(document.activeElement).toBe(actions);
      await tab(true);
      expect(document.activeElement).toBe(title);

      await act(async () => {
        await user.keyboard('{Enter}');
      });
      const editorTitle = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      const notes = container.querySelector<HTMLTextAreaElement>('#task-notes-task-a')!;
      const actionability = container.querySelector<HTMLSelectElement>('#task-actionability-task-a')!;
      const organization = container.querySelector<HTMLSelectElement>('#task-organization-task-a')!;
      const startDate = container.querySelector<HTMLButtonElement>('#task-start-date-task-a')!;
      const deadline = container.querySelector<HTMLButtonElement>('#task-deadline-task-a')!;
      const cancel = Array.from(editorTitle.form!.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Cancel')!;
      const save = Array.from(editorTitle.form!.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Save')!;

      expect(document.activeElement).toBe(editorTitle);
      await tab();
      expect(document.activeElement).toBe(notes);
      await tab();
      expect(document.activeElement).toBe(actionability);
      await tab();
      expect(document.activeElement).toBe(organization);
      await tab();
      expect(document.activeElement).toBe(startDate);
      await tab();
      expect(document.activeElement).toBe(deadline);
      await tab();
      expect(document.activeElement).toBe(cancel);
      await tab();
      expect(document.activeElement).toBe(save);
      await tab(true);
      expect(document.activeElement).toBe(cancel);
    } finally {
      cleanup(root, container);
    }
  });

  it('gives every task control an accessible name and scopes reduced motion to the module', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      expect(document.body).toHaveAttribute('data-tasks-motion-scope', 'true');
      expectInteractiveControlsToHaveNames(container);

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expectInteractiveControlsToHaveNames(container);

      await act(async () => {
        container.querySelector<HTMLInputElement>('#task-title-task-a')?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
        );
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      const title = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      title.focus();
      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'm', bubbles: true, cancelable: true,
        }));
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog).toHaveAccessibleName('Move Task');
      expectInteractiveControlsToHaveNames(dialog);
    } finally {
      cleanup(root, container);
    }

    expect(document.body).not.toHaveAttribute('data-tasks-motion-scope');
  });

  it('keeps search traversal inside a named dialog', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const searchButton = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Search Tasks and Views"]',
      )!;
      searchButton.focus();
      await act(async () => {
        searchButton.click();
      });

      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      const searchInput = dialog.querySelector<HTMLInputElement>(
        'input[aria-label="Search Tasks and Views"]',
      )!;
      const placement = Array.from(dialog.querySelectorAll<HTMLSelectElement>('select'))
        .find((select) => select.labels?.[0]?.textContent?.startsWith('Placement'))!;
      expect(dialog).toHaveAccessibleName('Search Tasks');
      expect(document.activeElement).toBe(searchInput);
      expectInteractiveControlsToHaveNames(dialog);

      await act(async () => {
        searchInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Tab', bubbles: true, cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(placement);

      await act(async () => {
        placement.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', bubbles: true, cancelable: true,
        }));
      });
      expect(dialog.dataset.state).toBe('closed');
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

  it('saves an open task editor with Command+Enter', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      await act(async () => {
        setInputValue(title, 'Saved by keyboard');
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', metaKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        title: 'Saved by keyboard',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('shows hierarchy context and moves a task structurally without changing planning state', async () => {
    const organizedTask = {
      ...task,
      area_id: null,
      project_id: 'project-launch',
      heading_id: 'heading-next',
      hierarchy_order_key: 'a0',
    };
    const taskList = { ...defaultTaskList(), tasks: [organizedTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-work', title: 'Work' }],
      projects: [{ id: 'project-launch', title: 'Launch' }],
      headings: [{ id: 'heading-next', project_id: 'project-launch', title: 'Next' }],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      expect(container.textContent).toContain('Launch / Next');
      const titleButton = container.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!;
      await act(async () => titleButton.click());
      const organization = container.querySelector<HTMLSelectElement>(
        '#task-organization-task-a',
      )!;
      expect(organization.value).toBe('project:project-launch');
      await act(async () => setSelectValue(organization, 'area:area-work'));
      await act(async () => {
        organization.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        area_id: 'area-work',
        project_id: null,
        heading_id: null,
      });
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

  it('saves a canonical reminder from the task editor', async () => {
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    const reminder = {
      id: 'reminder-a', owner_id: 'owner-a', root_type: 'todo' as const,
      task_id: 'task-a', project_id: null, local_date: '2026-07-20',
      local_time: '09:00:00', time_zone: 'America/Los_Angeles',
      ambiguity_choice: 'earlier' as const, resolved_at: '2026-07-20T16:00:00Z',
      resolution_kind: 'exact' as const, status: 'active' as const,
      record_revision: 1, last_mutation_channel: 'web' as const,
      last_actor_type: 'user' as const, client_mutation_id: 'mutation-a',
      created_at: '2026-07-20T15:00:00Z', updated_at: '2026-07-20T15:00:00Z',
    };
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [reminder], byRootId: new Map([['task-a', reminder]]), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: saveReminder, cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const time = container.querySelector<HTMLInputElement>('#task-reminder-time-task-a')!;
      await act(async () => setInputValue(time, '10:30'));
      await act(async () => {
        time.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(saveReminder).toHaveBeenCalledWith(expect.objectContaining({
        rootType: 'todo', rootId: 'task-a', reminder,
        localDate: '2026-07-20', localTime: '10:30', ambiguityChoice: 'earlier',
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('shows and acknowledges a claimed due reminder', async () => {
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected',
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge, claimDue: vi.fn(),
      dueItems: [{
        delivery_id: 'delivery-a', occurrence_id: 'occurrence-a',
        reminder_id: 'reminder-a', root_type: 'todo', root_id: 'task-a',
        title: 'Existing task', resolved_at: '2026-07-20T16:00:00Z', attempt_count: 1,
      }],
    });
    const { container, root } = renderShell();

    try {
      expect(container.querySelector('section[aria-label="Due Reminders"]')?.textContent)
        .toContain('Existing task');
      const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Acknowledge');
      await act(async () => button?.click());
      expect(acknowledge).toHaveBeenCalledWith('delivery-a');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps reminder acknowledgement failures content-free and retryable', async () => {
    const acknowledge = vi.fn().mockRejectedValue(new Error('provider receipt and endpoint detail'));
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected',
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge, claimDue: vi.fn(),
      dueItems: [{
        delivery_id: 'delivery-a', occurrence_id: 'occurrence-a',
        reminder_id: 'reminder-a', root_type: 'todo', root_id: 'task-a',
        title: 'Existing task', resolved_at: '2026-07-20T16:00:00Z', attempt_count: 1,
      }],
    });
    const { container, root } = renderShell();

    try {
      const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Acknowledge');
      await act(async () => {
        button?.click();
        await Promise.resolve();
      });

      expect(acknowledge).toHaveBeenCalledWith('delivery-a');
      expect(container.querySelector('section[aria-label="Due Reminders"]')?.textContent)
        .toContain('Existing task');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Reminder Could Not Be Acknowledged',
        description: 'The reminder acknowledgement failed. The reminder remains available to retry.',
        variant: 'destructive',
      });
      expect(JSON.stringify(mockToast.mock.calls)).not.toContain('provider receipt');
    } finally {
      cleanup(root, container);
    }
  });

  it('reports a failed due-reminder check without exposing provider diagnostics and retries explicitly', async () => {
    const claimDue = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [], mode: 'connected',
      planningTimeZone: 'America/Los_Angeles', loading: false,
      error: new Error('provider detail'), claimError: new Error('provider detail'),
      save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue,
    });
    const { container, root } = renderShell();

    try {
      const status = container.querySelector('section[aria-label="Reminder Delivery Check"]');
      expect(status?.textContent).toContain('Reminder Check Failed');
      expect(status?.textContent).toContain('Scheduled reminders remain unchanged');
      expect(status?.textContent).not.toContain('provider detail');
      const retry = Array.from(status?.querySelectorAll<HTMLButtonElement>('button') ?? [])
        .find(({ textContent }) => textContent === 'Retry');
      await act(async () => retry?.click());
      expect(claimDue).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('reports an unavailable reminder projection and prevents blind reminder replacement', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [], mode: 'connected',
      planningTimeZone: 'America/Los_Angeles', loading: false,
      error: new Error('provider detail'), claimError: null,
      projectionError: new Error('provider detail'),
      save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell();

    try {
      const status = container.querySelector('section[aria-label="Reminder Data Status"]');
      expect(status?.textContent).toContain('Reminder Data Unavailable');
      expect(status?.textContent).not.toContain('provider detail');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expect(container.querySelector<HTMLButtonElement>('[aria-label="Reminder Date"]')?.disabled)
        .toBe(true);
      expect(container.textContent).toContain('Editing is disabled to protect existing schedules');
    } finally {
      cleanup(root, container);
    }
  });

  it('acknowledges a Web Push delivery opened from its notification URL', async () => {
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected', dueItems: [],
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge, claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/today?reminder_delivery=push-delivery-a');

    try {
      await act(async () => Promise.resolve());
      expect(acknowledge).toHaveBeenCalledTimes(1);
      expect(acknowledge).toHaveBeenCalledWith('push-delivery-a');
    } finally {
      cleanup(root, container);
    }
  });

  it('reports degraded browser capability and offers an explicit enable action', async () => {
    const enable = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected', dueItems: [],
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
      webPush: {
        status: 'available', busy: false, error: null,
        enable, disable: vi.fn().mockResolvedValue(undefined),
      },
    });
    const { container, root } = renderShell();

    try {
      expect(container.querySelector('section[aria-label="Browser Reminder Capability"]')?.textContent)
        .toContain('Background Reminders Off');
      const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Enable');
      await act(async () => button?.click());
      expect(enable).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps browser-reminder failures content-free in the capability panel and toast', async () => {
    const enable = vi.fn().mockRejectedValue(new Error('provider endpoint and subscription detail'));
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected', dueItems: [],
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
      webPush: {
        status: 'error', busy: false,
        error: new Error('provider endpoint and subscription detail'),
        enable, disable: vi.fn().mockResolvedValue(undefined),
      },
    });
    const { container, root } = renderShell();

    try {
      const capability = container.querySelector('section[aria-label="Browser Reminder Capability"]');
      expect(capability?.textContent).toContain('Background Reminders Degraded');
      expect(capability?.textContent).toContain('In-app reminders remain available');
      expect(capability?.textContent).not.toContain('provider endpoint');

      const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Enable');
      await act(async () => {
        button?.click();
        await Promise.resolve();
      });

      expect(enable).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Browser Reminders Could Not Be Enabled',
        description: 'The browser reminder operation failed. In-app reminders remain available.',
        variant: 'destructive',
      });
      expect(JSON.stringify(mockToast.mock.calls)).not.toContain('provider endpoint');
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
      deletion_root_id: 'task-a',
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
      expect(container.querySelector('button[aria-label="Permanently Delete Existing task"]'))
        .toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('restores independently deleted checklist items from Trash', async () => {
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [] });
    const deletedChecklistItem = {
      id: 'checklist-a',
      title: 'Verify release',
      deleted_at: '2026-07-20T04:05:00.000Z',
      root_type: 'checklist_item' as const,
    };
    const restore = vi.fn().mockResolvedValue(undefined);
    mockTaskHierarchyTrash.mockReturnValue({
      roots: [deletedChecklistItem],
      loading: false,
      error: null,
      restore,
    });
    const { container, root } = renderShell('/tasks/trash');

    try {
      expect(container.textContent).toContain('Deleted Checklist Item');
      const restoreButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Restore');
      await act(async () => {
        restoreButton?.click();
      });
      expect(restore).toHaveBeenCalledWith(deletedChecklistItem);
    } finally {
      cleanup(root, container);
    }
  });

  it('exposes server-authoritative permanent deletion only when connected and synchronized', () => {
    const deletedTask = {
      ...task,
      disposition: 'deleted' as const,
      deleted_at: '2026-07-20T04:05:00.000Z',
      deletion_root_id: 'task-a',
    };
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [deletedTask] });
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      mode: 'connected',
      syncState: 'connected',
    });
    const { container, root } = renderShell('/tasks/trash');

    try {
      expect(container.querySelector<HTMLButtonElement>(
        'button[aria-label="Permanently Delete Existing task"]',
      )).toBeEnabled();
    } finally {
      cleanup(root, container);
    }

    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 1,
    });
    const pendingRender = renderShell('/tasks/trash');
    try {
      expect(pendingRender.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Permanently Delete Existing task"]',
      )).toBeDisabled();
    } finally {
      cleanup(pendingRender.root, pendingRender.container);
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
      await openTaskMenuSurface(container, 'Existing task', 'When...');
      const makeAvailable = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
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

      await openTaskMenuSurface(container, 'Existing task', 'When...');
      const moveSomeday = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
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
      source_kind: 'mail_message' as const,
      source_url: 'message://synthetic-logbook-message',
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
      expect(container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Mail Message for Existing task"]',
      )?.getAttribute('href')).toBe('message://synthetic-logbook-message');
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

      await openTaskMenuSurface(container, 'Carryover task', 'When...');
      const moveEvening = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
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

  it('renders projects in Today and applies project-specific planning actions', async () => {
    const taskList = { ...defaultTaskList(), tasks: [] };
    const hierarchy = {
      areas: [],
      projects: [planningProject],
      headings: [],
      loading: false,
      error: null,
      moveProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      reorderProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      transitionProject: vi.fn().mockResolvedValue(undefined),
    };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue(hierarchy);
    const { container, root } = renderShell('/tasks/today');

    try {
      expect(container.querySelector('#task-planning-projects-heading')?.textContent)
        .toContain('Projects (1)');
      expect(container.querySelector<HTMLAnchorElement>('a[href="/tasks/projects/project-plan"]')
        ?.textContent).toBe('Plan the launch');

      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Planning actions for Plan the launch"]',
      );
      await act(async () => {
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const tomorrow = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Move to Tomorrow');
      await act(async () => {
        tomorrow?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(hierarchy.moveProjectInPlanning).toHaveBeenCalledWith('project-plan', {
        destination: 'today',
        todaySection: 'daytime',
        startDate: '2026-07-21',
      });
      expect(taskList.moveTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('renders terminal projects in Logbook and reopens them through hierarchy operations', async () => {
    const completedProject = {
      ...planningProject,
      lifecycle: 'completed' as const,
      completed_at: '2026-07-20T05:00:00.000Z',
    };
    const taskList = { ...defaultTaskList(), tasks: [] };
    const hierarchy = {
      areas: [],
      projects: [completedProject],
      headings: [],
      loading: false,
      error: null,
      moveProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      reorderProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      transitionProject: vi.fn().mockResolvedValue(undefined),
    };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue(hierarchy);
    const { container, root } = renderShell('/tasks/logbook');

    try {
      expect(container.textContent).toContain('Completed');
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Reopen Plan the launch"]')?.click();
      });
      expect(hierarchy.transitionProject).toHaveBeenCalledWith(
        'project-plan',
        'reopen_project',
      );
      expect(taskList.transitionTask).not.toHaveBeenCalled();
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
