import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  taskAreaFixture,
  taskRecurrenceDefinitionFixture,
  taskRecurrenceRevisionFixture,
  taskReminderFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';
import { normalizeTaskEditorPlanningPatch } from './taskEditorPlanning';
import { requestTaskStartPickerOpen } from './taskStartPickerEvents';
import { getTasksStorageStatusLabel } from './tasksStorageStatus';
import { TasksShell } from './TasksShell';
import { useBathosFormInteractions } from '@/platform/hooks/useCommandEnterSubmit';
import { TASK_CLIPBOARD_KIND } from '@/modules/tasks/domain/taskClipboard';
import {
  UnsafeTaskRedoError,
} from '@/modules/tasks/domain/taskHistory';

if (typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.scrollIntoView !== 'function') {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => undefined,
  });
}

Object.defineProperty(window, 'scrollBy', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
const mockTaskList = vi.fn();
const mockTaskSearch = vi.fn();
const mockTaskQuickFilterPreference = vi.fn();
const mockTaskAutomaticListSorting = vi.fn();
const mockTaskHierarchy = vi.fn();
const mockTaskDeletedHierarchyRoots = vi.fn();
const mockTaskReminders = vi.fn();
const mockTaskUndo = vi.fn();
const mockTaskRecurrences = vi.fn();
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
  taskWithRetainedViewPlacement: <
    T extends {
      id: string;
      destination: string;
      today_section: string | null;
      start_date: string | null;
      deadline: string | null;
      order_key: string;
    },
  >(
    value: T,
    retainedTaskId: string | null,
    retainedPlacement: Partial<T> | null,
  ) => value.id === retainedTaskId && retainedPlacement !== null
    ? { ...value, ...retainedPlacement }
    : value,
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

vi.mock('@/modules/tasks/hooks/useTaskQuickFilterPreference', () => ({
  useTaskQuickFilterPreference: (...args: unknown[]) => (
    mockTaskQuickFilterPreference(...args)
  ),
}));

vi.mock('@/modules/tasks/hooks/useTaskAutomaticListSorting', () => ({
  useTaskAutomaticListSorting: (...args: unknown[]) => (
    mockTaskAutomaticListSorting(...args)
  ),
}));

vi.mock('@/modules/tasks/hooks/useTaskHierarchy', () => ({
  useTaskHierarchy: (...args: unknown[]) => mockTaskHierarchy(...args),
}));

vi.mock('@/modules/tasks/hooks/useTaskNativeWidgetBridge', () => ({
  useTaskNativeWidgetBridge: vi.fn(),
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

vi.mock('@/modules/tasks/hooks/useTaskRecurrences', () => ({
  useTaskRecurrences: (...args: unknown[]) => mockTaskRecurrences(...args),
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

vi.mock('./TaskAreaDetailView', () => ({
  TaskAreaDetailView: ({ areaId }: { areaId: string }) => (
    <section data-testid="area-detail-view">Area {areaId}</section>
  ),
}));

vi.mock('./TaskTemplatesView', () => ({
  TaskTemplatesView: () => (
    <section data-testid="templates-view">Templates</section>
  ),
}));

vi.mock('./TaskSyncDiagnosticsDialog', () => ({
  TaskSyncDiagnosticsDialog: ({
    triggerVariant,
    inAppReminderStatus,
  }: {
    triggerVariant?: string;
    inAppReminderStatus?: string;
  }) => (
    <button
      type="button"
      data-trigger-variant={triggerVariant}
      data-in-app-reminder-status={inAppReminderStatus}
    >
      Synchronization Status
    </button>
  ),
}));

vi.mock('./TaskDataPortabilityDialog', () => ({
  TaskDataPortabilityDialog: ({ triggerVariant }: { triggerVariant?: string }) => (
    <button type="button" data-trigger-variant={triggerVariant}>Manage Backups</button>
  ),
}));

vi.mock('@/platform/components/ToplineHeader', () => ({
  ToplineHeader: ({ title, onSignOut }: { title: string; onSignOut: () => void }) => (
    <header data-topline-header>
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

function defaultTaskList() {
  return {
    tasks: [task],
    checklistTaskIds: new Set<string>(),
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
    applyTaskPatches: vi.fn().mockResolvedValue([]),
    reorderTask: vi.fn().mockResolvedValue(undefined),
    reorderTaskTo: vi.fn().mockResolvedValue(undefined),
    transitionTask: vi.fn().mockResolvedValue(undefined),
    duplicateTask: vi.fn().mockResolvedValue(undefined),
    planningDate: '2026-07-20',
    retainedTaskPlacement: null,
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

function clipboardEvent(
  type: 'copy' | 'cut' | 'paste',
  text = '',
  setData = vi.fn(),
): ClipboardEvent {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: {
      getData: vi.fn(() => text),
      setData,
    },
  });
  return event;
}

function taskPointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  {
    pointerType = 'touch',
    pointerId = 1,
    clientX,
    clientY,
    isPrimary = true,
  }: {
    pointerType?: string;
    pointerId?: number;
    clientX: number;
    clientY: number;
    isPrimary?: boolean;
  },
): PointerEvent {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as PointerEvent;
  Object.defineProperties(event, {
    pointerType: { configurable: true, value: pointerType },
    pointerId: { configurable: true, value: pointerId },
    clientX: { configurable: true, value: clientX },
    clientY: { configurable: true, value: clientY },
    isPrimary: { configurable: true, value: isPrimary },
  });
  return event;
}

function FormInteractionsHarness({ children }: { children: React.ReactNode }) {
  useBathosFormInteractions();
  return <>{children}</>;
}

function renderShell(initialEntry = '/tasks/today') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = () => {
    root.render(
      <FormInteractionsHarness>
        <MemoryRouter initialEntries={[initialEntry]}>
          <TasksShell
            userId="owner-a"
            displayName="Owner"
            onSignOut={vi.fn()}
          />
        </MemoryRouter>
      </FormInteractionsHarness>,
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

async function selectBathosOption(trigger: HTMLButtonElement, optionLabel: string) {
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
    .find((candidate) => candidate.textContent?.trim() === optionLabel);
  if (!option) throw new Error(`BathOS Select option not found: ${optionLabel}`);
  await act(async () => {
    option.focus();
    option.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
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
  surfaceLabel: 'Move...' | 'Do...' | "Start...",
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

function requestTaskStartPickerOpenForTest(
  container: HTMLElement,
  taskId: string,
  focusTarget: 'start' | 'reminder' = 'start',
) {
  const trigger = document.getElementById(`task-start-${taskId}`);
  if (trigger && !container.contains(trigger)) {
    throw new Error(`Task Start trigger was outside the rendered shell for ${taskId}`);
  }
  if (!trigger) throw new Error(`Task Start trigger was not found for ${taskId}`);
  requestTaskStartPickerOpen(trigger, focusTarget);
}

async function waitForTaskEditorExit(container: HTMLElement, taskId = 'task-a') {
  await waitFor(() => {
    expect(container.querySelector(`[id="task-title-${taskId}"]`)).toBeNull();
  });
}

describe('TasksShell', () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockPrepareForSignOut.mockReset().mockResolvedValue(undefined);
    mockTasksRuntime.mockReset().mockReturnValue(defaultTasksRuntime());
    mockTaskList.mockReset();
    mockTaskQuickFilterPreference.mockReset().mockImplementation(() => {
      const [filter, setFilter] = React.useState<
        'all' | 'actionable' | 'non_actionable' | 'rechecking' | 'waiting'
      >('all');
      return { filter, setFilter };
    });
    mockTaskAutomaticListSorting.mockReset().mockReturnValue({
      enabled: false,
      loading: false,
      error: null,
      pending: false,
      setEnabled: vi.fn().mockResolvedValue(undefined),
    });
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
      undoWhenAvailable: vi.fn().mockResolvedValue(null),
      redoWhenAvailable: vi.fn().mockResolvedValue(null),
      reserveForwardMutation: vi.fn(),
      registerForwardMutation: vi.fn(),
    });
    mockTaskSearch.mockReset().mockReturnValue({
      tasks: [task],
      loading: false,
      error: null,
    });
    mockTaskHierarchy.mockReset().mockReturnValue({
      areas: [],
      loading: false,
      error: null,
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
    mockTaskRecurrences.mockReset().mockReturnValue({
      definitions: [],
      revisions: new Map(),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'local',
      loading: false,
      error: null,
      save: vi.fn(),
      createFromTask: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
    });
  });

  it('opens a visible task supplied by the native companion deep link', async () => {
    const nativeTask = taskTodoFixture({
      id: '53a4b5c1-3a4e-4fab-a5bf-4c1b114fc690',
      title: 'Native companion task',
      destination: 'anytime',
      today_section: 'next',
      start_date: '2026-07-20',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [nativeTask],
    });
    const { container, root } = renderShell(
      `/tasks/today?native_task=${nativeTask.id}`,
    );

    try {
      await waitFor(() => {
        expect(container.querySelector(`#task-title-${nativeTask.id}`)).toBeTruthy();
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('does not open a native deep-linked task outside the current visible projection', async () => {
    const nativeTask = taskTodoFixture({
      id: '53a4b5c1-3a4e-4fab-a5bf-4c1b114fc690',
      title: 'Future native companion task',
      destination: 'anytime',
      today_section: null,
      start_date: '2026-07-21',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [],
    });
    const { container, root } = renderShell(
      `/tasks/today?native_task=${nativeTask.id}`,
    );

    try {
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(container.querySelector(`#task-title-${nativeTask.id}`)).toBeNull();
      expect(container.querySelector('[data-task-editor-region]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('opens a blank complete editor with Alt+Shift+A and persists the first valid title', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      expect(container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      const newTask = new KeyboardEvent('keydown', {
        key: 'a', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(newTask);
      });
      const input = container.querySelector<HTMLInputElement>('#task-title-task-draft\\:new');
      expect(input).toBeTruthy();
      expect(input).toHaveValue('');
      expect(document.activeElement).toBe(input);
      expect(container.querySelector('[aria-label="Add Primary Link"]')).toBeTruthy();
      expect(document.getElementById('task-primary-link-task-draft:new')).toBeNull();
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

  it('persists a new task before the checklist shortcut focuses its checklist', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();
    const focusRequests: string[] = [];
    const recordFocusRequest = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail?.taskId === 'string') {
        focusRequests.push(event.detail.taskId);
      }
    };
    document.addEventListener('bathos:task-checklist-focus', recordFocusRequest);

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'a',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      const title = container.querySelector<HTMLInputElement>(
        '#task-title-task-draft\\:new',
      )!;
      await act(async () => {
        setInputValue(title, 'Task with a checklist');
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'c',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Task with a checklist',
      }));
      expect(focusRequests).toEqual(['task-draft:new']);
    } finally {
      document.removeEventListener('bathos:task-checklist-focus', recordFocusRequest);
      cleanup(root, container);
    }
  });

  it('uses one fixed floating creation action on planning lists and omits it from Done', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const today = renderShell('/tasks/today');

    try {
      const newTaskButtons = today.container.querySelectorAll<HTMLButtonElement>(
        'button[aria-label="New Task"]',
      );
      expect(newTaskButtons).toHaveLength(1);
      expect(newTaskButtons[0]).toHaveAttribute('data-task-floating-create');
      expect(
        today.container.querySelector('[data-task-floating-create-boundary]'),
      ).toHaveClass(
        'fixed',
        'inset-x-0',
        'mx-auto',
        'w-full',
        'max-w-3xl',
        'justify-end',
        'px-4',
        'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]',
      );
      expect(newTaskButtons[0]).toHaveClass(
        'h-14',
        'w-14',
        'rounded-full',
        'border-2',
        'border-success',
        'bg-background',
        'text-success',
        'enabled:hover:!bg-accent',
      );
    } finally {
      cleanup(today.root, today.container);
    }

    mockTaskList.mockReturnValue(defaultTaskList());
    const done = renderShell('/tasks/done');
    try {
      expect(done.container.querySelector('button[aria-label="New Task"]')).toBeNull();
      expect(done.container.querySelector('[data-task-floating-create]')).toBeNull();
    } finally {
      cleanup(done.root, done.container);
    }
  });

  it('creates from the floating action at the top of the first visible Today bucket', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/today');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-floating-create]')?.click();
      });
      const draftRow = container.querySelector<HTMLElement>(
        '[data-task-row-id="task-draft:new"]',
      )!;
      expect(draftRow.closest('section')).toHaveAttribute(
        'aria-labelledby',
        'tasks-next-heading',
      );
      expect(document.getElementById('task-start-task-draft:new')).toHaveTextContent(
        'Today · Next',
      );

      const title = document.getElementById('task-title-task-draft:new') as HTMLInputElement;
      await act(async () => {
        setInputValue(title, 'Created in first Today bucket');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });
      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Created in first Today bucket',
        todaySection: 'next',
        startDate: null,
        atTop: true,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('creates from an Upcoming bucket heading with its canonical month Start', async () => {
    const augustTask = taskTodoFixture({
      id: 'task-august',
      title: 'August work',
      destination: 'anytime',
      today_section: null,
      start_date: '2026-08-15',
    });
    const taskList = { ...defaultTaskList(), tasks: [augustTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const bucketButton = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Add Task to August 2026"]',
      )!;
      expect(bucketButton).toHaveClass('cursor-pointer');
      expect(bucketButton.querySelector('svg')).toHaveClass(
        'opacity-0',
        'group-hover:opacity-100',
        'group-focus-visible:opacity-100',
      );

      await act(async () => bucketButton.click());
      const draftRow = container.querySelector<HTMLElement>(
        '[data-task-row-id="task-draft:new"]',
      )!;
      expect(draftRow.closest('section')).toHaveAttribute(
        'aria-labelledby',
        'tasks-month-2026-08-heading',
      );
      const sectionRows = draftRow.closest('section')?.querySelectorAll(
        '[data-task-row-id]',
      );
      expect(sectionRows?.[0]).toBe(draftRow);

      const title = document.getElementById('task-title-task-draft:new') as HTMLInputElement;
      await act(async () => {
        setInputValue(title, 'Created in August');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });
      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Created in August',
        todaySection: null,
        startDate: '2026-08-01',
        atTop: true,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('uses tomorrow when the floating action creates in an empty Upcoming view', async () => {
    const taskList = { ...defaultTaskList(), tasks: [] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-floating-create]')?.click();
      });
      expect(container.querySelector('[data-task-row-id="task-draft:new"]')).toBeTruthy();
      expect(document.getElementById('task-start-task-draft:new')).toHaveTextContent(
        'Tomorrow',
      );

      const title = document.getElementById('task-title-task-draft:new') as HTMLInputElement;
      await act(async () => {
        setInputValue(title, 'Tomorrow task');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });
      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Tomorrow task',
        startDate: '2026-07-21',
        todaySection: null,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('opens Quick Find with a single character from a focused task', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const titleButton = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      titleButton.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
      });
      expect(document.querySelector<HTMLInputElement>(
        '[aria-label="Find Tasks and Areas"]',
      )?.value).toBe('n');
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
          key: 'a', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
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
          key: 'a', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      const actionability = document.getElementById(
        'task-actionability-task-draft:new',
      ) as HTMLButtonElement;
      await selectBathosOption(actionability, 'Waiting');
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

  it('retains Today Inbox and a pending reminder until an untitled draft is created', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T20:00:00.000Z'));
    const taskList = defaultTaskList();
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(taskList);
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: saveReminder, cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'a', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-draft:new', 'reminder');
      });
      const reminderTime = document.getElementById(
        'task-start-reminder-task-draft:new',
      ) as HTMLInputElement;
      expect(reminderTime).toBeEnabled();

      await act(async () => {
        setInputValue(reminderTime, '2p');
        reminderTime.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(taskList.createTask).not.toHaveBeenCalled();
      expect(saveReminder).not.toHaveBeenCalled();
      expect(document.getElementById('task-start-task-draft:new'))
        .toHaveTextContent('Today · Inbox');

      const title = document.getElementById('task-title-task-draft:new') as HTMLInputElement;
      await act(async () => {
        setInputValue(title, 'Reminder-backed draft');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });

      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Reminder-backed draft',
        destination: 'anytime',
        startDate: null,
        todaySection: 'inbox',
      }));
      expect(saveReminder).toHaveBeenCalledWith(expect.objectContaining({
        rootType: 'todo',
        rootId: 'task-created',
        reminder: null,
        localTime: '14:00',
      }));
      expect(taskList.createTask.mock.invocationCallOrder[0])
        .toBeLessThan(saveReminder.mock.invocationCallOrder[0]);
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('keeps an untitled draft open on plain Escape and discards it on the form-submit command', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'a', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      const title = document.getElementById('task-title-task-draft:new') as HTMLInputElement;
      const close = new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true,
      });
      await act(async () => {
        title.dispatchEvent(close);
      });
      expect(container.querySelector('[id="task-title-task-draft:new"]')).toBe(title);
      expect(close.defaultPrevented).toBe(false);

      const submitClose = new KeyboardEvent('keydown', {
        key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        title.dispatchEvent(submitClose);
      });
      await waitForTaskEditorExit(container, 'task-draft:new');
      expect(submitClose.defaultPrevented).toBe(true);
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
      expect(document.activeElement).toBe(
        container.querySelector('[data-task-row-id="task-a"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('toggles deferred completion with the Windows Tasks command and commits it on close', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      const toggle = new KeyboardEvent('keydown', {
        key: 'x', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
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
        await new Promise<void>((resolve) => window.setTimeout(resolve, 420));
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
          key: 'a', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      const title = document.getElementById('task-title-task-draft:new') as HTMLInputElement;
      await act(async () => {
        setInputValue(title, 'Needs scheduling');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 420));
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Task Saved',
        description: 'The task is not visible in the current list.',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('navigates task views with the Windows application commands and suppresses browser defaults', async () => {
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
      expect(mockTaskList).toHaveBeenLastCalledWith(
        'owner-a',
        'upcoming',
        null,
        expect.any(Function),
        expect.any(Function),
      );
      expect(upcomingEvent.defaultPrevented).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('opens Quick Find by typing without exposing a visible search control', async () => {
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
      expect(container.querySelector(
        'button[aria-label="Quick Find Tasks and Areas"]',
      )).toBeNull();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'r',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog).toHaveAccessibleName('Quick Find');
      expect(dialog.querySelector('[aria-label="Task Search Filters"]')).toBeNull();
      const search = dialog.querySelector<HTMLInputElement>(
        '[aria-label="Find Tasks and Areas"]',
      )!;
      await act(async () => {
        setInputValue(search, 'architect');
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
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'i',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      const search = dialog.querySelector<HTMLInputElement>(
        '[aria-label="Find Tasks and Areas"]',
      )!;
      await act(async () => {
        setInputValue(search, 'inspection');
      });
      const result = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('a'))
        .find((link) => link.textContent?.includes('Book the inspection'));
      await act(async () => {
        result?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(mockTaskList).toHaveBeenLastCalledWith(
        'owner-a',
        'upcoming',
        'task-future',
        expect.any(Function),
        expect.any(Function),
      );
      expect(container.querySelector('#task-title-task-future')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('opens Quick Find from an unmodified printable key and preserves the first character', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const typeAhead = new KeyboardEvent('keydown', {
        key: 'e',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(typeAhead);
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      const search = dialog.querySelector<HTMLInputElement>(
        '[aria-label="Find Tasks and Areas"]',
      )!;
      expect(dialog).toHaveAccessibleName('Quick Find');
      expect(search.value).toBe('e');
      expect(document.activeElement).toBe(search);
      expect(typeAhead.defaultPrevented).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('preserves shifted printable input when type-to-search opens Quick Find', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '?',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.querySelector<HTMLInputElement>(
        '[aria-label="Find Tasks and Areas"]',
      )?.value).toBe('?');
    } finally {
      cleanup(root, container);
    }
  });

  it('opens type-to-search from Config and leaves editable search input typing alone', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell('/tasks/config');

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'c',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.querySelector<HTMLInputElement>(
        '[aria-label="Find Tasks and Areas"]',
      )?.value).toBe('c');
      await act(async () => {
        document.querySelector<HTMLElement>('[data-modal-close="true"]')?.click();
      });
    } finally {
      cleanup(root, container);
    }

    const searchShell = renderShell('/tasks/search?q=existing');
    try {
      const ownedInput = searchShell.container.querySelector<HTMLInputElement>(
        '[aria-label="Search All Tasks"]',
      )!;
      ownedInput.focus();
      await act(async () => {
        ownedInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'x',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      cleanup(searchShell.root, searchShell.container);
    }
  });

  it('opens keyboard help from its platform shortcut after shifted type-to-search', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      expect(container.querySelector('[aria-label="Keyboard Commands"]')).toBeNull();
      const titleButton = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      titleButton.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '?', shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(document.querySelector<HTMLInputElement>(
        '[aria-label="Find Tasks and Areas"]',
      )?.value).toBe('?');
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-modal-close="true"]')?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const helpEvent = new KeyboardEvent('keydown', {
        key: '/', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(helpEvent);
      });
      expect(helpEvent.defaultPrevented).toBe(true);
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Keyboard Commands');
      expect(dialog.textContent).toContain('Show Keyboard Commands');
      expect(dialog.textContent).toContain('⌘/');
      expect(dialog.textContent).toContain('⌃/');
      expect(dialog.textContent).toContain('Open Next');
      expect(dialog.textContent).toContain('Toggle Done');
      expect(dialog.textContent).toContain('⌘1');
      expect(dialog.textContent).toContain('⌃6');
      expect(dialog.textContent).toContain('Clear Start');
      expect(dialog.textContent).toContain('Set Start to Someday');
      expect(dialog.textContent).toContain('⌘Z / ⌃Z');
      expect(dialog.textContent).toContain('⌃Z / ⌥⇧Z');
      expect(dialog.textContent).toContain('⌃R⌥⇧R');
      expect(dialog.textContent).toContain('⌃T⌥⇧T');
      expect(dialog.textContent).toContain('⌃A⌥⇧A');
      expect(dialog.textContent).toContain('⌃D⌥⇧D');
      expect(dialog.textContent).toContain('⌃F⌥⇧F');
      expect(dialog.textContent).toContain('⌃G⌥⇧G');
      expect(dialog.textContent).toContain('⌃X⌥⇧X');
      expect(dialog.textContent).toContain('⌃B⌥⇧B');
      expect(dialog.textContent).not.toContain('⌃N');
      expect(dialog.textContent).toContain('⌘Return / ⌘Escape');
      expect(dialog.textContent).toContain('Select Multiple');
      expect(dialog.textContent).toContain('Select Range');
      expect(dialog.textContent).toContain('Edit Checklist');
      expect(dialog.textContent).not.toContain('+');
      expect(dialog.textContent).not.toContain('Escape Closes');
      expect(dialog).toHaveClass(
        'focus:outline-none',
        'focus-visible:outline-none',
        'focus:ring-0',
        'focus-visible:ring-0',
        'focus:shadow-none',
        'focus-visible:shadow-none',
      );
      for (const shortcut of dialog.querySelectorAll('kbd')) {
        expect(shortcut).toHaveClass('font-sans');
        expect(shortcut).not.toHaveClass('font-mono', 'text-xs');
      }
      expect(dialog.querySelector('[data-modal-close="true"]')).toHaveClass('focus:ring-2');
      expect(dialog.dataset.dialogFooterless).toBe('true');
      expect(dialog.querySelector('[data-dialog-footer="true"]')).toBeNull();
      expect(dialog.querySelector('[data-dialog-body="true"]')).toHaveClass(
        '-mb-[25px]',
        'border-b-0',
      );
      expect(dialog.textContent).not.toContain('Reorder by Keyboard');
      expect(dialog.textContent).not.toContain('Toggle After Selection Starts');
      expect(dialog.textContent).not.toContain('Reorder Directly');
      await act(async () => {
        (document.activeElement ?? dialog).dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(dialog.dataset.state).toBe('open');
      await act(async () => {
        dialog.querySelector<HTMLButtonElement>('[data-modal-close="true"]')?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(dialog.dataset.state).toBe('closed');

      await act(async () => {
        titleButton.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const titleInput = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      titleInput.focus();
      const editableHelpEvent = new KeyboardEvent('keydown', {
        key: '/', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        titleInput.dispatchEvent(editableHelpEvent);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(editableHelpEvent.defaultPrevented).toBe(true);
      expect(document.querySelector<HTMLElement>('[role="dialog"]')?.textContent)
        .toContain('Keyboard Commands');
    } finally {
      cleanup(root, container);
    }
  });

  it('captures task undo and redo before editable controls and browser handlers', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const redo = vi.fn().mockResolvedValue(undefined);
    const registerForwardMutation = vi.fn();
    mockTaskUndo.mockReturnValue({
      available: false,
      redoAvailable: false,
      pending: false,
      loading: false,
      error: null,
      event: { id: 'event-update' },
      redoEvent: { id: 'event-redo' },
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: undo,
      redoWhenAvailable: redo,
      reserveForwardMutation: vi.fn(),
      registerForwardMutation,
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      expect(mockTaskList.mock.calls[0][3]).toBe(registerForwardMutation);
      expect(container.querySelector('button[aria-label="Undo Last Task Change"]')).toBeNull();
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeTruthy();

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
        key: 'y', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle.dispatchEvent(redoEvent);
      });
      expect(redo).toHaveBeenCalledTimes(1);
      expect(redoEvent.defaultPrevented).toBe(true);

      const shiftedRedoEvent = new KeyboardEvent('keydown', {
        key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle.dispatchEvent(shiftedRedoEvent);
      });
      expect(redo).toHaveBeenCalledTimes(2);
      expect(shiftedRedoEvent.defaultPrevented).toBe(true);

      const alternateUndoEvent = new KeyboardEvent('keydown', {
        key: 'z', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle.dispatchEvent(alternateUndoEvent);
      });
      expect(undo).toHaveBeenCalledTimes(2);
      expect(alternateUndoEvent.defaultPrevented).toBe(true);

      await act(async () => {
        editorTitle.dispatchEvent(new KeyboardEvent('keydown', {
          key: '/', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      const help = document.querySelector<HTMLElement>('[role="dialog"]')?.textContent;
      expect(help).toContain('Undo a Task Change');
      expect(help).toContain('Redo a Task Change');
      expect(help).toContain('Open/Close Task');
      expect(help).toContain('Focus or Advance Through Tasks');
      expect(help).toContain('Move Back Through Tasks');
      expect(help).toContain('Traverse Page Controls');
      expect(help).toContain('Mac');
      expect(help).toContain('Windows');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses neutral toasts when undo or redo has no safely traversable change', async () => {
    const undo = vi.fn().mockResolvedValue(null);
    const redo = vi.fn().mockRejectedValue(
      new UnsafeTaskRedoError('There are no more task changes to redo'),
    );
    mockTaskUndo.mockReturnValue({
      available: false,
      redoAvailable: false,
      pending: false,
      loading: false,
      error: null,
      event: null,
      redoEvent: null,
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: undo,
      redoWhenAvailable: redo,
      reserveForwardMutation: vi.fn(),
      registerForwardMutation: vi.fn(),
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'z', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith({
        title: 'Nothing to Undo',
      }));

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith({
        title: 'Nothing to Redo',
      }));
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('opens distinct structural Move and temporal Do surfaces from the action menu', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-house', title: 'House' }],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      await openTaskMenuSurface(container, 'Existing task', 'Move...');
      const area = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'House');
      await act(async () => {
        area?.click();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        area_id: 'area-house',
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(container.querySelector('[data-task-row-id][aria-current="true"]')).toBeNull();

      await openTaskMenuSurface(container, 'Existing task', 'Do...');
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
      expect(container.querySelector('[data-task-row-id][aria-current="true"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('limits the to-do menu to Move, Do, Start, and Delete without redundant actions', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      );
      await act(async () => {
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const labels = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .map((item) => item.textContent?.trim());
      expect(labels).toEqual(expect.arrayContaining([
        'Move...',
        'Do...',
        "Start...",
        'Delete',
      ]));
      expect(labels).not.toEqual(expect.arrayContaining(['Cancel', 'Move Up', 'Move Down', 'When...']));
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps task focus cleared when menu planning removes the invoked task', async () => {
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
      await openTaskMenuSurface(container, 'Existing task', 'Do...');
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
      expect(container.querySelector('[data-task-row-id][aria-current="true"]')).toBeNull();
      expect(document.activeElement).not.toBe(
        container.querySelector<HTMLElement>('[data-task-row-id="task-b"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps bare-arrow and former modifier-reorder commands inert while letters open Quick Find', async () => {
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
      expect(taskList.reorderTask).not.toHaveBeenCalled();

      first.focus();
      await act(async () => {
        first.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'c', bubbles: true, cancelable: true,
        }));
      });
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      expect(document.querySelector<HTMLInputElement>(
        '[aria-label="Find Tasks and Areas"]',
      )?.value).toBe('c');
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
        key: 's', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      }));
      const openPrevious = () => window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'w', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
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
        container.querySelector<HTMLElement>('[data-task-row-id="task-a"]'),
      );
      expect(container.querySelector('[data-task-row-id="task-a"]'))
        .toHaveAttribute('aria-current', 'true');
      await act(async () => openNext());
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

      const displacedCloseEvent = new KeyboardEvent('keydown', {
        key: 'q', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        container.querySelector<HTMLInputElement>('#task-title-task-a')
          ?.dispatchEvent(displacedCloseEvent);
      });
      expect(displacedCloseEvent.defaultPrevented).toBe(false);
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      expect(container.querySelector<HTMLInputElement>('#task-title-task-a')).toBeTruthy();

      const closeEvent = new KeyboardEvent('keydown', {
        key: 'q', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        container.querySelector<HTMLInputElement>('#task-title-task-a')?.dispatchEvent(closeEvent);
        await Promise.resolve();
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      await waitForTaskEditorExit(container);
      expect(mockTaskList.mock.calls.at(-1)?.[2]).toBe('task-a');
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 190));
      });
      expect(mockTaskList.mock.calls.at(-1)?.[2]).toBeNull();
      expect(document.activeElement).toBe(
        container.querySelector('[data-task-row-id="task-a"]'),
      );
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
        key: 'x', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
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
      const listSurface = container.querySelector<HTMLElement>(
        '[data-task-list-bottom-clearance]',
      )!;
      expect(listSurface).toHaveClass(
        'pb-[calc(env(safe-area-inset-bottom)+11rem)]',
        'md:pb-36',
      );
      expect(listSurface).not.toHaveClass('pb-44');

      const firstTitle = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      await act(async () => {
        firstTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Add a Task"]')).toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')?.textContent)
        .toContain('2 Tasks Selected');
      expect(listSurface).toHaveClass(
        'pb-[calc(env(safe-area-inset-bottom)+11rem)]',
        'md:pb-36',
      );

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

  it('enters selection mode on one modified click and retains it with one remaining task', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      actionability: 'rechecking',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks Selected',
      );

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Deselect Second task"]')
          ?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('clears incidental summary focus after platform-modifier selection and bare Shift', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      actionability: 'rechecking',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();
    try {
      const firstTitle = container.querySelector<HTMLButtonElement>(
        '[data-task-id="task-a"]',
      )!;
      firstTitle.focus();
      expect(document.activeElement).toBe(firstTitle);

      await act(async () => {
        firstTitle.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(document.activeElement).not.toBe(firstTitle);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Shift',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        window.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Shift',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(document.activeElement).not.toBe(firstTitle);
      expect(container.querySelector('[aria-current="true"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('clears incidental summary focus after Shift-click range selection and bare Shift', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      actionability: 'rechecking',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();
    try {
      const firstTitle = container.querySelector<HTMLButtonElement>(
        '[data-task-id="task-a"]',
      )!;
      const secondTitle = container.querySelector<HTMLButtonElement>(
        '[data-task-id="task-b"]',
      )!;

      await act(async () => {
        firstTitle.focus();
        firstTitle.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });

      secondTitle.focus();
      expect(document.activeElement).toBe(secondTitle);
      await act(async () => {
        secondTitle.dispatchEvent(
          new MouseEvent('click', { shiftKey: true, bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks Selected',
      );
      expect(document.activeElement).not.toBe(secondTitle);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Shift',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        window.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Shift',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks Selected',
      );
      expect(document.activeElement).not.toBe(secondTitle);
      expect(container.querySelector('[aria-current="true"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it.each([
    '/tasks/today',
    '/tasks/upcoming',
    '/tasks/anytime',
    '/tasks/someday',
    '/tasks/done',
  ])('offers explicit point-and-click selection entry on %s', (path) => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell(path);
    try {
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('omits explicit task selection entry from Config', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell('/tasks/config');
    try {
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('enters empty selection mode safely and exits after the selected task returns to zero', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[aria-label="Select Tasks"]')?.click();
        await Promise.resolve();
      });

      const toolbar = container.querySelector<HTMLElement>(
        'section[aria-label="Task Selection"]',
      )!;
      expect(toolbar).toHaveTextContent('0 Tasks Selected');
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeNull();
      expect(container.querySelector('[aria-label="Select Existing task"]'))
        .toHaveAttribute('aria-checked', 'false');

      const plan = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Plan Selected')!;
      const cancel = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Cancel')!;
      const selectAll = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Select All')!;
      expect(plan).toBeDisabled();
      expect(cancel).toBeDisabled();
      expect(selectAll).toBeEnabled();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')
          ?.click();
      });
      expect(toolbar).toHaveTextContent('1 Task Selected');
      expect(plan).toBeEnabled();
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')
          ?.click();
        await Promise.resolve();
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeNull();
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('selects the only visible task from an explicitly empty selection', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[aria-label="Select Tasks"]')?.click();
        await Promise.resolve();
      });
      const toolbar = container.querySelector<HTMLElement>(
        'section[aria-label="Task Selection"]',
      )!;
      const selectAll = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Select All')!;

      await act(async () => selectAll.click());
      expect(toolbar).toHaveTextContent('1 Task Selected');
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('closes an open task before explicit empty selection begins', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expect(container.querySelector('#task-title-task-a')).toBeTruthy();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[aria-label="Select Tasks"]')?.click();
        await Promise.resolve();
      });
      expect(container.querySelector('#task-title-task-a')).toBeNull();
      expect(container.querySelector('section[aria-label="Task Selection"]'))
        .toHaveTextContent('0 Tasks Selected');
    } finally {
      cleanup(root, container);
    }
  });

  it('toggles task membership from the full summary row while selection mode is active', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      actionability: 'rechecking',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.click();
        await Promise.resolve();
      });

      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks Selected',
      );
      expect(container.querySelector('#task-title-task-a')).toBeNull();
      expect(container.querySelector('#task-title-task-b')).toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
        await Promise.resolve();
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.click();
        await Promise.resolve();
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('continues to toggle membership through the circular selection control', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      actionability: 'rechecking',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks Selected',
      );

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Deselect Second task"]')
          ?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('#task-title-task-a')).toBeNull();
      expect(container.querySelector('#task-title-task-b')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('enters selection mode from a qualifying touch swipe and suppresses its click', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const header = container.querySelector<HTMLElement>(
        '[data-task-row-id="task-a"] [data-task-row-header]',
      )!;
      const title = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      expect(header).toHaveClass('touch-pan-y');

      await act(async () => {
        header.dispatchEvent(taskPointerEvent('pointerdown', {
          clientX: 200,
          clientY: 100,
        }));
        header.dispatchEvent(taskPointerEvent('pointermove', {
          clientX: 140,
          clientY: 104,
        }));
        header.dispatchEvent(taskPointerEvent('pointerup', {
          clientX: 140,
          clientY: 104,
        }));
        title.click();
        await Promise.resolve();
      });

      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('#task-title-task-a')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('abandons a touch selection gesture after pointer cancellation', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const header = container.querySelector<HTMLElement>(
        '[data-task-row-id="task-a"] [data-task-row-header]',
      )!;

      await act(async () => {
        header.dispatchEvent(taskPointerEvent('pointerdown', {
          clientX: 200,
          clientY: 100,
        }));
        header.dispatchEvent(taskPointerEvent('pointermove', {
          clientX: 140,
          clientY: 100,
        }));
        header.dispatchEvent(taskPointerEvent('pointercancel', {
          clientX: 140,
          clientY: 100,
        }));
        header.dispatchEvent(taskPointerEvent('pointerup', {
          clientX: 140,
          clientY: 100,
        }));
        await Promise.resolve();
      });

      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('includes a keyboard-focused task when a modified click starts selection', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();
    try {
      const firstRow = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      await act(async () => {
        firstRow.focus();
        firstRow.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ', bubbles: true, cancelable: true,
        }));
      });
      expect(firstRow).toHaveAttribute('aria-current', 'true');
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(firstRow).not.toHaveAttribute('aria-current');
    } finally {
      cleanup(root, container);
    }
  });

  it('counts an open task as the first selection and keeps the remaining task closed', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expect(container.querySelector('#task-title-task-a')).toBeTruthy();

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });

      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');
      await waitForTaskEditorExit(container);
      expect(container.querySelector('#task-title-task-a')).toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Deselect Second task"]')
          ?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(container.querySelector('#task-title-task-a')).toBeNull();
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
    } finally {
      cleanup(root, container);
    }
  });

  it('clears whole-task focus on outside interaction and focuses one result for Select All', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const selectAll = new KeyboardEvent('keydown', {
        key: 'a', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(selectAll);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      expect(selectAll.defaultPrevented).toBe(true);
      expect(row).toHaveAttribute('aria-current', 'true');
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();

      await act(async () => {
        container.querySelector('[data-task-view-heading]')?.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true }),
        );
      });
      expect(row).not.toHaveAttribute('aria-current');
      expect(document.activeElement).not.toBe(row);
    } finally {
      cleanup(root, container);
    }
  });

  it('applies task commands to one focused closed task and toggles it open and closed', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();
    try {
      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      await act(async () => {
        row.focus();
        row.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ', bubbles: true, cancelable: true,
        }));
      });
      const complete = new KeyboardEvent('keydown', {
        key: 'x', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(complete);
      });
      expect(container.querySelector('[data-task-row-id="task-a"]'))
        .toHaveAttribute('data-terminal-settling', 'true');
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 420));
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');

      taskList.transitionTask.mockClear();
      await act(async () => {
        row.focus();
        row.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ', bubbles: true, cancelable: true,
        }));
      });
      const toggleOpen = () => window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'q', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      }));
      await act(async () => toggleOpen());
      expect(container.querySelector('#task-title-task-a')).toBeTruthy();
      await act(async () => toggleOpen());
      await waitForTaskEditorExit(container);
      expect(document.activeElement).toBe(
        container.querySelector('[data-task-row-id="task-a"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps task links, completion, and actions as direct accessible controls', async () => {
    const linkedTask = taskTodoFixture({
      ...task,
      primary_link: 'https://example.test/article',
    });
    const taskList = { ...defaultTaskList(), tasks: [linkedTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();
    try {
      const link = container.querySelector<HTMLAnchorElement>(
        '[aria-label="Open Primary Link for Existing task"]',
      )!;
      const modifiedClick = new MouseEvent('click', {
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => link.dispatchEvent(modifiedClick));
      expect(modifiedClick.defaultPrevented).toBe(false);
      expect(container.querySelector('[data-task-row-id="task-a"]'))
        .not.toHaveAttribute('aria-current');
      expect(link).not.toHaveAttribute('tabindex', '-1');

      await act(async () => {
        const actions = container.querySelector<HTMLButtonElement>(
          '[aria-label="Actions for Existing task"]',
        );
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.querySelector('[role="menu"]')).toBeTruthy();
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', bubbles: true, cancelable: true,
        }));
      });

      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[aria-label="Complete Existing task"]',
        )?.click();
      });
      await waitFor(() => {
        expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      });
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
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
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
      expect(container.querySelector('section[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');

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

  it('completes every bulk-selected to-do with the Windows Tasks command', async () => {
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
        key: 'x', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(complete);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
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

  it('copies selected to-dos as a versioned durable task payload', async () => {
    const database = {
      getAll: vi.fn().mockImplementation(async (sql: string) => (
        sql.includes('FROM tasks_todos') ? [task] : []
      )),
      getOptional: vi.fn(),
    };
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      database,
      repository: {},
      hierarchyRepository: {},
      reminderService: {},
      recurrenceService: {},
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      const setData = vi.fn();
      const copy = clipboardEvent('copy', '', setData);
      await act(async () => {
        window.dispatchEvent(copy);
        await Promise.resolve();
      });
      await waitFor(() => expect(setData).toHaveBeenCalled());
      const payload = JSON.parse(setData.mock.calls[0][1] as string);
      expect(payload).toMatchObject({
        kind: TASK_CLIPBOARD_KIND,
        version: 1,
        operation: 'copy',
        tasks: [{ title: 'Existing task' }],
      });
      expect(copy.defaultPrevented).toBe(true);
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Tasks Copied',
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('preserves native Copy in an editable task field', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      const setData = vi.fn();
      const copy = clipboardEvent('copy', '', setData);
      await act(async () => {
        title.dispatchEvent(copy);
      });
      expect(copy.defaultPrevented).toBe(false);
      expect(setData).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('pastes ordinary clipboard text as a Today Inbox task at the top', async () => {
    const repository = {
      createTask: vi.fn().mockImplementation(async (input: Record<string, unknown>) => (
        taskTodoFixture({
          id: 'task-pasted',
          title: String(input.title),
          destination: 'anytime',
          today_section: 'inbox',
          order_key: String(input.orderKey),
        })
      )),
      transitionTask: vi.fn(),
    };
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      database: {
        getAll: vi.fn(),
        getOptional: vi.fn().mockResolvedValue(null),
      },
      repository,
      hierarchyRepository: {},
      reminderService: {},
      recurrenceService: {},
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const paste = clipboardEvent('paste', 'Task from clipboard');
      await act(async () => {
        window.dispatchEvent(paste);
        await Promise.resolve();
      });
      await waitFor(() => expect(repository.createTask).toHaveBeenCalled());
      expect(repository.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Task from clipboard',
        destination: 'anytime',
        todaySection: 'inbox',
        startDate: null,
      }));
      expect(paste.defaultPrevented).toBe(true);
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Task Pasted',
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('duplicates an open task with the standard Windows command and closes the original', async () => {
    const duplicate = taskTodoFixture({
      ...task,
      id: 'task-duplicate',
      client_mutation_id: 'mutation-duplicate',
    });
    const repository = {
      createTask: vi.fn().mockResolvedValue(duplicate),
      transitionTask: vi.fn(),
    };
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      database: {
        getAll: vi.fn().mockImplementation(async (sql: string) => (
          sql.includes('FROM tasks_todos') ? [task] : []
        )),
        getOptional: vi.fn(),
      },
      repository,
      hierarchyRepository: {},
      reminderService: {},
      recurrenceService: {},
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const duplicateEvent = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        container.querySelector<HTMLInputElement>('#task-title-task-a')
          ?.dispatchEvent(duplicateEvent);
        await Promise.resolve();
      });
      await waitFor(() => expect(repository.createTask).toHaveBeenCalled());
      expect(duplicateEvent.defaultPrevented).toBe(true);
      expect(repository.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Existing task',
        notes: 'Existing notes',
      }));
      expect(container.querySelector('[data-task-row-id="task-a"] [data-task-editor-region]'))
        .toHaveAttribute('data-state', 'closing');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Task Duplicated',
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('duplicates one focused closed task and transfers whole-task focus to the duplicate', async () => {
    const duplicate = taskTodoFixture({
      ...task,
      id: 'task-duplicate',
      title: 'Existing task copy',
      client_mutation_id: 'mutation-duplicate',
    });
    const repository = {
      createTask: vi.fn().mockResolvedValue(duplicate),
      transitionTask: vi.fn(),
    };
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      database: {
        getAll: vi.fn().mockImplementation(async (sql: string) => (
          sql.includes('FROM tasks_todos') ? [task] : []
        )),
        getOptional: vi.fn(),
      },
      repository,
      hierarchyRepository: {},
      reminderService: {},
      recurrenceService: {},
    });
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root, rerender } = renderShell();
    try {
      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      await act(async () => {
        row.focus();
        row.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ', bubbles: true, cancelable: true,
        }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'd', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      await waitFor(() => expect(repository.createTask).toHaveBeenCalled());
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Task Duplicated',
      })));
      taskList.tasks = [task, duplicate];
      await act(async () => {
        rerender();
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      });
      expect(container.querySelector('#task-title-task-a')).toBeNull();
      expect(container.querySelector('#task-title-task-duplicate')).toBeNull();
      await waitFor(() => {
        expect(container.querySelector('[data-task-row-id="task-a"]'))
          .not.toHaveAttribute('aria-current');
        expect(container.querySelector('[data-task-row-id="task-duplicate"]'))
          .toHaveAttribute('aria-current', 'true');
        expect(document.activeElement).toBe(
          container.querySelector('[data-task-row-id="task-duplicate"]'),
        );
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('does not delete cut sources when the clipboard write fails', async () => {
    const database = {
      getAll: vi.fn().mockImplementation(async (sql: string) => (
        sql.includes('FROM tasks_todos') ? [task] : []
      )),
      getOptional: vi.fn(),
    };
    const taskList = defaultTaskList();
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      database,
      repository: {},
      hierarchyRepository: {},
      reminderService: {},
      recurrenceService: {},
    });
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      const cut = clipboardEvent('cut', '', vi.fn(() => {
        throw new Error('clipboard denied');
      }));
      await act(async () => {
        window.dispatchEvent(cut);
        await Promise.resolve();
      });
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Tasks Could Not Be Cut',
      })));
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task Selected',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
    } finally {
      cleanup(root, container);
    }
  });

  it('selects Done to-dos for Copy or Duplicate but rejects Cut', async () => {
    const doneTask = taskTodoFixture({
      ...task,
      title: 'Done task',
      lifecycle: 'completed',
      completed_at: '2026-07-20T12:00:00.000Z',
      start_date: null,
    });
    const taskList = { ...defaultTaskList(), tasks: [doneTask] };
    const repository = {
      createTask: vi.fn().mockImplementation(async (input: Record<string, unknown>) => (
        taskTodoFixture({
          id: 'task-reopened-copy',
          title: String(input.title),
          lifecycle: 'open',
          completed_at: null,
          start_date: null,
        })
      )),
      transitionTask: vi.fn(),
    };
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      database: {
        getAll: vi.fn().mockImplementation(async (sql: string) => (
          sql.includes('FROM tasks_todos') ? [doneTask] : []
        )),
        getOptional: vi.fn(),
      },
      repository,
      hierarchyRepository: {},
      reminderService: {},
      recurrenceService: {},
    });
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/done');
    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'a', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(container.querySelector('[data-task-row-id="task-a"]'))
        .toHaveAttribute('aria-current', 'true');
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();

      const cut = clipboardEvent('cut');
      await act(async () => {
        window.dispatchEvent(cut);
        await Promise.resolve();
      });
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Cut Not Available',
      }));

      const duplicate = new KeyboardEvent('keydown', {
        key: 'd', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(duplicate);
        await Promise.resolve();
      });
      await waitFor(() => expect(repository.createTask).toHaveBeenCalled());
      expect(repository.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Done task',
      }));
      expect(duplicate.defaultPrevented).toBe(true);
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
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
          }),
        );
      });
      expect(container.querySelector(
        'button[aria-label="Deselect Existing task"] svg.lucide-circle-check',
      )).toBeTruthy();
      expect(container.querySelector(
        'button[aria-label="Deselect Second task"] svg.lucide-circle-check',
      )).toBeTruthy();
      expect(title.closest('article')).toHaveClass('rounded-md', 'bg-info/20');
      expect(
        container.querySelector('[data-task-id="task-b"]')?.closest('article'),
      ).toHaveClass('rounded-md', 'bg-info/20');
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
      new Error("Deadline cannot be earlier than Start"),
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
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
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
        todaySection: null,
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
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]');
      expect(source).not.toHaveAttribute('draggable');
      expect(sourceHandle).toHaveAttribute('draggable', 'true');
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
        sourceHandle!.dispatchEvent(dragStart);
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

  it('starts task dragging only from the summary row and collapses an open editor', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [task, secondTask],
    });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 20));
      });

      const taskRow = container.querySelector('[data-task-id="task-a"]')?.closest('article');
      const summary = taskRow?.querySelector<HTMLElement>('[data-task-row-header]');
      const dragHandle = summary?.querySelector<HTMLElement>('[data-task-drag-handle]');
      const editor = taskRow?.querySelector<HTMLElement>('[data-task-editor-region]');
      const titleInput = editor?.querySelector<HTMLInputElement>('#task-title-task-a');
      if (!taskRow || !summary || !dragHandle || !editor || !titleInput) {
        throw new Error('Expected an open draggable task');
      }
      expect(taskRow).not.toHaveAttribute('draggable');
      expect(summary).not.toHaveAttribute('draggable');
      expect(dragHandle).toHaveAttribute('draggable', 'true');
      expect(editor).not.toHaveAttribute('draggable');

      const setData = vi.fn();
      let dragPreview: HTMLElement | null = null;
      let dragPreviewWasConnected = false;
      const setDragImage = vi.fn((preview: Element) => {
        dragPreview = preview as HTMLElement;
        dragPreviewWasConnected = preview.isConnected;
      });
      const dataTransfer = {
        effectAllowed: 'none',
        dropEffect: 'none',
        setData,
        setDragImage,
        getData: vi.fn(() => ''),
      } as unknown as DataTransfer;
      const editorDragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(editorDragStart, 'dataTransfer', { value: dataTransfer });
      await act(async () => {
        titleInput.dispatchEvent(editorDragStart);
        await Promise.resolve();
      });
      expect(setData).not.toHaveBeenCalled();
      expect(taskRow.querySelector('[data-task-editor-region]')).toBeTruthy();

      vi.spyOn(summary, 'getBoundingClientRect').mockReturnValue({
        top: 20,
        bottom: 64,
        height: 44,
        left: 10,
        right: 250,
        width: 240,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      });
      const paintedDropIndicator = document.createElement('span');
      paintedDropIndicator.setAttribute('data-task-drop-indicator', '');
      summary.append(paintedDropIndicator);
      const summaryDragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperties(summaryDragStart, {
        dataTransfer: { value: dataTransfer },
        clientX: { value: 70 },
        clientY: { value: 35 },
      });
      await act(async () => {
        dragHandle.dispatchEvent(summaryDragStart);
        await Promise.resolve();
      });
      expect(setData).toHaveBeenCalledWith('application/x-bathos-task-id', 'task-a');
      expect(setData).toHaveBeenCalledWith('text/plain', 'task-a');
      expect(setDragImage).toHaveBeenCalledWith(expect.any(HTMLElement), 60, 15);
      expect(dragPreviewWasConnected).toBe(true);
      expect(dragPreview).toHaveAttribute('data-task-drag-preview', 'true');
      expect(dragPreview).toHaveAttribute('aria-hidden', 'true');
      expect(dragPreview?.querySelector('[data-task-drop-indicator]')).toBeNull();
      expect(dragPreview?.querySelector('[data-task-id="task-a"]')).toBeTruthy();
      await waitFor(() => {
        expect(document.querySelector('[data-task-drag-preview]')).toBeNull();
      });
      expect(taskRow.querySelector('[data-task-editor-region]')).toHaveAttribute(
        'data-state',
        'closing',
      );
      await waitForTaskEditorExit(container);
    } finally {
      cleanup(root, container);
    }
  });

  it('closes a different open task when task dragging begins', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [task, secondTask],
    });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 20));
      });

      const openTaskRow = container.querySelector('[data-task-id="task-a"]')?.closest('article');
      const draggedTaskRow = container.querySelector('[data-task-id="task-b"]')?.closest('article');
      const dragHandle = draggedTaskRow?.querySelector<HTMLElement>('[data-task-drag-handle]');
      if (!openTaskRow || !draggedTaskRow || !dragHandle) {
        throw new Error('Expected an open task and a different draggable task');
      }
      expect(openTaskRow.querySelector('[data-task-editor-region]')).toBeTruthy();
      expect(draggedTaskRow.querySelector('[data-task-editor-region]')).toBeNull();

      const setData = vi.fn();
      const dataTransfer = {
        effectAllowed: 'none',
        dropEffect: 'none',
        setData,
        getData: vi.fn(() => ''),
      } as unknown as DataTransfer;
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });

      await act(async () => {
        dragHandle.dispatchEvent(dragStart);
        await Promise.resolve();
      });

      expect(setData).toHaveBeenCalledWith('application/x-bathos-task-id', 'task-b');
      expect(setData).toHaveBeenCalledWith('text/plain', 'task-b');
      expect(openTaskRow.querySelector('[data-task-editor-region]')).toHaveAttribute(
        'data-state',
        'closing',
      );
      expect(draggedTaskRow.querySelector('[data-task-editor-region]')).toBeNull();
      await waitForTaskEditorExit(container);
    } finally {
      cleanup(root, container);
    }
  });

  it('drags a non-contiguous multi-selection as one atomic visual-order patch', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
    });
    const thirdTask = taskTodoFixture({
      ...task,
      id: 'task-c',
      title: 'Third task',
      order_key: 'a2',
    });
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask, thirdTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const firstTitle = container.querySelector<HTMLElement>('[data-task-id="task-a"]')!;
      const thirdTitle = container.querySelector<HTMLElement>('[data-task-id="task-c"]')!;
      await act(async () => {
        firstTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      await act(async () => {
        thirdTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      const source = container.querySelector('[data-task-id="task-a"]')!.closest('article')!;
      const target = container.querySelector('[data-task-id="task-b"]')!.closest('article')!;
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]');
      expect(source).not.toHaveAttribute('draggable');
      expect(sourceHandle).toHaveAttribute('draggable', 'true');
      const dataTransfer = {
        effectAllowed: 'none',
        dropEffect: 'none',
        setData: vi.fn(),
        getData: vi.fn(() => ''),
      } as unknown as DataTransfer;
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100,
        x: 0, y: 0, toJSON: () => ({}),
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
        sourceHandle!.dispatchEvent(dragStart);
        target.dispatchEvent(dragOver);
        target.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(taskList.applyTaskPatches).toHaveBeenCalledTimes(1);
      expect(taskList.applyTaskPatches.mock.calls[0][0]).toHaveLength(3);
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Deselect Third task"]'))
        .toHaveAttribute('aria-checked', 'true');
    } finally {
      cleanup(root, container);
    }
  });

  it('cancels an active bulk drag without persistence when Escape reaches Tasks', async () => {
    const secondTask = taskTodoFixture({ ...task, id: 'task-b', title: 'Second task' });
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();
    try {
      const firstTitle = container.querySelector<HTMLElement>('[data-task-id="task-a"]')!;
      const secondTitle = container.querySelector<HTMLElement>('[data-task-id="task-b"]')!;
      await act(async () => {
        firstTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      await act(async () => {
        secondTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', {
        value: { effectAllowed: 'none', setData: vi.fn() },
      });
      await act(async () => {
        firstTitle.closest('article')!
          .querySelector<HTMLElement>('[data-task-drag-handle]')!
          .dispatchEvent(dragStart);
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', bubbles: true, cancelable: true,
        }));
      });
      expect(taskList.applyTaskPatches).not.toHaveBeenCalled();
      expect(container.querySelector('[aria-label^="Deselect"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('manually reorders tasks inside one Upcoming date section', async () => {
    const firstTask = taskTodoFixture({
      id: 'task-upcoming-first',
      title: 'Upcoming First',
      start_date: '2026-07-21',
      today_section: null,
      order_key: 'a0',
    });
    const secondTask = taskTodoFixture({
      id: 'task-upcoming-second',
      title: 'Upcoming Second',
      start_date: '2026-07-21',
      today_section: null,
      order_key: 'a1',
    });
    const taskList = {
      ...defaultTaskList(),
      tasks: [firstTask, secondTask],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const source = container.querySelector(
        '[data-task-id="task-upcoming-first"]',
      )?.closest<HTMLElement>('article');
      const target = container.querySelector(
        '[data-task-id="task-upcoming-second"]',
      )?.closest<HTMLElement>('article');
      if (!source || !target) throw new Error('Expected Upcoming task rows');
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]');
      expect(source).not.toHaveAttribute('draggable');
      expect(sourceHandle).toHaveAttribute('draggable', 'true');
      const dataTransfer = {
        effectAllowed: 'none',
        dropEffect: 'none',
        setData: vi.fn(),
        getData: vi.fn(() => ''),
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
        sourceHandle!.dispatchEvent(dragStart);
        target.dispatchEvent(dragOver);
      });
      expect(target).toHaveAttribute('data-drag-placement', 'after');
      await act(async () => {
        target.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(taskList.reorderTaskTo).toHaveBeenCalledWith(
        'task-upcoming-first',
        'task-upcoming-second',
        'after',
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('moves a deadline-only task to another Upcoming section by assigning Start', async () => {
    const deadlineOnlyTask = taskTodoFixture({
      id: 'task-deadline-only',
      title: 'Deadline Only',
      start_date: null,
      deadline: '2026-07-21',
      today_section: null,
      order_key: 'a0',
    });
    const targetTask = taskTodoFixture({
      id: 'task-target-date',
      title: 'Target Date',
      start_date: '2026-07-22',
      deadline: null,
      today_section: null,
      order_key: 'a1',
    });
    const taskList = {
      ...defaultTaskList(),
      tasks: [deadlineOnlyTask, targetTask],
    };
    mockTaskList.mockReturnValue(taskList);
    const reminder = taskReminderFixture({
      id: 'reminder-deadline-only',
      task_id: deadlineOnlyTask.id,
      local_date: '2026-07-21',
      local_time: '09:30:00',
    });
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    mockTaskReminders.mockReturnValue({
      reminders: [reminder],
      byRootId: new Map([[deadlineOnlyTask.id, reminder]]),
      dueItems: [],
      claimError: null,
      projectionError: null,
      mode: 'local',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save: saveReminder,
      cancel: vi.fn().mockResolvedValue(undefined),
      acknowledge: vi.fn().mockResolvedValue(undefined),
      claimDue: vi.fn().mockResolvedValue(undefined),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const source = container.querySelector(
        '[data-task-id="task-deadline-only"]',
      )?.closest<HTMLElement>('article');
      const target = container.querySelector(
        '[data-task-id="task-target-date"]',
      )?.closest<HTMLElement>('article');
      if (!source || !target) throw new Error('Expected cross-section Upcoming rows');
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]');
      const dataTransfer = {
        effectAllowed: 'none',
        dropEffect: 'none',
        setData: vi.fn(),
        getData: vi.fn(() => ''),
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
        clientY: { value: 25 },
      });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });

      await act(async () => {
        sourceHandle!.dispatchEvent(dragStart);
        target.dispatchEvent(dragOver);
      });
      await act(async () => {
        target.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(taskList.reorderTaskTo).toHaveBeenCalledWith(
        'task-deadline-only',
        'task-target-date',
        'before',
        {
          destination: 'anytime',
          start_date: '2026-07-22',
          today_section: null,
        },
      );
      expect(taskList.updateTask).not.toHaveBeenCalled();
      expect(saveReminder).toHaveBeenCalledWith({
        rootType: 'todo',
        rootId: deadlineOnlyTask.id,
        reminder,
        localTime: '09:30',
        ambiguityChoice: 'earlier',
      });
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
        'Templates', 'Done', 'Config',
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
      expect(today.container.querySelector('[aria-label="Keyboard Commands"]')).toBeNull();
    } finally {
      cleanup(today.root, today.container);
    }

    const config = renderShell('/tasks/config');
    try {
      expect(config.container.querySelector('[data-task-view-heading]')?.textContent).toBe('Config');
      for (const title of [
        'Areas',
        'List Sorting',
        'Browser Reminders',
        'Synchronization',
        'Backup and Restore',
      ]) {
        expect(config.container.textContent).toContain(title);
      }
      expect(config.container.querySelector('#tasks-automatic-list-sorting'))
        .toHaveAttribute('data-state', 'unchecked');
      expect(config.container.querySelectorAll('[data-trigger-variant="config"]')).toHaveLength(2);
      expect(config.container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      expect(config.container.querySelector('[aria-label="Keyboard Commands"]')).toBeNull();
      expect(config.container.querySelector('[data-task-keyboard-help-cue]')?.textContent)
        .toBe('Press ⌃/ to view all keyboard commands.');
      expect(config.container.querySelector<HTMLAnchorElement>(
        '[data-testid="mobile-nav"] a[href="/tasks/config"]',
      )?.getAttribute('aria-current')).toBe('page');
    } finally {
      cleanup(config.root, config.container);
    }
  });

  it('persists the single automatic sorting preference from Config', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const setEnabled = vi.fn().mockResolvedValue(undefined);
    mockTaskAutomaticListSorting.mockReturnValue({
      enabled: false,
      loading: false,
      error: null,
      pending: false,
      setEnabled,
    });
    const { container, root } = renderShell('/tasks/config');

    try {
      const toggle = container.querySelector<HTMLButtonElement>(
        '#tasks-automatic-list-sorting',
      );
      await act(async () => {
        toggle?.click();
        await Promise.resolve();
      });
      expect(setEnabled).toHaveBeenCalledWith(true);
    } finally {
      cleanup(root, container);
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

  it('redirects a retired Project detail path to Anytime', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const retired = renderShell('/tasks/projects/project-alpha');
    try {
      expect(retired.container.querySelector('[data-task-view-heading]')?.textContent)
        .toBe('Anytime');
      expect(retired.container.querySelector<HTMLAnchorElement>(
        '[data-testid="mobile-nav"] a[href="/tasks/anytime"]',
      )?.getAttribute('aria-current')).toBe('page');
    } finally {
      cleanup(retired.root, retired.container);
    }
  });

  it('routes an Area detail path as part of Config without exposing task capture', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const area = renderShell('/tasks/areas/area-work');
    try {
      expect(area.container.querySelector('[data-testid="area-detail-view"]')?.textContent)
        .toBe('Area area-work');
      expect(area.container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      expect(area.container.querySelector<HTMLAnchorElement>(
        '[data-testid="mobile-nav"] a[href="/tasks/config"]',
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
      await openTaskMenuSurface(container, 'Existing task', 'Do...');
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
      });

      expect(complete?.closest('article')).toHaveAttribute('data-terminal-settling', 'true');
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 190));
      });
      expect(complete?.closest('article')).toHaveAttribute('data-terminal-exiting', 'true');
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 230));
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

  it('anchors a terminal mutation before Safari Command-Z can arrive during exit motion', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    const undo = vi.fn().mockResolvedValue(undefined);
    const reservation = { commit: vi.fn(), cancel: vi.fn() };
    const reserveForwardMutation = vi.fn().mockReturnValue(reservation);
    mockTaskUndo.mockReturnValue({
      available: false,
      redoAvailable: false,
      pending: false,
      loading: false,
      error: null,
      event: null,
      redoEvent: null,
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: undo,
      redoWhenAvailable: vi.fn().mockResolvedValue(null),
      reserveForwardMutation,
      registerForwardMutation: vi.fn(),
    });
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const complete = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete Existing task"]',
      )!;
      await act(async () => {
        complete.click();
      });
      expect(reserveForwardMutation).toHaveBeenCalledWith(task);
      expect(taskList.transitionTask).not.toHaveBeenCalled();

      const undoEvent = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(undoEvent);
      });
      expect(undoEvent.defaultPrevented).toBe(true);
      expect(undo).toHaveBeenCalledOnce();

      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 420));
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith(
        'task-a',
        'complete',
        reservation,
      );
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
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
      expect(complete.closest('article')).toHaveAttribute('data-terminal-settling', 'true');
      expect(complete.closest('article')).not.toHaveAttribute('data-terminal-exiting');
      expect(taskList.transitionTask).not.toHaveBeenCalled();

      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 190));
      });
      expect(complete.closest('article')).toHaveAttribute('data-terminal-exiting', 'true');
      expect(taskList.transitionTask).not.toHaveBeenCalled();

      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 230));
      });
      expect(taskList.transitionTask).toHaveBeenCalledTimes(1);
      expect(complete.closest('article')).not.toHaveAttribute('data-terminal-exiting');
      expect(document.activeElement).toBe(
        container.querySelector<HTMLElement>('[data-task-row-id="task-a"]'),
      );
      expect(container.querySelector('[data-task-row-id="task-a"]'))
        .toHaveAttribute('aria-current', 'true');
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

  it('Deletes an active task from its actions without focusing another row', async () => {
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
        .find((item) => item.textContent === 'Delete');
      await act(async () => {
        action?.click();
      });

      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'delete');
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
      });
      expect(container.querySelector('[data-task-row-id][aria-current="true"]')).toBeNull();
      expect(document.activeElement).not.toBe(
        container.querySelector<HTMLElement>('[data-task-row-id="task-b"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('requires the platform command with Delete for an open task but accepts plain Delete on whole-task focus', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const openRender = renderShell();

    try {
      await act(async () => {
        openRender.container.querySelector<HTMLButtonElement>(
          '[data-task-id="task-a"]',
        )?.click();
      });
      const title = openRender.container.querySelector<HTMLInputElement>(
        '#task-title-task-a',
      )!;
      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(taskList.transitionTask).not.toHaveBeenCalledWith('task-a', 'delete');

      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Delete',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'delete');
    } finally {
      cleanup(openRender.root, openRender.container);
    }

    taskList.transitionTask.mockClear();
    const focusedRender = renderShell();
    try {
      const row = focusedRender.container.querySelector<HTMLElement>(
        '[data-task-row-id="task-a"]',
      )!;
      row.focus();
      await act(async () => {
        row.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
          cancelable: true,
        }));
      });
      await act(async () => {
        row.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'delete');
    } finally {
      cleanup(focusedRender.root, focusedRender.container);
    }
  });

  it('deletes every explicitly selected task through the guarded lifecycle path', async () => {
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
      const first = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      await act(async () => {
        first.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      const second = container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')!;
      await act(async () => {
        second.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(taskList.transitionTask.mock.calls).toEqual(
        expect.arrayContaining([
          ['task-a', 'delete'],
          ['task-b', 'delete'],
        ]),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('clears whole-task focus after an actions-menu mutation', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      )!;
      await act(async () => {
        actions.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const action = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Mark as Waiting')!;
      await act(async () => {
        action.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        actionability: 'waiting',
      });
      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      expect(row).not.toHaveAttribute('aria-current');
      expect(document.activeElement).not.toBe(row);
      expect(document.activeElement).not.toBe(actions);
    } finally {
      cleanup(root, container);
    }
  });

  it('clears whole-task focus after dismissing the menu and a menu-launched surface', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      const focusRow = async () => {
        await act(async () => {
          row.focus();
          row.dispatchEvent(new KeyboardEvent('keydown', {
            key: ' ',
            bubbles: true,
            cancelable: true,
          }));
        });
        expect(row).toHaveAttribute('aria-current', 'true');
      };

      await focusRow();
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      )!;
      await act(async () => {
        actions.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
      expect(menu).not.toBeNull();
      await act(async () => {
        menu.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.querySelector('[role="menu"]')).toBeNull();
      await waitFor(() => expect(row).not.toHaveAttribute('aria-current'));
      expect(document.activeElement).not.toBe(actions);

      await focusRow();
      await openTaskMenuSurface(container, 'Existing task', 'Start...');
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog).not.toBeNull();
      await act(async () => {
        dialog.querySelector<HTMLButtonElement>('[data-modal-close]')?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(row).not.toHaveAttribute('aria-current');
      expect(document.activeElement).not.toBe(row);
    } finally {
      cleanup(root, container);
    }
  });

  it('combines granular native Tab traversal with wrapped Space and arrow task focus', async () => {
    const user = userEvent.setup();
    const tab = async (shift = false) => {
      await act(async () => {
        await user.tab({ shift });
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
    };
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [{ ...task, primary_link: 'https://example.com/task' }, secondTask],
    });
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-work', owner_id: 'owner-a', title: 'Work' }],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      const complete = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete Existing task"]',
      )!;
      const title = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      const source = container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Primary Link for Existing task"]',
      )!;
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      )!;
      const firstRow = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      const secondRow = container.querySelector<HTMLElement>('[data-task-row-id="task-b"]')!;
      const secondComplete = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete Second task"]',
      )!;
      const secondTitle = container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')!;
      const secondActions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Second task"]',
      )!;

      expect(complete).not.toHaveAttribute('tabindex', '-1');
      expect(title).not.toHaveAttribute('tabindex', '-1');
      expect(source).not.toHaveAttribute('tabindex', '-1');
      expect(actions).not.toHaveAttribute('tabindex', '-1');
      expect(title).toHaveClass('font-normal');
      expect(title).not.toHaveClass('font-medium');
      expect(source).toHaveClass('h-8', 'w-8');
      expect(actions).toHaveClass('h-8', 'w-8');
      expect(actions.closest('[data-task-row-trailing-controls]')).toHaveClass(
        'items-center',
        'gap-0.5',
      );
      expect(firstRow).toHaveClass(
        'focus:outline-none',
        'focus-visible:outline-none',
      );
      await act(async () => firstRow.focus());
      const granularRowEscape = new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true,
      });
      await act(async () => firstRow.dispatchEvent(granularRowEscape));
      expect(granularRowEscape.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(document.body);
      expect(firstRow).not.toHaveAttribute('aria-current');

      await act(async () => complete.focus());
      const granularControlEscape = new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true,
      });
      await act(async () => complete.dispatchEvent(granularControlEscape));
      expect(granularControlEscape.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(document.body);
      expect(firstRow).not.toHaveAttribute('aria-current');

      await act(async () => {
        firstRow.focus();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(firstRow).not.toHaveAttribute('aria-current');
      await tab();
      expect(document.activeElement).toBe(complete);
      await tab();
      expect(document.activeElement).toBe(title);
      await tab();
      expect(document.activeElement).toBe(source);
      await tab();
      expect(document.activeElement).toBe(actions);
      await tab();
      expect(document.activeElement).toBe(secondRow);
      await tab(true);
      expect(document.activeElement).toBe(actions);
      await tab();
      expect(document.activeElement).toBe(secondRow);
      await tab();
      expect(document.activeElement).toBe(secondComplete);
      await tab();
      expect(document.activeElement).toBe(secondTitle);
      await tab();
      expect(document.activeElement).toBe(secondActions);
      await tab();
      expect(document.activeElement?.closest('[data-task-row-id]')).toBeNull();

      await act(async () => {
        firstRow.focus();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const promoteSpace = new KeyboardEvent('keydown', {
        key: ' ', bubbles: true, cancelable: true,
      });
      await act(async () => firstRow.dispatchEvent(promoteSpace));
      expect(promoteSpace.defaultPrevented).toBe(true);
      await waitFor(() => expect(firstRow).toHaveAttribute('aria-current', 'true'));
      expect(document.activeElement).toBe(firstRow);
      expect(firstRow).toHaveClass('rounded-md', 'bg-info/20');
      expect(firstRow).not.toHaveClass('ring-2', 'ring-inset', 'ring-ring');

      const wholeTaskEscape = new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true,
      });
      await act(async () => firstRow.dispatchEvent(wholeTaskEscape));
      expect(wholeTaskEscape.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(document.body);
      expect(firstRow).not.toHaveAttribute('aria-current');

      await act(async () => {
        firstRow.focus();
        firstRow.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const advanceSpace = new KeyboardEvent('keydown', {
        key: ' ', bubbles: true, cancelable: true,
      });
      await act(async () => firstRow.dispatchEvent(advanceSpace));
      expect(advanceSpace.defaultPrevented).toBe(true);
      await waitFor(() => expect(document.activeElement).toBe(secondRow));

      const reverseSpace = new KeyboardEvent('keydown', {
        key: ' ', shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => secondRow.dispatchEvent(reverseSpace));
      expect(reverseSpace.defaultPrevented).toBe(true);
      await waitFor(() => expect(document.activeElement).toBe(firstRow));

      const repeatedSpace = new KeyboardEvent('keydown', {
        key: ' ', repeat: true, bubbles: true, cancelable: true,
      });
      await act(async () => firstRow.dispatchEvent(repeatedSpace));
      expect(repeatedSpace.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(firstRow);

      await act(async () => {
        firstRow.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(secondRow);
      await act(async () => {
        secondRow.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(firstRow);

      await tab();
      expect(document.activeElement).toBe(complete);
      await waitFor(() => expect(firstRow).not.toHaveAttribute('aria-current'));

      const nativeControlSpace = new KeyboardEvent('keydown', {
        key: ' ', bubbles: true, cancelable: true,
      });
      await act(async () => complete.dispatchEvent(nativeControlSpace));
      expect(nativeControlSpace.defaultPrevented).toBe(false);
      expect(container.querySelector('#task-title-task-a')).toBeNull();

      const viewHeading = container.querySelector<HTMLElement>('[data-task-view-heading]')!;
      await act(async () => viewHeading.focus());
      const enterFromBackground = new KeyboardEvent('keydown', {
        key: ' ', bubbles: true, cancelable: true,
      });
      await act(async () => viewHeading.dispatchEvent(enterFromBackground));
      expect(enterFromBackground.defaultPrevented).toBe(true);
      await waitFor(() => expect(document.activeElement).toBe(firstRow));
      expect(firstRow).toHaveAttribute('aria-current', 'true');

      await tab();
      const newTaskButton = container.querySelector<HTMLButtonElement>(
        'button[aria-label="New Task"]',
      )!;
      await act(async () => newTaskButton.focus());
      const unrelatedControlSpace = new KeyboardEvent('keydown', {
        key: ' ', bubbles: true, cancelable: true,
      });
      await act(async () => newTaskButton.dispatchEvent(unrelatedControlSpace));
      expect(unrelatedControlSpace.defaultPrevented).toBe(false);
      expect(firstRow).not.toHaveAttribute('aria-current');

      await act(async () => firstRow.focus());
      await act(async () => firstRow.dispatchEvent(new KeyboardEvent('keydown', {
        key: ' ', bubbles: true, cancelable: true,
      })));
      await act(async () => {
        firstRow.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', bubbles: true, cancelable: true,
        }));
      });
      const editorTitle = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      const notes = await waitFor(() => {
        const control = container.querySelector<HTMLDivElement>('#task-notes-task-a');
        expect(control).not.toBeNull();
        return control!;
      });
      const primaryLink = container.querySelector<HTMLInputElement>('#task-primary-link-task-a')!;
      const openPrimaryLink = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Open Primary Link"]',
      )!;
      const actionability = container.querySelector<HTMLButtonElement>('#task-actionability-task-a')!;
      const organization = container.querySelector<HTMLButtonElement>('#task-organization-task-a')!;
      const start = container.querySelector<HTMLButtonElement>('#task-start-task-a')!;
      const deadline = container.querySelector<HTMLButtonElement>('#task-deadline-task-a')!;
      const editor = container.querySelector<HTMLElement>('[data-task-editor-form]')!;

      expect(Array.from(editor.querySelectorAll<HTMLButtonElement>('button'))
        .some((button) => button.textContent === 'Cancel')).toBe(false);
      expect(Array.from(editor.querySelectorAll<HTMLButtonElement>('button'))
        .some((button) => button.textContent === 'Save')).toBe(false);
      expect(editor).toHaveClass(
        'flex',
        'flex-col',
        'gap-3',
        'px-2',
        'pb-3',
        'sm:px-3.5',
      );
      expect(editor).not.toHaveClass('translate-y-1', 'pt-1', 'mt-1');
      expect(editor).not.toHaveClass('space-y-3');
      expect(editor).not.toHaveClass('px-1.5', 'sm:px-3');
      expect(editor).not.toHaveClass('border-t', 'py-4', 'sm:ml-14');
      expect(editor.querySelector('label')).toBeNull();
      expect(editorTitle).toHaveAttribute('aria-label', 'Summary');
      expect(editorTitle).toHaveAttribute('placeholder', 'Summary');
      expect(primaryLink).toHaveAttribute('aria-label', 'Primary Link');
      expect(primaryLink).toHaveAttribute('placeholder', 'Primary Link');
      expect(deadline).toHaveTextContent('Deadline');
      expect(notes).toHaveClass(
        'border-[hsl(var(--grid-sticky-line))]',
        'focus:border-ring',
        'focus:ring-ring/65',
      );
      expect(actionability).toHaveAttribute('role', 'combobox');
      expect(organization).toHaveAttribute('role', 'combobox');
      expect(actionability).toHaveClass('border-[hsl(var(--grid-sticky-line))]');
      expect(organization).toHaveClass('border-[hsl(var(--grid-sticky-line))]');
      expect(Array.from(editor.querySelectorAll<HTMLElement>([
        '[data-task-editor-title]',
        '#task-notes-task-a',
        '#task-primary-link-task-a',
        '#task-start-task-a',
        '#task-deadline-task-a',
        '#task-actionability-task-a',
        '#task-organization-task-a',
      ].join(','))).map((control) => control.id)).toEqual([
        'task-title-task-a',
        'task-notes-task-a',
        'task-primary-link-task-a',
        'task-start-task-a',
        'task-deadline-task-a',
        'task-organization-task-a',
        'task-actionability-task-a',
      ]);

      expect(document.activeElement).toBe(editorTitle);
      await tab();
      expect(document.activeElement).toBe(notes);
      await tab();
      expect(document.activeElement).toBe(primaryLink);
      await tab();
      expect(document.activeElement).toBe(openPrimaryLink);
      await tab();
      expect(document.activeElement).toBe(container.querySelector(
        'button[aria-label="Add Checklist"]',
      ));
      await tab();
      expect(document.activeElement).toBe(start);
      await tab();
      expect(document.activeElement).toBe(deadline);
      await tab();
      expect(document.activeElement).toBe(organization);
      await tab();
      expect(document.activeElement).toBe(actionability);
      await tab(true);
      expect(document.activeElement).toBe(organization);

      await act(async () => {
        editorTitle.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'q', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      await waitForTaskEditorExit(container);
      expect(document.activeElement).toBe(firstRow);
    } finally {
      cleanup(root, container);
    }
  }, 15_000);

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
            key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
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

  it('keeps Quick Find inside a named dialog', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'q',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      const searchInput = dialog.querySelector<HTMLInputElement>(
        'input[aria-label="Find Tasks and Areas"]',
      )!;
      expect(dialog).toHaveAccessibleName('Quick Find');
      expect(document.activeElement).toBe(searchInput);
      expectInteractiveControlsToHaveNames(dialog);

      await act(async () => {
        searchInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Tab', bubbles: true, cancelable: true,
        }));
      });
      expect(dialog.contains(document.activeElement)).toBe(true);
      await act(async () => {
        dialog.querySelector<HTMLButtonElement>('[data-modal-close="true"]')?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
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
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const previousGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value(this: HTMLElement) {
        if (this.hasAttribute('data-topline-header')) {
          return {
            x: 0,
            y: 0,
            top: 0,
            right: 768,
            bottom: 64,
            left: 0,
            width: 768,
            height: 64,
            toJSON: () => ({}),
          };
        }
        if (this.hasAttribute('data-task-row-header')) {
          return {
            x: 0,
            y: 412,
            top: 412,
            right: 768,
            bottom: 456,
            left: 0,
            width: 768,
            height: 44,
            toJSON: () => ({}),
          };
        }
        return previousGetBoundingClientRect.call(this);
      },
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
      expect(region).toHaveClass(
        'grid-rows-[1fr]',
        'pt-[6px]',
        'opacity-100',
        'transition-[grid-template-rows,opacity,padding-top]',
      );
      const editorContent = region.querySelector<HTMLElement>('[data-task-editor-content]')!;
      expect(editorContent).toHaveClass('min-h-0');
      expect(editorContent).not.toHaveClass('overflow-hidden');
      expect(scrollBy).not.toHaveBeenCalled();

      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 225));
      });

      expect(scrollBy).toHaveBeenCalledWith({
        top: 348,
        left: 0,
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
      expect(region).toHaveClass('grid-rows-[0fr]', 'pt-0', 'opacity-0');
      await waitForTaskEditorExit(container);
    } finally {
      scrollBy.mockRestore();
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: previousGetBoundingClientRect,
      });
      cleanup(root, container);
    }
  });

  it('aligns an opened task immediately when reduced motion is requested', async () => {
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
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const previousGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value(this: HTMLElement) {
        if (this.hasAttribute('data-topline-header')) {
          return {
            x: 0,
            y: 0,
            top: 0,
            right: 768,
            bottom: 72,
            left: 0,
            width: 768,
            height: 72,
            toJSON: () => ({}),
          };
        }
        if (this.hasAttribute('data-task-row-header')) {
          return {
            x: 0,
            y: 252,
            top: 252,
            right: 768,
            bottom: 296,
            left: 0,
            width: 768,
            height: 44,
            toJSON: () => ({}),
          };
        }
        return previousGetBoundingClientRect.call(this);
      },
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 20));
      });

      expect(scrollBy).toHaveBeenCalledWith({
        top: 180,
        left: 0,
        behavior: 'auto',
      });
      expect(container.querySelector('[data-task-editor-region]'))
        .toHaveAttribute('data-state', 'open');
    } finally {
      window.matchMedia = originalMatchMedia;
      scrollBy.mockRestore();
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: previousGetBoundingClientRect,
      });
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

  it('reconciles open-editor identity controls after accepted task changes', async () => {
    let acceptedTask = task;
    const taskList = defaultTaskList();
    mockTaskList.mockImplementation(() => ({
      ...taskList,
      tasks: [acceptedTask],
    }));
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-work', owner_id: 'owner-a', title: 'Work' }],
      loading: false,
      error: null,
    });
    const { container, root, rerender } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expect(container.querySelector('#task-actionability-task-a')).toHaveTextContent('Ready');
      expect(container.querySelector('#task-organization-task-a'))
        .toHaveTextContent('No Area');

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'f',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        actionability: 'waiting',
      });

      acceptedTask = {
        ...acceptedTask,
        actionability: 'waiting',
        area_id: 'area-work',
      };
      await act(async () => {
        rerender();
        await Promise.resolve();
      });

      expect(container.querySelector('#task-title-task-a')).toBeTruthy();
      expect(container.querySelector('#task-actionability-task-a')).toHaveTextContent('Waiting');
      expect(container.querySelector('#task-organization-task-a')).toHaveTextContent('Work');
    } finally {
      cleanup(root, container);
    }
  });

  it.each([
    ['Actionability', '#task-actionability-task-a'],
    ['Organization', '#task-organization-task-a'],
  ])('dismisses the %s select without closing its task editor', async (_label, selector) => {
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-work', owner_id: 'owner-a', title: 'Work' }],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const trigger = container.querySelector<HTMLButtonElement>(selector)!;
      await act(async () => {
        trigger.focus();
        trigger.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
      expect(listbox).toBeTruthy();
      if (_label === 'Organization') {
        expect(Array.from(listbox!.querySelectorAll('*')).some(
          (element) => element.textContent?.trim() === 'Areas',
        )).toBe(false);
      }

      await act(async () => {
        document.body.dispatchEvent(new MouseEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
        }));
        document.body.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      await waitFor(() => {
        expect(document.querySelector('[role="listbox"]')).toBeNull();
      });
      expect(container.querySelector('#task-title-task-a')).toBeTruthy();
      expect(container.querySelector('[data-task-editor-region]'))
        .not.toHaveAttribute('data-state', 'closing');

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-view-heading]')?.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });
      expect(container.querySelector('[data-task-editor-region]'))
        .toHaveAttribute('data-state', 'closing');
      await waitForTaskEditorExit(container);
    } finally {
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
      const actionability = container.querySelector<HTMLButtonElement>(
        '#task-actionability-task-a',
      )!;
      await selectBathosOption(actionability, 'Waiting');
      await selectBathosOption(actionability, 'Rechecking');

      expect(taskList.updateTask).toHaveBeenCalledTimes(1);
      expect(taskList.updateTask).toHaveBeenNthCalledWith(1, 'task-a', {
        actionability: 'waiting',
      });

      await act(async () => {
        releaseFirst();
        await firstWrite;
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(taskList.updateTask).toHaveBeenCalledTimes(2);
      });
      expect(taskList.updateTask).toHaveBeenNthCalledWith(2, 'task-a', {
        actionability: 'rechecking',
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
        key: 'q', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
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
          key: 'q', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
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
      area_id: 'area-work',
      hierarchy_order_key: 'a0',
      actionability: 'waiting' as const,
      notes: '',
    };
    const taskList = { ...defaultTaskList(), tasks: [organizedTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [
        { id: 'area-work', title: 'Work' },
        { id: 'area-life', title: 'Life' },
      ],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      expect(container.textContent).toContain('Work');
      const rowHeader = container.querySelector('[data-task-row-header]');
      const metadata = rowHeader?.querySelector('[data-task-row-metadata]');
      const row = rowHeader?.closest('[data-task-planning-card]');
      const list = row?.closest('[data-task-planning-list]');
      expect(rowHeader).toHaveClass(
        'h-11',
        'gap-2',
        'overflow-hidden',
        'pl-1',
        'pr-1.5',
      );
      expect(rowHeader).not.toHaveClass('px-1.5');
      expect(metadata).toHaveClass(
        'gap-x-2.5',
        'leading-4',
        'overflow-hidden',
        'whitespace-nowrap',
        'mt-0.5',
      );
      expect(row).toHaveClass(
        'overflow-hidden',
      );
      expect(row).not.toHaveClass(
        'rounded-md',
        'border',
        'border-foreground/10',
        'bg-foreground/[0.05]',
      );
      expect(list).toHaveClass('space-y-0');
      expect(list).not.toHaveClass('divide-y', 'border-y');
      expect(metadata?.children).toHaveLength(2);
      const actionability = metadata?.querySelector('[aria-label="Waiting"]');
      const actionabilityLabel = actionability?.querySelector(
        '[data-task-actionability-label]',
      );
      expect(actionability?.querySelector('svg.lucide-hourglass')).toBeTruthy();
      expect(actionability).not.toHaveAttribute('data-task-metadata-chip');
      expect(actionability).not.toHaveClass(
        'rounded-sm',
        'bg-foreground/[0.06]',
        'px-1',
        'py-0.5',
        'sm:rounded-none',
        'sm:bg-transparent',
      );
      expect(actionability).toHaveClass('inline-flex', 'shrink-0', 'items-center', 'text-admin');
      expect(actionabilityLabel).toBeNull();
      const titleButton = container.querySelector<HTMLButtonElement>('button[data-task-id="task-a"]')!;
      await act(async () => titleButton.click());
      expect(row).toHaveClass('rounded-md', 'bg-foreground/[0.05]');
      expect(row).not.toHaveClass('bg-info/20');
      expect(row?.querySelector('[data-task-editor-region]')).not.toBeNull();
      const organization = container.querySelector<HTMLButtonElement>(
        '#task-organization-task-a',
      )!;
      expect(organization).toHaveTextContent('Work');
      await selectBathosOption(organization, 'Life');

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        area_id: 'area-life',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('masks immediate Start and Deadline dates in their editor controls', async () => {
    const tomorrowTask = taskTodoFixture({
      ...task,
      id: 'task-tomorrow',
      title: 'Tomorrow task',
      start_date: '2026-07-21',
      today_section: 'next',
      deadline: '2026-07-21',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [tomorrowTask] });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-tomorrow"]')?.click();
      });
      expect(container.querySelector('#task-start-task-tomorrow')).toHaveTextContent('Tomorrow');
      expect(container.querySelector('#task-deadline-task-tomorrow')).toHaveTextContent('Tomorrow');
      expect(container.querySelector('#task-start-task-tomorrow')).not.toHaveTextContent('Jul 21');
      expect(container.querySelector('#task-deadline-task-tomorrow')).not.toHaveTextContent('Jul 21');
    } finally {
      cleanup(root, container);
    }
  });

  it('shows only a 12-hour local time beside the task-row reminder bell', () => {
    const reminder = taskReminderFixture({
      task_id: 'task-a',
      local_date: '2026-07-20',
      local_time: '23:00:00',
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [reminder],
      byRootId: new Map([['task-a', reminder]]),
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
      const reminderMetadata = container.querySelector('[aria-label="Reminder 11:00 PM"]');
      expect(reminderMetadata).toHaveTextContent('11:00 PM');
      expect(reminderMetadata).not.toHaveTextContent('Remind');
      expect(reminderMetadata).not.toHaveTextContent('Today');
      expect(reminderMetadata?.querySelector('svg.lucide-bell')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('orders optional task-row metadata and omits Start from collapsed summaries', () => {
    const completeTask = taskTodoFixture({
      ...task,
      id: 'task-complete-metadata',
      title: 'Complete metadata',
      area_id: 'area-home',
      start_date: null,
      today_section: 'next',
      deadline: '2026-07-25',
      actionability: 'waiting',
      notes: 'Supporting details',
    });
    const partialTask = taskTodoFixture({
      ...task,
      id: 'task-partial-metadata',
      title: 'Partial metadata',
      area_id: 'area-home',
      start_date: '2026-07-23',
      today_section: null,
      deadline: null,
      actionability: 'actionable',
      notes: '',
    });
    const reminder = taskReminderFixture({
      task_id: completeTask.id,
      local_date: '2026-07-22',
      local_time: '13:30:00',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [completeTask, partialTask],
      checklistTaskIds: new Set([completeTask.id]),
    });
    mockTaskHierarchy.mockReturnValue({
      areas: [
        taskAreaFixture({ id: 'area-work', title: 'Work' }),
        taskAreaFixture({ id: 'area-home', title: 'Home' }),
      ],
      loading: false,
      error: null,
    });
    mockTaskReminders.mockReturnValue({
      reminders: [reminder],
      byRootId: new Map([[completeTask.id, reminder]]),
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
    const { container, root } = renderShell('/tasks/anytime');

    try {
      const completeMetadata = container.querySelector(
        '[data-task-id="task-complete-metadata"] [data-task-row-metadata]',
      );
      const partialMetadata = container.querySelector(
        '[data-task-id="task-partial-metadata"] [data-task-row-metadata]',
      );
      expect(
        Array.from(completeMetadata?.children ?? [], (item) => (
          item.getAttribute('data-task-metadata-kind')
        )),
      ).toEqual([
        'area',
        'horizon',
        'reminder',
        'actionability',
        'deadline',
        'notes',
        'checklist',
      ]);
      expect(completeMetadata).toHaveTextContent('Home');
      expect(
        completeMetadata?.querySelector('[data-task-metadata-kind="area"]'),
      ).not.toHaveClass('text-info');
      expect(
        completeMetadata?.querySelector('[data-task-metadata-kind="horizon"]'),
      ).toHaveClass('text-task-horizon-next');
      expect(completeMetadata).toHaveTextContent('1:30 PM');
      expect(completeMetadata).toHaveTextContent('5 days left');
      expect(completeMetadata).not.toHaveTextContent('Waiting');
      expect(
        completeMetadata?.querySelector('[data-task-metadata-kind="actionability"]'),
      ).toHaveClass('text-admin');
      expect(
        completeMetadata?.querySelector(
          '[data-task-metadata-kind="notes"] svg.lucide-notepad-text',
        ),
      ).toBeTruthy();
      expect(
        completeMetadata?.querySelector('[data-task-metadata-kind="notes"]'),
      ).toHaveAccessibleName('Notes');
      expect(
        completeMetadata?.querySelector(
          '[data-task-metadata-kind="checklist"] svg.lucide-list-tree',
        ),
      ).toBeTruthy();
      expect(
        completeMetadata?.querySelector('[data-task-metadata-kind="checklist"]'),
      ).toHaveAccessibleName('Checklist');

      expect(
        Array.from(partialMetadata?.children ?? [], (item) => (
          item.getAttribute('data-task-metadata-kind')
        )),
      ).toEqual(['area']);
      expect(partialMetadata).toHaveTextContent('Home');
      expect(
        partialMetadata?.querySelector('[data-task-metadata-kind="notes"]'),
      ).toBeNull();
      expect(
        partialMetadata?.querySelector('[data-task-metadata-kind="checklist"]'),
      ).toBeNull();

      expect(container.querySelector('[aria-label^="Starts "]')).toBeNull();
      expect(container.querySelector('[data-task-row-metadata] svg.lucide-play')).toBeNull();
      expect(completeMetadata).not.toHaveTextContent('In 2 days');
      expect(partialMetadata).not.toHaveTextContent('In 3 days');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses Today and singular signed offsets in mobile Deadline copy while preserving desktop and input wording', async () => {
    const overdueTask = taskTodoFixture({
      ...task,
      id: 'task-overdue',
      title: 'Overdue task',
      start_date: null,
      today_section: null,
      deadline: '2026-07-19',
    });
    const dueTodayTask = taskTodoFixture({
      ...task,
      id: 'task-due-today',
      title: 'Due today task',
      start_date: null,
      today_section: null,
      deadline: '2026-07-20',
    });
    const futureTask = taskTodoFixture({
      ...task,
      id: 'task-due-tomorrow',
      title: 'Due tomorrow task',
      start_date: null,
      today_section: null,
      deadline: '2026-07-21',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [overdueTask, dueTodayTask, futureTask],
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      expect(container.querySelector('[aria-label="Deadline 1 day ago"]')).toHaveClass('text-destructive');
      expect(container.querySelector('[aria-label="Deadline Today"]')).toHaveClass('text-destructive');
      expect(container.querySelector('[aria-label="Deadline Tomorrow"]')).not.toHaveClass('text-destructive');
      expect(container.querySelector('[aria-label="Deadline 1 day ago"] [data-task-deadline-compact]'))
        .toHaveTextContent('-1 day');
      expect(container.querySelector('[aria-label="Deadline Today"] [data-task-deadline-compact]'))
        .toHaveTextContent('Today');
      expect(container.querySelector('[aria-label="Deadline Tomorrow"] [data-task-deadline-compact]'))
        .toHaveTextContent('1 day');
      expect(container.querySelector('[aria-label="Deadline Today"]'))
        .not.toHaveAttribute('data-task-metadata-chip');
      expect(container.querySelector('[aria-label="Deadline Today"]')).not.toHaveClass(
        'rounded-sm',
        'bg-foreground/[0.06]',
        'px-1',
        'py-0.5',
        'sm:rounded-none',
        'sm:bg-transparent',
      );
      expect(container.querySelector('[aria-label="Deadline Today"]')).toHaveClass(
        'inline-flex',
        'shrink-0',
        'items-center',
        'gap-1',
      );
      expect(container.querySelector('[aria-label="Deadline 1 day ago"] [data-task-deadline-compact]'))
        .toHaveClass('sm:hidden');
      expect(container.querySelector('[aria-label="Deadline 1 day ago"] [data-task-deadline-full]'))
        .toHaveClass('hidden', 'sm:inline');
      expect(container.querySelector('[aria-label="Deadline 1 day ago"] [data-task-deadline-full]'))
        .toHaveTextContent('1 day ago');
      expect(container.querySelector('[aria-label="Deadline Today"] [data-task-deadline-full]'))
        .toHaveTextContent('Today');
      expect(container.querySelector('[aria-label="Deadline Tomorrow"] [data-task-deadline-full]'))
        .toHaveTextContent('Tomorrow');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-overdue"]')?.click();
      });
      expect(container.querySelector('#task-deadline-task-overdue')).toHaveTextContent('Yesterday');
      expect(container.querySelector('#task-deadline-task-overdue')).not.toHaveTextContent('Jul 19');
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

      await act(async () => {
        container.querySelector<HTMLButtonElement>('#task-deadline-task-a')?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(container.querySelector('button[aria-label="Clear Deadline"]')).toBeNull();
      const clearDeadline = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Clear');
      await act(async () => {
        clearDeadline?.click();
        await Promise.resolve();
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
      task_id: 'task-a', local_date: '2026-07-20',
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
      let start: HTMLButtonElement | null = null;
      await waitFor(() => {
        start = container.querySelector<HTMLButtonElement>('#task-start-task-a');
        expect(start).toBeInstanceOf(HTMLButtonElement);
      });
      await act(async () => {
        start!.click();
        await Promise.resolve();
      });
      let time: HTMLInputElement | null = null;
      await waitFor(() => {
        time = document.querySelector<HTMLInputElement>('#task-start-reminder-task-a');
        expect(time).toBeInstanceOf(HTMLInputElement);
      });
      await act(async () => {
        setInputValue(time!, '10:30');
        time!.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(saveReminder).toHaveBeenCalledWith(expect.objectContaining({
        rootType: 'todo', rootId: 'task-a', reminder,
        localTime: '10:30', ambiguityChoice: 'earlier',
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('plans an unplanned to-do for Today Inbox before saving its reminder', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T20:00:00.000Z'));
    const unplannedTask = taskTodoFixture({
      ...task,
      destination: 'anytime',
      start_date: null,
      today_section: null,
    });
    const taskList = { ...defaultTaskList(), tasks: [unplannedTask] };
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(taskList);
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: saveReminder, cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a', 'reminder');
      });
      const time = document.querySelector<HTMLInputElement>('#task-start-reminder-task-a')!;
      expect(time).toBeEnabled();

      await act(async () => {
        setInputValue(time, '2p');
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        start_date: null,
        today_section: 'inbox',
      });
      expect(saveReminder).toHaveBeenCalledWith(expect.objectContaining({
        rootType: 'todo',
        rootId: 'task-a',
        localTime: '14:00',
        ambiguityChoice: 'earlier',
      }));
      expect(taskList.updateTask.mock.invocationCallOrder[0])
        .toBeLessThan(saveReminder.mock.invocationCallOrder[0]);
      expect(container.querySelector('#task-start-task-a')).toHaveTextContent('Today · Inbox');
      expect(time).toHaveValue('2:00 pm');
      expect(time).toBeInTheDocument();
      await act(async () => {
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(document.querySelector('#task-start-reminder-task-a')).not.toBeInTheDocument();
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({
        title: 'Reminder Could Not Be Saved',
      }));
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('submits an unplanned reminder only once when planning rerenders and blurs the input', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T20:00:00.000Z'));
    const unplannedTask = taskTodoFixture({
      ...task,
      destination: 'anytime',
      start_date: null,
      today_section: null,
    });
    const taskList = { ...defaultTaskList(), tasks: [unplannedTask] };
    let releaseReminder!: () => void;
    const reminderPending = new Promise<void>((resolve) => {
      releaseReminder = resolve;
    });
    const saveReminder = vi.fn().mockReturnValue(reminderPending);
    mockTaskList.mockReturnValue(taskList);
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: saveReminder, cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a', 'reminder');
      });
      const time = document.querySelector<HTMLInputElement>('#task-start-reminder-task-a')!;

      await act(async () => {
        setInputValue(time, '2p');
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
        time.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await Promise.resolve();
      });
      expect(saveReminder).toHaveBeenCalledOnce();

      await act(async () => {
        releaseReminder();
        await reminderPending;
        await Promise.resolve();
      });

      expect(saveReminder).toHaveBeenCalledOnce();
      expect(time).toHaveValue('2:00 pm');
      expect(time).toBeInTheDocument();
      await act(async () => {
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(document.querySelector('#task-start-reminder-task-a')).not.toBeInTheDocument();
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({
        title: 'Reminder Could Not Be Saved',
      }));
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('applies the same unplanned reminder default from the row Start dialog', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T20:00:00.000Z'));
    const unplannedTask = taskTodoFixture({
      ...task,
      destination: 'anytime',
      start_date: null,
      today_section: null,
    });
    const taskList = { ...defaultTaskList(), tasks: [unplannedTask] };
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(taskList);
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: saveReminder, cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await openTaskMenuSurface(container, 'Existing task', "Start...");
      const time = document.querySelector<HTMLInputElement>('#task-start-reminder-task-a')!;
      expect(time).toBeEnabled();

      await act(async () => {
        setInputValue(time, '2p');
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        start_date: null,
        today_section: 'inbox',
      });
      expect(saveReminder).toHaveBeenCalledWith(expect.objectContaining({
        rootType: 'todo',
        rootId: 'task-a',
        localTime: '14:00',
      }));
      expect(taskList.updateTask.mock.invocationCallOrder[0])
        .toBeLessThan(saveReminder.mock.invocationCallOrder[0]);
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('preserves an existing Today horizon when saving a reminder', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T20:00:00.000Z'));
    const laterTask = taskTodoFixture({
      ...task,
      start_date: null,
      today_section: 'later',
    });
    const taskList = { ...defaultTaskList(), tasks: [laterTask] };
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(taskList);
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: saveReminder, cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a', 'reminder');
      });
      const time = document.querySelector<HTMLInputElement>('#task-start-reminder-task-a')!;
      await act(async () => {
        setInputValue(time, '2p');
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.updateTask).not.toHaveBeenCalled();
      expect(saveReminder).toHaveBeenCalledWith(expect.objectContaining({
        localTime: '14:00',
      }));
      expect(container.querySelector('#task-start-task-a')).toHaveTextContent('Today · Later');
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('rejects an elapsed reminder before planning an unplanned to-do', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T20:00:00.000Z'));
    const unplannedTask = taskTodoFixture({
      ...task,
      destination: 'anytime',
      start_date: null,
      today_section: null,
    });
    const taskList = { ...defaultTaskList(), tasks: [unplannedTask] };
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(taskList);
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: saveReminder, cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a', 'reminder');
      });
      const time = document.querySelector<HTMLInputElement>('#task-start-reminder-task-a')!;
      await act(async () => {
        setInputValue(time, '12p');
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(time).toHaveValue('');
      expect(taskList.updateTask).not.toHaveBeenCalled();
      expect(saveReminder).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Not Allowed.',
        duration: 1_800,
      });
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('places Start and Deadline together and lets Actionability fill the row without Areas', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const temporalGrid = container.querySelector('[data-task-editor-temporal-grid]');
      const identityGrid = container.querySelector('[data-task-editor-identity-grid]');
      expect(temporalGrid).toHaveClass('grid-cols-2');
      expect(temporalGrid).not.toHaveClass('sm:grid-cols-2');
      expect(temporalGrid?.children).toHaveLength(2);
      expect(identityGrid).toHaveClass('grid-cols-1');
      expect(identityGrid).not.toHaveClass('sm:grid-cols-2');
      expect(identityGrid?.children).toHaveLength(1);
      expect(container.querySelector('#task-organization-task-a')).toBeNull();
      Array.from(temporalGrid?.children ?? []).forEach((field) => {
        expect(field).toHaveClass('min-w-0');
      });
      Array.from(identityGrid?.children ?? []).forEach((field) => {
        expect(field).toHaveClass('min-w-0');
      });
      expect(temporalGrid?.querySelectorAll('svg.lucide-calendar')).toHaveLength(2);
      expect(container.querySelector('button[aria-label="Clear Deadline"]')).toBeNull();
      expect(container.querySelector('#task-start-task-a')).toHaveClass(
        'enabled:hover:bg-background',
      );
      expect(container.querySelector('#task-deadline-task-a')).toHaveClass(
        'enabled:hover:bg-background',
        'text-sm',
      );
      expect(container.querySelector('#task-deadline-task-a')).not.toHaveClass('text-base');
    } finally {
      cleanup(root, container);
    }
  });

  it('focuses Inbox when Start opens without a planning intent', async () => {
    const unplannedTask = taskTodoFixture({
      ...task,
      destination: 'anytime',
      start_date: null,
      today_section: null,
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [unplannedTask] });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(
        document.querySelector('[data-task-start-horizon="inbox"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('focuses the selected future date when Start opens', async () => {
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-24',
      today_section: 'next',
    });
    const taskList = { ...defaultTaskList(), tasks: [futureTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const selectedDay = document.querySelector<HTMLButtonElement>(
        'button[name="day"][aria-selected="true"]',
      );
      expect(selectedDay?.textContent?.trim()).toBe('24');
      expect(document.activeElement).toBe(selectedDay);
    } finally {
      cleanup(root, container);
    }
  });

  it('normalizes reminder shorthand before a second Enter closes Start', async () => {
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-24',
      today_section: null,
    });
    const taskList = { ...defaultTaskList(), tasks: [futureTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: saveReminder, cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a', 'reminder');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const time = document.querySelector<HTMLInputElement>('#task-start-reminder-task-a')!;
      await act(async () => {
        setInputValue(time, '1:3p');
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(saveReminder).toHaveBeenCalledWith(expect.objectContaining({
        rootType: 'todo',
        rootId: 'task-a',
        localTime: '13:30',
      }));
      expect(taskList.updateTask).not.toHaveBeenCalled();
      expect(time.value).toBe('1:30 pm');
      expect(document.querySelector('[data-task-start-picker]')).not.toBeNull();
      await act(async () => {
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('restores the committed reminder and reports malformed input as not allowed', async () => {
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    const activeReminder = taskReminderFixture({
      root_type: 'todo',
      task_id: 'task-a',
      local_time: '09:00:00',
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [activeReminder],
      byRootId: new Map([['task-a', activeReminder]]),
      dueItems: [],
      mode: 'connected',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save: saveReminder,
      cancel: vi.fn(),
      acknowledge: vi.fn(),
      claimDue: vi.fn(),
    });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a', 'reminder');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const time = document.querySelector<HTMLInputElement>('#task-start-reminder-task-a')!;
      expect(time.value).toBe('9:00 am');
      const space = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        time.dispatchEvent(space);
        setInputValue(time, 'asdf');
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(space.defaultPrevented).toBe(false);
      expect(time.value).toBe('9:00 am');
      expect(saveReminder).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Not Allowed.',
        duration: 1_800,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('moves arrow focus through Today, calendar, Reminder, and Clear', async () => {
    const activeReminder = taskReminderFixture({
      root_type: 'todo',
      task_id: 'task-a',
      local_time: '09:00:00',
    });
    const todayTask = taskTodoFixture({
      ...task,
      start_date: null,
      today_section: 'next',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [todayTask] });
    mockTaskReminders.mockReturnValue({
      reminders: [activeReminder], byRootId: new Map([['task-a', activeReminder]]), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const selectedHorizon = document.querySelector<HTMLButtonElement>(
        '[data-task-start-horizon="next"]',
      )!;
      expect(document.activeElement).toBe(selectedHorizon);

      await act(async () => {
        selectedHorizon.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(
        document.querySelector('button[name="caption-month-year"]'),
      );

      await act(async () => {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect((document.activeElement as HTMLElement)?.getAttribute('name')).toBe('day');
      expect(document.activeElement).not.toBeDisabled();

      const enabledDays = Array.from(document.querySelectorAll<HTMLButtonElement>(
        'button[name="day"]:not(:disabled)',
      )).filter((button) => !button.className.includes('day-outside'));
      const finalDay = enabledDays.at(-1)!;
      await act(async () => {
        finalDay.focus();
        finalDay.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }));
      });
      const reminderInput = document.querySelector<HTMLInputElement>('#task-start-reminder-task-a');
      expect(document.activeElement).toBe(reminderInput);
      expect(document.body.textContent).not.toContain('Repeated Time');
      expect(document.body.textContent).not.toContain('Time Zone');

      await act(async () => {
        reminderInput?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(
        document.querySelector('[data-task-start-clear]'),
      );

      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-task-start-clear]')
          ?.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowUp',
            bubbles: true,
            cancelable: true,
          }));
      });
      expect(document.activeElement).toBe(reminderInput);
    } finally {
      cleanup(root, container);
    }
  });

  it('closes Start on Tab and Shift+Tab without selecting the focused value', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const initialFocus = document.activeElement as HTMLElement;
      await act(async () => {
        initialFocus.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      await waitFor(() => {
        expect(document.querySelector('[data-task-start-picker]')).toBeNull();
        expect(document.activeElement).toBe(
          container.querySelector('#task-deadline-task-a'),
        );
      });
      expect(taskList.updateTask).not.toHaveBeenCalled();

      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      await act(async () => {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      await waitFor(() => {
        expect(document.querySelector('[data-task-start-picker]')).toBeNull();
        expect(document.activeElement).toBe(
          container.querySelector('button[aria-label="Add Checklist"]'),
        );
      });
      expect(taskList.updateTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('commits a Today horizon once and closes Start when Enter confirms it', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const later = document.querySelector<HTMLButtonElement>(
        '[data-task-start-horizon="later"]',
      );
      await act(async () => {
        later?.focus();
        later?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        later?.click();
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledTimes(1);
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        start_date: null,
        today_section: 'later',
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('commits a Today horizon once and closes Start when Space confirms it', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const later = document.querySelector<HTMLButtonElement>(
        '[data-task-start-horizon="later"]',
      );
      await act(async () => {
        later?.focus();
        later?.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
          cancelable: true,
        }));
        later?.click();
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledTimes(1);
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        start_date: null,
        today_section: 'later',
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('closes Start after Enter confirms a legal date but not after calendar navigation', async () => {
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-24',
      today_section: 'next',
    });
    const taskList = { ...defaultTaskList(), tasks: [futureTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const nextMonth = document.querySelector<HTMLButtonElement>(
        'button[name="next-month"]',
      );
      await act(async () => {
        nextMonth?.focus();
        nextMonth?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        nextMonth?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();
      expect(document.body.textContent).toContain('August 2026');

      const augustFirst = Array.from(document.querySelectorAll<HTMLButtonElement>(
        'button[name="day"]:not(:disabled)',
      )).find((button) => (
        button.textContent?.trim() === '1'
        && !button.className.includes('day-outside')
      ));
      await act(async () => {
        augustFirst?.focus();
        augustFirst?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledTimes(1);
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        start_date: '2026-08-01',
        today_section: null,
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('commits a legal date once and closes Start when Space confirms it', async () => {
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-24',
      today_section: 'next',
    });
    const taskList = { ...defaultTaskList(), tasks: [futureTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const julyTwentyFifth = Array.from(document.querySelectorAll<HTMLButtonElement>(
        'button[name="day"]:not(:disabled)',
      )).find((button) => (
        button.textContent?.trim() === '25'
        && !button.className.includes('day-outside')
      ));

      await act(async () => {
        julyTwentyFifth?.focus();
        julyTwentyFifth?.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledTimes(1);
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        start_date: '2026-07-25',
        today_section: null,
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeNull();
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

  it('keeps a failed due-reminder check out of task lists and reports it only on Config', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [], mode: 'connected',
      planningTimeZone: 'America/Los_Angeles', loading: false,
      error: new Error('provider detail'), claimError: new Error('provider detail'),
      save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const today = renderShell('/tasks/today');

    try {
      expect(today.container.querySelector('[aria-label="Reminder Delivery Check"]')).toBeNull();
      expect(today.container.textContent).not.toContain('Reminder Check Failed');
    } finally {
      cleanup(today.root, today.container);
    }

    const config = renderShell('/tasks/config');
    try {
      expect(config.container.querySelector('[data-in-app-reminder-status="delayed"]')).toBeTruthy();
      expect(config.container.textContent).not.toContain('provider detail');
    } finally {
      cleanup(config.root, config.container);
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
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a', 'reminder');
      });
      expect(document.querySelector<HTMLInputElement>('#task-start-reminder-task-a')?.disabled)
        .toBe(true);
      expect(document.body.textContent).toContain('Editing is disabled to protect existing schedules');
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

  it('clears the complete Start intent from the unified picker', async () => {
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

      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
      });
      const clear = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Clear');
      await act(async () => clear?.click());

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        start_date: null,
        today_section: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('surfaces Someday beside Clear and moves work there from Start', async () => {
    const futureTask = taskTodoFixture({
      ...task,
      destination: 'anytime',
      start_date: '2026-07-24',
      today_section: null,
    });
    const reminder = taskReminderFixture({
      id: 'reminder-a',
      task_id: 'task-a',
    });
    const cancelReminder = vi.fn().mockResolvedValue(undefined);
    const taskList = { ...defaultTaskList(), tasks: [futureTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskReminders.mockReturnValue({
      reminders: [reminder],
      byRootId: new Map([['task-a', reminder]]),
      dueItems: [],
      claimError: null,
      projectionError: null,
      mode: 'connected',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save: vi.fn().mockResolvedValue(undefined),
      cancel: cancelReminder,
      acknowledge: vi.fn().mockResolvedValue(undefined),
      claimDue: vi.fn().mockResolvedValue(undefined),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      const footer = document.querySelector('[data-task-start-footer]');
      const clear = footer?.querySelector<HTMLButtonElement>('[data-task-start-clear]');
      const someday = footer?.querySelector<HTMLButtonElement>('[data-task-start-someday]');
      expect(clear).toBeTruthy();
      expect(someday).toBeTruthy();
      expect(clear?.parentElement).toBe(someday?.parentElement);

      await act(async () => {
        clear?.focus();
        clear?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(someday);

      await act(async () => {
        someday?.click();
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'someday',
        start_date: null,
        today_section: null,
      });
      expect(cancelReminder).toHaveBeenCalledWith(reminder);
      expect(document.querySelector('[data-task-start-picker]')).toBeNull();
      expect(container.querySelector('#task-start-task-a')).toHaveTextContent('Someday');

      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(
        document.querySelector('[data-task-start-someday][aria-pressed="true"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('uses Today horizons instead of allowing today or past calendar dates', async () => {
    const todayTask = taskTodoFixture({
      ...task,
      start_date: null,
      today_section: 'next',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [todayTask] });
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      const selectedHorizon = document.querySelector<HTMLButtonElement>(
        '[data-task-start-horizon="next"]',
      );
      expect(selectedHorizon).toHaveAttribute('aria-pressed', 'true');
      await waitFor(() => {
        expect(document.activeElement).toBe(selectedHorizon);
      });

      const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[name="day"]'))
        .filter((button) => !button.className.includes('day-outside'));
      const today = days.find((button) => button.getAttribute('aria-current') === 'date');
      const tomorrow = days.find((button) => button.textContent?.trim() === '21');
      expect(today).toBeDisabled();
      expect(today?.querySelector(
        '[data-calendar-current-date-icon="true"]',
      )).toBeTruthy();
      expect(tomorrow).not.toBeDisabled();
    } finally {
      cleanup(root, container);
    }
  });

  it('closes editing with the Windows form-cancel command', async () => {
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
        key: 'q', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle?.dispatchEvent(closeEvent);
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      await waitForTaskEditorExit(container);
      expect(closeEvent.defaultPrevented).toBe(true);
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
      const row = restore?.closest<HTMLElement>('article') ?? null;
      const rowHeader = row?.querySelector<HTMLElement>('[data-task-row-header]') ?? null;
      expect(rowHeader).toHaveClass('h-11');
      expect(rowHeader).toHaveClass('pl-1', 'pr-1.5');
      expect(rowHeader).not.toHaveClass('px-1.5');
      expect(row).not.toHaveClass('rounded-md', 'border', 'bg-foreground/[0.05]');
      expect(row?.querySelector('[data-task-title-control]')).toHaveClass('font-normal');
      expect(row?.querySelector('[data-task-title-control]')).not.toHaveClass('font-medium');
      expect(row).toHaveAttribute('tabindex', '0');
      expect(restore?.querySelector('.lucide-trash-2')).toHaveClass(
        'group-hover/restore:hidden',
      );
      expect(restore?.querySelector('.lucide-rotate-ccw')).toHaveClass(
        'group-hover/restore:block',
      );
      row?.focus();
      await act(async () => {
        row?.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(row).toHaveAttribute('aria-current', 'true');
      expect(document.activeElement).toBe(row);
      expect(row).toHaveClass('rounded-md', 'bg-info/20');
      expect(row).not.toHaveClass('ring-2', 'ring-inset', 'ring-ring');
      await act(async () => {
        restore?.click();
      });
      await waitFor(() => {
        expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'restore', undefined);
      });

      expect(mockTaskList).toHaveBeenCalledWith(
        'owner-a',
        'done',
        null,
        expect.any(Function),
        expect.any(Function),
      );
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
      expect(mockTaskList).toHaveBeenCalledWith(
        'owner-a',
        'upcoming',
        null,
        expect.any(Function),
        expect.any(Function),
      );
      expect(container.querySelector('[aria-label="Day Horizon Next"]')).toBeNull();
      expect(container.querySelector('[data-task-metadata-kind="horizon"]')).toBeNull();
      const upcomingHeading = container.querySelector('#tasks-day-2026-07-24-heading');
      expect(upcomingHeading).toHaveAccessibleName('Friday, July 24');
      expect(upcomingHeading?.querySelector('[data-task-count-badge]')).toBeNull();
      const titleLine = container.querySelector('[data-task-id="task-a"] span.flex');
      expect(titleLine?.querySelector('[data-task-horizon-surface="row"]')).toBeNull();
      await openTaskMenuSurface(container, 'Existing task', "Start...");
      expect(document.querySelector('[data-dialog-body="true"]')).toHaveClass('mx-0');
      expect(document.querySelector('[data-task-start-picker]')).toHaveClass('mx-auto');
      for (const [horizon, colorClass] of [
        ['inbox', 'text-task-horizon-inbox'],
        ['now', 'text-task-horizon-now'],
        ['next', 'text-task-horizon-next'],
        ['later', 'text-task-horizon-later'],
      ]) {
        expect(document.querySelector(
          `[data-task-horizon-surface="picker"][data-task-horizon-symbol="${horizon}"]`,
        )).toHaveClass(colorClass);
      }
      const now = Array.from(document.querySelectorAll<HTMLButtonElement>(
        '[data-task-start-horizon]',
      )).find((button) => button.textContent?.includes('Now'));
      await act(async () => {
        now?.click();
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'anytime',
        start_date: null,
        today_section: 'now',
      });

      await openTaskMenuSurface(container, 'Existing task', 'Do...');
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

  it('shows outstanding after-completion recurrence definitions below dated Upcoming work', () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-waiting',
      name: 'Water Plants',
      status: 'active',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [] });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[
        definition.id,
        taskRecurrenceRevisionFixture({
          recurrence_id: definition.id,
          rule_mode: 'after_completion',
        }),
      ]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set([definition.id]),
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      save: vi.fn(),
      createFromTask: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const waiting = container.querySelector<HTMLElement>(
        '[data-task-waiting-recurrence]',
      );
      expect(container.textContent).toContain('Repeating Tasks');
      expect(waiting).toHaveTextContent('Waiting');
      expect(waiting).toHaveTextContent('Water Plants');
      expect(waiting).not.toHaveAttribute('draggable');
      expect(container.textContent).not.toContain('No upcoming tasks');
    } finally {
      cleanup(root, container);
    }
  });

  it('orders the complete Upcoming surface from nearest to latest', () => {
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
      loading: false,
      error: null,
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const upcoming = container.querySelector('[aria-label="Upcoming Tasks"]');
      const text = upcoming?.textContent ?? '';
      expect(text.indexOf('July twenty-second task'))
        .toBeLessThan(text.indexOf('July thirtieth task'));
      expect(text.indexOf('July thirtieth task'))
        .toBeLessThan(text.indexOf('August first task'));
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
      expect(marker).toHaveClass('text-task-horizon-next');
      expect(marker?.parentElement?.firstElementChild).toBe(marker);
      expect(mockTaskList).toHaveBeenCalledWith(
        'owner-a',
        'anytime',
        null,
        expect.any(Function),
        expect.any(Function),
      );
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      expect(container.querySelector('section[aria-label="Anytime Tasks"]')).toBeTruthy();
      expect(container.querySelector('section[aria-label="Unassigned Tasks"]')).toBeTruthy();
      expect(Array.from(container.querySelectorAll('h3')).some(
        (heading) => heading.textContent?.trim() === 'Tasks',
      )).toBe(false);

      await openTaskMenuSurface(container, 'Existing task', 'Do...');
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

  it('groups Anytime tasks by effective Area after unassigned work in manual Area order', () => {
    const unassignedTask = taskTodoFixture({
      ...task,
      id: 'task-unassigned',
      title: 'Unassigned',
      area_id: null,
      order_key: 'a3',
    });
    const workDirectTask = taskTodoFixture({
      ...task,
      id: 'task-work-direct',
      title: 'Work Direct',
      area_id: 'area-work',
      order_key: 'a2',
    });
    const secondWorkTask = taskTodoFixture({
      ...task,
      id: 'task-work-second',
      title: 'Work Second',
      area_id: 'area-work',
      order_key: 'a0',
    });
    const homeTask = taskTodoFixture({
      ...task,
      id: 'task-home',
      title: 'Home',
      area_id: 'area-home',
      order_key: 'a1',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [workDirectTask, unassignedTask, homeTask, secondWorkTask],
    });
    mockTaskHierarchy.mockReturnValue({
      areas: [
        taskAreaFixture({ id: 'area-home', title: 'Home', order_key: 'a1' }),
        taskAreaFixture({ id: 'area-work', title: 'Work', order_key: 'a0' }),
        taskAreaFixture({ id: 'area-empty', title: 'Empty', order_key: 'a2' }),
      ],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      const unassigned = container.querySelector('section[aria-label="Unassigned Tasks"]');
      const work = container.querySelector('section[aria-labelledby="tasks-area-area-work-heading"]');
      const home = container.querySelector('section[aria-labelledby="tasks-area-area-home-heading"]');
      expect(unassigned).toBeTruthy();
      expect(work).toBeTruthy();
      expect(home).toBeTruthy();
      expect(container.querySelector('#tasks-area-area-empty-heading')).toBeNull();
      expect(unassigned?.compareDocumentPosition(work!) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();
      expect(work?.compareDocumentPosition(home!) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();
      expect(work?.textContent).toContain('Work Direct');
      expect(work?.textContent).toContain('Work Second');
      expect(home?.textContent).toContain('Home');
      expect(Array.from(container.querySelectorAll('h3')).some(
        (heading) => heading.textContent?.trim() === 'No Area',
      )).toBe(false);
    } finally {
      cleanup(root, container);
    }
  });

  it('automatically sorts inside an Area but retains an edited task until close', async () => {
    mockTaskAutomaticListSorting.mockReturnValue({
      enabled: true,
      loading: false,
      error: null,
      pending: false,
      setEnabled: vi.fn(),
    });
    const initiallyReady = taskTodoFixture({
      ...task,
      id: 'task-ready',
      title: 'Initially Ready',
      area_id: null,
      deadline: '2026-07-26',
      today_section: 'now',
      actionability: 'actionable',
      order_key: 'a1',
    });
    const rechecking = taskTodoFixture({
      ...task,
      id: 'task-rechecking',
      title: 'Rechecking',
      area_id: null,
      deadline: '2026-07-26',
      today_section: 'now',
      actionability: 'rechecking',
      order_key: 'a0',
    });
    let acceptedTasks = [initiallyReady, rechecking];
    const taskList = defaultTaskList();
    mockTaskList.mockImplementation((
      _ownerId: string,
      _view: string,
      retainedTaskId: string | null,
    ) => ({
      ...taskList,
      tasks: acceptedTasks,
      retainedTaskPlacement: retainedTaskId === initiallyReady.id
        ? {
          destination: initiallyReady.destination,
          today_section: initiallyReady.today_section,
          start_date: initiallyReady.start_date,
          deadline: initiallyReady.deadline,
          actionability: initiallyReady.actionability,
          order_key: initiallyReady.order_key,
          area_id: initiallyReady.area_id,
        }
        : null,
    }));
    const { container, root, rerender } = renderShell('/tasks/anytime');
    const visibleTitles = () => Array.from(
      container.querySelectorAll<HTMLElement>('[data-task-row-title]'),
    ).map((title) => title.textContent?.trim());

    try {
      expect(visibleTitles()).toEqual(['Initially Ready', 'Rechecking']);
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[data-task-id="task-ready"]',
        )?.click();
      });

      acceptedTasks = [
        { ...initiallyReady, actionability: 'waiting' },
        rechecking,
      ];
      await act(async () => {
        rerender();
        await Promise.resolve();
      });
      expect(visibleTitles()).toEqual(['Initially Ready', 'Rechecking']);

      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[data-task-id="task-ready"]',
        )?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
      });
      expect(visibleTitles()).toEqual(['Rechecking', 'Initially Ready']);
    } finally {
      cleanup(root, container);
    }
  });

  it('creates a new Anytime task directly inside an Area bucket', async () => {
    const workTask = taskTodoFixture({
      ...task,
      id: 'task-work',
      title: 'Existing Work',
      area_id: 'area-work',
    });
    const taskList = { ...defaultTaskList(), tasks: [workTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [taskAreaFixture({ id: 'area-work', title: 'Work' })],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Add Task to Work"]')?.click();
      });
      const input = container.querySelector<HTMLInputElement>('#task-title-task-draft\\:new');
      const workSection = container.querySelector(
        'section[aria-labelledby="tasks-area-area-work-heading"]',
      );
      const draftRow = workSection?.querySelector('[data-task-row-id="task-draft:new"]');
      const existingRow = workSection?.querySelector('[data-task-row-id="task-work"]');
      expect(input).toBeTruthy();
      expect(draftRow?.compareDocumentPosition(existingRow!) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();

      await act(async () => {
        setInputValue(input!, 'New Work');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });

      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New Work',
        destination: 'anytime',
        areaId: 'area-work',
        atTop: true,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('changes exact organization only when an Anytime drag crosses Area regions', async () => {
    const workPeerTask = taskTodoFixture({
      ...task,
      id: 'task-work-peer',
      title: 'Work Peer',
      area_id: 'area-work',
      order_key: 'a0',
    });
    const workTask = taskTodoFixture({
      ...task,
      id: 'task-work',
      title: 'Work Task',
      area_id: 'area-work',
      order_key: 'a1',
    });
    const homeTask = taskTodoFixture({
      ...task,
      id: 'task-home',
      title: 'Home Task',
      area_id: 'area-home',
      order_key: 'a2',
    });
    const taskList = {
      ...defaultTaskList(),
      tasks: [workPeerTask, workTask, homeTask],
    };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [
        taskAreaFixture({ id: 'area-work', title: 'Work', order_key: 'a0' }),
        taskAreaFixture({ id: 'area-home', title: 'Home', order_key: 'a1' }),
      ],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell('/tasks/anytime');

    const drag = async (sourceId: string, targetId: string) => {
      const source = container.querySelector(`[data-task-id="${sourceId}"]`)?.closest('article');
      const target = container.querySelector(`[data-task-id="${targetId}"]`)?.closest('article');
      if (!source || !target) throw new Error('Expected draggable Area task rows');
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]');
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
        sourceHandle!.dispatchEvent(dragStart);
        target.dispatchEvent(dragOver);
      });
      await act(async () => {
        target.dispatchEvent(drop);
        await Promise.resolve();
      });
    };

    try {
      await drag('task-work-peer', 'task-work');
      expect(taskList.reorderTaskTo).toHaveBeenLastCalledWith(
        'task-work-peer',
        'task-work',
        'after',
      );

      taskList.reorderTaskTo.mockClear();
      await drag('task-work-peer', 'task-home');
      expect(taskList.reorderTaskTo).toHaveBeenLastCalledWith(
        'task-work-peer',
        'task-home',
        'after',
        { area_id: 'area-home' },
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('commits the last legal exact-peer position when release occurs outside the list', async () => {
    mockTaskAutomaticListSorting.mockReturnValue({
      enabled: true,
      loading: false,
      error: null,
      pending: false,
      setEnabled: vi.fn(),
    });
    const dragged = taskTodoFixture({
      ...task,
      id: 'task-dragged',
      title: 'Dragged',
      area_id: null,
      deadline: '2026-07-26',
      today_section: 'now',
      actionability: 'rechecking',
      order_key: 'a0',
    });
    const firstPeer = taskTodoFixture({
      ...task,
      id: 'task-peer-first',
      title: 'First Peer',
      area_id: null,
      deadline: '2026-07-26',
      today_section: 'now',
      actionability: 'rechecking',
      order_key: 'a1',
    });
    const lastPeer = taskTodoFixture({
      ...task,
      id: 'task-peer-last',
      title: 'Last Peer',
      area_id: null,
      deadline: '2026-07-26',
      today_section: 'now',
      actionability: 'rechecking',
      order_key: 'a2',
    });
    const illegal = taskTodoFixture({
      ...task,
      id: 'task-illegal',
      title: 'Different Deadline',
      area_id: null,
      deadline: '2026-07-27',
      today_section: 'now',
      actionability: 'rechecking',
      order_key: 'a3',
    });
    const taskList = {
      ...defaultTaskList(),
      tasks: [dragged, firstPeer, lastPeer, illegal],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/anytime');

    const row = (id: string) => container.querySelector(
      `[data-task-id="${id}"]`,
    )?.closest<HTMLElement>('article') ?? null;
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: (type: string, value: string) => data.set(type, value),
      getData: () => '',
    } as unknown as DataTransfer;
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
    const dragOver = (clientY: number) => {
      const event = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        dataTransfer: { value: dataTransfer },
        clientY: { value: clientY },
      });
      return event;
    };
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });

    try {
      const source = row('task-dragged');
      const firstPeerRow = row('task-peer-first');
      const lastPeerRow = row('task-peer-last');
      const illegalRow = row('task-illegal');
      const moduleDropSurface = container.querySelector<HTMLElement>(
        '[data-task-module-drop-surface]',
      );
      if (!source || !firstPeerRow || !lastPeerRow || !illegalRow || !moduleDropSurface) {
        throw new Error('Expected automatic-sort rows');
      }
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]');
      for (const target of [firstPeerRow, lastPeerRow, illegalRow]) {
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
      }
      await act(async () => {
        sourceHandle!.dispatchEvent(dragStart);
        firstPeerRow.dispatchEvent(dragOver(75));
      });
      expect(firstPeerRow).toHaveAttribute('data-drag-placement', 'after');

      await act(async () => {
        lastPeerRow.dispatchEvent(dragOver(75));
      });
      expect(firstPeerRow).not.toHaveAttribute('data-drag-placement');
      expect(lastPeerRow).toHaveAttribute('data-drag-placement', 'after');

      await act(async () => {
        illegalRow.dispatchEvent(dragOver(25));
      });
      expect(lastPeerRow).toHaveAttribute('data-drag-placement', 'after');
      expect(illegalRow).not.toHaveAttribute('data-drag-placement');

      await act(async () => {
        moduleDropSurface.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(drop.defaultPrevented).toBe(true);
      expect(taskList.reorderTaskTo).toHaveBeenCalledWith(
        'task-dragged',
        'task-peer-last',
        'after',
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('drops Area work into an empty unassigned Anytime region', async () => {
    const workTask = taskTodoFixture({
      ...task,
      id: 'task-work',
      title: 'Work Task',
      area_id: 'area-work',
    });
    const taskList = { ...defaultTaskList(), tasks: [workTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [taskAreaFixture({ id: 'area-work', title: 'Work' })],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      const source = container.querySelector('[data-task-id="task-work"]')?.closest('article');
      const target = container.querySelector('[data-task-unassigned-drop-target]');
      if (!source || !target) throw new Error('Expected the empty unassigned drop region');
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]');
      expect(source).not.toHaveAttribute('draggable');
      expect(sourceHandle).toHaveAttribute('draggable', 'true');
      const data = new Map<string, string>();
      const dataTransfer = {
        effectAllowed: 'none',
        dropEffect: 'none',
        setData: (type: string, value: string) => data.set(type, value),
        getData: (type: string) => data.get(type) ?? '',
      } as unknown as DataTransfer;
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });

      await act(async () => {
        sourceHandle!.dispatchEvent(dragStart);
        target.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-work', {
        area_id: null,
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
      expect(mockTaskList).toHaveBeenCalledWith(
        'owner-a',
        'someday',
        null,
        expect.any(Function),
        expect.any(Function),
      );
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      expect(container.querySelector('section[aria-label="Someday Tasks"]')).toBeTruthy();
      expect(container.querySelector('[aria-label="Someday Tasks by Area"]')).toBeTruthy();
      expect(container.querySelector('section[aria-label="Unassigned Tasks"]')).toBeTruthy();
      expect(Array.from(container.querySelectorAll('h3')).some(
        (heading) => heading.textContent?.trim() === 'Tasks',
      )).toBe(false);
      expect(normalizeTaskEditorPlanningPatch(
        somedayTask,
        { start_date: '2026-07-24' },
        '2026-07-20',
      )).toEqual({
        destination: 'anytime',
        today_section: null,
        start_date: '2026-07-24',
      });
      expect(normalizeTaskEditorPlanningPatch(
        { ...task, today_section: 'later' },
        { start_date: '2026-07-24' },
        '2026-07-20',
      )).toEqual({
        start_date: '2026-07-24',
        today_section: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('groups Someday tasks in the manual Area order maintained in Config', () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [
        taskTodoFixture({
          id: 'task-home',
          title: 'Home Someday',
          destination: 'someday',
          area_id: 'area-home',
          order_key: 'a0',
        }),
        taskTodoFixture({
          id: 'task-unassigned',
          title: 'Loose Someday',
          destination: 'someday',
          area_id: null,
          order_key: 'a1',
        }),
        taskTodoFixture({
          id: 'task-work',
          title: 'Work Someday',
          destination: 'someday',
          area_id: 'area-work',
          order_key: 'a2',
        }),
      ],
    });
    mockTaskHierarchy.mockReturnValue({
      areas: [
        taskAreaFixture({ id: 'area-home', title: 'Home', order_key: 'a1' }),
        taskAreaFixture({ id: 'area-work', title: 'Work', order_key: 'a0' }),
      ],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell('/tasks/someday');

    try {
      const unassigned = container.querySelector('section[aria-label="Unassigned Tasks"]');
      const work = container.querySelector('section[aria-labelledby="tasks-area-area-work-heading"]');
      const home = container.querySelector('section[aria-labelledby="tasks-area-area-home-heading"]');
      expect(unassigned?.textContent).toContain('Loose Someday');
      expect(work?.textContent).toContain('Work Someday');
      expect(home?.textContent).toContain('Home Someday');
      expect(unassigned?.compareDocumentPosition(work!) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();
      expect(work?.compareDocumentPosition(home!) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();
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
      expect(container.querySelector('section[aria-label="Tasks"]')).toBeTruthy();
      expect(Array.from(container.querySelectorAll('h3')).some(
        (heading) => heading.textContent?.trim() === 'Tasks',
      )).toBe(false);
      expect(container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Mail Link for Existing task"]',
      )?.getAttribute('href')).toBe('message://synthetic-logbook-message');
      const reopen = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Mark Incomplete Existing task"]',
      );
      expect(reopen).toHaveAttribute('role', 'checkbox');
      expect(reopen).toHaveAttribute('aria-checked', 'true');
      const rowHeader = reopen?.closest('article')
        ?.querySelector<HTMLElement>('[data-task-row-header]') ?? null;
      expect(rowHeader).toHaveClass('h-11');
      expect(rowHeader).toHaveClass('pl-1', 'pr-1.5');
      expect(rowHeader).not.toHaveClass('px-1.5');
      expect(reopen?.closest('article')?.querySelector('[data-task-title-control]'))
        .toHaveClass('font-normal');
      expect(reopen?.closest('article')?.querySelector('[data-task-title-control]'))
        .not.toHaveClass('font-medium');
      expect(reopen?.closest('article')).not.toHaveClass(
        'rounded-md',
        'border',
        'bg-foreground/[0.05]',
      );
      await act(async () => {
        reopen?.click();
      });
      await waitFor(() => {
        expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'reopen', undefined);
      });

      expect(mockTaskList).toHaveBeenCalledWith(
        'owner-a',
        'done',
        null,
        expect.any(Function),
        expect.any(Function),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('reopens canceled work from its direct Done control', async () => {
    const canceledTask = {
      ...task,
      lifecycle: 'canceled' as const,
      canceled_at: '2026-07-20T04:05:00.000Z',
    };
    const taskList = { ...defaultTaskList(), tasks: [canceledTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/done');

    try {
      const reopen = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Reopen Canceled Existing task"]',
      );
      expect(reopen).toBeTruthy();
      await act(async () => {
        reopen?.click();
      });
      await waitFor(() => {
        expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'reopen', undefined);
      });
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
      for (const [id, colorClass] of [
        ['inbox', 'text-task-horizon-inbox'],
        ['now', 'text-task-horizon-now'],
        ['next', 'text-task-horizon-next'],
        ['later', 'text-task-horizon-later'],
      ]) {
        const heading = container.querySelector(`#tasks-${id}-heading`);
        expect(heading).toHaveAccessibleName(
          id === 'inbox' ? 'Inbox' : id[0].toUpperCase() + id.slice(1),
        );
        expect(heading?.querySelector('[data-task-count-badge]')).toBeNull();
        expect(heading?.querySelector(
          `[data-task-horizon-surface="heading"][data-task-horizon-symbol="${id}"]`,
        )).toHaveClass(colorClass);
      }

      await openTaskMenuSurface(container, 'Now task', 'Do...');
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



  it('omits menu and keyboard reorder actions', async () => {
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
      const moveDown = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Move Down');
      expect(moveUp).toBeUndefined();
      expect(moveDown).toBeUndefined();
      const title = container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')!;
      await act(async () => {
        title.focus();
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          altKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(taskList.reorderTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('cycles an open Today task horizon with the Windows Tasks command', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockImplementation(() => taskList);
    const { container, root, rerender } = renderShell('/tasks/anytime');
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const shortcut = new KeyboardEvent('keydown', {
        key: 'r',
        altKey: true,
        shiftKey: true,
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
      taskList.tasks = [{ ...task, start_date: null, today_section: 'later' }];
      await act(async () => {
        rerender();
        await Promise.resolve();
      });
      expect(container.querySelector('#task-start-task-a')).toHaveTextContent('Today · Later');
      expect(container.querySelector('[aria-label="Today Later"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('moves a future task to Today Now when cycling its horizon', async () => {
    const futureTask = {
      ...task,
      start_date: '2026-07-24',
      today_section: null,
    };
    const taskList = { ...defaultTaskList(), tasks: [futureTask] };
    mockTaskList.mockImplementation(() => taskList);
    const { container, root } = renderShell('/tasks/upcoming');
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'r',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a'], {
        destination: 'anytime',
        todaySection: 'now',
        startDate: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('normalizes mixed bulk horizons to Today Now as one shared command target', async () => {
    const nowTask = taskTodoFixture({
      ...task,
      id: 'task-a',
      today_section: 'now',
      start_date: null,
    });
    const laterTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Later task',
      today_section: 'later',
      start_date: null,
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    const taskList = { ...defaultTaskList(), tasks: [nowTask, laterTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/anytime');
    try {
      for (const id of ['task-a', 'task-b']) {
        await act(async () => {
          container.querySelector<HTMLButtonElement>(`[data-task-id="${id}"]`)?.dispatchEvent(
            new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
          );
          await Promise.resolve();
        });
      }
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'r',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.moveTasks).toHaveBeenCalledTimes(1);
      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a', 'task-b'], {
        destination: 'anytime',
        todaySection: 'now',
        startDate: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('clears Start and moves work to Someday with the revised Windows commands', async () => {
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-24',
      today_section: null,
    });
    const reminder = taskReminderFixture({
      id: 'reminder-a',
      task_id: 'task-a',
    });
    const cancelReminder = vi.fn().mockResolvedValue(undefined);
    const taskList = { ...defaultTaskList(), tasks: [futureTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskReminders.mockReturnValue({
      reminders: [reminder],
      byRootId: new Map([['task-a', reminder]]),
      dueItems: [],
      claimError: null,
      projectionError: null,
      mode: 'connected',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save: vi.fn().mockResolvedValue(undefined),
      cancel: cancelReminder,
      acknowledge: vi.fn().mockResolvedValue(undefined),
      claimDue: vi.fn().mockResolvedValue(undefined),
    });
    const { container, root } = renderShell('/tasks/upcoming');
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 't',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a'], {
          destination: 'anytime',
          todaySection: null,
          startDate: null,
        });
      });
      expect(cancelReminder).toHaveBeenCalledWith(reminder);

      taskList.moveTasks.mockClear();
      cancelReminder.mockClear();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'g',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a'], {
          destination: 'someday',
          todaySection: null,
          startDate: null,
        });
      });
      expect(cancelReminder).toHaveBeenCalledWith(reminder);
    } finally {
      cleanup(root, container);
    }
  });

  it('applies actionability commands to a multi-selection and lets Escape cancel it', async () => {
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
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      const toolbar = container.querySelector<HTMLElement>('[aria-label="Task Selection"]')!;
      expect(toolbar.textContent).toContain('Cancel');
      expect(toolbar.className).toContain('fixed');
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'f',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenNthCalledWith(1, 'task-a', {
        actionability: 'waiting',
      });
      expect(taskList.updateTask).toHaveBeenNthCalledWith(2, 'task-b', {
        actionability: 'waiting',
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

  it('leaves the browser Find command unmodified', async () => {
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
      loading: false,
      error: null,
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
      expect(document.querySelector<HTMLElement>('[role="dialog"]')).toBeNull();
      expect(shortcut.defaultPrevented).toBe(false);
    } finally {
      cleanup(root, container);
    }
  });

  it('opens date and reminder controls and cycles Area from commands', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [
        { id: 'area-work', owner_id: 'owner-a', title: 'Work' },
        { id: 'area-home', owner_id: 'owner-a', title: 'Home' },
      ],
      loading: false,
      error: null,
    });
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
      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      await act(async () => {
        row.focus();
        row.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ', bubbles: true, cancelable: true,
        }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'd', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
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
          key: 'v', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        area_id: 'area-work',
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'b', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(document.querySelector('#task-start-reminder-task-a'));
    } finally {
      cleanup(root, container);
    }
  });

  it('normalizes mixed bulk Areas before advancing them together', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
      area_id: 'area-home',
    });
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [
        { id: 'area-work', owner_id: 'owner-a', title: 'Work' },
        { id: 'area-home', owner_id: 'owner-a', title: 'Home' },
      ],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'v', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(document.querySelector<HTMLElement>('[role="dialog"]')).toBeNull();
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', { area_id: null });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-b', { area_id: null });
    } finally {
      cleanup(root, container);
    }
  });

  it('normalizes bulk reminder shorthand before a second Enter applies it', async () => {
    const firstTask = taskTodoFixture({
      ...task,
      id: 'task-a',
      start_date: '2026-07-26',
      today_section: null,
    });
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      start_date: '2026-07-27',
      today_section: null,
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [firstTask, secondTask] });
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
      save: saveReminder,
      cancel: vi.fn(),
      acknowledge: vi.fn(),
      claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/anytime');
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'b',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      const input = dialog.querySelector<HTMLInputElement>('[aria-label="Reminder Time"]')!;
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('inputmode', 'text');
      expect(input).toHaveAttribute('placeholder', 'No Reminder');
      expect(input).toHaveClass('w-32', 'shrink-0');

      await act(async () => {
        setInputValue(input, '1:3p');
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(input).toHaveValue('1:30 pm');
      expect(saveReminder).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).toBe(dialog);

      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      await waitFor(() => expect(saveReminder).toHaveBeenCalledTimes(2));
      expect(saveReminder).toHaveBeenNthCalledWith(1, expect.objectContaining({
        rootId: 'task-a',
        localTime: '13:30',
      }));
      expect(saveReminder).toHaveBeenNthCalledWith(2, expect.objectContaining({
        rootId: 'task-b',
        localTime: '13:30',
      }));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('validates a mixed Today bulk reminder and lets Apply resolve raw shorthand once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T20:00:00.000Z'));
    const todayTask = taskTodoFixture({
      ...task,
      id: 'task-a',
      start_date: null,
      today_section: 'next',
    });
    const futureTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Future task',
      start_date: '2026-07-27',
      today_section: null,
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [todayTask, futureTask] });
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
      save: saveReminder,
      cancel: vi.fn(),
      acknowledge: vi.fn(),
      claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/anytime');
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'b',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      const input = dialog.querySelector<HTMLInputElement>('[aria-label="Reminder Time"]')!;

      await act(async () => {
        setInputValue(input, '12p');
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(input).toHaveValue('');
      expect(saveReminder).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).toBe(dialog);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Not Allowed.',
        duration: 1_800,
      });

      await act(async () => {
        setInputValue(input, '1:3p');
        Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
          .find((button) => button.textContent?.trim() === 'Apply')
          ?.click();
        await Promise.resolve();
      });
      await waitFor(() => expect(saveReminder).toHaveBeenCalledTimes(2));
      expect(saveReminder).toHaveBeenNthCalledWith(1, expect.objectContaining({
        rootId: 'task-a',
        localTime: '13:30',
      }));
      expect(saveReminder).toHaveBeenNthCalledWith(2, expect.objectContaining({
        rootId: 'task-b',
        localTime: '13:30',
      }));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('uses the standard URL control and opens Primary Link without a clear button', async () => {
    const taskList = {
      ...defaultTaskList(),
      tasks: [taskTodoFixture({ ...task, primary_link: 'https://example.test' })],
    };
    mockTaskList.mockReturnValue(taskList);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const input = container.querySelector<HTMLInputElement>('#task-primary-link-task-a')!;
      const openLink = container.querySelector<HTMLButtonElement>('[aria-label="Open Primary Link"]')!;
      expect(input).toHaveAttribute('type', 'url');
      expect(input).toHaveClass('border-[hsl(var(--grid-sticky-line))]');
      expect(container.querySelector('[aria-label="Clear Primary Link"]')).toBeNull();
      await act(async () => {
        openLink.click();
      });
      expect(open).toHaveBeenCalledWith(
        'https://example.test',
        '_blank',
        'noopener,noreferrer',
      );
    } finally {
      open.mockRestore();
      cleanup(root, container);
    }
  });

  it('reveals the Primary Link action for any nonempty value', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const addPrimaryLink = container.querySelector<HTMLButtonElement>(
        '[aria-label="Add Primary Link"]',
      )!;
      expect(addPrimaryLink).toBeTruthy();
      expect(container.querySelector('#task-primary-link-task-a')).toBeNull();
      await act(async () => addPrimaryLink.click());
      const input = container.querySelector<HTMLInputElement>('#task-primary-link-task-a')!;
      expect(document.activeElement).toBe(input);
      expect(container.querySelector('[aria-label="Open Primary Link"]')).toBeNull();

      await act(async () => {
        setInputValue(input, 'x');
      });
      expect(container.querySelector('[aria-label="Open Primary Link"]')).toBeEnabled();

      await act(async () => {
        setInputValue(input, 'https://example.test');
      });
      expect(container.querySelector('[aria-label="Open Primary Link"]')).toBeEnabled();
    } finally {
      cleanup(root, container);
    }
  });

  it('persists a manually emptied Mail Primary Link across close and reopen', async () => {
    const mailTask = taskTodoFixture({
      ...task,
      primary_link: 'message://mail-task-a',
      source_kind: 'mail_message',
      source_url: 'message://mail-task-a',
      source_title: 'Mail task',
    });
    const taskList = {
      ...defaultTaskList(),
      tasks: [mailTask],
    };
    taskList.updateTask.mockImplementation(async (taskId, patch) => {
      taskList.tasks = taskList.tasks.map((candidate) => (
        candidate.id === taskId ? { ...candidate, ...patch } : candidate
      ));
    });
    mockTaskList.mockReturnValue(taskList);
    const { container, root, rerender } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const input = container.querySelector<HTMLInputElement>('#task-primary-link-task-a')!;
      await act(async () => {
        setInputValue(input, '');
        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        container.querySelector<HTMLElement>('[data-task-view-heading]')?.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(taskList.updateTask).toHaveBeenCalledWith('task-a', { primary_link: null });
      });
      rerender();
      await waitForTaskEditorExit(container);
      expect(container.querySelector('[aria-label="Open Mail Link for Existing task"]')).toBeNull();
      expect(container.querySelector('[aria-label="Mail Message Source for Existing task"]'))
        .toBeTruthy();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expect(container.querySelector<HTMLInputElement>('#task-primary-link-task-a')).toBeNull();
      expect(container.querySelector('[aria-label="Add Primary Link"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('uses Upcoming buckets for Start and keeps only Deadline temporal metadata in rows', () => {
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
      expect(container.querySelector('[aria-label^="Starts "]')).toBeNull();
      expect(container.querySelector('[data-task-row-metadata] svg.lucide-play')).toBeNull();
      expect(container.querySelector('[aria-label="Deadline 5 days left"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('applies, replaces, and clears the fixed actionability quick filters', async () => {
    const user = userEvent.setup();
    const actionable = taskTodoFixture({
      ...task,
      id: 'task-actionable',
      title: 'Actionable task',
      actionability: 'actionable',
      client_mutation_id: 'mutation-actionable',
    });
    const waiting = taskTodoFixture({
      ...task,
      id: 'task-waiting',
      title: 'Waiting task',
      actionability: 'waiting',
      client_mutation_id: 'mutation-waiting',
    });
    const rechecking = taskTodoFixture({
      ...task,
      id: 'task-rechecking',
      title: 'Rechecking task',
      actionability: 'rechecking',
      client_mutation_id: 'mutation-rechecking',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [actionable, waiting, rechecking],
    });
    const { container, root } = renderShell('/tasks/anytime');
    try {
      expect(container.querySelector('[aria-label="Quick Filters"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-actionable"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-waiting"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-rechecking"]')).toBeTruthy();

      await user.click(container.querySelector('[aria-label="Quick Filters"]')!);
      await user.click(document.querySelector('[role="menuitemradio"][data-value="waiting"]')
        ?? Array.from(document.querySelectorAll('[role="menuitemradio"]'))
          .find((item) => item.textContent === 'Only Waiting')!);
      await waitFor(() => {
        expect(container.querySelector('[aria-label="Quick Filters: Only Waiting"]')).toBeTruthy();
      });
      expect(container.querySelector('[data-task-id="task-actionable"]')).toBeNull();
      expect(container.querySelector('[data-task-id="task-waiting"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-rechecking"]')).toBeNull();

      await user.click(container.querySelector('[aria-label="Quick Filters: Only Waiting"]')!);
      await user.click(Array.from(document.querySelectorAll('[role="menuitemradio"]'))
        .find((item) => item.textContent === 'Only Not Ready')!);
      await waitFor(() => {
        expect(container.querySelector('[aria-label="Quick Filters: Only Not Ready"]'))
          .toBeTruthy();
      });
      expect(container.querySelector('[data-task-id="task-actionable"]')).toBeNull();
      expect(container.querySelector('[data-task-id="task-waiting"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-rechecking"]')).toBeTruthy();

      await user.click(
        container.querySelector('[aria-label="Quick Filters: Only Not Ready"]')!,
      );
      await user.click(Array.from(document.querySelectorAll('[role="menuitemradio"]'))
        .find((item) => item.textContent === 'All Tasks')!);
      await waitFor(() => {
        expect(container.querySelector('[aria-label="Quick Filters"]')).toBeTruthy();
      });
      expect(container.querySelector('[data-task-id="task-actionable"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-waiting"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-rechecking"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('clears task focus and bulk selection when a quick filter changes visibility', async () => {
    const user = userEvent.setup();
    const actionable = taskTodoFixture({
      ...task,
      id: 'task-actionable',
      title: 'Actionable task',
      actionability: 'actionable',
      client_mutation_id: 'mutation-actionable',
    });
    const waiting = taskTodoFixture({
      ...task,
      id: 'task-waiting',
      title: 'Waiting task',
      actionability: 'waiting',
      client_mutation_id: 'mutation-waiting',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [actionable, waiting],
    });
    const { container, root } = renderShell('/tasks/anytime');
    try {
      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-actionable"]')
          ?.dispatchEvent(new MouseEvent('click', {
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }));
      });
      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-waiting"]')
          ?.dispatchEvent(new MouseEvent('click', {
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }));
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeTruthy();

      await user.click(container.querySelector('[aria-label="Quick Filters"]')!);
      await user.click(Array.from(document.querySelectorAll('[role="menuitemradio"]'))
        .find((item) => item.textContent === 'Only Waiting')!);
      await waitFor(() => {
        expect(container.querySelector('[aria-label="Quick Filters: Only Waiting"]')).toBeTruthy();
      });

      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeNull();
      expect(container.querySelector('[data-task-id="task-actionable"]')).toBeNull();
      expect(container.querySelector('[data-task-id="task-waiting"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps the active quick filter across list navigation and omits it elsewhere', async () => {
    const user = userEvent.setup();
    const waiting = taskTodoFixture({
      ...task,
      id: 'task-waiting',
      title: 'Waiting task',
      actionability: 'waiting',
      client_mutation_id: 'mutation-waiting',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [waiting] });
    const { container, root } = renderShell('/tasks/anytime');
    try {
      await user.click(container.querySelector('[aria-label="Quick Filters"]')!);
      await user.click(Array.from(document.querySelectorAll('[role="menuitemradio"]'))
        .find((item) => item.textContent === 'Only Waiting')!);
      await waitFor(() => {
        expect(container.querySelector('[aria-label="Quick Filters: Only Waiting"]')).toBeTruthy();
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '1',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(container.querySelector('[data-task-view-heading]')).toHaveTextContent('Today');
      expect(container.querySelector('[aria-label="Quick Filters: Only Waiting"]')).toBeTruthy();

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '6',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(container.querySelector('[data-task-view-heading]')).toHaveTextContent('Config');
      expect(container.querySelector('[data-task-quick-filter-trigger]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });


  it('opens Config with the Windows application command', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const shortcut = new KeyboardEvent('keydown', {
        key: '6',
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
