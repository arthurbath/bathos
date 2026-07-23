import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { waitFor } from '@testing-library/react';
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
const mockTaskDeletedHierarchyRoots = vi.fn();
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
  getTodayTaskSection: (value: { today_section: string }) => (
    value.today_section === 'none' ? 'inbox' : value.today_section
  ),
  getTaskTodayMembershipSection: (value: {
    start_date: string | null;
    today_section: string;
  }, planningDate: string) => (
    (value.start_date === null && value.today_section !== 'none')
    || (value.start_date !== null && value.start_date <= planningDate)
      ? value.today_section === 'none' ? 'inbox' : value.today_section
      : null
  ),
  taskIsVisible: (value: {
    destination: string;
    today_section: string | null;
    start_date: string | null;
    deadline: string | null;
    lifecycle: string;
    disposition: string;
  }, _ownerId: string, view: string, planningDate: string) => {
    if (value.lifecycle !== 'open' || value.disposition !== 'present') return false;
    if (view === 'today') {
      return value.destination === 'anytime'
        && value.today_section !== null
        && (value.start_date === null || value.start_date <= planningDate);
    }
    if (view === 'upcoming') {
      return value.destination === 'anytime'
        && ((value.start_date !== null && value.start_date > planningDate)
          || (value.deadline !== null && value.deadline > planningDate));
    }
    return value.destination === view;
  },
}));

vi.mock('@/modules/tasks/hooks/useTaskSearch', () => ({
  useTaskSearch: (...args: unknown[]) => mockTaskSearch(...args),
}));

vi.mock('@/modules/tasks/hooks/useTaskHierarchy', () => ({
  useTaskHierarchy: (...args: unknown[]) => mockTaskHierarchy(...args),
}));

vi.mock('@/modules/tasks/hooks/useTaskDeletedHierarchyRoots', () => ({
  useTaskDeletedHierarchyRoots: (...args: unknown[]) => mockTaskDeletedHierarchyRoots(...args),
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

vi.mock('./TaskSyncDiagnosticsDialog', () => ({
  TaskSyncDiagnosticsDialog: ({ triggerVariant }: { triggerVariant?: string }) => (
    <button type="button" data-trigger-variant={triggerVariant}>Synchronization Status</button>
  ),
}));

vi.mock('./TaskDataPortabilityDialog', () => ({
  TaskDataPortabilityDialog: ({ triggerVariant }: { triggerVariant?: string }) => (
    <button type="button" data-trigger-variant={triggerVariant}>Manage Backups</button>
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
  MobileBottomNav: ({
    items,
    overflowItems = [],
    isActive,
    hrefForPath,
  }: {
    items: Array<{ path: string; label: string }>;
    overflowItems?: Array<{ path: string; label: string }>;
    isActive: (path: string) => boolean;
    hrefForPath: (path: string) => string;
  }) => (
    <nav data-testid="mobile-nav">
      {[...items, ...overflowItems].map(({ path, label }) => (
        <a
          key={path}
          href={hrefForPath(path)}
          aria-current={isActive(path) ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  ),
}));

vi.mock('@/platform/hooks/useHostModule', () => ({
  useModuleBasePath: () => '/tasks',
}));

const task = taskTodoFixture({
  id: 'task-a',
  title: 'Existing task',
  notes: 'Existing notes',
  destination: 'anytime',
  today_section: 'next',
  start_date: '2026-07-20',
});

const planningProject = taskProjectFixture({
  id: 'project-plan',
  title: 'Plan the launch',
  destination: 'anytime',
  today_section: 'next',
  start_date: '2026-07-20',
  client_mutation_id: 'project-plan-mutation',
});

function defaultTaskList() {
  return {
    tasks: [task],
    loading: false,
    error: null,
    createTask: vi.fn().mockImplementation(async (input: {
      title: string;
      notes?: string;
      destination?: 'anytime' | 'someday';
      todaySection?: 'inbox' | 'now' | 'next' | 'later' | null;
      startDate?: string | null;
      deadline?: string | null;
      primaryLink?: string | null;
      actionability?: 'actionable' | 'waiting' | 'rechecking';
      areaId?: string | null;
      projectId?: string | null;
    }) => taskTodoFixture({
      id: 'task-created',
      title: input.title,
      notes: input.notes ?? '',
      destination: input.destination ?? 'anytime',
      today_section: input.todaySection ?? null,
      start_date: input.startDate ?? null,
      deadline: input.deadline ?? null,
      primary_link: input.primaryLink ?? null,
      actionability: input.actionability ?? 'actionable',
      area_id: input.areaId ?? null,
      project_id: input.projectId ?? null,
      client_mutation_id: 'mutation-created',
    })),
    updateTask: vi.fn().mockImplementation(async (taskId: string, patch: Partial<typeof task>) => ({
      ...task,
      id: taskId,
      ...patch,
      revision: task.revision + 1,
      client_mutation_id: 'mutation-updated',
    })),
    moveTask: vi.fn().mockResolvedValue(undefined),
    moveTasks: vi.fn().mockResolvedValue([]),
    reorderTask: vi.fn().mockResolvedValue(undefined),
    reorderTaskTo: vi.fn().mockResolvedValue(undefined),
    transitionTask: vi.fn().mockResolvedValue(undefined),
    duplicateTask: vi.fn().mockResolvedValue(undefined),
    planningDate: '2026-07-20',
  };
}

function defaultTasksRuntime() {
  return {
    mode: 'local' as const,
    syncState: 'local' as const,
    offlineLaunchState: 'ready' as const,
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

async function waitForTaskEditorExit(container: HTMLElement, taskId = 'task-a') {
  await act(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 175));
  });
  expect(container.querySelector(`[id="task-title-${taskId}"]`)).toBeNull();
}

describe('TasksShell', () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockPrepareForSignOut.mockReset().mockResolvedValue(undefined);
    mockTasksRuntime.mockReset().mockReturnValue(defaultTasksRuntime());
    mockTaskList.mockReset();
    mockTaskUndo.mockReset().mockReturnValue({
      available: false,
      redoAvailable: false,
      pending: false,
      loading: false,
      error: null,
      event: null,
      redoEvent: null,
      undo: vi.fn(),
      redo: vi.fn(),
    });
    mockTaskSearch.mockReset().mockReturnValue({
      tasks: [task],
      loading: false,
      error: null,
    });
    mockTaskHierarchy.mockReset().mockReturnValue({
      areas: [],
      projects: [],
      loading: false,
      error: null,
      moveProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      reorderProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      transitionProject: vi.fn().mockResolvedValue(undefined),
    });
    mockTaskDeletedHierarchyRoots.mockReset().mockReturnValue({
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

  it('opens a blank complete editor with Control+N and persists the first valid title', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      expect(container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      const newTask = new KeyboardEvent('keydown', {
        key: 'n', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(newTask);
      });
      const input = container.querySelector<HTMLInputElement>('#task-title-task-draft\\:new');
      expect(input).toBeTruthy();
      expect(input).toHaveValue('');
      expect(document.activeElement).toBe(input);
      expect(document.getElementById('task-primary-link-task-draft:new')).toBeTruthy();
      const draftRow = container.querySelector('[data-task-row-id="task-draft:new"]')!;
      const existingRow = container.querySelector('[data-task-row-id="task-a"]')!;
      expect(draftRow.compareDocumentPosition(existingRow) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();

      await act(async () => {
        setInputValue(input!, 'New local task');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });

      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New local task',
        destination: 'anytime',
        todaySection: 'now',
        startDate: null,
        atTop: true,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('opens task creation with Control+N and leaves single-character keys unbound', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const titleButton = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      titleButton.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
      });
      expect(document.activeElement).toBe(titleButton);

      const captureEvent = new KeyboardEvent('keydown', {
        key: 'n', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(captureEvent);
      });
      const draftTitle = container.querySelector<HTMLInputElement>('#task-title-task-draft\\:new');
      expect(document.activeElement).toBe(draftTitle);
      expect(captureEvent.defaultPrevented).toBe(true);

      await act(async () => {
        draftTitle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
        draftTitle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));
      });
      expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain('Today');
    } finally {
      cleanup(root, container);
    }
  });

  it('navigates non-list routes to Today before opening a new task', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell('/tasks/config');

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'n', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(container.querySelector('[data-task-view-heading]')).toHaveTextContent('Today');
      expect(document.getElementById('task-title-task-draft:new')).toBeTruthy();
      expect(document.activeElement).toBe(document.getElementById('task-title-task-draft:new'));
    } finally {
      cleanup(root, container);
    }
  });

  it('preserves draft metadata entered before the first valid title', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'n', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      const actionability = document.getElementById(
        'task-actionability-task-draft:new',
      ) as HTMLSelectElement;
      await act(async () => {
        setSelectValue(actionability, 'waiting');
      });
      expect(taskList.createTask).not.toHaveBeenCalled();

      const title = document.getElementById('task-title-task-draft:new') as HTMLInputElement;
      await act(async () => {
        setInputValue(title, 'Waiting for review');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });
      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Waiting for review',
        actionability: 'waiting',
        todaySection: 'now',
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('discards an untitled draft when Escape closes the editor', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'n', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      const title = document.getElementById('task-title-task-draft:new') as HTMLInputElement;
      const close = new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true,
      });
      await act(async () => {
        title.dispatchEvent(close);
      });
      await waitForTaskEditorExit(container, 'task-draft:new');
      expect(close.defaultPrevented).toBe(true);
      expect(taskList.createTask).not.toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Task Saved' }));
    } finally {
      cleanup(root, container);
    }
  });

  it('flushes and closes an open to-do with Control+Return from an active field', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      await act(async () => {
        setInputValue(title, 'Close from keyboard');
      });
      const close = new KeyboardEvent('keydown', {
        key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        title.dispatchEvent(close);
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        title: 'Close from keyboard',
      });
      await waitForTaskEditorExit(container);
      expect(close.defaultPrevented).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('toggles deferred completion with Control+K and commits it on close', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      const toggle = new KeyboardEvent('keydown', {
        key: 'k', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        title.dispatchEvent(toggle);
      });
      expect(toggle.defaultPrevented).toBe(true);
      expect(container.querySelector('[aria-label="Mark Incomplete Existing task"]')).toBeTruthy();
      expect(taskList.transitionTask).not.toHaveBeenCalled();

      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
    } finally {
      cleanup(root, container);
    }
  });

  it('toasts when an Upcoming draft saves outside the current list', async () => {
    const taskList = { ...defaultTaskList(), tasks: [] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'n', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      const title = document.getElementById('task-title-task-draft:new') as HTMLInputElement;
      await act(async () => {
        setInputValue(title, 'Needs scheduling');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Task Saved',
        description: 'The task is not visible in the current list.',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('navigates task views with modifier-number commands and suppresses browser defaults', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.focus();
      const upcomingEvent = new KeyboardEvent('keydown', {
        key: '2', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(upcomingEvent);
      });
      expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain('Upcoming');
      expect(mockTaskList).toHaveBeenLastCalledWith('owner-a', 'upcoming', null);
      expect(upcomingEvent.defaultPrevented).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('opens unified search from its visible control and filters on structured source data', async () => {
    const mailTask = {
      ...task,
      id: 'task-mail',
      title: 'Reply to the architect',
      destination: 'anytime' as const,
      today_section: 'later' as const,
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
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Search Tasks and Views"]',
        )?.click();
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

  it('exposes an editable Primary Link in the active task row', () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [{
        ...task,
        source_kind: 'webpage',
        source_url: 'https://example.test/source',
        source_title: 'Synthetic source',
        primary_link: 'https://example.test/source',
      }],
    });
    const { container, root } = renderShell();

    try {
      const link = container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Primary Link for Existing task"]',
      );
      expect(link?.getAttribute('href')).toBe('https://example.test/source');
      expect(link?.target).toBe('_blank');
      expect(link?.title).toBe('https://example.test/source');
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
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Search Tasks and Views"]',
        )?.click();
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
      expect(mockTaskList).toHaveBeenLastCalledWith('owner-a', 'upcoming', 'task-future');
      expect(container.querySelector('#task-title-task-future')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('opens keyboard help with Control+/ and leaves question mark unbound', async () => {
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
      expect(document.querySelector<HTMLElement>('[role="dialog"]')).toBeNull();
      const helpEvent = new KeyboardEvent('keydown', {
        key: '/', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(helpEvent);
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Keyboard Commands');
      expect(dialog.textContent).toContain('Open Next');
      expect(dialog.textContent).toContain('Toggle Completion');
      expect(dialog.textContent).toContain('Command+Return or Escape');
      expect(helpEvent.defaultPrevented).toBe(true);
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

  it('captures task undo and redo before editable controls and browser handlers', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const redo = vi.fn().mockResolvedValue(undefined);
    mockTaskUndo.mockReturnValue({
      available: true,
      redoAvailable: true,
      pending: false,
      loading: false,
      error: null,
      event: { id: 'event-update' },
      redoEvent: { id: 'event-redo' },
      undo,
      redo,
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      expect(container.querySelector('button[aria-label="Undo Last Task Change"]')).toBeNull();
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const editorTitle = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      editorTitle.focus();
      const downstreamHandler = vi.fn();
      editorTitle.addEventListener('keydown', downstreamHandler);
      const undoEvent = new KeyboardEvent('keydown', {
        key: 'z', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle.dispatchEvent(undoEvent);
      });
      expect(undo).toHaveBeenCalledTimes(1);
      expect(undoEvent.defaultPrevented).toBe(true);
      expect(downstreamHandler).not.toHaveBeenCalled();

      const redoEvent = new KeyboardEvent('keydown', {
        key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle.dispatchEvent(redoEvent);
      });
      expect(redo).toHaveBeenCalledTimes(1);
      expect(redoEvent.defaultPrevented).toBe(true);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '/', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      const help = document.querySelector<HTMLElement>('[role="dialog"]')?.textContent;
      expect(help).toContain('Undo a Task Change');
      expect(help).toContain('Redo a Task Change');
      expect(help).toContain('Mac');
      expect(help).toContain('Windows');
    } finally {
      cleanup(root, container);
    }
  });

  it('opens distinct structural Move and temporal When surfaces from the action menu', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [],
      projects: [{ id: 'project-a', title: 'House' }],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      const titleButton = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      await openTaskMenuSurface(container, 'Existing task', 'Move...');
      const project = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'House');
      await act(async () => {
        project?.click();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        area_id: null,
        project_id: 'project-a',
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(titleButton);

      await openTaskMenuSurface(container, 'Existing task', 'When...');
      const someday = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Move to Someday');
      await act(async () => {
        someday?.click();
      });
      expect(taskList.moveTask).toHaveBeenCalledWith('task-a', {
        destination: 'someday',
        todaySection: null,
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
      await openTaskMenuSurface(container, 'Existing task', 'When...');
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
        todaySection: null,
        startDate: null,
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(
          container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]'),
        );
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps single-character and bare-arrow commands inert while preserving modifier reorder', async () => {
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
      expect(document.activeElement).toBe(first);

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
      expect(taskList.transitionTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('opens the next and previous visible task and places the caret at the title end', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      const openNext = () => window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 's', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      }));
      const openPrevious = () => window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'w', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      }));

      await act(async () => openNext());
      const firstTitle = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      expect(document.activeElement).toBe(firstTitle);
      expect(firstTitle.selectionStart).toBe(firstTitle.value.length);
      expect(firstTitle.selectionEnd).toBe(firstTitle.value.length);

      await act(async () => openNext());
      const secondTitle = container.querySelector<HTMLInputElement>('#task-title-task-b')!;
      expect(container.querySelector('[data-task-row-id="task-a"] [data-task-editor-region]'))
        .toHaveAttribute('data-state', 'closing');
      await waitForTaskEditorExit(container);
      expect(document.activeElement).toBe(secondTitle);

      await act(async () => openPrevious());
      expect(document.activeElement).toBe(
        container.querySelector<HTMLInputElement>('#task-title-task-a'),
      );

      await act(async () => openPrevious());
      await waitForTaskEditorExit(container);
      await act(async () => openPrevious());
      expect(document.activeElement).toBe(
        container.querySelector<HTMLInputElement>('#task-title-task-b'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('defers an open task completion until the editor closes', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-title-control][data-task-id="task-a"]')
          ?.click();
      });
      const complete = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete Existing task"]',
      )!;
      await act(async () => complete.click());
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      expect(container.querySelector('button[aria-label="Mark Incomplete Existing task"]'))
        .toHaveAttribute('aria-pressed', 'true');

      const closeEvent = new KeyboardEvent('keydown', {
        key: 'x', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        container.querySelector<HTMLInputElement>('#task-title-task-a')?.dispatchEvent(closeEvent);
        await Promise.resolve();
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      await waitForTaskEditorExit(container);
      expect(document.activeElement).toBe(document.body);
    } finally {
      cleanup(root, container);
    }
  });

  it('toggles the open task completion with its modifier command without closing it', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-title-control][data-task-id="task-a"]')
          ?.click();
      });
      const completionEvent = new KeyboardEvent('keydown', {
        key: 'd', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        container.querySelector<HTMLInputElement>('#task-title-task-a')
          ?.dispatchEvent(completionEvent);
      });
      expect(completionEvent.defaultPrevented).toBe(true);
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      expect(container.querySelector('#task-title-task-a')).toBeTruthy();
      expect(container.querySelector('button[aria-label="Mark Incomplete Existing task"]'))
        .toHaveAttribute('aria-pressed', 'true');
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
      const firstTitle = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      await act(async () => {
        firstTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')?.textContent)
        .toContain('1 Task Selected');
      expect(container.querySelector('[aria-label="Add a Task"]')).toBeNull();

      const second = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Select Second task"]',
      );
      await act(async () => {
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
      const later = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Move to Today Later');
      await act(async () => later?.click());

      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a', 'task-b'], {
        destination: 'anytime',
        todaySection: 'later',
        startDate: null,
      });
      expect(container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(
        container.querySelector('[data-task-view-heading]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('dismisses bulk selection outside to-dos while retaining row and selection-surface interactions', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();

    try {
      const firstTitle = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      await act(async () => {
        firstTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      const selection = container.querySelector<HTMLElement>(
        'section[aria-label="Task Selection"]',
      )!;

      await act(async () => {
        firstTitle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        selection.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeTruthy();

      const plan = Array.from(selection.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Plan Selected')!;
      await act(async () => {
        plan.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        plan.click();
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      await act(async () => {
        dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeTruthy();

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-view-heading]')?.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true }),
        );
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeNull();
      expect(container.querySelector('[aria-label="Add a Task"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('selects every visible to-do with the platform select-all command from any list state', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();

    try {
      const selectAllFromNoSelection = new KeyboardEvent('keydown', {
        key: 'a', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(selectAllFromNoSelection);
        await Promise.resolve();
      });
      expect(selectAllFromNoSelection.defaultPrevented).toBe(true);
      expect(container.querySelector('section[aria-label="Task Selection"]')?.textContent)
        .toContain('2 Tasks Selected');

      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Deselect Second task"]',
        )?.click();
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')?.textContent)
        .toContain('1 Task Selected');

      const selectAllFromPartialSelection = new KeyboardEvent('keydown', {
        key: 'a', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(selectAllFromPartialSelection);
        await Promise.resolve();
      });
      expect(selectAllFromPartialSelection.defaultPrevented).toBe(true);
      expect(container.querySelector('section[aria-label="Task Selection"]')?.textContent)
        .toContain('2 Tasks Selected');
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');
    } finally {
      cleanup(root, container);
    }
  });

  it('completes every bulk-selected to-do with Control+K', async () => {
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
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'a', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      const complete = new KeyboardEvent('keydown', {
        key: 'k', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(complete);
      });
      expect(complete.defaultPrevented).toBe(true);
      expect(taskList.transitionTask).toHaveBeenNthCalledWith(1, 'task-a', 'complete');
      expect(taskList.transitionTask).toHaveBeenNthCalledWith(2, 'task-b', 'complete');
      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('preserves native select-all inside editable controls', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const editorTitle = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      editorTitle.focus();
      const selectAll = new KeyboardEvent('keydown', {
        key: 'a', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle.dispatchEvent(selectAll);
      });
      expect(selectAll.defaultPrevented).toBe(false);
      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('uses square completion and circular bulk-selection controls', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();

    try {
      expect(container.querySelector(
        'button[aria-label="Complete Existing task"] svg.lucide-square',
      )).toBeTruthy();
      const title = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      await act(async () => {
        title.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }));
      });
      expect(container.querySelector(
        'button[aria-label="Deselect Existing task"] svg.lucide-circle-check-big',
      )).toBeTruthy();
      expect(container.querySelector(
        'button[aria-label="Select Second task"] svg.lucide-circle',
      )).toBeTruthy();
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
      const firstTitle = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      await act(async () => {
        firstTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      await act(async () => {
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
        destination: 'anytime',
        todaySection: 'next',
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

  it('replaces repeated Shift-click ranges from the original pointer-selection anchor', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    const thirdTask = {
      ...task,
      id: 'task-c',
      title: 'Third task',
      order_key: 'a2',
      client_mutation_id: 'mutation-c',
    };
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [task, secondTask, thirdTask],
    });
    const { container, root } = renderShell();

    try {
      const secondTitle = container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')!;
      await act(async () => {
        secondTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      const thirdTitle = container.querySelector<HTMLButtonElement>('[data-task-id="task-c"]')!;
      await act(async () => {
        thirdTitle.dispatchEvent(new MouseEvent('click', {
          shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(container.querySelector('[aria-label="Select Existing task"]'))
        .toHaveAttribute('aria-checked', 'false');
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Deselect Third task"]'))
        .toHaveAttribute('aria-checked', 'true');

      const firstTitle = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      await act(async () => {
        firstTitle.dispatchEvent(new MouseEvent('click', {
          shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Select Third task"]'))
        .toHaveAttribute('aria-checked', 'false');
    } finally {
      cleanup(root, container);
    }
  });

  it('drops a task at an arbitrary position inside its current ordered scope', async () => {
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
      const source = container.querySelector('[data-task-id="task-a"]')?.closest('article');
      const target = container.querySelector('[data-task-id="task-b"]')?.closest('article');
      if (!source || !target) {
        throw new Error('Expected both draggable task rows');
      }
      expect(source).toHaveAttribute('draggable', 'true');
      const data = new Map<string, string>();
      const dataTransfer = {
        effectAllowed: 'none',
        dropEffect: 'none',
        setData: (type: string, value: string) => data.set(type, value),
        getData: (type: string) => data.get(type) ?? '',
      } as unknown as DataTransfer;
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        bottom: 100,
        height: 100,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperties(dragOver, {
        dataTransfer: { value: dataTransfer },
        clientY: { value: 75 },
      });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });

      await act(async () => {
        source.dispatchEvent(dragStart);
        target.dispatchEvent(dragOver);
      });
      await act(async () => {
        target.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(taskList.reorderTaskTo).toHaveBeenCalledWith('task-a', 'task-b', 'after');
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

  it('keeps Projects in the real-link More hierarchy without duplicate toolbar shortcuts', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const today = renderShell('/tasks/today');

    try {
      const projectsLink = today.container.querySelector<HTMLAnchorElement>(
        '[data-testid="mobile-nav"] a[href="/tasks/projects"]',
      );
      expect(projectsLink?.getAttribute('href')).toBe('/tasks/projects');
      expect(today.container.querySelector('a[aria-label="Open Projects"]')).toBeNull();
      expect(today.container.querySelector('a[aria-label="Open Templates"]')).toBeNull();
    } finally {
      cleanup(today.root, today.container);
    }

    const projects = renderShell('/tasks/projects');
    try {
      expect(projects.container.querySelector('[data-testid="projects-view"]')?.textContent)
        .toBe('Projects');
      const todayLink = projects.container.querySelector<HTMLAnchorElement>(
        '[data-testid="mobile-nav"] a[href="/tasks/today"]',
      );
      expect(todayLink?.getAttribute('href')).toBe('/tasks/today');
      expect(projects.container.querySelector('[data-task-view-heading]')?.textContent)
        .toBe('Projects');
    } finally {
      cleanup(projects.root, projects.container);
    }
  });

  it('uses four direct mobile destinations plus four named overflow destinations', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const today = renderShell('/tasks/today');

    try {
      const mobileLinks = Array.from(today.container.querySelectorAll<HTMLAnchorElement>(
        '[data-testid="mobile-nav"] a',
      ));
      expect(mobileLinks.slice(0, 4).map((link) => link.textContent)).toEqual([
        'Today', 'Upcoming', 'Anytime', 'Someday',
      ]);
      expect(mobileLinks.slice(4).map((link) => link.textContent)).toEqual([
        'Projects', 'Templates', 'Done', 'Config',
      ]);
    } finally {
      cleanup(today.root, today.container);
    }
  });

  it('keeps maintenance surfaces on Config and out of the daily header and body', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const today = renderShell('/tasks/today');

    try {
      expect(today.container.querySelector('[aria-label="Browser Reminder Capability"]')).toBeNull();
      expect(today.container.querySelector('[data-trigger-variant="config"]')).toBeNull();
    } finally {
      cleanup(today.root, today.container);
    }

    const config = renderShell('/tasks/config');
    try {
      expect(config.container.querySelector('[data-task-view-heading]')?.textContent).toBe('Config');
      for (const title of ['Browser Reminders', 'Synchronization', 'Backup and Restore']) {
        expect(config.container.textContent).toContain(title);
      }
      expect(config.container.querySelectorAll('[data-trigger-variant="config"]')).toHaveLength(2);
      expect(config.container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      expect(config.container.querySelector<HTMLAnchorElement>(
        '[data-testid="mobile-nav"] a[href="/tasks/config"]',
      )?.getAttribute('aria-current')).toBe('page');
    } finally {
      cleanup(config.root, config.container);
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
        '[data-testid="mobile-nav"] a[href="/tasks/templates"]',
      )?.getAttribute('aria-current')).toBe('page');
      expect(templates.container.querySelector<HTMLButtonElement>(
        'nav[aria-label="Task views"] button[aria-label="More Task Views"]',
      )?.getAttribute('aria-pressed')).toBe('true');
      expect(templates.container.querySelector('[data-task-view-heading]')?.textContent)
        .toBe('Templates');
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
        '[data-testid="mobile-nav"] a[href="/tasks/projects"]',
      )?.getAttribute('aria-current')).toBe('page');
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
        '[data-testid="mobile-nav"] a[href="/tasks/projects"]',
      )?.getAttribute('aria-current')).toBe('page');
    } finally {
      cleanup(area.root, area.container);
    }
  });

  it('redirects the retired Inbox route to Today and removes Today membership explicitly', async () => {
    const taskList = { ...defaultTaskList(), tasks: [task] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/inbox');

    try {
      await openTaskMenuSurface(container, 'Existing task', 'When...');
      const moveAnytime = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((item) => item.textContent === 'Remove from Today');
      await act(async () => {
        moveAnytime?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(taskList.moveTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        todaySection: null,
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
      complete?.focus();
      await act(async () => {
        complete?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 170));
      });

      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(
        container.querySelector('[data-task-view-heading]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('restores a failed animated completion and rejects a duplicate terminal action', async () => {
    const taskList = defaultTaskList();
    taskList.transitionTask.mockRejectedValue(new Error('write failed'));
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const complete = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete Existing task"]',
      )!;
      complete.focus();
      await act(async () => {
        complete.click();
        complete.click();
      });
      expect(complete.closest('article')).toHaveAttribute('data-terminal-exiting', 'true');
      expect(taskList.transitionTask).not.toHaveBeenCalled();

      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
      });
      expect(taskList.transitionTask).toHaveBeenCalledTimes(1);
      expect(complete.closest('article')).not.toHaveAttribute('data-terminal-exiting');
      expect(document.activeElement).toBe(
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('skips the decorative completion delay when reduced motion is requested', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Complete Existing task"]',
        )?.click();
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
    } finally {
      window.matchMedia = originalMatchMedia;
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
        if (transition !== 'delete') {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 170));
        }
      });

      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', transition);
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(
          container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]'),
        );
      });
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
      const notes = container.querySelector<HTMLDivElement>('#task-notes-task-a')!;
      const primaryLink = container.querySelector<HTMLInputElement>('#task-primary-link-task-a')!;
      const actionability = container.querySelector<HTMLSelectElement>('#task-actionability-task-a')!;
      const organization = container.querySelector<HTMLSelectElement>('#task-organization-task-a')!;
      const startDate = container.querySelector<HTMLButtonElement>('#task-start-date-task-a')!;
      const clearStartDate = container.querySelector<HTMLButtonElement>('[aria-label="Clear Start Date"]')!;
      const dayHorizon = container.querySelector<HTMLSelectElement>('#task-day-horizon-task-a')!;
      const deadline = container.querySelector<HTMLButtonElement>('#task-deadline-task-a')!;
      const editor = editorTitle.parentElement!;

      expect(Array.from(editor.querySelectorAll<HTMLButtonElement>('button'))
        .some((button) => button.textContent === 'Cancel')).toBe(false);
      expect(Array.from(editor.querySelectorAll<HTMLButtonElement>('button'))
        .some((button) => button.textContent === 'Save')).toBe(false);

      expect(document.activeElement).toBe(editorTitle);
      await tab();
      expect(document.activeElement).toBe(notes);
      await tab();
      expect(document.activeElement).toBe(primaryLink);
      await tab();
      expect(document.activeElement).toBe(actionability);
      await tab();
      expect(document.activeElement).toBe(organization);
      await tab();
      expect(document.activeElement).toBe(startDate);
      await tab();
      expect(document.activeElement).toBe(clearStartDate);
      await tab();
      expect(document.activeElement).toBe(dayHorizon);
      await tab();
      expect(document.activeElement).toBe(deadline);
      await tab(true);
      expect(document.activeElement).toBe(dayHorizon);
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
          new KeyboardEvent('keydown', {
            key: 'x', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
          }),
        );
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      await openTaskMenuSurface(container, 'Existing task', 'Move...');
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

  it('autosaves changed title and notes as one debounced mutation without action buttons', async () => {
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
      expect(document.activeElement).toBe(title);
      await act(async () => {
        setInputValue(title!, 'Revised task');
      });
      const notes = container.querySelector<HTMLDivElement>('#task-notes-task-a');
      await act(async () => {
        notes!.replaceChildren(document.createTextNode('Revised notes'));
        notes!.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        title: 'Revised task',
        notes: 'Revised notes',
      });
      expect(container.querySelector('#task-title-task-a')).toBeTruthy();
      expect(Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .some((button) => button.textContent === 'Save' || button.textContent === 'Cancel'))
        .toBe(false);
    } finally {
      cleanup(root, container);
    }
  });

  it('animates an opened editor into view and flushes autosave when the pointer moves outside', async () => {
    const scrollIntoView = vi.fn();
    const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
      });

      const region = container.querySelector<HTMLElement>('[data-task-editor-region]')!;
      expect(region).toHaveAttribute('data-state', 'open');
      expect(region.className).toContain('grid-rows-[1fr]');
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        behavior: 'smooth',
      });

      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      await act(async () => {
        setInputValue(title, 'Saved outside');
        container.querySelector<HTMLElement>('[data-task-view-heading]')?.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        title: 'Saved outside',
      });
      expect(region).toHaveAttribute('data-state', 'closing');
      await waitForTaskEditorExit(container);
    } finally {
      if (previousScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: previousScrollIntoView,
        });
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
      cleanup(root, container);
    }
  });

  it('keeps an editor open while interacting with its portaled controls', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    const portal = document.createElement('div');
    portal.setAttribute('role', 'dialog');
    document.body.appendChild(portal);

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        portal.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });

      expect(container.querySelector('#task-title-task-a')).toBeTruthy();
      expect(container.querySelector('[data-task-editor-region]'))
        .not.toHaveAttribute('data-state', 'closing');
    } finally {
      portal.remove();
      cleanup(root, container);
    }
  });

  it('serializes immediate field autosaves in interaction order', async () => {
    let releaseFirst!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const taskList = defaultTaskList();
    taskList.updateTask
      .mockImplementationOnce(() => firstWrite)
      .mockResolvedValueOnce(undefined);
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const actionability = container.querySelector<HTMLSelectElement>(
        '#task-actionability-task-a',
      )!;
      const dayHorizon = container.querySelector<HTMLSelectElement>(
        '#task-day-horizon-task-a',
      )!;
      await act(async () => {
        setSelectValue(actionability, 'waiting');
        setSelectValue(dayHorizon, 'later');
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledTimes(1);
      expect(taskList.updateTask).toHaveBeenNthCalledWith(1, 'task-a', {
        actionability: 'waiting',
      });

      await act(async () => {
        releaseFirst();
        await firstWrite;
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledTimes(2);
      expect(taskList.updateTask).toHaveBeenNthCalledWith(2, 'task-a', {
        today_section: 'later',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('flushes a pending title autosave when the editor closes', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      const closeEvent = new KeyboardEvent('keydown', {
        key: 'x', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        setInputValue(title, 'Saved on close');
        title.dispatchEvent(closeEvent);
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        title: 'Saved on close',
      });
      await waitForTaskEditorExit(container);
    } finally {
      cleanup(root, container);
    }
  });

  it('waits for the closing autosave before committing deferred completion', async () => {
    let releaseUpdate!: () => void;
    const pendingUpdate = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });
    const taskList = defaultTaskList();
    taskList.updateTask.mockReturnValueOnce(pendingUpdate);
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      await act(async () => {
        setInputValue(title, 'Complete after autosave');
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Complete Existing task"]',
        )?.click();
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'x', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        title: 'Complete after autosave',
      });
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      expect(container.querySelector('#task-title-task-a')).toBeTruthy();

      await act(async () => {
        releaseUpdate();
        await pendingUpdate;
        await Promise.resolve();
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      await waitForTaskEditorExit(container);
    } finally {
      cleanup(root, container);
    }
  });

  it('shows hierarchy context and moves a task structurally without changing planning state', async () => {
    const organizedTask = {
      ...task,
      area_id: null,
      project_id: 'project-launch',
      hierarchy_order_key: 'a0',
    };
    const taskList = { ...defaultTaskList(), tasks: [organizedTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-work', title: 'Work' }],
      projects: [{ id: 'project-launch', title: 'Launch' }],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      expect(container.textContent).toContain('Launch');
      const titleButton = container.querySelector<HTMLButtonElement>('button[data-task-id="task-a"]')!;
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
      const titleButton = container.querySelector<HTMLButtonElement>('button[data-task-id="task-a"]');
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
        localTime: '10:30', ambiguityChoice: 'earlier',
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
      expect(container.querySelector<HTMLInputElement>('#task-reminder-time-task-a')?.disabled)
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
    const { container, root } = renderShell('/tasks/config');

    try {
      expect(container.querySelector('[aria-label="Browser Reminder Capability"]')?.textContent)
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
    const { container, root } = renderShell('/tasks/config');

    try {
      const capability = container.querySelector('[aria-label="Browser Reminder Capability"]');
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

  it('retains the active day horizon when its future Start Date is cleared', async () => {
    const laterTask = {
      ...task,
      today_section: 'later' as const,
      start_date: '2026-07-24',
    };
    const taskList = { ...defaultTaskList(), tasks: [laterTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const titleButton = container.querySelector<HTMLButtonElement>('button[data-task-id="task-a"]');
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
        today_section: 'later',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('closes editing with Control+Shift+X and clears page focus', async () => {
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
      const closeEvent = new KeyboardEvent('keydown', {
        key: 'x', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle?.dispatchEvent(closeEvent);
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      await waitForTaskEditorExit(container);
      expect(closeEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(document.body);
    } finally {
      cleanup(root, container);
    }
  });

  it('falls back to keyup when the browser consumes the close-command keydown', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-title-control][data-task-id="task-a"]')
          ?.click();
      });
      const editorTitle = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      const closeEvent = new KeyboardEvent('keyup', {
        key: 'x', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => editorTitle.dispatchEvent(closeEvent));

      expect(closeEvent.defaultPrevented).toBe(true);
      await waitForTaskEditorExit(container);
      expect(document.activeElement).toBe(document.body);
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

  it('shows deleted tasks in Done and restores them without exposing task capture', async () => {
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
    const { container, root } = renderShell('/tasks/done');

    try {
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      const restore = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Restore Existing task"]',
      );
      await act(async () => {
        restore?.click();
      });

      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'done', null);
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'restore');
      expect(container.querySelector('button[aria-label="Permanently Delete Existing task"]'))
        .toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('restores independently deleted checklist items from Done', async () => {
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [] });
    const deletedChecklistItem = {
      id: 'checklist-a',
      title: 'Verify release',
      deleted_at: '2026-07-20T04:05:00.000Z',
      root_type: 'checklist_item' as const,
    };
    const restore = vi.fn().mockResolvedValue(undefined);
    mockTaskDeletedHierarchyRoots.mockReturnValue({
      roots: [deletedChecklistItem],
      loading: false,
      error: null,
      restore,
    });
    const { container, root } = renderShell('/tasks/done');

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

  it('never exposes user-triggered permanent deletion from Done', () => {
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
    const { container, root } = renderShell('/tasks/done');

    try {
      expect(container.querySelector<HTMLButtonElement>(
        'button[aria-label="Permanently Delete Existing task"]',
      )).toBeNull();
    } finally {
      cleanup(root, container);
    }

    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 1,
    });
    const pendingRender = renderShell('/tasks/done');
    try {
      expect(pendingRender.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Permanently Delete Existing task"]',
      )).toBeNull();
    } finally {
      cleanup(pendingRender.root, pendingRender.container);
    }
  });

  it('shows future-start work in Upcoming and can make it available today', async () => {
    const upcomingTask = { ...task, today_section: 'next' as const, start_date: '2026-07-24' };
    const taskList = { ...defaultTaskList(), tasks: [upcomingTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'upcoming', null);
      expect(container.querySelector('[aria-label="Day Horizon Next"]')).toHaveClass('text-warning');
      expect(container.querySelector('[aria-label="Upcoming Tasks"]')?.textContent)
        .toContain('Friday, July 24 (1)');
      const titleLine = container.querySelector('[data-task-id="task-a"] span.flex');
      expect(titleLine?.firstElementChild).toHaveAttribute('aria-label', 'Day Horizon Next');
      await openTaskMenuSurface(container, 'Existing task', 'When...');
      const dayHorizon = document.querySelector<HTMLSelectElement>('#task-when-horizon-task-a')!;
      await act(async () => {
        dayHorizon.value = 'now';
        dayHorizon.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const savePlanning = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((item) => item.textContent === 'Save Planning');
      await act(async () => {
        savePlanning?.click();
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        start_date: '2026-07-24',
        today_section: 'now',
      });

      await openTaskMenuSurface(container, 'Existing task', 'When...');
      const makeAvailable = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((item) => item.textContent === 'Move to Today Later');
      await act(async () => {
        makeAvailable?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(taskList.moveTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        todaySection: 'later',
        startDate: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('orders the complete Upcoming surface from nearest to latest across projects and to-dos', () => {
    const taskList = {
      ...defaultTaskList(),
      tasks: [
        taskTodoFixture({
          id: 'task-august-first',
          title: 'August first task',
          start_date: '2026-08-01',
        }),
        taskTodoFixture({
          id: 'task-july-twenty-second',
          title: 'July twenty-second task',
          start_date: '2026-07-22',
        }),
        taskTodoFixture({
          id: 'task-july-thirtieth',
          title: 'July thirtieth task',
          start_date: '2026-07-30',
        }),
      ],
    };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [],
      projects: [
        taskProjectFixture({
          id: 'project-september',
          title: 'September project',
          start_date: '2026-09-10',
        }),
        taskProjectFixture({
          id: 'project-august-fifth',
          title: 'August fifth project',
          start_date: '2026-08-05',
        }),
      ],
      loading: false,
      error: null,
      moveProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      reorderProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      transitionProject: vi.fn().mockResolvedValue(undefined),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const upcoming = container.querySelector('[aria-label="Upcoming Tasks"]');
      const text = upcoming?.textContent ?? '';
      expect(text.indexOf('July twenty-second task'))
        .toBeLessThan(text.indexOf('July thirtieth task'));
      expect(text.indexOf('July thirtieth task'))
        .toBeLessThan(text.indexOf('August first task'));
      expect(text.indexOf('August first task'))
        .toBeLessThan(text.indexOf('August fifth project'));
      expect(text.indexOf('August fifth project'))
        .toBeLessThan(text.indexOf('September project'));
      expect(upcoming?.querySelector('#task-planning-projects-heading')).toBeNull();
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
      const marker = container.querySelector('[aria-label="Today Next"]');
      expect(marker).toHaveClass('text-warning');
      expect(marker?.parentElement?.firstElementChild).toBe(marker);
      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'anytime', null);
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      expect(container.querySelector('section[aria-label="Anytime Tasks"]')).toBeTruthy();

      await openTaskMenuSurface(container, 'Existing task', 'When...');
      const moveSomeday = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((item) => item.textContent === 'Move to Someday');
      await act(async () => {
        moveSomeday?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(taskList.moveTask).toHaveBeenCalledWith('task-a', {
        destination: 'someday',
        todaySection: null,
        startDate: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('captures inactive work in Someday and activates it when a start date is assigned', () => {
    const somedayTask = {
      ...task, destination: 'someday' as const, today_section: null, start_date: null,
    };
    const taskList = { ...defaultTaskList(), tasks: [somedayTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/someday');

    try {
      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'someday', null);
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      expect(container.querySelector('section[aria-label="Someday Tasks"]')).toBeTruthy();
      expect(normalizeTaskEditorPlanningPatch(
        somedayTask,
        { start_date: '2026-07-24' },
        '2026-07-20',
      )).toEqual({
        destination: 'anytime',
        today_section: 'next',
        start_date: '2026-07-24',
      });
      expect(normalizeTaskEditorPlanningPatch(
        { ...task, today_section: 'later' },
        { start_date: '2026-07-24' },
        '2026-07-20',
      )).toEqual({ start_date: '2026-07-24' });
    } finally {
      cleanup(root, container);
    }
  });

  it('shows terminal work in Done and reopens it without exposing task capture', async () => {
    const completedTask = {
      ...task,
      lifecycle: 'completed' as const,
      completed_at: '2026-07-20T04:05:00.000Z',
      source_kind: 'mail_message' as const,
      source_url: 'message://synthetic-logbook-message',
      primary_link: 'message://synthetic-logbook-message',
    };
    const taskList = {
      ...defaultTaskList(),
      tasks: [completedTask],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/done');

    try {
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      expect(container.querySelector('section[aria-label="Done Tasks"]')).toBeTruthy();
      expect(container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Mail Link for Existing task"]',
      )?.getAttribute('href')).toBe('message://synthetic-logbook-message');
      const reopen = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Reopen Existing task"]',
      );
      await act(async () => {
        reopen?.click();
      });

      expect(mockTaskList).toHaveBeenCalledWith('owner-a', 'done', null);
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'reopen');
    } finally {
      cleanup(root, container);
    }
  });

  it('renders Inbox, Now, Next, and Later as distinct Today sections and moves between them', async () => {
    const inboxTask = {
      ...task,
      id: 'task-inbox',
      title: 'Inbox task',
      today_section: 'inbox' as const,
      start_date: '2026-07-20',
    };
    const nowTask = {
      ...task,
      id: 'task-now',
      title: 'Now task',
      today_section: 'now' as const,
      start_date: '2026-07-19',
    };
    const laterTask = {
      ...task,
      id: 'task-later',
      title: 'Later task',
      start_date: '2026-07-20',
      today_section: 'later' as const,
    };
    const taskList = {
      ...defaultTaskList(),
      tasks: [inboxTask, nowTask, { ...task, start_date: '2026-07-20' }, laterTask],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/today');

    try {
      expect(container.textContent).toContain('Now task');
      expect(container.querySelector('#tasks-inbox-heading')?.textContent).toContain('Inbox (1)');
      expect(container.querySelector('#tasks-now-heading')?.textContent).toContain('Now (1)');
      expect(container.querySelector('#tasks-next-heading')?.textContent).toContain('Next (1)');
      expect(container.querySelector('#tasks-later-heading')?.textContent).toContain('Later (1)');

      await openTaskMenuSurface(container, 'Now task', 'When...');
      const moveEvening = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((item) => item.textContent === 'Move to Today Later');
      await act(async () => {
        moveEvening?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(taskList.moveTask).toHaveBeenCalledWith('task-now', {
        destination: 'anytime',
        todaySection: 'later',
        startDate: null,
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
        destination: 'anytime',
        todaySection: 'next',
        startDate: '2026-07-21',
      });
      expect(taskList.moveTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('renders terminal projects in Done and reopens them through hierarchy operations', async () => {
    const completedProject = {
      ...planningProject,
      lifecycle: 'completed' as const,
      completed_at: '2026-07-20T05:00:00.000Z',
    };
    const taskList = { ...defaultTaskList(), tasks: [] };
    const hierarchy = {
      areas: [],
      projects: [completedProject],
      loading: false,
      error: null,
      moveProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      reorderProjectInPlanning: vi.fn().mockResolvedValue(undefined),
      transitionProject: vi.fn().mockResolvedValue(undefined),
    };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue(hierarchy);
    const { container, root } = renderShell('/tasks/done');

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

  it('cycles an open Today task with Control+T and suppresses the browser command', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const shortcut = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(shortcut);
        await Promise.resolve();
      });
      expect(shortcut.defaultPrevented).toBe(true);
      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a'], {
        destination: 'anytime',
        todaySection: 'later',
        startDate: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('applies planning shortcuts to a multi-selection and lets Escape cancel it', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.click();
      });
      const toolbar = container.querySelector<HTMLElement>('[aria-label="Task Selection"]')!;
      expect(toolbar.textContent).toContain('Select None');
      expect(toolbar.className).toContain('fixed');
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'r',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a', 'task-b'], {
        destination: 'anytime',
        todaySection: null,
        startDate: null,
      });
      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => window.dispatchEvent(escape));
      expect(escape.defaultPrevented).toBe(true);
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('opens quick find with Control+F and limits mixed results to three', async () => {
    const matchingTasks = ['One', 'Two', 'Three'].map((suffix, index) => taskTodoFixture({
      ...task,
      id: `task-${index}`,
      title: `Plan ${suffix}`,
      client_mutation_id: `mutation-${index}`,
    }));
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: matchingTasks });
    mockTaskSearch.mockReturnValue({ tasks: matchingTasks, loading: false, error: null });
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-plan', owner_id: 'owner-a', title: 'Plan Area' }],
      projects: [{ id: 'project-plan', owner_id: 'owner-a', title: 'Plan Project' }],
      loading: false,
      error: null,
      moveProjectInPlanning: vi.fn(),
      reorderProjectInPlanning: vi.fn(),
      transitionProject: vi.fn(),
    });
    const { container, root } = renderShell();
    try {
      const shortcut = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => window.dispatchEvent(shortcut));
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog).toHaveAccessibleName('Quick Find');
      const input = dialog.querySelector<HTMLInputElement>(
        '[aria-label="Find To-Dos, Projects, and Areas"]',
      )!;
      await act(async () => {
        setInputValue(input, 'plan');
        await Promise.resolve();
      });
      expect(Array.from(dialog.querySelectorAll('a')).filter(
        (link) => link.textContent !== 'Continue Search',
      )).toHaveLength(3);
      expect(shortcut.defaultPrevented).toBe(true);
      await act(async () => {
        Array.from(dialog.querySelectorAll<HTMLAnchorElement>('a'))
          .find(({ textContent }) => textContent === 'Continue Search')
          ?.click();
        await Promise.resolve();
      });
      const fullSearch = container.querySelector<HTMLInputElement>('[aria-label="Search All To-Dos"]');
      expect(fullSearch?.value).toBe('plan');
      expect(container.querySelector('[data-task-view-heading]')?.textContent).toContain('Search');
      expect(container.querySelector('[aria-label="Task Search Results"]')?.textContent)
        .toContain('To-Dos (3)');
    } finally {
      cleanup(root, container);
    }
  });

  it('opens and focuses inline date, organization, and reminder controls from commands', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [],
      byRootId: new Map(),
      dueItems: [],
      claimError: null,
      projectionError: null,
      mode: 'connected',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      acknowledge: vi.fn().mockResolvedValue(undefined),
      claimDue: vi.fn().mockResolvedValue(undefined),
    });
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'd', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(container.querySelector('#task-deadline-task-a')).toHaveAttribute('aria-expanded', 'true');
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'm', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(container.querySelector('#task-organization-task-a'));
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'e', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(container.querySelector('#task-reminder-time-task-a'));
    } finally {
      cleanup(root, container);
    }
  });

  it('opens centered bulk command surfaces for selected task fields', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'm', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog).toHaveAccessibleName('Move Selected To');
      expect(dialog).toHaveAttribute('data-task-bulk-selection-surface');
      expect(document.activeElement).toBe(dialog.querySelector('[aria-label="Area or Project"]'));
    } finally {
      cleanup(root, container);
    }
  });

  it('clears Primary Link immediately from the open editor', async () => {
    const taskList = {
      ...defaultTaskList(),
      tasks: [taskTodoFixture({ ...task, primary_link: 'https://example.test' })],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Clear Primary Link"]')?.click();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(taskList.updateTask).toHaveBeenCalledWith('task-a', { primary_link: null });
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('labels Upcoming start and due dates with forward-looking temporal metadata', () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [taskTodoFixture({
        ...task,
        start_date: '2026-07-22',
        deadline: '2026-07-25',
      })],
    });
    const { container, root } = renderShell('/tasks/upcoming');
    try {
      expect(container.querySelector('[aria-label="Starts In 2 days"]')).toBeTruthy();
      expect(container.querySelector('[aria-label="Due 5 days left"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('opens Config with Control+Comma instead of a numbered command', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const shortcut = new KeyboardEvent('keydown', {
        key: ',',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(shortcut);
        await Promise.resolve();
      });
      expect(shortcut.defaultPrevented).toBe(true);
      expect(container.querySelector('[data-task-view-heading]')?.textContent).toContain('Config');
    } finally {
      cleanup(root, container);
    }
  });
});
