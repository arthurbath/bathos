import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from 'react-router-dom';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  taskAreaFixture,
  taskChecklistItemFixture,
  taskRecurrenceDefinitionFixture,
  taskRecurrenceRevisionFixture,
  taskReminderFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';
import { normalizeTaskEditorPlanningPatch } from './taskEditorPlanning';
import {
  requestTaskRowTemporalPickerOpen,
  requestTaskStartPickerOpen,
} from './taskStartPickerEvents';
import { getTasksStorageStatusLabel } from './tasksStorageStatus';
import { TASK_NATIVE_COMMAND_EVENT, TasksShell } from './TasksShell';
import { useBathosFormInteractions } from '@/platform/hooks/useCommandEnterSubmit';
import { TASK_CLIPBOARD_KIND } from '@/modules/tasks/domain/taskClipboard';
import { TASK_CLIPBOARD_MIME_TYPE } from '@/modules/tasks/domain/taskClipboardRepresentations';
import { NEW_TASK_DRAFT_ID } from '@/modules/tasks/domain/taskCreationDraft';
import {
  TASK_CHECKLIST_FORWARD_MUTATION_EVENT,
} from '@/modules/tasks/hooks/taskChecklistForwardMutationEvents';
import {
  UnsafeTaskRedoError,
} from '@/modules/tasks/domain/taskHistory';
import type { TaskQuickFilter } from '@/modules/tasks/domain/taskQuickFilters';

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
const mockTaskDragHandleVisibility = vi.fn();
const mockTaskHierarchy = vi.fn();
const mockTaskDeletedHierarchyRoots = vi.fn();
const mockTaskReminders = vi.fn();
const mockTaskUndo = vi.fn();
const mockTaskChecklistUndo = vi.fn();
const mockTaskRecurrences = vi.fn();
const mockTaskChecklist = vi.fn();
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

vi.mock('@/modules/tasks/hooks/useTaskDragHandleVisibility', () => ({
  useTaskDragHandleVisibility: (...args: unknown[]) => (
    mockTaskDragHandleVisibility(...args)
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

vi.mock('@/modules/tasks/hooks/useTaskChecklistUndo', () => ({
  useTaskChecklistUndo: (...args: unknown[]) => mockTaskChecklistUndo(...args),
}));

vi.mock('@/modules/tasks/hooks/useTaskRecurrences', () => ({
  useTaskRecurrences: (...args: unknown[]) => mockTaskRecurrences(...args),
}));

vi.mock('@/modules/tasks/hooks/useTaskChecklist', () => ({
  useTaskChecklist: (...args: unknown[]) => mockTaskChecklist(...args),
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

vi.mock('./TaskSyncStatusCard', () => ({
  TaskSyncStatusCard: () => (
    <section data-task-sync-status>
      <h3>Sync Status</h3>
      <span>Health</span>
      <span>Healthy</span>
      <span>Pending Changes</span>
      <span>0</span>
      <span>Last Successful Sync</span>
      <span>2026 Aug 3, 5:55 PM</span>
    </section>
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

vi.mock('@/platform/components/FeedbackDialog', () => ({
  FeedbackDialog: ({ trigger }: { trigger?: React.ReactNode }) => <>{trigger}</>,
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
    fetching: false,
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

function defaultTaskChecklist(
  items = [] as ReturnType<typeof taskChecklistItemFixture>[],
) {
  return {
    items,
    loading: false,
    createItem: vi.fn(),
    createItems: vi.fn(),
    createItemCopies: vi.fn(),
    updateItem: vi.fn(),
    setCompleted: vi.fn(),
    deleteItem: vi.fn(),
    deleteItems: vi.fn(),
    reorderItem: vi.fn(),
    reorderItems: vi.fn(),
  };
}

function defaultTasksRuntime() {
  return {
    mode: 'local' as const,
    syncState: 'local' as const,
    startupRefreshPending: false,
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

function NavigationCapture({
  onNavigate,
  onLocation,
}: {
  onNavigate: (navigate: NavigateFunction) => void;
  onLocation: (location: string) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  React.useLayoutEffect(() => {
    onNavigate(navigate);
    onLocation(`${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search, navigate, onLocation, onNavigate]);
  return null;
}

function renderShell(initialEntry = '/tasks/today') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let capturedNavigate: NavigateFunction | null = null;
  const locations: string[] = [];
  const captureNavigate = (navigate: NavigateFunction) => {
    capturedNavigate = navigate;
  };
  const captureLocation = (location: string) => {
    locations.push(location);
  };
  const render = () => {
    root.render(
      <FormInteractionsHarness>
        <MemoryRouter initialEntries={[initialEntry]}>
          <NavigationCapture
            onNavigate={captureNavigate}
            onLocation={captureLocation}
          />
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
    locations,
    navigate: (to: string) => {
      if (capturedNavigate === null) throw new Error('Router navigation was not captured');
      act(() => capturedNavigate?.(to));
    },
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

function dispatchTouch(
  target: Element,
  type: 'touchstart' | 'touchmove' | 'touchend',
  clientY?: number,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: clientY === undefined ? [] : [{ clientY }],
  });
  target.dispatchEvent(event);
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
  const accessibilityTreeControls = controls.filter(
    (control) => control.closest('[aria-hidden="true"], [inert]') === null,
  );
  expect(accessibilityTreeControls.length).toBeGreaterThan(0);
  accessibilityTreeControls.forEach((control) => {
    expect(control, control.outerHTML).not.toHaveAccessibleName('');
  });
}

async function openTaskMenuSurface(
  container: HTMLElement,
  taskTitle: string,
  surfaceLabel: 'Start...' | 'Deadline...',
) {
  const user = userEvent.setup();
  const actions = container.querySelector<HTMLButtonElement>(
    `button[aria-label="Actions for ${taskTitle}"]`,
  );
  await act(async () => {
    if (actions) await user.click(actions);
  });
  await waitFor(() => expect(actions).toHaveAttribute('aria-expanded', 'true'));
  const menu = document.getElementById(actions?.getAttribute('aria-controls') ?? '');
  const surface = Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    .find((item) => item.textContent === surfaceLabel);
  expect(surface).toBeDefined();
  await act(async () => {
    if (surface) await user.click(surface);
  });
  await waitFor(() => expect(actions).toHaveAttribute('aria-expanded', 'false'));
  await waitFor(() => {
    expect(document.querySelector(
      `[data-task-row-temporal-picker="${surfaceLabel === 'Start...' ? 'start' : 'deadline'}"]`,
    )).not.toBeNull();
  });
}

async function openTaskMenuSubmenu(
  container: HTMLElement,
  taskTitle: string,
  submenuLabel: 'Area' | 'Actionability',
) {
  const actions = container.querySelector<HTMLButtonElement>(
    `button[aria-label="Actions for ${taskTitle}"]`,
  );
  await act(async () => {
    actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const trigger = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .find((item) => item.textContent?.trim() === submenuLabel);
  if (!trigger) throw new Error(`Task submenu was not found: ${submenuLabel}`);
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    }));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
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
    Reflect.deleteProperty(window, '__bathosNativeApp');
    Reflect.deleteProperty(window, '__bathosTasksNative');
    Reflect.deleteProperty(window, 'webkit');
    let toastSequence = 0;
    mockToast.mockReset().mockImplementation(() => ({
      id: `toast-${toastSequence += 1}`,
      dismiss: vi.fn(),
      update: vi.fn(),
    }));
    mockPrepareForSignOut.mockReset().mockResolvedValue(undefined);
    mockTasksRuntime.mockReset().mockReturnValue(defaultTasksRuntime());
    mockTaskList.mockReset();
    mockTaskChecklist.mockReset().mockReturnValue(defaultTaskChecklist());
    mockTaskQuickFilterPreference.mockReset().mockImplementation(() => {
      const [filter, setFilter] = React.useState<TaskQuickFilter>('all');
      return { filter, setFilter };
    });
    mockTaskAutomaticListSorting.mockReset().mockReturnValue({
      enabled: false,
      loading: false,
      error: null,
      pending: false,
      setEnabled: vi.fn().mockResolvedValue(undefined),
    });
    mockTaskDragHandleVisibility.mockReset().mockReturnValue({
      visibility: 'hidden',
      loading: false,
      error: null,
      pending: false,
      setVisibility: vi.fn().mockResolvedValue(undefined),
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
    mockTaskChecklistUndo.mockReset().mockReturnValue({
      available: false,
      redoAvailable: false,
      pending: false,
      loading: false,
      error: null,
      event: null,
      redoEvent: null,
      forwardActionPending: false,
      undo: vi.fn().mockResolvedValue(null),
      redo: vi.fn().mockResolvedValue(null),
      undoWhenAvailable: vi.fn().mockResolvedValue(null),
      redoWhenAvailable: vi.fn().mockResolvedValue(null),
      registerForwardAction: vi.fn(),
      hasPendingForwardAction: vi.fn(() => false),
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
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'local',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: vi.fn(),
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

  it('consumes native new-task capture once into a focused Today Inbox draft', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, locations, root } = renderShell(
      '/tasks/today?native_new_task=1',
    );

    try {
      await waitFor(() => {
        expect(document.getElementById('task-title-task-draft:new')).toBeTruthy();
      });
      const title = document.getElementById(
        'task-title-task-draft:new',
      ) as HTMLInputElement;
      expect(document.activeElement).toBe(title);
      expect(title).toHaveAttribute('placeholder', 'New Task');

      await act(async () => {
        setInputValue(title, 'Captured from Control Center');
      });
      expect(title).toHaveValue('Captured from Control Center');
      expect(document.getElementById('task-start-task-draft:new'))
        .toHaveTextContent('Today · Inbox');
      expect(container.querySelectorAll('[data-task-row-id="task-draft:new"]'))
        .toHaveLength(1);
      expect(locations.at(-1)).toBe('/tasks/today');
    } finally {
      cleanup(root, container);
    }
  });

  it('shows native Summary capture focus and yields it to direct pointer editing', async () => {
    const nativeMessages: unknown[] = [];
    const nativeWindow = window as Window & {
      __bathosTasksNative?: {
        schemaVersion: number;
        installationId: string;
      };
      webkit?: {
        messageHandlers?: {
          bathosTasksWidget?: {
            postMessage: (message: unknown) => void;
          };
        };
      };
    };
    nativeWindow.__bathosTasksNative = {
      schemaVersion: 2,
      installationId: '53a4b5c1-3a4e-4fab-a5bf-4c1b114fc690',
    };
    nativeWindow.webkit = {
      messageHandlers: {
        bathosTasksWidget: {
          postMessage: (message) => nativeMessages.push(message),
        },
      },
    };
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell('/tasks/today?native_new_task=1');

    try {
      const title = await waitFor(() => {
        const candidate = container.querySelector<HTMLInputElement>(
          '#task-title-task-draft\\:new',
        );
        expect(candidate).toBeTruthy();
        return candidate!;
      });
      const capture = title.closest<HTMLElement>('[data-task-native-summary-capture]');
      await waitFor(() => {
        expect(capture).toHaveAttribute('data-task-native-summary-capture', 'true');
      });
      expect(title).toHaveClass('border-ring', 'ring-2', 'ring-ring/65');
      expect(capture?.querySelector('[data-task-native-summary-caret]')).toBeTruthy();
      expect(nativeMessages).toContainEqual({
        type: 'focus-new-task-summary',
        schemaVersion: 2,
      });

      await act(async () => {
        title.dispatchEvent(new MouseEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(capture).not.toHaveAttribute('data-task-native-summary-capture');
      expect(capture?.querySelector('[data-task-native-summary-caret]')).toBeNull();
      expect(title).not.toHaveClass('border-ring', 'ring-2', 'ring-ring/65');
    } finally {
      cleanup(root, container);
      delete nativeWindow.__bathosTasksNative;
      delete nativeWindow.webkit;
    }
  });

  it('uses the configured list placement for a widget-header new-task capture', async () => {
    const taskList = { ...defaultTaskList(), tasks: [] };
    mockTaskList.mockReturnValue(taskList);
    const { container, locations, root } = renderShell(
      '/tasks/upcoming?native_new_task=list',
    );

    try {
      await waitFor(() => {
        expect(document.getElementById('task-title-task-draft:new')).toBeTruthy();
      });
      expect(document.activeElement).toBe(
        document.getElementById('task-title-task-draft:new'),
      );
      expect(document.getElementById('task-start-task-draft:new')).toHaveTextContent(
        'Tomorrow',
      );
      expect(container.querySelectorAll('[data-task-row-id="task-draft:new"]'))
        .toHaveLength(1);
      expect(locations.at(-1)).toBe('/tasks/upcoming');
    } finally {
      cleanup(root, container);
    }
  });

  it('focuses an existing unsaved draft when native capture arrives', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, locations, navigate, root } = renderShell();

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
      const title = document.getElementById(
        'task-title-task-draft:new',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(title, 'Existing unsaved draft');
      });
      title.blur();

      navigate('/tasks/today?native_new_task=1');

      await waitFor(() => {
        expect(locations.at(-1)).toBe('/tasks/today');
        expect(document.activeElement).toBe(title);
      });
      expect(title).toHaveValue('Existing unsaved draft');
      expect(container.querySelectorAll('[data-task-row-id="task-draft:new"]'))
        .toHaveLength(1);
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
      expect(container.querySelector('[aria-label="Add Notes"]')).toBeTruthy();
      expect(container.querySelector('[aria-label="Add Link"]')).toBeTruthy();
      expect(container.querySelector('button[aria-label="Add Checklist"]')).toBeTruthy();
      const disclosures = container.querySelector('[data-task-editor-disclosures]');
      expect(disclosures).toHaveAttribute('data-layout', 'optional-content');
      expect(disclosures).toHaveClass('grid', 'grid-cols-3', 'gap-2');
      expect(disclosures?.querySelector('[data-task-primary-link-disclosure]'))
        .toHaveClass('w-full', 'border-primary', 'text-primary', 'text-center');
      expect(disclosures?.querySelector('[data-task-checklist-disclosure]'))
        .toHaveClass('w-full', 'border-primary', 'text-primary', 'text-center');
      expect(disclosures?.querySelectorAll('[data-task-editor-disclosure-divider]'))
        .toHaveLength(0);
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

  it('collapses a persisted creation draft without applying the empty-draft exit animation', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'a', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      const title = container.querySelector<HTMLInputElement>(
        '#task-title-task-draft\\:new',
      )!;
      await act(async () => {
        setInputValue(title, 'Persisted creation draft');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });
      expect(taskList.createTask).toHaveBeenCalled();

      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      await waitFor(() => {
        expect(container.querySelector('[data-task-editor-region]'))
          .toHaveAttribute('data-state', 'closing');
      });
      expect(container.querySelector('[data-task-row-id="task-draft:new"]'))
        .not.toHaveAttribute('data-draft-exiting');
      await waitForTaskEditorExit(container, 'task-draft:new');
    } finally {
      cleanup(root, container);
    }
  });

  it('persists a titled creation draft before opening its checklist editor', async () => {
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
      const addChecklist = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Add Checklist"]',
      )!;

      await act(async () => {
        setInputValue(title, 'New task with checklist');
        addChecklist.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New task with checklist',
      }));
      await waitFor(() => {
        expect(focusRequests).toEqual(['task-draft:new']);
      });
    } finally {
      document.removeEventListener('bathos:task-checklist-focus', recordFocusRequest);
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
      await waitFor(() => {
        expect(focusRequests).toEqual(['task-draft:new']);
      });
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
        'bottom-[calc(var(--mobile-bottom-nav-bottom-offset)+4.75rem)]',
      );
      expect(newTaskButtons[0]).toHaveClass(
        'h-12',
        'w-12',
        'rounded-full',
        'border',
        'border-success',
        'bg-success/85',
        'text-success-foreground',
        'backdrop-blur-sm',
        'supports-[backdrop-filter]:bg-success/75',
      );
      expect(newTaskButtons[0].className).not.toContain('hover:');
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

  it('fades and disables the floating creation action while adding or editing a task', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell('/tasks/today');

    try {
      const floatingBoundary = container.querySelector<HTMLElement>(
        '[data-task-floating-create-boundary]',
      )!;
      const floatingCreate = container.querySelector<HTMLButtonElement>(
        '[data-task-floating-create]',
      )!;

      expect(floatingBoundary).toHaveClass('opacity-100', 'transition-opacity');
      expect(floatingCreate).toBeEnabled();
      expect(floatingCreate).toHaveClass('pointer-events-auto');
      expect(floatingCreate).not.toHaveAttribute('aria-hidden');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await waitFor(() => {
        expect(container.querySelector('#task-title-task-a')).not.toBeNull();
        expect(floatingBoundary).toHaveClass('opacity-0');
        expect(floatingCreate).toBeDisabled();
      });
      expect(floatingCreate).toHaveAttribute('aria-hidden', 'true');
      expect(floatingCreate).toHaveClass('pointer-events-none', 'disabled:opacity-100');

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }));
      });
      await waitFor(() => {
        expect(container.querySelector('#task-title-task-a')).toBeNull();
        expect(floatingBoundary).toHaveClass('opacity-100');
        expect(floatingCreate).toBeEnabled();
      });
      expect(floatingCreate).not.toHaveAttribute('aria-hidden');
      expect(floatingCreate).toHaveClass('pointer-events-auto');

      await act(async () => {
        floatingCreate.click();
      });
      await waitFor(() => {
        expect(container.querySelector('[data-task-row-id="task-draft:new"]')).not.toBeNull();
        expect(floatingBoundary).toHaveClass('opacity-0');
        expect(floatingCreate).toBeDisabled();
      });
    } finally {
      cleanup(root, container);
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

  it('creates from a Today bucket heading without displaying an Add Task icon', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/today');

    try {
      const bucketButton = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Add Task to Next"]',
      )!;
      expect(bucketButton).toHaveClass('cursor-pointer');
      expect(bucketButton.querySelectorAll('svg')).toHaveLength(1);

      await act(async () => bucketButton.click());
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
      expect(bucketButton.querySelector('svg')).toBeNull();

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
        '[aria-label="Find Tasks"]',
      )?.value).toBe('n');
    } finally {
      cleanup(root, container);
    }
  });

  it('reveals and opens Quick Find after a touch pull from the top of a list', async () => {
    const maxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      'maxTouchPoints',
    );
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5,
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const surface = container.querySelector<HTMLElement>(
        '[data-task-module-drop-surface]',
      )!;
      await act(async () => {
        dispatchTouch(surface, 'touchstart', 20);
        dispatchTouch(surface, 'touchmove', 220);
      });
      expect(container.querySelector('[data-task-pull-to-find-indicator]')).toBeTruthy();

      await act(async () => {
        dispatchTouch(surface, 'touchend');
        await Promise.resolve();
      });
      expect(document.querySelector<HTMLElement>('[role="dialog"]'))
        .toHaveAccessibleName('Quick Find');
      const input = document.querySelector<HTMLInputElement>(
        '[data-task-quick-find-input]',
      );
      expect(document.activeElement).toBe(input);
      expect(input?.selectionStart).toBe(input?.value.length);
      expect(container.querySelector('[data-task-pull-to-find-indicator]')).toBeNull();
    } finally {
      cleanup(root, container);
      if (maxTouchPointsDescriptor) {
        Object.defineProperty(
          window.navigator,
          'maxTouchPoints',
          maxTouchPointsDescriptor,
        );
      } else {
        Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
      }
    }
  });

  it('reserves touch pulls from drag handles for reordering instead of Quick Find', async () => {
    const maxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      'maxTouchPoints',
    );
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5,
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [task, taskTodoFixture({
        id: 'task-b',
        title: 'Second task',
        destination: 'anytime',
        today_section: 'next',
        start_date: '2026-07-20',
      })],
    });
    mockTaskDragHandleVisibility.mockReturnValue({
      visibility: 'always',
      loading: false,
      error: null,
      pending: false,
      setVisibility: vi.fn().mockResolvedValue(undefined),
    });
    const { container, root } = renderShell();

    try {
      const handle = container.querySelector<HTMLElement>(
        '[data-task-drag-handle-control]',
      )!;
      await act(async () => {
        dispatchTouch(handle, 'touchstart', 20);
        dispatchTouch(handle, 'touchmove', 220);
      });
      expect(container.querySelector('[data-task-pull-to-find-indicator]')).toBeNull();

      await act(async () => {
        dispatchTouch(handle, 'touchend');
        await Promise.resolve();
      });
      expect(document.querySelector('[data-task-quick-find]')).toBeNull();
    } finally {
      cleanup(root, container);
      if (maxTouchPointsDescriptor) {
        Object.defineProperty(
          window.navigator,
          'maxTouchPoints',
          maxTouchPointsDescriptor,
        );
      } else {
        Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
      }
    }
  });

  it('elastically resists a touch pull at the bottom without opening Quick Find', async () => {
    const maxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      'maxTouchPoints',
    );
    const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY');
    const innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      document.documentElement,
      'scrollHeight',
    );
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5,
    });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 1000,
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const surface = container.querySelector<HTMLElement>(
        '[data-task-module-drop-surface]',
      )!;
      const main = container.querySelector<HTMLElement>(
        '[data-task-list-bottom-clearance]',
      )!;
      await act(async () => {
        dispatchTouch(surface, 'touchstart', 220);
        dispatchTouch(surface, 'touchmove', 120);
      });
      expect(main.style.transform).toMatch(/translate3d\(0, -[1-9]/);
      expect(container.querySelector('[data-task-pull-to-find-indicator]')).toBeNull();

      await act(async () => {
        dispatchTouch(surface, 'touchend');
      });
      expect(main.style.transform).toBe('');
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      cleanup(root, container);
      if (maxTouchPointsDescriptor) {
        Object.defineProperty(window.navigator, 'maxTouchPoints', maxTouchPointsDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
      }
      if (scrollYDescriptor) {
        Object.defineProperty(window, 'scrollY', scrollYDescriptor);
      } else {
        Reflect.deleteProperty(window, 'scrollY');
      }
      if (innerHeightDescriptor) {
        Object.defineProperty(window, 'innerHeight', innerHeightDescriptor);
      } else {
        Reflect.deleteProperty(window, 'innerHeight');
      }
      if (scrollHeightDescriptor) {
        Object.defineProperty(document.documentElement, 'scrollHeight', scrollHeightDescriptor);
      } else {
        Reflect.deleteProperty(document.documentElement, 'scrollHeight');
      }
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
      await waitFor(() => {
        expect(document.getElementById('task-title-task-draft:new')).toBeTruthy();
      });
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

  it('keeps Reminder hidden for an unplanned untitled draft', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'a', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-draft:new');
        await Promise.resolve();
      });

      expect(document.querySelector('[data-task-start-reminder-group]')).toBeNull();
      expect(document.getElementById('task-start-reminder-task-draft:new')).toBeNull();
      expect(taskList.createTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });
  it('closes and discards an untitled draft on plain Escape', async () => {
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
      await waitFor(() => {
        expect(container.querySelector('[data-task-editor-region]'))
          .toHaveAttribute('data-state', 'closing');
      });
      await waitFor(() => {
        expect(container.querySelector('[data-task-row-id="task-draft:new"]'))
          .toHaveAttribute('data-draft-exiting', 'true');
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
      expect(document.activeElement).toBe(
        container.querySelector('[data-task-row-id="task-a"]'),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps a blank Summary when Notes contain the task meaning', async () => {
    const meaningfulTask = taskTodoFixture({
      ...task,
      notes: 'The task is fully described here.',
    });
    const taskList = { ...defaultTaskList(), tasks: [meaningfulTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      await act(async () => {
        setInputValue(title, '');
        await Promise.resolve();
      });
      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', { title: '' });
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await waitForTaskEditorExit(container);
    } finally {
      cleanup(root, container);
    }
  });

  it('trashes a fully empty existing task when its editor closes', async () => {
    const taskList = {
      ...defaultTaskList(),
      tasks: [taskTodoFixture({ ...task, notes: '', primary_link: null })],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      await act(async () => {
        setInputValue(title, '');
        await Promise.resolve();
      });
      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', { title: '' });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'delete');
      await waitForTaskEditorExit(container);
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
      expect(container.querySelector('[aria-label="Mark Incomplete Existing task"]'))
        .toHaveClass('text-success');
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
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          description: 'The task now appears in Anytime.',
        });
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
        expect.any(Function),
      );
      expect(upcomingEvent.defaultPrevented).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('navigates task views with Mac Control-number when Safari reserves Command-number', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
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
        expect.any(Function),
      );
      expect(upcomingEvent.defaultPrevented).toBe(true);
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      cleanup(root, container);
    }
  });

  it('conceals task rows until a destination planning query settles', async () => {
    const upcomingTask = taskTodoFixture({
      id: 'task-upcoming',
      title: 'Settled upcoming task',
      destination: 'anytime',
      today_section: null,
      start_date: '2026-07-21',
    });
    let upcomingFetching = true;
    mockTaskList.mockImplementation((_ownerId, currentView) => ({
      ...defaultTaskList(),
      tasks: currentView === 'upcoming' ? [upcomingTask] : [task],
      fetching: currentView === 'upcoming' && upcomingFetching,
    }));
    const { container, navigate, rerender, root } = renderShell();

    try {
      expect(container.textContent).toContain('Existing task');

      navigate('/tasks/upcoming');
      expect(
        container.querySelector('[data-task-view-transition-loading="true"]'),
      ).not.toBeNull();
      expect(container.textContent).not.toContain('Existing task');
      expect(container.textContent).not.toContain('Settled upcoming task');

      upcomingFetching = false;
      act(() => rerender());
      await waitFor(() => {
        expect(
          container.querySelector('[data-task-view-transition-loading="true"]'),
        ).toBeNull();
      });
      expect(container.textContent).toContain('Settled upcoming task');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps current-view rows visible during a same-view query refresh after startup settles', () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      fetching: true,
    });
    const { container, root } = renderShell();

    try {
      expect(container.textContent).toContain('Existing task');
      expect(
        container.querySelector('[data-task-view-transition-loading="true"]'),
      ).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('conceals stale cached rows while an online startup refresh is pending', () => {
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      mode: 'connected',
      syncState: 'connecting',
      startupRefreshPending: true,
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      expect(container.textContent).toContain('Loading Tasks');
      expect(container.textContent).not.toContain('Existing task');
    } finally {
      cleanup(root, container);
    }
  });

  it('renders cached rows immediately when an offline launch releases freshness gating', () => {
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      mode: 'connected',
      syncState: 'offline',
      startupRefreshPending: false,
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      expect(container.textContent).toContain('Existing task');
      expect(container.textContent).not.toContain('Loading Tasks');
    } finally {
      cleanup(root, container);
    }
  });

  it('shows loading instead of a false empty state during a cacheless fetch', () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [],
      fetching: true,
    });
    const { container, root } = renderShell();

    try {
      expect(container.textContent).toContain('Loading Tasks');
      expect(container.textContent).not.toContain('No tasks');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses the celebratory sentence-case empty state across every primary task list', () => {
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [] });

    for (const route of ['today', 'upcoming', 'anytime', 'someday', 'done']) {
      const { container, root } = renderShell(`/tasks/${route}`);
      try {
        const emptyState = container.querySelector<HTMLElement>('[data-task-empty-state]');
        expect(emptyState).toBeTruthy();
        expect(emptyState?.querySelector('svg.lucide-sparkles')).toHaveClass('h-8', 'w-8');
        expect(emptyState?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        expect(emptyState).toHaveTextContent(route === 'done' ? 'Done is empty' : 'No tasks');
      } finally {
        cleanup(root, container);
      }
    }
  });

  it('keeps the active quick filter visible with the celebratory no-match state', () => {
    mockTaskQuickFilterPreference.mockReturnValue({
      filter: 'waiting',
      setFilter: vi.fn(),
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [taskTodoFixture({ ...task, actionability: 'actionable' })],
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      expect(container.querySelector('[data-task-active-quick-filter]'))
        .toHaveTextContent('Only Waiting');
      const emptyState = container.querySelector<HTMLElement>('[data-task-empty-state]');
      expect(emptyState).toHaveTextContent('No tasks match this filter');
      expect(emptyState?.querySelector('svg.lucide-sparkles')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps full Search empty states sentence-cased, icon-free, and unbucketed', () => {
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [] });
    mockTaskSearch.mockReturnValue({ tasks: [], loading: false, error: null });

    const noQuery = renderShell('/tasks/search');
    try {
      const results = noQuery.container.querySelector<HTMLElement>(
        '[aria-label="Task Search Results"]',
      )!;
      expect(results).toHaveTextContent('Enter a search term');
      expect(results.querySelector('svg.lucide-sparkles')).toBeNull();
      expect(results.querySelector('h3')).toBeNull();
    } finally {
      cleanup(noQuery.root, noQuery.container);
    }

    const noMatches = renderShell('/tasks/search?q=unfindable');
    try {
      const results = noMatches.container.querySelector<HTMLElement>(
        '[aria-label="Task Search Results"]',
      )!;
      expect(results).toHaveTextContent('No matching tasks');
      expect(results.querySelector('svg.lucide-sparkles')).toBeNull();
      expect(results.querySelector('h3')).toBeNull();
    } finally {
      cleanup(noMatches.root, noMatches.container);
    }
  });

  it('opens Quick Find from the visible list action and by typing', async () => {
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
      const quickFindAction = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Quick Find Tasks"]',
      );
      expect(quickFindAction).toBeTruthy();
      await act(async () => quickFindAction?.click());
      expect(document.querySelector<HTMLElement>('[role="dialog"]'))
        .toHaveAccessibleName('Quick Find');
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }));
      });
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
        '[aria-label="Find Tasks"]',
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

  it('prioritizes summary matches above ancillary metadata matches in Quick Find', async () => {
    const searchTasks = [
      taskTodoFixture({
        ...task,
        id: 'task-notes-match',
        title: 'Save Filters',
        notes: 'Review the Figma prototype',
        client_mutation_id: 'mutation-notes-match',
      }),
      taskTodoFixture({
        ...task,
        id: 'task-primary-link-match',
        title: 'Open design reference',
        primary_link: 'https://figma.com/design/primary-link-example',
        client_mutation_id: 'mutation-primary-link-match',
      }),
      taskTodoFixture({
        ...task,
        id: 'task-url-match',
        title: 'Meter Source Cert Relevance',
        source_url: 'https://figma.com/design/example',
        client_mutation_id: 'mutation-url-match',
      }),
      taskTodoFixture({
        ...task,
        id: 'task-summary-match',
        title: 'Review Figma Comment on General Experience',
        client_mutation_id: 'mutation-summary-match',
      }),
    ];
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: searchTasks });
    mockTaskSearch.mockReturnValue({ tasks: searchTasks, loading: false, error: null });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'f', bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      const dialog = document.querySelector<HTMLElement>('[data-task-quick-find]')!;
      const search = dialog.querySelector<HTMLInputElement>('[aria-label="Find Tasks"]')!;
      await act(async () => {
        setInputValue(search, 'figma');
      });
      const results = Array.from(
        dialog.querySelectorAll<HTMLElement>('[data-task-compact-row]'),
      );

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveTextContent('Review Figma Comment on General Experience');
      expect(results[1]).toHaveTextContent('Save Filters');
      expect(results[2]).toHaveTextContent('Open design reference');
      expect(dialog).not.toHaveTextContent('Meter Source Cert Relevance');
    } finally {
      cleanup(root, container);
    }
  });

  it('includes Done tasks in Quick Find with Completed and Deleted status labels', async () => {
    const completedTask = taskTodoFixture({
      id: 'task-done-completed',
      title: 'Archive-only Completed Task',
      lifecycle: 'completed',
      completed_at: '2026-07-20T12:00:00.000Z',
    });
    const canceledTask = taskTodoFixture({
      id: 'task-done-canceled',
      title: 'Archive-only Canceled Task',
      lifecycle: 'canceled',
      canceled_at: '2026-07-20T12:01:00.000Z',
    });
    const trashedTask = taskTodoFixture({
      id: 'task-done-trashed',
      title: 'Archive-only Trashed Task',
      disposition: 'deleted',
      deleted_at: '2026-07-20T12:02:00.000Z',
      deletion_root_id: 'task-done-trashed',
    });
    const searchTasks = [completedTask, canceledTask, trashedTask];
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskSearch.mockReturnValue({ tasks: searchTasks, loading: false, error: null });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'a', bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      const dialog = document.querySelector<HTMLElement>('[data-task-quick-find]')!;
      const search = dialog.querySelector<HTMLInputElement>('[aria-label="Find Tasks"]')!;
      await act(async () => {
        setInputValue(search, 'archive-only');
      });

      const results = Array.from(
        dialog.querySelectorAll<HTMLElement>('[data-task-compact-row]'),
      );
      expect(results).toHaveLength(3);
      const completedResult = results.find((result) => (
        result.textContent?.includes('Archive-only Completed Task')
      ))!;
      const canceledResult = results.find((result) => (
        result.textContent?.includes('Archive-only Canceled Task')
      ))!;
      const deletedResult = results.find((result) => (
        result.textContent?.includes('Archive-only Trashed Task')
      ))!;
      expect(completedResult).toHaveTextContent('Completed');
      expect(canceledResult).toHaveTextContent('Completed');
      expect(deletedResult).toHaveTextContent('Deleted');
      expect(completedResult).toHaveAttribute('href', '/tasks/done');
      expect(deletedResult).toHaveAttribute('href', '/tasks/done');
      const seeAll = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('[role="option"]'))
        .find((option) => option.textContent?.includes('See All Results'))!;
      expect(seeAll).toBeTruthy();

      await act(async () => {
        seeAll.click();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(container.querySelector('[data-task-view-heading]')).toHaveTextContent('Search');
      });
      const fullResults = container.querySelector<HTMLElement>('[aria-label="Task Search Results"]')!;
      expect(fullResults).toHaveTextContent('Archive-only Completed Task');
      expect(fullResults).toHaveTextContent('Archive-only Canceled Task');
      expect(fullResults).toHaveTextContent('Archive-only Trashed Task');
    } finally {
      cleanup(root, container);
    }
  });

  it('labels Today-and-Anytime work as Anytime and future-only work as Upcoming in Quick Find', async () => {
    const currentTask = taskTodoFixture({
      ...task,
      id: 'task-route-current',
      title: 'Route Current Work',
      start_date: null,
      today_section: 'inbox',
      client_mutation_id: 'mutation-route-current',
    });
    const futureTask = taskTodoFixture({
      ...task,
      id: 'task-route-future',
      title: 'Route Future Work',
      start_date: '2026-07-24',
      today_section: null,
      client_mutation_id: 'mutation-route-future',
    });
    const searchTasks = [currentTask, futureTask];
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: searchTasks });
    mockTaskSearch.mockReturnValue({ tasks: searchTasks, loading: false, error: null });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'r', bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      const dialog = document.querySelector<HTMLElement>('[data-task-quick-find]')!;
      const search = dialog.querySelector<HTMLInputElement>('[aria-label="Find Tasks"]')!;
      await act(async () => setInputValue(search, 'route'));
      const currentResult = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('a'))
        .find((link) => link.textContent?.includes(currentTask.title));
      const futureResult = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('a'))
        .find((link) => link.textContent?.includes(futureTask.title));

      expect(currentResult).toHaveAttribute('href', '/tasks/anytime');
      expect(currentResult).toHaveTextContent('Anytime');
      expect(futureResult).toHaveAttribute('href', '/tasks/upcoming');
      expect(futureResult).toHaveTextContent('Upcoming');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps text focus in Quick Find while arrow keys select results and See All Results', async () => {
    const matchingTasks = ['Alpha Match', 'Beta Match', 'Gamma Match'].map((title, index) => (
      taskTodoFixture({
        ...task,
        id: `task-match-${index}`,
        title,
        client_mutation_id: `mutation-match-${index}`,
      })
    ));
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: matchingTasks });
    mockTaskSearch.mockReturnValue({ tasks: matchingTasks, loading: false, error: null });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'm', bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      const dialog = document.querySelector<HTMLElement>('[data-task-quick-find]')!;
      const search = dialog.querySelector<HTMLInputElement>('[aria-label="Find Tasks"]')!;
      await waitFor(() => {
        expect(dialog.querySelectorAll('[data-task-compact-row]')).toHaveLength(3);
      });
      const firstActiveId = search.getAttribute('aria-activedescendant');
      expect(firstActiveId).toContain('result-0');
      expect(document.activeElement).toBe(search);

      await act(async () => {
        search.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp', bubbles: true, cancelable: true,
        }));
      });
      expect(search.getAttribute('aria-activedescendant')).toContain('all');
      expect(document.activeElement).toBe(search);

      await act(async () => {
        search.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(container.querySelector('[data-task-view-heading]')).toHaveTextContent('Search');
      expect(container.querySelector<HTMLInputElement>(
        '[aria-label="Search All Tasks"]',
      )?.value).toBe('m');
    } finally {
      cleanup(root, container);
    }
  });

  it('dismisses Quick Find from an outside press without activating the page beneath it', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'e', bubbles: true, cancelable: true,
        }));
      });
      const dismissLayer = document.querySelector<HTMLElement>(
        '[data-task-quick-find-dismiss-layer]',
      )!;
      const dismiss = new MouseEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        dismissLayer.dispatchEvent(dismiss);
        await Promise.resolve();
      });
      expect(dismiss.defaultPrevented).toBe(true);
      expect(document.querySelector('[data-task-quick-find]')).toBeNull();
      expect(document.getElementById(`task-title-${NEW_TASK_DRAFT_ID}`)).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps an editable Primary Link in the summary row while the task is open', async () => {
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
        'a[aria-label="Open Link for Existing task"]',
      );
      expect(link?.getAttribute('href')).toBe('https://example.test/source');
      expect(link?.target).toBe('_blank');
      expect(link?.title).toBe('https://example.test/source');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-title-control]')?.click();
        await Promise.resolve();
      });

      expect(container.querySelector('input[aria-label="Link"]')).toBeTruthy();
      const openLink = container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Link for Existing task"]',
      );
      expect(openLink?.getAttribute('href')).toBe('https://example.test/source');
      expect(openLink?.target).toBe('_blank');
      expect(openLink?.title).toBe('https://example.test/source');
      const openActions = container.querySelector<HTMLButtonElement>(
        '[aria-label="Actions for Existing task"]',
      )!;
      expect(openActions).toBeTruthy();
      await act(async () => {
        openActions.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        openActions.click();
      });
      expect(Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .some((item) => item.textContent?.trim() === 'Start...')).toBe(true);
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
        '[aria-label="Find Tasks"]',
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
        expect.any(Function),
      );
      await waitFor(() => {
        expect(container.querySelector('#task-title-task-future')).toBeTruthy();
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('renders full Search results with their native list row treatments but no drawers, dragging, or bulk selection', async () => {
    const anytimeTask = taskTodoFixture({
      ...task,
      id: 'search-anytime',
      title: 'Search Anytime Result',
      area_id: 'area-search',
      start_date: null,
      today_section: 'inbox',
      client_mutation_id: 'mutation-search-anytime',
    });
    const upcomingTask = taskTodoFixture({
      ...task,
      id: 'search-upcoming',
      title: 'Search Upcoming Result',
      area_id: 'area-search',
      start_date: '2026-07-24',
      today_section: null,
      client_mutation_id: 'mutation-search-upcoming',
    });
    const somedayTask = taskTodoFixture({
      ...task,
      id: 'search-someday',
      title: 'Search Someday Result',
      destination: 'someday',
      start_date: null,
      today_section: null,
      client_mutation_id: 'mutation-search-someday',
    });
    const completedTask = taskTodoFixture({
      ...task,
      id: 'search-completed',
      title: 'Search Completed Result',
      lifecycle: 'completed',
      completed_at: '2026-07-20T12:00:00.000Z',
      client_mutation_id: 'mutation-search-completed',
    });
    const deletedTask = taskTodoFixture({
      ...task,
      id: 'search-deleted',
      title: 'Search Deleted Result',
      disposition: 'deleted',
      deleted_at: '2026-07-20T12:01:00.000Z',
      deletion_root_id: 'search-deleted',
      client_mutation_id: 'mutation-search-deleted',
    });
    const searchTasks = [
      anytimeTask,
      upcomingTask,
      somedayTask,
      completedTask,
      deletedTask,
    ];
    mockTaskHierarchy.mockReturnValue({
      areas: [taskAreaFixture({ id: 'area-search', title: 'Search Area' })],
      loading: false,
      error: null,
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: searchTasks,
      checklistTaskIds: new Set([somedayTask.id]),
    });
    mockTaskSearch.mockReturnValue({ tasks: searchTasks, loading: false, error: null });
    const { container, root, locations } = renderShell('/tasks/search?q=search');

    try {
      await waitFor(() => {
        expect(container.querySelectorAll('[data-task-search-result-kind="todo"]'))
          .toHaveLength(5);
      });
      const anytimeRow = container.querySelector<HTMLElement>(
        `[data-task-search-id="${anytimeTask.id}"]`,
      )!;
      const upcomingRow = container.querySelector<HTMLElement>(
        `[data-task-search-id="${upcomingTask.id}"]`,
      )!;
      const somedayRow = container.querySelector<HTMLElement>(
        `[data-task-search-id="${somedayTask.id}"]`,
      )!;
      const completedRow = container.querySelector<HTMLElement>(
        `[data-task-search-id="${completedTask.id}"]`,
      )!;
      const deletedRow = container.querySelector<HTMLElement>(
        `[data-task-search-id="${deletedTask.id}"]`,
      )!;

      expect(anytimeRow.querySelector('[data-task-metadata-kind="area"]')).toBeNull();
      expect(upcomingRow.querySelector('[data-task-metadata-kind="area"]'))
        .toHaveTextContent('Search Area');
      expect(somedayRow.querySelector('svg.lucide-square-dashed')).toBeTruthy();
      expect(completedRow.querySelector('[data-task-completion-control]'))
        .toHaveClass('text-success');
      expect(deletedRow.querySelector('svg.lucide-square-x')).toBeTruthy();
      searchTasks.forEach((resultTask) => {
        const row = container.querySelector<HTMLElement>(
          `[data-task-search-id="${resultTask.id}"]`,
        )!;
        expect(row).not.toHaveAttribute('data-task-draggable');
        expect(row.querySelector(`#task-title-${resultTask.id}`)).toBeNull();
        expect(row.querySelector(`a[data-task-id="${resultTask.id}"]`)).toHaveAttribute(
          'href',
          resultTask.id === upcomingTask.id
            ? '/tasks/upcoming'
            : resultTask.id === somedayTask.id
              ? '/tasks/someday'
              : resultTask.lifecycle !== 'open' || resultTask.disposition === 'deleted'
                ? '/tasks/done'
                : '/tasks/anytime',
        );
      });
      expect(container.querySelector('[data-task-selection-entry]')).toBeNull();
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();

      await act(async () => {
        completedRow.querySelector<HTMLAnchorElement>(
          `a[data-task-id="${completedTask.id}"]`,
        )!.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(locations.at(-1)).toBe('/tasks/done');
      await waitFor(() => {
        expect(container.querySelector(`#task-title-${completedTask.id}`)).toBeTruthy();
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('moves keyboard focus between full Search results, returns to its input, and ignores task commands', async () => {
    const firstTask = taskTodoFixture({
      ...task,
      id: 'search-keyboard-first',
      title: 'Keyboard Search Alpha',
      start_date: null,
      today_section: 'inbox',
      client_mutation_id: 'mutation-search-keyboard-first',
    });
    const secondTask = taskTodoFixture({
      ...task,
      id: 'search-keyboard-second',
      title: 'Keyboard Search Beta',
      start_date: null,
      today_section: 'inbox',
      client_mutation_id: 'mutation-search-keyboard-second',
    });
    const taskList = { ...defaultTaskList(), tasks: [firstTask, secondTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskSearch.mockReturnValue({
      tasks: [firstTask, secondTask],
      loading: false,
      error: null,
    });
    const { container, root, locations } = renderShell('/tasks/search?q=keyboard');

    try {
      const input = container.querySelector<HTMLInputElement>(
        '[aria-label="Search All Tasks"]',
      )!;
      await act(async () => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      });
      const rows = Array.from(container.querySelectorAll<HTMLElement>(
        '[data-task-search-result-kind="todo"] [data-task-row-focus-target]',
      ));
      expect(document.activeElement).toBe(rows[0]);

      const ignoredCommand = new KeyboardEvent('keydown', {
        key: 'e', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => window.dispatchEvent(ignoredCommand));
      expect(ignoredCommand.defaultPrevented).toBe(false);
      expect(taskList.updateTask).not.toHaveBeenCalled();

      await act(async () => {
        rows[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      });
      expect(document.activeElement).toBe(rows[1]);
      await act(async () => {
        rows[1].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      });
      await act(async () => {
        rows[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp', bubbles: true, cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(input);

      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      });
      await act(async () => {
        rows[0].dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(locations.at(-1)).toBe('/tasks/anytime');
      await waitFor(() => {
        expect(container.querySelector(`#task-title-${firstTask.id}`)).toBeTruthy();
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('renders recurrence Search results with the canonical Upcoming prototype row and navigates instead of opening a drawer', async () => {
    const definition = taskRecurrenceDefinitionFixture({ id: 'search-row-recurrence' });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      revision: 1,
      target_area_id: 'area-search-recurrence',
      prototype_snapshot: {
        version: 2,
        kind: 'todo',
        root: {
          node_id: 'prototype-search-row',
          title: 'Canonical Search Recurrence',
          notes: 'Prototype notes',
          primary_link: null,
          actionability: 'waiting',
          destination: 'anytime',
          today_section: null,
          order_key: 'a0',
          start_offset_days: 0,
          deadline_offset_days: 2,
          checklist: [{
            node_id: 'prototype-checklist',
            title: 'Prototype checklist',
            completed: false,
            order_key: 'a0',
          }],
        },
      },
    });
    mockTaskHierarchy.mockReturnValue({
      areas: [taskAreaFixture({ id: 'area-search-recurrence', title: 'Prototype Area' })],
      loading: false,
      error: null,
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [] });
    mockTaskSearch.mockReturnValue({ tasks: [], loading: false, error: null });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{ definition, revision, scheduledDate: '2026-07-27' }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'local',
      loading: false,
      error: null,
      save: vi.fn(),
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
    });
    const { container, root, locations } = renderShell(
      '/tasks/search?q=canonical%20search%20recurrence',
    );

    try {
      await waitFor(() => {
        expect(container.querySelector(
          `[data-task-recurrence-prototype="${definition.id}"]`,
        )).toBeTruthy();
      });
      const prototype = container.querySelector<HTMLElement>(
        `[data-task-recurrence-prototype="${definition.id}"]`,
      )!;
      expect(prototype).toHaveTextContent('Prototype Area');
      expect(prototype.querySelector('[data-task-metadata-kind="notes"]')).toBeTruthy();
      expect(prototype.querySelector('[data-task-metadata-kind="checklist"]')).toBeTruthy();
      expect(prototype.querySelector('a')).toHaveAttribute('href', '/tasks/upcoming');
      expect(prototype.querySelector('input')).toBeNull();
      expect(prototype).not.toHaveAttribute('data-task-draggable');
      expect(prototype.querySelector('button[aria-label^="Actions for "]')).toBeTruthy();

      await act(async () => {
        prototype.querySelector<HTMLAnchorElement>('a')?.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(locations.at(-1)).toBe('/tasks/upcoming');
      await waitFor(() => expect(document.activeElement).toBe(container.querySelector(
        `[data-task-recurrence-prototype="${definition.id}"]`,
      )));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('focuses a scheduled after-completion prototype from Quick Find without opening repeat management', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-search',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      revision: 1,
      rule_mode: 'after_completion',
      prototype_snapshot: {
        version: 2,
        kind: 'todo',
        root: {
          node_id: 'prototype-search',
          title: 'Review recurring plan',
          notes: '',
          primary_link: null,
          actionability: 'actionable',
          destination: 'anytime',
          today_section: null,
          order_key: 'a0',
          start_offset_days: 0,
          deadline_offset_days: null,
          checklist: [],
        },
      },
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [] });
    mockTaskSearch.mockReturnValue({
      tasks: [],
      loading: false,
      error: null,
    });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{
        definition,
        revision,
        scheduledDate: '2026-07-27',
      }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'local',
      loading: false,
      error: null,
      save: vi.fn(),
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
    });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'r', bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });
      const dialog = document.querySelector<HTMLElement>('[data-task-quick-find]')!;
      const result = dialog.querySelector<HTMLAnchorElement>(
        '[data-task-quick-find-result-kind="focus-recurrence"]',
      )!;
      expect(result).toHaveTextContent('Review recurring plan');
      expect(result.querySelector('svg')).toBeTruthy();

      await act(async () => {
        result.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      await waitFor(() => {
        expect(container.querySelector('[data-task-view-heading]')).toHaveTextContent('Upcoming');
        expect(document.activeElement).toBe(container.querySelector(
          `[data-task-recurrence-prototype="${definition.id}"]`,
        ));
      });
      expect(document.querySelector('[role="dialog"]')).toBeNull();
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
        '[aria-label="Find Tasks"]',
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
        '[aria-label="Find Tasks"]',
      )?.value).toBe('?');
    } finally {
      cleanup(root, container);
    }
  });

  it('opens type-to-search from Settings and leaves editable search input typing alone', async () => {
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
        '[aria-label="Find Tasks"]',
      )?.value).toBe('c');
      await act(async () => {
        document.querySelector<HTMLInputElement>('[aria-label="Find Tasks"]')
          ?.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape', bubbles: true, cancelable: true,
          }));
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
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      expect(container.querySelector('[aria-label="Keyboard Shortcuts"]')).toBeNull();
      const titleButton = container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')!;
      titleButton.focus();
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '?', shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      expect(document.querySelector<HTMLInputElement>(
        '[aria-label="Find Tasks"]',
      )?.value).toBe('?');
      await act(async () => {
        document.querySelector<HTMLInputElement>('[aria-label="Find Tasks"]')
          ?.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape', bubbles: true, cancelable: true,
          }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const helpEvent = new KeyboardEvent('keydown', {
        key: '/', metaKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(helpEvent);
      });
      expect(helpEvent.defaultPrevented).toBe(true);
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Keyboard Shortcuts');
      expect(dialog.textContent).toContain('Show Keyboard Shortcuts');
      expect(dialog.textContent).toContain('⌘/');
      expect(dialog.textContent).toContain('Open Next');
      expect(dialog.textContent).toContain('Toggle Done');
      expect(dialog.textContent).not.toContain('⌘1');
      expect(dialog.textContent).toContain('⌃1');
      expect(dialog.textContent).toContain('⌃6');
      expect(dialog.textContent).toContain('Clear Start');
      expect(dialog.textContent).toContain('Set Today / Cycle Horizon');
      expect(dialog.textContent).toContain('Edit Reminder Time');
      expect(dialog.textContent).toContain('Start Bulk Selection With Task');
      expect(dialog.textContent).toContain('Set Start to Someday');
      expect(dialog.textContent).toContain('⌘Z / ⌃Z');
      expect(dialog.textContent).toContain('⌃R');
      expect(dialog.textContent).toContain('⌃T');
      expect(dialog.textContent).toContain('⌃A');
      expect(dialog.textContent).toContain('⌃D');
      expect(dialog.textContent).toContain('⌃F');
      expect(dialog.textContent).toContain('⌃G');
      expect(dialog.textContent).toContain('⌃X');
      expect(dialog.textContent).toContain('⌃B');
      expect(dialog.textContent).toContain('⌃Y');
      expect(dialog.textContent).toContain('⌃H');
      expect(dialog.textContent).toContain('⌃N');
      expect(dialog.textContent).not.toContain('⌥⇧Q');
      expect(dialog.textContent).toContain('⌘Return / ⌘Escape');
      expect(dialog.textContent).toContain('Tasks-specific Actions');
      expect(dialog.textContent).not.toContain('Tasks-Specific Actions');
      expect(dialog.textContent).not.toContain('Windows');
      expect(dialog.textContent).not.toContain('Mac · Current');
      expect(dialog.querySelector('thead')).toBeNull();
      for (const row of dialog.querySelectorAll('tbody tr')) {
        expect(row.children).toHaveLength(2);
      }
      expect(dialog.textContent).toContain('Select Multiple');
      expect(dialog.textContent).toContain('Select Range');
      expect(dialog.textContent).toContain('Add or Focus Checklist');
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
        key: '/', metaKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        titleInput.dispatchEvent(editableHelpEvent);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(editableHelpEvent.defaultPrevented).toBe(true);
      expect(document.querySelector<HTMLElement>('[role="dialog"]')?.textContent)
        .toContain('Keyboard Shortcuts');
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      cleanup(root, container);
    }
  });

  it('shows only Windows shortcuts in keyboard help on Windows', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '/', ctrlKey: true, bubbles: true, cancelable: true,
        }));
      });
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog).toHaveAccessibleName('Keyboard Shortcuts');
      expect(dialog.textContent).toContain('⌃/');
      expect(dialog.textContent).toContain('⌥⇧Q');
      expect(dialog.textContent).not.toContain('⌘/');
      expect(dialog.textContent).not.toContain('Mac');
      expect(dialog.textContent).not.toContain('Windows · Current');
      expect(dialog.querySelector('thead')).toBeNull();
      for (const row of dialog.querySelectorAll('tbody tr')) {
        expect(row.children).toHaveLength(2);
      }
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      cleanup(root, container);
    }
  });

  it('captures undo and redo inside editable controls and exposes matching list actions', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const redo = vi.fn().mockResolvedValue(undefined);
    const registerForwardMutation = vi.fn();
    mockTaskUndo.mockReturnValue({
      available: true,
      redoAvailable: true,
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
      expect(mockTaskList.mock.calls[0][3]).toEqual(expect.any(Function));
      expect(container.querySelector('button[aria-label="Undo Last Task Change"]')).toBeTruthy();
      expect(container.querySelector('button[aria-label="Redo Last Task Change"]')).toBeTruthy();
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeTruthy();
      expect(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>(
            'button[aria-label="Undo Last Task Change"], '
            + 'button[aria-label="Redo Last Task Change"], '
            + 'button[aria-label="Select Tasks"], '
            + 'button[aria-label="Quick Find Tasks"], '
            + 'button[aria-label="Quick Filters"]',
          ),
        ).map((button) => button.getAttribute('aria-label')),
      ).toEqual([
        'Undo Last Task Change',
        'Redo Last Task Change',
        'Select Tasks',
        'Quick Find Tasks',
        'Quick Filters',
      ]);

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
      await waitFor(() => expect(undo).toHaveBeenCalledTimes(1));
      expect(undoEvent.defaultPrevented).toBe(true);
      expect(downstreamHandler).not.toHaveBeenCalled();

      const redoEvent = new KeyboardEvent('keydown', {
        key: 'y', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle.dispatchEvent(redoEvent);
      });
      await waitFor(() => expect(redo).toHaveBeenCalledTimes(1));
      expect(redoEvent.defaultPrevented).toBe(true);

      const shiftedRedoEvent = new KeyboardEvent('keydown', {
        key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle.dispatchEvent(shiftedRedoEvent);
      });
      await waitFor(() => expect(redo).toHaveBeenCalledTimes(2));
      expect(shiftedRedoEvent.defaultPrevented).toBe(true);

      const alternateUndoEvent = new KeyboardEvent('keydown', {
        key: 'z', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        editorTitle.dispatchEvent(alternateUndoEvent);
      });
      await waitFor(() => expect(undo).toHaveBeenCalledTimes(2));
      expect(alternateUndoEvent.defaultPrevented).toBe(true);

      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      row.focus();
      const globalUndoEvent = new KeyboardEvent('keydown', {
        key: 'z', ctrlKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => row.dispatchEvent(globalUndoEvent));
      expect(undo).toHaveBeenCalledTimes(3);
      expect(globalUndoEvent.defaultPrevented).toBe(true);

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
      expect(help).toContain('Tasks-specific Actions');
      expect(help).not.toContain('Windows');
    } finally {
      cleanup(root, container);
    }
  });

  it('shows immediate blocking progress while task history traversal is unresolved', async () => {
    let resolveUndo: ((value: typeof task) => void) | null = null;
    const undo = vi.fn(() => new Promise<typeof task>((resolve) => {
      resolveUndo = resolve;
    }));
    mockTaskUndo.mockReturnValue({
      available: true,
      redoAvailable: false,
      pending: false,
      loading: false,
      error: null,
      event: { id: 'event-update', occurred_at: '2026-07-20T18:00:00.000Z' },
      redoEvent: null,
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: undo,
      redoWhenAvailable: vi.fn().mockResolvedValue(null),
      reserveForwardMutation: vi.fn(),
      registerForwardMutation: vi.fn(),
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Undo Last Task Change"]',
        )?.click();
        await Promise.resolve();
      });
      const progress = container.querySelector<HTMLElement>(
        '[data-task-history-pending="undo"]',
      );
      expect(progress).toBeTruthy();
      expect(progress).toHaveTextContent('Undoing Task Change');
      expect(container.querySelector('button[aria-label="Undo Last Task Change"]'))
        .toBeDisabled();

      await act(async () => {
        resolveUndo?.(task);
        await Promise.resolve();
      });
      await waitFor(() => expect(container.querySelector(
        '[data-task-history-pending]',
      )).toBeNull());
    } finally {
      cleanup(root, container);
    }
  });

  it('registers an accepted checklist action and routes immediate undo and redo through checklist history', async () => {
    const taskUndo = vi.fn().mockResolvedValue(task);
    mockTaskUndo.mockReturnValue({
      available: true,
      redoAvailable: false,
      pending: false,
      loading: false,
      error: null,
      event: { id: 'older-task-event', occurred_at: '2026-07-20T17:00:00.000Z' },
      redoEvent: null,
      forwardMutationPending: false,
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: taskUndo,
      redoWhenAvailable: vi.fn().mockResolvedValue(null),
      reserveForwardMutation: vi.fn(),
      registerForwardMutation: vi.fn(),
    });
    const registerForwardAction = vi.fn();
    const checklistUndo = vi.fn().mockResolvedValue({ id: 'checklist-event' });
    const checklistRedo = vi.fn().mockResolvedValue({ id: 'checklist-event' });
    mockTaskChecklistUndo.mockReturnValue({
      available: true,
      redoAvailable: true,
      pending: false,
      loading: false,
      error: null,
      event: null,
      redoEvent: null,
      forwardActionPending: true,
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: checklistUndo,
      redoWhenAvailable: checklistRedo,
      registerForwardAction,
      hasPendingForwardAction: vi.fn(() => true),
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new CustomEvent(TASK_CHECKLIST_FORWARD_MUTATION_EVENT, {
          detail: {
            schemaVersion: 1,
            actionId: 'accepted-checklist-action',
            occurredAt: '2026-07-20T18:00:00.000Z',
          },
        }));
      });
      expect(registerForwardAction).toHaveBeenCalledWith({
        actionId: 'accepted-checklist-action',
        occurredAt: '2026-07-20T18:00:00.000Z',
      });

      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Undo Last Task Change"]',
        )?.click();
      });
      await waitFor(() => expect(checklistUndo).toHaveBeenCalledOnce());
      expect(taskUndo).not.toHaveBeenCalled();

      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Redo Last Task Change"]',
        )?.click();
      });
      await waitFor(() => expect(checklistRedo).toHaveBeenCalledOnce());
    } finally {
      cleanup(root, container);
    }
  });

  it('shows immediate blocking progress while task redo is unresolved', async () => {
    let resolveRedo: ((value: typeof task) => void) | null = null;
    const redo = vi.fn(() => new Promise<typeof task>((resolve) => {
      resolveRedo = resolve;
    }));
    mockTaskUndo.mockReturnValue({
      available: false,
      redoAvailable: true,
      pending: false,
      loading: false,
      error: null,
      event: null,
      redoEvent: { id: 'event-redo', occurred_at: '2026-07-20T18:00:00.000Z' },
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: vi.fn().mockResolvedValue(null),
      redoWhenAvailable: redo,
      reserveForwardMutation: vi.fn(),
      registerForwardMutation: vi.fn(),
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Redo Last Task Change"]',
        )?.click();
        await Promise.resolve();
      });
      const progress = container.querySelector<HTMLElement>(
        '[data-task-history-pending="redo"]',
      );
      expect(progress).toBeTruthy();
      expect(progress).toHaveTextContent('Redoing Task Change');
      expect(container.querySelector('button[aria-label="Redo Last Task Change"]'))
        .toBeDisabled();

      await act(async () => {
        resolveRedo?.(task);
        await Promise.resolve();
      });
      await waitFor(() => expect(container.querySelector(
        '[data-task-history-pending]',
      )).toBeNull());
    } finally {
      cleanup(root, container);
    }
  });

  it('invokes history from the list toolbar and omits the controls from Settings', async () => {
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
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: undo,
      redoWhenAvailable: redo,
      reserveForwardMutation: vi.fn(),
      registerForwardMutation: vi.fn(),
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const list = renderShell();

    try {
      await act(async () => {
        list.container.querySelector<HTMLButtonElement>(
          'button[aria-label="Undo Last Task Change"]',
        )?.click();
      });
      await waitFor(() => expect(undo).toHaveBeenCalledTimes(1));

      await act(async () => {
        list.container.querySelector<HTMLButtonElement>(
          'button[aria-label="Redo Last Task Change"]',
        )?.click();
      });
      await waitFor(() => expect(redo).toHaveBeenCalledTimes(1));
    } finally {
      cleanup(list.root, list.container);
    }

    const settings = renderShell('/tasks/config');
    try {
      expect(settings.container.querySelector(
        'button[aria-label="Undo Last Task Change"]',
      )).toBeNull();
      expect(settings.container.querySelector(
        'button[aria-label="Redo Last Task Change"]',
      )).toBeNull();
    } finally {
      cleanup(settings.root, settings.container);
    }
  });

  it('flushes a pending Summary autosave before toolbar Undo traverses history', async () => {
    const undo = vi.fn().mockResolvedValue(task);
    const taskList = defaultTaskList();
    mockTaskUndo.mockReturnValue({
      available: true,
      redoAvailable: false,
      pending: false,
      loading: false,
      error: null,
      event: { id: 'event-update', occurred_at: '2026-07-20T18:00:00.000Z' },
      redoEvent: null,
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: undo,
      redoWhenAvailable: vi.fn().mockResolvedValue(null),
      reserveForwardMutation: vi.fn(),
      registerForwardMutation: vi.fn(),
    });
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const editorTitle = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      await act(async () => {
        setInputValue(editorTitle, 'Edited immediately before undo');
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Undo Last Task Change"]',
        )?.click();
      });

      await waitFor(() => {
        expect(taskList.updateTask).toHaveBeenCalledWith(
          'task-a',
          expect.objectContaining({ title: 'Edited immediately before undo' }),
        );
        expect(undo).toHaveBeenCalledTimes(1);
      });
      expect(taskList.updateTask.mock.invocationCallOrder[0])
        .toBeLessThan(undo.mock.invocationCallOrder[0]);
    } finally {
      cleanup(root, container);
    }
  });

  it('routes a versioned native undo command through the existing task history', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    mockTaskUndo.mockReturnValue({
      available: true,
      redoAvailable: false,
      pending: false,
      loading: false,
      error: null,
      event: { id: 'event-update' },
      redoEvent: null,
      undo: vi.fn(),
      redo: vi.fn(),
      undoWhenAvailable: undo,
      redoWhenAvailable: vi.fn().mockResolvedValue(null),
      reserveForwardMutation: vi.fn(),
      registerForwardMutation: vi.fn(),
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      await act(async () => {
        window.dispatchEvent(new CustomEvent(TASK_NATIVE_COMMAND_EVENT, {
          detail: { schemaVersion: 1, command: 'undo' },
        }));
      });
      expect(undo).toHaveBeenCalledOnce();

      await act(async () => {
        window.dispatchEvent(new CustomEvent(TASK_NATIVE_COMMAND_EVENT, {
          detail: { schemaVersion: 2, command: 'undo' },
        }));
      });
      expect(undo).toHaveBeenCalledOnce();
    } finally {
      cleanup(root, container);
    }
  });

  it('describes a metadata change that moves a visible task to another list', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell('/tasks/today');

    try {
      const reportMetadataMutation = mockTaskList.mock.calls[0][5] as (
        mutations: Array<{ before: typeof task; after: typeof task }>,
      ) => void;
      await act(async () => {
        reportMetadataMutation([{
          before: task,
          after: {
            ...task,
            start_date: '2026-07-21',
            today_section: null,
          },
        }]);
      });
      expect(mockToast).toHaveBeenCalledWith({
        description: 'The task now appears in Upcoming.',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('describes a metadata change that hides a task behind the active quick filter', async () => {
    const waitingTask = taskTodoFixture({
      ...task,
      actionability: 'waiting',
    });
    mockTaskQuickFilterPreference.mockReturnValue({
      filter: 'waiting',
      setFilter: vi.fn().mockResolvedValue(undefined),
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [waitingTask],
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      const reportMetadataMutation = mockTaskList.mock.calls[0][5] as (
        mutations: Array<{ before: typeof waitingTask; after: typeof waitingTask }>,
      ) => void;
      await act(async () => {
        reportMetadataMutation([{
          before: waitingTask,
          after: { ...waitingTask, actionability: 'actionable' },
        }]);
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Task Hidden by Quick Filter',
        description: 'The task no longer matches Only Waiting.',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('defers a Start departure notice until an edited task closes', async () => {
    const user = userEvent.setup();
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/today');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const reportMetadataMutation = mockTaskList.mock.calls[0][5] as (
        mutations: Array<{ before: typeof task; after: typeof task }>,
      ) => void;
      taskList.updateTask.mockImplementation(async (taskId, patch) => {
        const after = {
          ...task,
          id: taskId,
          ...patch,
          revision: task.revision + 1,
          client_mutation_id: 'mutation-moved-to-someday',
        };
        reportMetadataMutation([{ before: task, after }]);
        return after;
      });

      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const someday = document.querySelector<HTMLButtonElement>(
        '[data-task-start-someday]',
      );
      await act(async () => {
        if (someday) await user.click(someday);
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'someday',
        start_date: null,
        today_section: null,
      });
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({
        description: 'The task now appears in Someday.',
      }));
      expect(container.querySelector('[data-task-editor-region]')).not.toBeNull();

      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      await waitForTaskEditorExit(container);
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          description: 'The task now appears in Someday.',
        });
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('defers a quick-filter departure notice for a persisted creation draft until it closes', async () => {
    const taskList = defaultTaskList();
    const persistedDraft = taskTodoFixture({
      ...task,
      id: 'task-created',
      title: 'Persisted creation draft',
      today_section: 'inbox',
      start_date: '2026-07-20',
      actionability: 'waiting',
      client_mutation_id: 'mutation-created',
    });
    taskList.createTask.mockResolvedValue(persistedDraft);
    mockTaskQuickFilterPreference.mockReturnValue({
      filter: 'waiting',
      setFilter: vi.fn().mockResolvedValue(undefined),
    });
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/today');

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
      const actionability = document.getElementById(
        'task-actionability-task-draft:new',
      ) as HTMLButtonElement;
      await selectBathosOption(actionability, 'Waiting');
      await act(async () => {
        setInputValue(title, persistedDraft.title);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });
      await waitFor(() => expect(taskList.createTask).toHaveBeenCalledOnce());

      const reportMetadataMutation = mockTaskList.mock.calls[0][5] as (
        mutations: Array<{ before: typeof persistedDraft; after: typeof persistedDraft }>,
      ) => void;
      taskList.updateTask.mockImplementation(async (taskId, patch) => {
        const after = {
          ...persistedDraft,
          id: taskId,
          ...patch,
          revision: persistedDraft.revision + 1,
          client_mutation_id: 'mutation-draft-left-filter',
        };
        reportMetadataMutation([{ before: persistedDraft, after }]);
        return after;
      });

      await selectBathosOption(
        document.getElementById(
          'task-actionability-task-draft:new',
        ) as HTMLButtonElement,
        'Ready',
      );
      expect(taskList.updateTask).toHaveBeenCalledWith('task-created', {
        actionability: 'actionable',
      });
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({
        title: 'Task Hidden by Quick Filter',
      }));
      expect(container.querySelector('[data-task-editor-region]')).not.toBeNull();

      const currentTitle = document.getElementById(
        `task-title-${NEW_TASK_DRAFT_ID}`,
      ) as HTMLInputElement;
      await act(async () => {
        currentTitle.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      await waitForTaskEditorExit(container, NEW_TASK_DRAFT_ID);
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Task Hidden by Quick Filter',
          description: 'The task no longer matches Only Waiting.',
        });
      });
      expect(mockToast).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('retains an edited task through drawer close before applying a quick-filter departure', async () => {
    const waitingTask = taskTodoFixture({
      ...task,
      id: 'task-filter-retained',
      title: 'Filtered After Close',
      actionability: 'waiting',
    });
    let acceptedTasks = [waitingTask];
    const taskList = defaultTaskList();
    mockTaskQuickFilterPreference.mockReturnValue({
      filter: 'waiting',
      setFilter: vi.fn().mockResolvedValue(undefined),
    });
    mockTaskList.mockImplementation((
      _ownerId: string,
      _view: string,
      retainedTaskId: string | null,
    ) => ({
      ...taskList,
      tasks: acceptedTasks,
      retainedTaskPlacement: retainedTaskId === waitingTask.id
        ? waitingTask
        : null,
    }));
    const { container, root, rerender } = renderShell('/tasks/anytime');
    const retainedRow = () => container.querySelector(
      '[data-task-row-id="task-filter-retained"]',
    );

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[data-task-row-id="task-filter-retained"] [data-task-title-control]',
        )?.click();
      });
      await waitFor(() => expect(container.querySelector(
        '[data-task-row-id="task-filter-retained"] [data-task-editor-region]',
      )).not.toBeNull());
      const reportMetadataMutation = mockTaskList.mock.calls[0][5] as (
        mutations: Array<{ before: typeof waitingTask; after: typeof waitingTask }>,
      ) => void;
      const acceptedTask = {
        ...waitingTask,
        actionability: 'actionable' as const,
      };
      acceptedTasks = [acceptedTask];
      await act(async () => {
        reportMetadataMutation([{
          before: waitingTask,
          after: acceptedTask,
        }]);
        rerender();
        await Promise.resolve();
      });
      expect(retainedRow()).toBeTruthy();
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({
        title: 'Task Hidden by Quick Filter',
      }));

      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[data-task-row-id="task-filter-retained"] [data-bathos-form-submit]',
        )?.click();
        await Promise.resolve();
      });
      expect(retainedRow()).toBeTruthy();
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({
        title: 'Task Hidden by Quick Filter',
      }));

      acceptedTasks = [];
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
        rerender();
      });
      expect(retainedRow()).toBeNull();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Task Hidden by Quick Filter',
        description: 'The task no longer matches Only Waiting.',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('abandons task focus after Quick Find closes a task hidden by the active filter', async () => {
    const user = userEvent.setup();
    const visibleFirst = taskTodoFixture({
      ...task,
      id: 'task-filter-visible-first',
      title: 'Visible First',
      actionability: 'actionable',
      client_mutation_id: 'mutation-visible-first',
    });
    const hiddenTask = taskTodoFixture({
      ...task,
      id: 'task-filter-hidden-quick-find',
      title: 'Hidden Quick Find Task',
      actionability: 'waiting',
      client_mutation_id: 'mutation-hidden-quick-find',
    });
    const visibleLast = taskTodoFixture({
      ...task,
      id: 'task-filter-visible-last',
      title: 'Visible Last',
      actionability: 'actionable',
      client_mutation_id: 'mutation-visible-last',
    });
    const setFilter = vi.fn().mockResolvedValue(undefined);
    mockTaskQuickFilterPreference.mockReturnValue({
      filter: 'actionable',
      setFilter,
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [visibleFirst, hiddenTask, visibleLast],
    });
    mockTaskSearch.mockReturnValue({
      tasks: [hiddenTask],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      expect(container.querySelector(
        '[data-task-row-id="task-filter-hidden-quick-find"]',
      )).toBeNull();

      await user.click(container.querySelector<HTMLButtonElement>(
        'button[aria-label="Quick Find Tasks"]',
      )!);
      await user.type(
        document.querySelector<HTMLInputElement>('[aria-label="Find Tasks"]')!,
        'Hidden Quick Find Task',
      );
      const result = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
        .find((option) => option.textContent?.includes('Hidden Quick Find Task'));
      expect(result).toBeTruthy();
      await user.click(result!);

      await waitFor(() => {
        expect(container.querySelector(
          '[data-task-row-id="task-filter-hidden-quick-find"] [data-task-editor-region]',
        )).not.toBeNull();
      });
      expect(container.querySelector('[aria-label="Quick Filters: Only Ready"]'))
        .toBeTruthy();

      await user.click(container.querySelector<HTMLButtonElement>(
        '[data-task-row-id="task-filter-hidden-quick-find"] [data-bathos-form-submit]',
      )!);
      await waitFor(() => {
        expect(container.querySelector(
          '[data-task-row-id="task-filter-hidden-quick-find"]',
        )).toBeNull();
      });

      expect(container.querySelector(
        '[data-task-row-focus-target][aria-current="true"]',
      )).toBeNull();
      expect(document.activeElement?.closest('[data-task-row-focus-target]')).toBeNull();
      expect(setFilter).not.toHaveBeenCalled();
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

  it('applies Area and Actionability from nested task action submenus', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-house', title: 'House' }],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell();

    try {
      await openTaskMenuSubmenu(container, 'Existing task', 'Area');
      const area = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'House');
      await act(async () => {
        area?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        area_id: 'area-house',
      });
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(container.querySelector('[data-task-row-id][aria-current="true"]')).toBeNull();

      await openTaskMenuSubmenu(container, 'Existing task', 'Actionability');
      const ready = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Ready');
      expect(ready).toHaveAttribute('data-disabled');
      const waiting = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Waiting');
      await act(async () => {
        waiting?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        actionability: 'waiting',
      });
      expect(container.querySelector('[data-task-row-id][aria-current="true"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('limits the active task menu to direct temporal and metadata actions', async () => {
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
      expect(labels).toEqual([
        'Start...',
        'Deadline...',
        'Area',
        'Actionability',
        'Repeat...',
        'Delete',
      ]);
      expect(labels).not.toEqual(expect.arrayContaining([
        'Move...',
        'Do...',
        'Cancel',
        'Move Up',
        'Move Down',
        'When...',
        'Mark as Ready',
        'Mark as Rechecking',
        'Mark as Waiting',
      ]));
    } finally {
      cleanup(root, container);
    }
  });

  it('opens menu temporal pickers without opening the task editor', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      expect(row.querySelector('[data-task-editor-region]')).toBeNull();
      await openTaskMenuSurface(container, 'Existing task', 'Start...');
      expect(row.querySelector('[data-task-editor-region]')).toBeNull();
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
        '[aria-label="Find Tasks"]',
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
      expect(complete).toHaveClass('text-muted-foreground');
      expect(complete.className).not.toContain('hover:');
      await act(async () => complete.click());
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      const markedIncomplete = container.querySelector(
        'button[aria-label="Mark Incomplete Existing task"]',
      );
      expect(markedIncomplete).toHaveAttribute('aria-pressed', 'true');
      expect(markedIncomplete).toHaveClass('text-success');
      expect(markedIncomplete?.querySelector('svg.lucide-square-check'))
        .toBeTruthy();

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
      expect(container.querySelector('button[aria-label="Mark Incomplete Existing task"]'))
        .toHaveClass('text-success');
    } finally {
      cleanup(root, container);
    }
  });

  it('offers the compact bulk Edit menu and applies an Area atomically without clearing selection', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-house', title: 'House' }],
      loading: false,
      error: null,
    });
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
        '1 Task',
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
        .toContain('2 Tasks');
      expect(listSurface).toHaveClass(
        'pb-[calc(env(safe-area-inset-bottom)+11rem)]',
        'md:pb-36',
      );

      const toolbar = container.querySelector<HTMLElement>(
        'section[aria-label="Task Selection"]',
      )!;
      expect(Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button')).map(
        ({ textContent }) => textContent?.trim(),
      )).toEqual(['Select All', 'Edit...', 'Done']);

      const edit = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Edit...')!;
      await act(async () => {
        edit.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        edit.click();
      });
      const menuItems = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      expect(menuItems.map(({ textContent }) => textContent?.trim())).toEqual(
        expect.arrayContaining(['Start...', 'Deadline...', 'Area', 'Actionability', 'Delete']),
      );
      expect(menuItems.some(({ textContent }) => textContent?.trim() === 'Repeat...')).toBe(false);

      const areaTrigger = menuItems.find(({ textContent }) => textContent?.trim() === 'Area')!;
      await act(async () => {
        areaTrigger.focus();
        areaTrigger.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const house = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find(({ textContent }) => textContent?.trim() === 'House')!;
      await act(async () => {
        house.click();
        await Promise.resolve();
      });

      expect(taskList.applyTaskPatches).toHaveBeenCalledWith([
        { taskId: 'task-a', patch: { area_id: 'area-house' } },
        { taskId: 'task-b', patch: { area_id: 'area-house' } },
      ]);
      expect(toolbar).toHaveTextContent('2 Tasks');
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');
    } finally {
      cleanup(root, container);
    }
  });

  it('offers operable terminal metadata submenus and bulk Reopen instead of Delete in Done', async () => {
    const completedTask = taskTodoFixture({
      ...task,
      id: 'task-completed',
      title: 'Completed task',
      lifecycle: 'completed',
      completed_at: '2026-07-20T03:00:00.000Z',
      client_mutation_id: 'mutation-completed',
    });
    const deletedTask = taskTodoFixture({
      ...task,
      id: 'task-deleted',
      title: 'Deleted task',
      disposition: 'deleted',
      deleted_at: '2026-07-20T04:00:00.000Z',
      deletion_root_id: 'task-deleted',
      client_mutation_id: 'mutation-deleted',
    });
    const taskList = {
      ...defaultTaskList(),
      tasks: [completedTask, deletedTask],
    };
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-house', title: 'House' }],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell('/tasks/done');

    const openBulkEdit = async () => {
      const edit = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Edit...')!;
      await act(async () => {
        edit.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        edit.click();
      });
    };

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-completed"]')
          ?.dispatchEvent(new MouseEvent('click', {
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }));
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-deleted"]')
          ?.dispatchEvent(new MouseEvent('click', {
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }));
      });
      expect(container.querySelector('[aria-label="Task Selection"]'))
        .toHaveTextContent('2 Tasks');

      await openBulkEdit();
      let menuItems = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      expect(menuItems.map(({ textContent }) => textContent?.trim())).toEqual(
        expect.arrayContaining(['Area', 'Actionability', 'Reopen']),
      );
      expect(menuItems.some(({ textContent }) => textContent?.trim() === 'Delete')).toBe(false);
      expect(menuItems.some(({ textContent }) => textContent?.trim() === 'Start...')).toBe(false);
      expect(menuItems.some(({ textContent }) => textContent?.trim() === 'Deadline...')).toBe(false);

      const areaTrigger = menuItems.find(
        ({ textContent }) => textContent?.trim() === 'Area',
      )!;
      expect(areaTrigger).not.toHaveAttribute('data-disabled');
      await act(async () => {
        areaTrigger.focus();
        areaTrigger.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const house = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find(({ textContent }) => textContent?.trim() === 'House')!;
      await act(async () => {
        house.click();
        await Promise.resolve();
      });
      expect(taskList.applyTaskPatches).toHaveBeenNthCalledWith(1, [
        { taskId: 'task-completed', patch: { area_id: 'area-house' } },
        { taskId: 'task-deleted', patch: { area_id: 'area-house' } },
      ]);

      await openBulkEdit();
      menuItems = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      const actionabilityTrigger = menuItems.find(
        ({ textContent }) => textContent?.trim() === 'Actionability',
      )!;
      expect(actionabilityTrigger).not.toHaveAttribute('data-disabled');
      await act(async () => {
        actionabilityTrigger.focus();
        actionabilityTrigger.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const waiting = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find(({ textContent }) => textContent?.trim() === 'Waiting')!;
      await act(async () => {
        waiting.click();
        await Promise.resolve();
      });
      expect(taskList.applyTaskPatches).toHaveBeenNthCalledWith(2, [
        { taskId: 'task-completed', patch: { actionability: 'waiting' } },
        { taskId: 'task-deleted', patch: { actionability: 'waiting' } },
      ]);

      await openBulkEdit();
      const reopen = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find(({ textContent }) => textContent?.trim() === 'Reopen')!;
      await act(async () => {
        reopen.click();
        await Promise.resolve();
      });

      expect(taskList.transitionTask).toHaveBeenCalledTimes(2);
      expect(taskList.transitionTask).toHaveBeenCalledWith(
        'task-completed',
        'reopen',
        undefined,
        { operationId: expect.any(String) },
      );
      expect(taskList.transitionTask).toHaveBeenCalledWith(
        'task-deleted',
        'restore',
        undefined,
        { operationId: expect.any(String) },
      );
      const operationIds = taskList.transitionTask.mock.calls.map(
        ([, , , context]) => context.operationId,
      );
      expect(new Set(operationIds).size).toBe(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('centers the shared Start picker without leaving selection mode', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [task, secondTask],
    });
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', {
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      expect(container.querySelector('[aria-label="Task Selection"]'))
        .toHaveTextContent('1 Task');

      const edit = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Edit...')!;
      await act(async () => {
        edit.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        edit.click();
      });
      const start = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find(({ textContent }) => textContent?.trim() === 'Start...')!;
      await act(async () => {
        start.click();
        await Promise.resolve();
      });

      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      expect(dialog).toHaveAccessibleName('Set Start');
      expect(dialog?.querySelector('[data-task-start-picker]')).not.toBeNull();
      expect(dialog?.querySelector('[aria-label="Reminder Time"]')).toBeNull();
      expect(dialog?.querySelector('[data-dialog-header]')).toBeNull();
      expect(dialog?.querySelector('[data-modal-close="true"]')).toBeNull();
      expect(container.querySelector('[aria-label="Task Selection"]'))
        .toHaveTextContent('1 Task');
      expect(container.querySelector('#task-title-task-a')).toBeNull();
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
        '1 Task',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks',
      );

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Deselect Second task"]')
          ?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task',
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

  it('treats Mac Control-click as one context-menu-free task selection gesture', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [task, secondTask] });
    const { container, root } = renderShell();

    const controlClick = async (target: HTMLElement) => {
      const contextMenu = new MouseEvent('contextmenu', {
        ctrlKey: true,
        button: 2,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        target.dispatchEvent(new MouseEvent('mousedown', {
          ctrlKey: true,
          button: 0,
          bubbles: true,
          cancelable: true,
        }));
        target.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true,
          button: 0,
          bubbles: true,
          cancelable: true,
        }));
        target.dispatchEvent(contextMenu);
        await Promise.resolve();
      });
      return contextMenu;
    };

    try {
      const firstTitle = container.querySelector<HTMLElement>('[data-task-id="task-a"]')!;
      const firstContextMenu = await controlClick(firstTitle);
      expect(firstContextMenu.defaultPrevented).toBe(true);
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');

      const secondTitle = container.querySelector<HTMLElement>('[data-task-id="task-b"]')!;
      await controlClick(secondTitle);
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks',
      );

      await controlClick(firstTitle);
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task',
      );
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');

      const nonTaskContextMenu = new MouseEvent('contextmenu', {
        ctrlKey: true,
        button: 2,
        bubbles: true,
        cancelable: true,
      });
      container.querySelector<HTMLElement>('[data-task-view-heading]')
        ?.dispatchEvent(nonTaskContextMenu);
      expect(nonTaskContextMenu.defaultPrevented).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
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
        '1 Task',
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
        '1 Task',
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
        '2 Tasks',
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
        '2 Tasks',
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

  it('omits explicit task selection entry from Settings', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell('/tasks/config');
    try {
      expect(container.querySelector('button[aria-label="Select Tasks"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('starts selection mode with the keyboard-focused task', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      await act(async () => {
        row.focus();
        row.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ', bubbles: true, cancelable: true,
        }));
      });
      expect(row).toHaveAttribute('aria-current', 'true');

      const selectionEvent = new KeyboardEvent('keydown', {
        key: 'b', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(selectionEvent);
        await Promise.resolve();
      });

      expect(selectionEvent.defaultPrevented).toBe(true);
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(row).not.toHaveAttribute('aria-current');
    } finally {
      cleanup(root, container);
    }
  });

  it('closes an open task before starting selection mode with it', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expect(container.querySelector('#task-title-task-a')).not.toBeNull();

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'b', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
          '1 Task',
        );
      });
      expect(container.querySelector('#task-title-task-a')).toBeNull();
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
    } finally {
      cleanup(root, container);
    }
  });

  it('suppresses targeted selection entry when no task is current', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const selectionEvent = new KeyboardEvent('keydown', {
        key: 'b', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
      });
      await act(async () => window.dispatchEvent(selectionEvent));

      expect(selectionEvent.defaultPrevented).toBe(true);
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();
      expect(container.querySelector('#task-title-task-a')).toBeNull();
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
      expect(toolbar).toHaveTextContent('0 Tasks');
      expect(container.querySelector('button[aria-label="Select Tasks"]'))
        .toHaveAttribute('aria-pressed', 'true');
      expect(container.querySelector('[aria-label="Select Existing task"]'))
        .toHaveAttribute('aria-checked', 'false');

      const edit = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Edit...')!;
      const done = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Done')!;
      const selectAll = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Select All')!;
      expect(edit).toBeDisabled();
      expect(done).toBeEnabled();
      expect(selectAll).toBeEnabled();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')
          ?.click();
      });
      expect(toolbar).toHaveTextContent('1 Task');
      expect(edit).toBeEnabled();
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

  it('prunes tasks that leave the view after an edit and retains selection mode at zero', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    const taskList = defaultTaskList();
    let visibleTasks = [task, secondTask];
    mockTaskList.mockImplementation(() => ({ ...taskList, tasks: visibleTasks }));
    const { container, rerender, root } = renderShell();

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
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks',
      );

      visibleTasks = [secondTask];
      await act(async () => {
        rerender();
        await Promise.resolve();
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task',
      );
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');

      visibleTasks = [];
      await act(async () => {
        rerender();
        await Promise.resolve();
      });
      const toolbar = container.querySelector<HTMLElement>(
        'section[aria-label="Task Selection"]',
      )!;
      expect(toolbar).toHaveTextContent('0 Tasks');
      expect(Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button')).find(
        ({ textContent }) => textContent === 'Edit...',
      )).toBeDisabled();
      expect(Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button')).find(
        ({ textContent }) => textContent === 'Done',
      )).toBeEnabled();
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
      expect(toolbar).toHaveTextContent('1 Task');
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
        .toHaveTextContent('0 Tasks');
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
        '1 Task',
      );

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.click();
        await Promise.resolve();
      });

      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks',
      );
      expect(container.querySelector('#task-title-task-a')).toBeNull();
      expect(container.querySelector('#task-title-task-b')).toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
        await Promise.resolve();
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task',
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
        '2 Tasks',
      );

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Deselect Second task"]')
          ?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task',
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
        '1 Task',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('#task-title-task-a')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('translates with a touch drag and opens Start after a qualifying right swipe', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      const header = container.querySelector<HTMLElement>(
        '[data-task-row-id="task-a"] [data-task-row-header]',
      )!;

      await act(async () => {
        header.dispatchEvent(taskPointerEvent('pointerdown', {
          clientX: 120,
          clientY: 100,
        }));
        header.dispatchEvent(taskPointerEvent('pointermove', {
          clientX: 175,
          clientY: 103,
        }));
      });

      expect(header).toHaveAttribute('data-task-swipe-direction', 'right');
      expect(header.style.transform).toMatch(/translate3d\([1-9]/);
      expect(Number.parseFloat(
        container.querySelector<HTMLElement>(
          '[data-task-swipe-affordance="start"]',
        )!.style.opacity,
      )).toBeCloseTo(0.89375);

      await act(async () => {
        header.dispatchEvent(taskPointerEvent('pointerup', {
          clientX: 175,
          clientY: 103,
        }));
        await Promise.resolve();
      });

      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();
      expect(header.style.transform).toBe('translate3d(0px, 0, 0)');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps Arrow Right native in Summary and focuses the end of Notes with the Notes command', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const summary = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      await waitFor(() => {
        expect(container.querySelector('#task-notes-task-a')).toBeTruthy();
      });
      const notes = container.querySelector<HTMLElement>('#task-notes-task-a')!;
      summary.focus();
      summary.setSelectionRange(summary.value.length, summary.value.length);

      await act(async () => {
        summary.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
      });

      expect(document.activeElement).toBe(summary);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'n',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(document.activeElement).toBe(notes);
      const selection = window.getSelection();
      expect(selection?.isCollapsed).toBe(true);
      const prefixAtEnd = document.createRange();
      prefixAtEnd.selectNodeContents(notes);
      prefixAtEnd.setEnd(selection!.anchorNode!, selection!.anchorOffset);
      expect(prefixAtEnd.toString()).toBe('Existing notes');

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'n',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(notes);
      expect(window.getSelection()?.isCollapsed).toBe(true);
      const beginningSelection = window.getSelection()!;
      const prefixAtBeginning = document.createRange();
      prefixAtBeginning.selectNodeContents(notes);
      prefixAtBeginning.setEnd(
        beginningSelection.anchorNode!,
        beginningSelection.anchorOffset,
      );
      expect(prefixAtBeginning.toString()).toBe('');
    } finally {
      cleanup(root, container);
    }
  });

  it('opens a focused task and toggles Link focus between the end and beginning', async () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [taskTodoFixture({
        ...task,
        primary_link: 'https://example.test/brief',
      })],
    });
    const { container, root } = renderShell();
    const invokeLinkShortcut = async () => {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'h',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
    };

    try {
      const focusedTask = container.querySelector<HTMLElement>(
        '[data-task-row-focus-target][data-task-row-id="task-a"]',
      )!;
      await act(async () => {
        focusedTask.focus();
        focusedTask.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ', bubbles: true, cancelable: true,
        }));
      });
      await invokeLinkShortcut();

      const link = await waitFor(() => {
        const control = container.querySelector<HTMLInputElement>('#task-primary-link-task-a');
        expect(control).not.toBeNull();
        return control!;
      });
      expect(document.activeElement).toBe(link);
      expect(link.selectionStart).toBe(link.value.length);
      expect(link.selectionEnd).toBe(link.value.length);

      await invokeLinkShortcut();
      expect(document.activeElement).toBe(link);
      expect(link.selectionStart).toBe(0);
      expect(link.selectionEnd).toBe(0);
    } finally {
      cleanup(root, container);
    }
  });

  it('reveals empty Notes and Link through their shortcuts but restores add actions after reopen', async () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [taskTodoFixture({ ...task, notes: '', primary_link: null })],
    });
    const { container, root } = renderShell();
    try {
      const focusedTask = container.querySelector<HTMLElement>(
        '[data-task-row-focus-target][data-task-row-id="task-a"]',
      )!;
      await act(async () => {
        focusedTask.focus();
        focusedTask.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ', bubbles: true, cancelable: true,
        }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'n', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const notes = await waitFor(() => {
        const control = container.querySelector<HTMLElement>('#task-notes-task-a');
        expect(control).not.toBeNull();
        return control!;
      });
      expect(document.activeElement).toBe(notes);
      expect(container.querySelector('[aria-label="Add Notes"]')).toBeNull();

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'h', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(container.querySelector('#task-primary-link-task-a'));
      expect(container.querySelector('[aria-label="Add Link"]')).toBeNull();

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'q', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
      });
      await waitForTaskEditorExit(container);
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expect(container.querySelector('#task-notes-task-a')).toBeNull();
      expect(container.querySelector('#task-primary-link-task-a')).toBeNull();
      expect(container.querySelector('[aria-label="Add Notes"]')).toBeTruthy();
      expect(container.querySelector('[aria-label="Add Link"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('ignores Notes and Link focus shortcuts when multiple tasks are selected', async () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [
        taskTodoFixture({ ...task, notes: '', primary_link: null }),
        taskTodoFixture({
          ...task,
          id: 'task-b',
          title: 'Second task',
          client_mutation_id: 'mutation-task-b',
          notes: '',
          primary_link: null,
        }),
      ],
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
      expect(document.body).toHaveTextContent('2 Tasks');

      for (const key of ['h', 'n']) {
        const shortcut = new KeyboardEvent('keydown', {
          key,
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        });
        await act(async () => {
          window.dispatchEvent(shortcut);
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        });
        expect(shortcut.defaultPrevented).toBe(true);
      }

      expect(container.querySelector('[data-task-editor-region]')).toBeNull();
      expect(container.querySelector('[data-task-editor-disclosures]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('opens and focuses optional content for one task selected in selection mode', async () => {
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [taskTodoFixture({ ...task, notes: '', primary_link: null })],
    });
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'h', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      const link = await waitFor(() => {
        const control = container.querySelector<HTMLInputElement>('#task-primary-link-task-a');
        expect(control).not.toBeNull();
        return control!;
      });
      expect(document.activeElement).toBe(link);
      expect(container.querySelector('[data-task-selection-bar]')).toBeNull();
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

  it('replaces a keyboard-focused task when a modified click starts selection', async () => {
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
        '1 Task',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]')).toBeNull();
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(firstRow).not.toHaveAttribute('aria-current');
    } finally {
      cleanup(root, container);
    }
  });

  it('closes an open task and selects only the modified-clicked task', async () => {
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
        '1 Task',
      );
      expect(container.querySelector('[aria-label="Deselect Existing task"]')).toBeNull();
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');
      await waitForTaskEditorExit(container);
      expect(container.querySelector('#task-title-task-a')).toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Deselect Second task"]')
          ?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();
      expect(container.querySelector('#task-title-task-a')).toBeNull();
      expect(container.querySelector('[aria-label="Deselect Existing task"]')).toBeNull();
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
    vi.useFakeTimers();
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
        .toHaveAttribute('data-completion-grace', 'true');
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_400);
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      vi.useRealTimers();

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
      vi.useRealTimers();
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
        '[aria-label="Open Link for Existing task"]',
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

      vi.useFakeTimers();
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[aria-label="Complete Existing task"]',
        )?.click();
        await vi.advanceTimersByTimeAsync(2_400);
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      vi.useRealTimers();
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('lets an open bulk Edit menu consume its outside dismissal before clearing selection', async () => {
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

      const edit = Array.from(selection.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Edit...')!;
      await act(async () => {
        edit.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        edit.click();
      });
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
      await act(async () => {
        menu.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')).toBeTruthy();

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-view-heading]')?.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });
      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(container.querySelector('section[aria-label="Task Selection"]'))
        .toHaveTextContent('2 Tasks');
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-view-heading]')?.dispatchEvent(
          new MouseEvent('pointerdown', { bubbles: true, cancelable: true }),
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
        .toContain('2 Tasks');

      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Deselect Second task"]',
        )?.click();
      });
      expect(container.querySelector('section[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task',
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
        .toContain('2 Tasks');
      expect(container.querySelector('[aria-label="Deselect Existing task"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('[aria-label="Deselect Second task"]'))
        .toHaveAttribute('aria-checked', 'true');
    } finally {
      cleanup(root, container);
    }
  });

  it('completes every bulk-selected to-do without exiting selection mode', async () => {
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
      expect(container.querySelector('section[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks',
      );
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
      expect(setData).toHaveBeenCalledWith('text/plain', 'Existing task');
      expect(setData).toHaveBeenCalledWith(
        'text/html',
        expect.stringContaining('Existing task'),
      );
      const structuredCall = setData.mock.calls.find(
        ([type]) => type === TASK_CLIPBOARD_MIME_TYPE,
      );
      expect(structuredCall).toBeDefined();
      const payload = JSON.parse(structuredCall?.[1] as string);
      expect(payload).toMatchObject({
        kind: TASK_CLIPBOARD_KIND,
        version: 2,
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

  it('yields task-level Copy and Cut while checklist selection owns the clipboard', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    const checklistSelection = document.createElement('section');
    checklistSelection.dataset.taskChecklist = '';
    checklistSelection.dataset.checklistSelectionActive = 'true';
    document.body.appendChild(checklistSelection);
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      const copySetData = vi.fn();
      const copy = clipboardEvent('copy', '', copySetData);
      const cutSetData = vi.fn();
      const cut = clipboardEvent('cut', '', cutSetData);
      await act(async () => {
        window.dispatchEvent(copy);
        window.dispatchEvent(cut);
        await Promise.resolve();
      });

      expect(copy.defaultPrevented).toBe(false);
      expect(cut.defaultPrevented).toBe(false);
      expect(copySetData).not.toHaveBeenCalled();
      expect(cutSetData).not.toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({
        title: 'Tasks Copied',
      }));
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({
        title: 'Tasks Cut',
      }));
    } finally {
      checklistSelection.remove();
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
      expect(mockToast).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('pastes each nonempty clipboard line as a separate Today Inbox task', async () => {
    let createdIndex = 0;
    const repository = {
      createTask: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
        createdIndex += 1;
        return taskTodoFixture({
          id: `task-pasted-${createdIndex}`,
          title: String(input.title),
          destination: 'anytime',
          today_section: 'inbox',
          order_key: String(input.orderKey),
        });
      }),
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
      const paste = clipboardEvent(
        'paste',
        ' First task \r\n\r\nSecond task\r Third task ',
      );
      await act(async () => {
        window.dispatchEvent(paste);
        await Promise.resolve();
      });
      await waitFor(() => expect(repository.createTask).toHaveBeenCalledTimes(3));

      expect(repository.createTask.mock.calls.map(([input]) => input.title))
        .toEqual(['Third task', 'Second task', 'First task']);
      for (const [input] of repository.createTask.mock.calls) {
        expect(input).toMatchObject({
          destination: 'anytime',
          todaySection: 'inbox',
          startDate: null,
        });
      }
      expect(paste.defaultPrevented).toBe(true);
      expect(mockToast).not.toHaveBeenCalled();
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
        '1 Task',
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
      expect(title.closest('article')).toHaveClass('rounded-md', 'bg-info/10');
      expect(
        container.querySelector('[data-task-id="task-b"]')?.closest('article'),
      ).toHaveClass('rounded-md', 'bg-info/10');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps bulk selection available when an atomic bulk edit fails', async () => {
    const secondTask = {
      ...task,
      id: 'task-b',
      title: 'Deadline-constrained task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    const taskList = { ...defaultTaskList(), tasks: [task, secondTask] };
    taskList.applyTaskPatches.mockRejectedValueOnce(new Error('Update failed'));
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
      const edit = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Edit...')!;
      await act(async () => {
        edit.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        edit.click();
      });
      const actionability = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find(({ textContent }) => textContent?.trim() === 'Actionability')!;
      await act(async () => {
        actionability.focus();
        actionability.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const waiting = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find(({ textContent }) => textContent?.trim() === 'Waiting')!;
      await act(async () => {
        waiting.click();
        await Promise.resolve();
      });

      expect(taskList.applyTaskPatches).toHaveBeenCalledWith([
        { taskId: 'task-a', patch: { actionability: 'waiting' } },
        { taskId: 'task-b', patch: { actionability: 'waiting' } },
      ]);
      expect(container.querySelector('section[aria-label="Task Selection"]')?.textContent)
        .toContain('2 Tasks');
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

  it('lets the final task in a Today horizon return to its own source position', async () => {
    const nowTask = taskTodoFixture({
      ...task,
      id: 'task-now',
      title: 'Now task',
      today_section: 'now',
      order_key: 'a1',
    });
    const taskList = { ...defaultTaskList(), tasks: [task, nowTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskDragHandleVisibility.mockReturnValue({
      visibility: 'always',
      loading: false,
      error: null,
      pending: false,
      setVisibility: vi.fn().mockResolvedValue(undefined),
    });
    const { container, root } = renderShell();

    try {
      const source = container.querySelector('[data-task-id="task-a"]')?.closest('article');
      const target = container.querySelector('[data-task-id="task-now"]')?.closest('article');
      const sourceHandle = source?.querySelector<HTMLElement>('[data-task-drag-handle]');
      if (!source || !target || !sourceHandle) {
        throw new Error('Expected draggable tasks in separate Today horizons');
      }
      const bounds = {
        top: 0,
        bottom: 100,
        height: 100,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
      vi.spyOn(source, 'getBoundingClientRect').mockReturnValue(bounds);
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(bounds);
      const dataTransfer = {
        effectAllowed: 'none',
        dropEffect: 'none',
        setData: vi.fn(),
        getData: vi.fn(() => ''),
      } as unknown as DataTransfer;
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      const dragOverTarget = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperties(dragOverTarget, {
        dataTransfer: { value: dataTransfer },
        clientY: { value: 75 },
      });
      const dragOverSource = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperties(dragOverSource, {
        dataTransfer: { value: dataTransfer },
        clientY: { value: 75 },
      });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });

      await act(async () => {
        sourceHandle.dispatchEvent(dragStart);
        target.dispatchEvent(dragOverTarget);
        source.dispatchEvent(dragOverSource);
      });

      expect(source).toHaveAttribute('data-drag-placement', 'after');
      expect(source.querySelector('[data-task-drop-indicator]')).toBeTruthy();

      await act(async () => {
        source.dispatchEvent(drop);
        await Promise.resolve();
      });

      expect(taskList.reorderTaskTo).not.toHaveBeenCalled();
      expect(taskList.updateTask).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('targets the final task through blank list space and dims the complete source row', async () => {
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
    const elementsFromPointDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'elementsFromPoint',
    );
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: vi.fn(() => []),
    });
    const { container, root } = renderShell();

    try {
      const rows = ['task-a', 'task-b', 'task-c'].map((taskId) => (
        container.querySelector<HTMLElement>(`[data-task-row-id="${taskId}"]`)!
      ));
      const main = container.querySelector<HTMLElement>('[data-task-space-entry-surface]')!;
      const dropSurface = container.querySelector<HTMLElement>(
        '[data-task-module-drop-surface]',
      )!;
      const rectangle = (top: number, bottom: number): DOMRect => ({
        top,
        bottom,
        height: bottom - top,
        left: 0,
        right: 500,
        width: 500,
        x: 0,
        y: top,
        toJSON: () => ({}),
      });
      vi.spyOn(main, 'getBoundingClientRect').mockReturnValue(rectangle(0, 600));
      rows.forEach((row, index) => {
        vi.spyOn(row, 'getBoundingClientRect')
          .mockReturnValue(rectangle(20 + index * 52, 64 + index * 52));
      });
      const sourceHandle = rows[0].querySelector<HTMLElement>('[data-task-drag-handle]')!;
      const sourceSummary = rows[0].querySelector<HTMLElement>('[data-task-row-header]')!;
      const dataTransfer = {
        effectAllowed: 'none',
        dropEffect: 'none',
        setData: vi.fn(),
        getData: vi.fn(() => ''),
      } as unknown as DataTransfer;
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperties(dragStart, {
        dataTransfer: { value: dataTransfer },
        clientX: { value: 80 },
        clientY: { value: 40 },
      });
      const blankSpaceDragOver = new Event('dragover', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperties(blankSpaceDragOver, {
        dataTransfer: { value: dataTransfer },
        clientX: { value: 80 },
        clientY: { value: 300 },
      });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });

      await act(async () => {
        sourceHandle.dispatchEvent(dragStart);
      });
      expect(sourceSummary).toHaveAttribute('data-task-dragging', 'true');
      expect(sourceSummary).toHaveClass('opacity-45');
      expect(sourceSummary.querySelector('[data-task-completion-control]')).toBeTruthy();
      expect(sourceSummary.querySelector('[data-task-row-trailing-controls]')).toBeTruthy();

      await act(async () => {
        dropSurface.dispatchEvent(blankSpaceDragOver);
      });
      expect(rows[2]).toHaveAttribute('data-drag-placement', 'after');

      await act(async () => {
        dropSurface.dispatchEvent(drop);
        await Promise.resolve();
      });
      expect(taskList.reorderTaskTo).toHaveBeenCalledWith('task-a', 'task-c', 'after');
    } finally {
      cleanup(root, container);
      if (elementsFromPointDescriptor) {
        Object.defineProperty(document, 'elementsFromPoint', elementsFromPointDescriptor);
      } else {
        Reflect.deleteProperty(document, 'elementsFromPoint');
      }
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

      const taskRow = container.querySelector('[data-task-row-id="task-a"]');
      const summary = taskRow?.querySelector<HTMLElement>('[data-task-row-header]');
      const dragHandle = summary?.querySelector<HTMLElement>('[data-task-drag-handle]');
      const editor = taskRow?.querySelector<HTMLElement>('[data-task-editor-region]');
      const titleInput = taskRow?.querySelector<HTMLInputElement>('#task-title-task-a');
      if (!taskRow || !summary || !dragHandle || !editor || !titleInput) {
        throw new Error('Expected an open draggable task');
      }
      expect(taskRow).not.toHaveAttribute('draggable');
      expect(summary).not.toHaveAttribute('draggable');
      expect(dragHandle).toHaveAttribute('draggable', 'true');
      expect(editor).not.toHaveAttribute('draggable');
      expect(summary).toHaveTextContent('Existing task');
      expect(summary.querySelector('#task-title-task-a')).toBeNull();
      expect(editor.querySelector('#task-title-task-a')).toBe(titleInput);

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

      const openTaskRow = container.querySelector('[data-task-row-id="task-a"]');
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
      expect(taskList.updateTask).toHaveBeenCalledWith(
        'task-upcoming-first',
        { upcoming_order_key: expect.any(String) },
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
      expect(taskList.updateTask).toHaveBeenCalledWith(
        'task-deadline-only',
        expect.objectContaining({
          destination: 'anytime',
          start_date: '2026-07-22',
          today_section: null,
          upcoming_order_key: expect.any(String),
        }),
      );
      expect(taskList.reorderTaskTo).not.toHaveBeenCalled();
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


  it('marks a task waiting from its Actionability submenu without changing placement', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await openTaskMenuSubmenu(container, 'Existing task', 'Actionability');
      const waiting = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Waiting');
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
        'Done', 'Settings',
      ]);
    } finally {
      cleanup(today.root, today.container);
    }
  });

  it('keeps the ordered settings surfaces out of the daily header and opens keyboard help', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const today = renderShell('/tasks/today');

    try {
      expect(today.container.querySelector('[aria-label="Browser Reminder Capability"]')).toBeNull();
      expect(today.container.querySelector('[data-trigger-variant="config"]')).toBeNull();
      expect(today.container.querySelector('[aria-label="Keyboard Shortcuts"]')).toBeNull();
    } finally {
      cleanup(today.root, today.container);
    }

    const config = renderShell('/tasks/config');
    try {
      expect(config.container.querySelector('[data-task-view-heading]')?.textContent).toBe('Settings');
      const settingsText = config.container.textContent ?? '';
      const featuresIndex = settingsText.indexOf('Features');
      const areasIndex = settingsText.indexOf('Areas');
      const syncIndex = settingsText.indexOf('Sync Status');
      expect(featuresIndex).toBeGreaterThanOrEqual(0);
      expect(areasIndex).toBeGreaterThan(featuresIndex);
      expect(syncIndex).toBeGreaterThan(areasIndex);
      expect(settingsText).toContain('Notifications');
      expect(settingsText).toContain('Automatically Sort Anytime and Someday');
      expect(settingsText).toContain('Drag Handles');
      expect(settingsText).toContain('Keyboard Shortcuts');
      const dragHandleSelect = config.container.querySelector<HTMLButtonElement>(
        '[aria-label="Drag Handles"]',
      );
      expect(dragHandleSelect).toHaveTextContent('Hidden');
      await act(async () => {
        dragHandleSelect?.click();
      });
      expect(document.body).toHaveTextContent('Touch Devices Only');
      expect(settingsText).toContain(
        'Press ⌃/ to view all keyboard commands at any time.',
      );
      expect(settingsText).toContain('Pending Changes');
      expect(settingsText).toContain('Last Successful Sync');
      expect(settingsText).not.toContain('Backup and Restore');
      expect(settingsText).not.toContain('Synchronization Details');
      expect(settingsText).not.toContain('Manage Backups');
      expect(config.container.querySelector('#tasks-automatic-list-sorting'))
        .toHaveAttribute('data-state', 'unchecked');
      expect(config.container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      expect(config.container.querySelector('[aria-label="Keyboard Shortcuts"]')).toBeNull();
      const keyboardShortcutsHeading = Array.from(
        config.container.querySelectorAll<HTMLHeadingElement>('h4'),
      ).find((heading) => heading.textContent === 'Keyboard Shortcuts');
      const keyboardShortcutsRow = keyboardShortcutsHeading?.closest('div.flex');
      const showButton = Array.from(
        keyboardShortcutsRow?.querySelectorAll<HTMLButtonElement>('button') ?? [],
      ).find((button) => button.textContent?.trim() === 'Show');
      await act(async () => {
        showButton?.click();
      });
      expect(document.querySelector<HTMLElement>('[role="dialog"]'))
        .toHaveAccessibleName('Keyboard Shortcuts');
      expect(config.container.querySelector<HTMLAnchorElement>(
        '[data-testid="mobile-nav"] a[href="/tasks/config"]',
      )?.getAttribute('aria-current')).toBe('page');
    } finally {
      cleanup(config.root, config.container);
    }
  });

  it('withholds the Keyboard Shortcuts setting from touch devices', async () => {
    const maxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      'maxTouchPoints',
    );
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5,
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const config = renderShell('/tasks/config');

    try {
      await waitFor(() => {
        expect(config.container.textContent).not.toContain('Keyboard Shortcuts');
      });
      expect(config.container.textContent).not.toContain(
        'view all keyboard commands at any time',
      );
    } finally {
      cleanup(config.root, config.container);
      if (maxTouchPointsDescriptor) {
        Object.defineProperty(
          window.navigator,
          'maxTouchPoints',
          maxTouchPointsDescriptor,
        );
      } else {
        Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
      }
    }
  });

  it('shows immediate drag handles on task and checklist rows when configured always', async () => {
    const checklistItem = taskChecklistItemFixture({
      id: 'checklist-handle',
      task_id: task.id,
      title: 'Checklist item',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [task, taskTodoFixture({
        id: 'task-b',
        title: 'Second task',
        destination: 'anytime',
        today_section: 'next',
        start_date: '2026-07-20',
      })],
      checklistTaskIds: new Set([task.id]),
    });
    mockTaskChecklist.mockReturnValue(defaultTaskChecklist([checklistItem]));
    mockTaskDragHandleVisibility.mockReturnValue({
      visibility: 'always',
      loading: false,
      error: null,
      pending: false,
      setVisibility: vi.fn().mockResolvedValue(undefined),
    });
    const { container, root } = renderShell();

    try {
      expect(container.querySelectorAll('[data-task-drag-handle-control]')).toHaveLength(2);
      const taskRow = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      const actions = taskRow.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      )!;
      const taskHandle = taskRow.querySelector<HTMLButtonElement>(
        '[data-task-drag-handle-control]',
      )!;
      const trailingControls = actions.closest('[data-task-row-trailing-controls]');
      expect(trailingControls).toHaveClass('gap-0.5');
      expect(actions.nextElementSibling).toBe(taskHandle);
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expect(container.querySelectorAll('[data-task-drag-handle-control]')).toHaveLength(3);
      expect(taskRow.querySelector('button[aria-label="Actions for Existing task"]'))
        .toBe(actions);
      expect(actions.nextElementSibling).toBe(taskHandle);
      expect(container.querySelector('[data-task-checklist] [data-task-drag-handle-control]'))
        .toHaveAccessibleName('Reorder Checklist item');
    } finally {
      cleanup(root, container);
    }
  });

  it('shows and records Global Quick Entry only in the native Mac Settings view', async () => {
    const messages: unknown[] = [];
    mockTaskList.mockReturnValue(defaultTaskList());
    const browser = renderShell('/tasks/config');
    try {
      expect(browser.container.textContent).not.toContain('Global Quick Entry');
    } finally {
      cleanup(browser.root, browser.container);
    }

    Object.assign(window, {
      __bathosNativeApp: {
        schemaVersion: 2,
        moduleId: 'tasks',
        platform: 'macos',
        quickEntryShortcut: '⌃⌥Space',
      },
      __bathosTasksNative: {
        schemaVersion: 2,
        installationId: '30000000-0000-4000-8000-000000000001',
      },
      webkit: {
        messageHandlers: {
          bathosTasksWidget: {
            postMessage: (message: unknown) => messages.push(message),
          },
        },
      },
    });
    const native = renderShell('/tasks/config');
    try {
      expect(native.container.textContent).toContain('Global Quick Entry');
      const recorder = Array.from(native.container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === '⌃⌥Space');
      await act(async () => {
        recorder?.click();
      });
      expect(recorder).toHaveTextContent('Type...');

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ',
          code: 'Space',
          ctrlKey: true,
          altKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(messages).toContainEqual({
        type: 'configure-quick-entry-shortcut',
        schemaVersion: 2,
        shortcut: {
          code: 'Space',
          command: false,
          control: true,
          option: true,
          shift: false,
        },
      });
      await act(async () => {
        window.dispatchEvent(new CustomEvent(
          'bathos:tasks-native-quick-entry-shortcut',
          {
            detail: {
              success: true,
              display: '⌃⌥Space',
              message: null,
            },
          },
        ));
      });
      expect(recorder).toHaveTextContent('⌃⌥Space');

      await act(async () => {
        recorder?.click();
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'j',
          code: 'KeyJ',
          metaKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(messages).toContainEqual({
        type: 'configure-quick-entry-shortcut',
        schemaVersion: 2,
        shortcut: {
          code: 'KeyJ',
          command: true,
          control: false,
          option: false,
          shift: true,
        },
      });

      await act(async () => {
        window.dispatchEvent(new CustomEvent(
          'bathos:tasks-native-quick-entry-shortcut',
          {
            detail: {
              success: true,
              display: '⇧⌘J',
              message: null,
            },
          },
        ));
      });
      expect(native.container.textContent).toContain('⇧⌘J');
      expect(native.container.textContent).toContain(
        'Global Quick Entry shortcut saved',
      );

      const clear = native.container.querySelector<HTMLButtonElement>(
        '[aria-label="Clear Global Quick Entry Shortcut"]',
      );
      await act(async () => clear?.click());
      expect(messages).toContainEqual({
        type: 'clear-quick-entry-shortcut',
        schemaVersion: 2,
      });
      await act(async () => {
        window.dispatchEvent(new CustomEvent(
          'bathos:tasks-native-quick-entry-shortcut',
          {
            detail: {
              success: true,
              display: null,
              message: null,
            },
          },
        ));
      });
      expect(native.container.textContent).toContain('Not Set');
      expect(native.container.textContent).toContain('Global Quick Entry turned off');
    } finally {
      cleanup(native.root, native.container);
      Reflect.deleteProperty(window, '__bathosNativeApp');
      Reflect.deleteProperty(window, '__bathosTasksNative');
      Reflect.deleteProperty(window, 'webkit');
    }
  });

  it('renders the native Mac quick-entry route as only the ordinary new-task editor', async () => {
    const messages: unknown[] = [];
    Object.assign(window, {
      __bathosNativeApp: {
        schemaVersion: 2,
        moduleId: 'tasks',
        platform: 'macos',
        quickEntryShortcut: '⌃⌥Space',
      },
      __bathosTasksNative: {
        schemaVersion: 2,
        installationId: '30000000-0000-4000-8000-000000000001',
      },
      webkit: {
        messageHandlers: {
          bathosTasksWidget: {
            postMessage: (message: unknown) => messages.push(message),
          },
        },
      },
    });
    mockTaskList.mockReturnValue(defaultTaskList());
    const quickEntry = renderShell(
      '/tasks/today?native_new_task=1&native_quick_entry=1',
    );
    try {
      await waitFor(() => {
        const titleInput = document.getElementById(`task-title-${NEW_TASK_DRAFT_ID}`);
        expect(titleInput).toBeTruthy();
        expect(quickEntry.container.contains(titleInput)).toBe(true);
      });
      await waitFor(() => {
        expect(messages).toContainEqual({
          type: 'quick-entry-ready',
          schemaVersion: 2,
        });
      });
      expect(quickEntry.container.querySelector('[data-topline-header]')).toBeNull();
      expect(quickEntry.container.querySelector('[data-testid="mobile-nav"]')).toBeNull();
      expect(quickEntry.container.querySelector('[aria-label="Add a Task"]')).toBeNull();
      expect(quickEntry.container.querySelector('[data-task-editor-region]')).toBeTruthy();
      expect(quickEntry.container.querySelector('[data-task-quick-entry-editor="true"]'))
        .toHaveClass('bg-transparent');
      expect(quickEntry.container.querySelector('[data-task-row-header]')).toBeNull();
      expect(quickEntry.container.querySelector('[data-task-completion-control]')).toBeNull();
      expect(quickEntry.container.querySelector('[data-task-row-trailing-controls]')).toBeNull();
      expect(quickEntry.container.querySelector('[data-task-editor-form]'))
        .toHaveClass('gap-2', 'p-1');
      expect(quickEntry.container.querySelector('[data-task-space-entry-surface]'))
        .toHaveClass('px-8', 'py-3');
      expect(quickEntry.container.querySelector('[data-task-quick-entry-actions]'))
        .toHaveTextContent('CancelSave');
      const quickEntryActions = quickEntry.container.querySelector(
        '[data-task-quick-entry-actions]',
      );
      expect(quickEntryActions?.querySelector('button:first-child'))
        .toHaveClass('bg-background', 'border-primary');
      expect(quickEntryActions?.querySelector('button:last-child'))
        .toHaveClass('bg-primary');
      expect(quickEntryActions?.querySelector('button:first-child')).not.toBeDisabled();
      expect(quickEntryActions?.querySelector('button:last-child')).not.toBeDisabled();
      expect(quickEntry.container.querySelector('[data-task-editor-temporal-grid]')).toBeTruthy();
      expect(quickEntry.container.querySelector('[data-task-editor-identity-grid]')).toBeTruthy();
      expect(quickEntry.container.querySelector('[data-task-primary-link-disclosure]')).toBeTruthy();
      expect(quickEntry.container.querySelector('[data-task-checklist-disclosure]')).toBeTruthy();

      await act(async () => {
        quickEntry.container.querySelector<HTMLElement>(
          '[data-task-native-quick-entry="true"]',
        )?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      });
      expect(document.getElementById(`task-title-${NEW_TASK_DRAFT_ID}`)).toBeTruthy();

      const startTrigger = quickEntry.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Start"]',
      );
      expect(startTrigger).toHaveClass('gap-2');
      expect(startTrigger?.children[1]).not.toHaveClass('ml-2');

      await act(async () => {
        startTrigger?.click();
      });
      expect(document.querySelector('[data-task-start-picker-placement="viewport-center"]'))
        .toBeTruthy();
      expect(document.querySelector('[data-task-start-picker-viewport-anchor]')).toBeTruthy();

      await act(async () => {
        quickEntry.container.querySelector<HTMLButtonElement>(
          'button[aria-label="Start"]',
        )?.click();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(document.querySelector('[data-task-start-picker-placement="viewport-center"]'))
          .toBeNull();
      });
      await act(async () => {
        quickEntry.container.querySelector<HTMLButtonElement>(
          'button[aria-label="Deadline"]',
        )?.click();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(document.querySelector('[data-date-picker-placement="viewport-center"]'))
          .toBeTruthy();
      });
      expect(document.querySelector('[data-date-picker-viewport-anchor]')).toBeTruthy();
    } finally {
      cleanup(quickEntry.root, quickEntry.container);
      Reflect.deleteProperty(window, '__bathosNativeApp');
      Reflect.deleteProperty(window, '__bathosTasksNative');
      Reflect.deleteProperty(window, 'webkit');
    }
  });

  it('applies Control metadata shortcuts to native quick entry and consumes ambiguous commands', async () => {
    const messages: unknown[] = [];
    Object.assign(window, {
      __bathosNativeApp: {
        schemaVersion: 2,
        moduleId: 'tasks',
        platform: 'macos',
        quickEntryShortcut: '⌃⌥Space',
      },
      __bathosTasksNative: {
        schemaVersion: 2,
        installationId: '30000000-0000-4000-8000-000000000001',
      },
      webkit: {
        messageHandlers: {
          bathosTasksWidget: {
            postMessage: (message: unknown) => messages.push(message),
          },
        },
      },
    });
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const quickEntry = renderShell(
      '/tasks/today?native_new_task=1&native_quick_entry=1',
    );

    try {
      const title = await waitFor(() => {
        const input = document.getElementById(
          `task-title-${NEW_TASK_DRAFT_ID}`,
        ) as HTMLInputElement | null;
        expect(input).toBeTruthy();
        return input!;
      });
      await waitFor(() => {
        expect(messages).toContainEqual({
          type: 'quick-entry-ready',
          schemaVersion: 2,
        });
      });
      title.focus();

      const startEvent = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        title.dispatchEvent(startEvent);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(startEvent.defaultPrevented).toBe(true);
      await waitFor(() => {
        expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();
      });

      const excludedKeys = ['q', 'w', 'a', 's', 'z', 'x', 'b', '1'];
      for (const key of excludedKeys) {
        const event = new KeyboardEvent('keydown', {
          key,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        await act(async () => {
          title.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
      }

      expect(document.getElementById(`task-title-${NEW_TASK_DRAFT_ID}`)).toBe(title);
      expect(quickEntry.container.querySelector('[data-task-editor-region]')).toBeTruthy();
      expect(taskList.createTask).not.toHaveBeenCalled();
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      expect(quickEntry.locations.at(-1)).toBe(
        '/tasks/today?native_quick_entry=1',
      );
    } finally {
      cleanup(quickEntry.root, quickEntry.container);
      Reflect.deleteProperty(window, '__bathosNativeApp');
      Reflect.deleteProperty(window, '__bathosTasksNative');
      Reflect.deleteProperty(window, 'webkit');
    }
  });

  it('persists a native Mac quick-entry draft before opening its checklist editor', async () => {
    Object.assign(window, {
      __bathosNativeApp: {
        schemaVersion: 2,
        moduleId: 'tasks',
        platform: 'macos',
        quickEntryShortcut: '⌃⌥Space',
      },
    });
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const quickEntry = renderShell(
      '/tasks/today?native_new_task=1&native_quick_entry=1',
    );
    const focusRequests: string[] = [];
    const recordFocusRequest = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail?.taskId === 'string') {
        focusRequests.push(event.detail.taskId);
      }
    };
    document.addEventListener('bathos:task-checklist-focus', recordFocusRequest);

    try {
      const title = await waitFor(() => {
        const input = document.getElementById(
          `task-title-${NEW_TASK_DRAFT_ID}`,
        ) as HTMLInputElement | null;
        expect(input).toBeTruthy();
        return input!;
      });
      const addChecklist = quickEntry.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Add Checklist"]',
      )!;

      await act(async () => {
        setInputValue(title, 'Overlay task with checklist');
        addChecklist.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Overlay task with checklist',
      }));
      await waitFor(() => {
        expect(focusRequests).toEqual(['task-draft:new']);
      });
      expect(quickEntry.container.querySelector('[data-task-checklist]')).toBeTruthy();
      expect(quickEntry.container.querySelector(
        'input[aria-label="New Checklist Item"]',
      )).toBeTruthy();
    } finally {
      document.removeEventListener('bathos:task-checklist-focus', recordFocusRequest);
      cleanup(quickEntry.root, quickEntry.container);
      Reflect.deleteProperty(window, '__bathosNativeApp');
    }
  });

  it('creates the temporary quick-entry parent when checklist is requested before Summary', async () => {
    Object.assign(window, {
      __bathosNativeApp: {
        schemaVersion: 2,
        moduleId: 'tasks',
        platform: 'macos',
        quickEntryShortcut: '⌃⌥Space',
      },
    });
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const quickEntry = renderShell(
      '/tasks/today?native_new_task=1&native_quick_entry=1',
    );

    try {
      await waitFor(() => {
        expect(document.getElementById(`task-title-${NEW_TASK_DRAFT_ID}`)).toBeTruthy();
      });
      const addChecklist = quickEntry.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Add Checklist"]',
      )!;

      await act(async () => {
        addChecklist.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: '',
      }));
      expect(document.getElementById(`task-title-${NEW_TASK_DRAFT_ID}`))
        .toHaveValue('');
      await waitFor(() => {
        expect(quickEntry.container.querySelector('[data-task-checklist]')).toBeTruthy();
        expect(quickEntry.container.querySelector(
          'input[aria-label="New Checklist Item"]',
        )).toBeTruthy();
      });
      const actions = quickEntry.container.querySelector('[data-task-quick-entry-actions]');
      expect(actions?.querySelector('button:first-child')).not.toBeDisabled();
      expect(actions?.querySelector('button:last-child')).not.toBeDisabled();
    } finally {
      cleanup(quickEntry.root, quickEntry.container);
      Reflect.deleteProperty(window, '__bathosNativeApp');
    }
  });

  it('finishes native Mac quick entry as committed after saving a titled task', async () => {
    const messages: unknown[] = [];
    const taskList = defaultTaskList();
    Object.assign(window, {
      __bathosNativeApp: {
        schemaVersion: 2,
        moduleId: 'tasks',
        platform: 'macos',
        quickEntryShortcut: '⌃⌥Space',
      },
      __bathosTasksNative: {
        schemaVersion: 2,
        installationId: '30000000-0000-4000-8000-000000000001',
      },
      webkit: {
        messageHandlers: {
          bathosTasksWidget: {
            postMessage: (message: unknown) => messages.push(message),
          },
        },
      },
    });
    mockTaskList.mockReturnValue(taskList);
    const quickEntry = renderShell(
      '/tasks/today?native_new_task=1&native_quick_entry=1',
    );

    try {
      const titleInput = await waitFor(() => {
        const input = document.getElementById(
          `task-title-${NEW_TASK_DRAFT_ID}`,
        ) as HTMLInputElement | null;
        expect(input).toBeTruthy();
        return input!;
      });
      await act(async () => {
        setInputValue(titleInput, 'Captured from anywhere');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });
      expect(taskList.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Captured from anywhere',
      }));

      await act(async () => {
        quickEntry.container.querySelector<HTMLButtonElement>(
          '[data-task-editor-region] [data-bathos-form-submit="true"]',
        )?.click();
      });
      await waitFor(() => {
        expect(messages).toContainEqual({
          type: 'quick-entry-finished',
          schemaVersion: 2,
          committed: true,
        });
      });
    } finally {
      cleanup(quickEntry.root, quickEntry.container);
      Reflect.deleteProperty(window, '__bathosNativeApp');
      Reflect.deleteProperty(window, '__bathosTasksNative');
      Reflect.deleteProperty(window, 'webkit');
    }
  });

  it('finishes an empty native Mac quick-entry draft as cancelled', async () => {
    const messages: unknown[] = [];
    const taskList = defaultTaskList();
    Object.assign(window, {
      __bathosNativeApp: {
        schemaVersion: 2,
        moduleId: 'tasks',
        platform: 'macos',
        quickEntryShortcut: '⌃⌥Space',
      },
      __bathosTasksNative: {
        schemaVersion: 2,
        installationId: '30000000-0000-4000-8000-000000000001',
      },
      webkit: {
        messageHandlers: {
          bathosTasksWidget: {
            postMessage: (message: unknown) => messages.push(message),
          },
        },
      },
    });
    mockTaskList.mockReturnValue(taskList);
    const quickEntry = renderShell(
      '/tasks/today?native_new_task=1&native_quick_entry=1',
    );

    try {
      await waitFor(() => {
        expect(document.getElementById(`task-title-${NEW_TASK_DRAFT_ID}`)).toBeTruthy();
      });
      await act(async () => {
        quickEntry.container.querySelector<HTMLButtonElement>(
          '[data-task-editor-region] [data-bathos-form-cancel="true"]',
        )?.click();
      });
      await waitFor(() => {
        expect(messages).toContainEqual({
          type: 'quick-entry-finished',
          schemaVersion: 2,
          committed: false,
        });
      });
      expect(taskList.createTask).not.toHaveBeenCalled();
    } finally {
      cleanup(quickEntry.root, quickEntry.container);
      Reflect.deleteProperty(window, '__bathosNativeApp');
      Reflect.deleteProperty(window, '__bathosTasksNative');
      Reflect.deleteProperty(window, 'webkit');
    }
  });

  it('deletes a persisted native Mac quick-entry draft when native cancellation is requested', async () => {
    const messages: unknown[] = [];
    const taskList = defaultTaskList();
    Object.assign(window, {
      __bathosNativeApp: {
        schemaVersion: 2,
        moduleId: 'tasks',
        platform: 'macos',
        quickEntryShortcut: '⌃⌥Space',
      },
      __bathosTasksNative: {
        schemaVersion: 2,
        installationId: '30000000-0000-4000-8000-000000000001',
      },
      webkit: {
        messageHandlers: {
          bathosTasksWidget: {
            postMessage: (message: unknown) => messages.push(message),
          },
        },
      },
    });
    mockTaskList.mockReturnValue(taskList);
    const quickEntry = renderShell(
      '/tasks/today?native_new_task=1&native_quick_entry=1',
    );

    try {
      const titleInput = await waitFor(() => {
        const input = document.getElementById(
          `task-title-${NEW_TASK_DRAFT_ID}`,
        ) as HTMLInputElement | null;
        expect(input).toBeTruthy();
        return input!;
      });
      await act(async () => {
        setInputValue(titleInput, 'Discard this capture');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 425));
      });
      expect(taskList.createTask).toHaveBeenCalled();

      const cancelEvent = new CustomEvent(
        'bathos:tasks-native-quick-entry-cancel',
        { cancelable: true },
      );
      await act(async () => {
        window.dispatchEvent(cancelEvent);
      });

      expect(cancelEvent.defaultPrevented).toBe(true);
      await waitFor(() => {
        expect(taskList.transitionTask).toHaveBeenCalledWith(
          'task-created',
          'delete',
        );
        expect(messages).toContainEqual({
          type: 'quick-entry-finished',
          schemaVersion: 2,
          committed: false,
        });
      });
    } finally {
      cleanup(quickEntry.root, quickEntry.container);
      Reflect.deleteProperty(window, '__bathosNativeApp');
      Reflect.deleteProperty(window, '__bathosTasksNative');
      Reflect.deleteProperty(window, 'webkit');
    }
  });

  it('persists the single automatic sorting preference from Settings', async () => {
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

  it('redirects the retired Templates route to Upcoming', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const templates = renderShell('/tasks/templates');
    try {
      expect(templates.container.querySelector<HTMLAnchorElement>(
        '[data-testid="mobile-nav"] a[href="/tasks/upcoming"]',
      )?.getAttribute('aria-current')).toBe('page');
      expect(templates.container.querySelector('[data-task-view-heading]')?.textContent)
        .toBe('Upcoming');
      expect(templates.container.textContent).not.toContain('Templates');
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

  it('routes an Area detail path as part of Settings without exposing task capture', () => {
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

  it('redirects the retired Inbox route to Today and clears Today through Start', async () => {
    const taskList = { ...defaultTaskList(), tasks: [task] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/inbox');

    try {
      await openTaskMenuSurface(container, 'Existing task', 'Start...');
      const clearStart = document.querySelector<HTMLButtonElement>('[data-task-start-clear]');
      await act(async () => {
        clearStart?.click();
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', expect.objectContaining({
        destination: 'anytime',
        today_section: null,
        start_date: null,
      }));
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps a closed task reversibly checked for two seconds before completing it', async () => {
    vi.useFakeTimers();
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      const complete = container.querySelector<HTMLButtonElement>('button[aria-label="Complete Existing task"]');
      complete?.focus();
      await act(async () => {
        complete?.click();
      });

      expect(complete?.closest('article')).toHaveAttribute('data-completion-grace', 'true');
      expect(complete).toHaveAttribute('aria-label', 'Mark Incomplete Existing task');
      expect(complete).toHaveClass('text-success');
      expect(complete?.closest('article')).not.toHaveAttribute('data-terminal-settling');
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_999);
      });
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(complete?.closest('article')).toHaveAttribute('data-terminal-settling', 'true');
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(180);
      });
      expect(complete?.closest('article')).toHaveAttribute('data-terminal-exiting', 'true');
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(220);
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(document.activeElement).toBe(
        container.querySelector('[data-task-view-heading]'),
      );
    } finally {
      vi.useRealTimers();
      cleanup(root, container);
    }
  });

  it('cancels a closed task completion when its checked control is clicked again', async () => {
    vi.useFakeTimers();
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
      expect(complete.closest('article')).toHaveAttribute('data-completion-grace', 'true');
      await act(async () => {
        complete.click();
        await vi.advanceTimersByTimeAsync(2_500);
      });
      expect(complete.closest('article')).not.toHaveAttribute('data-completion-grace');
      expect(complete).toHaveAttribute('aria-label', 'Complete Existing task');
      expect(taskList.transitionTask).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      cleanup(root, container);
    }
  });

  it('anchors a terminal mutation before Safari Command-Z can arrive during exit motion', async () => {
    vi.useFakeTimers();
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
        await vi.advanceTimersByTimeAsync(2_400);
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith(
        'task-a',
        'complete',
        reservation,
      );
    } finally {
      vi.useRealTimers();
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      cleanup(root, container);
    }
  });

  it('restores a failed animated completion and rejects a duplicate terminal action', async () => {
    vi.useFakeTimers();
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
      });
      expect(complete.closest('article')).toHaveAttribute('data-completion-grace', 'true');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      expect(complete.closest('article')).toHaveAttribute('data-terminal-settling', 'true');
      expect(complete.closest('article')).not.toHaveAttribute('data-terminal-exiting');
      expect(taskList.transitionTask).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(180);
      });
      expect(complete.closest('article')).toHaveAttribute('data-terminal-exiting', 'true');
      expect(taskList.transitionTask).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(220);
      });
      await act(async () => {
        await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      });
      expect(taskList.transitionTask).toHaveBeenCalledTimes(1);
      expect(complete.closest('article')).not.toHaveAttribute('data-terminal-exiting');
      expect(document.activeElement).toBe(
        container.querySelector<HTMLElement>('[data-task-row-id="task-a"]'),
      );
      expect(container.querySelector('[data-task-row-id="task-a"]'))
        .toHaveAttribute('aria-current', 'true');
    } finally {
      vi.useRealTimers();
      cleanup(root, container);
    }
  });

  it('skips the decorative completion delay when reduced motion is requested', async () => {
    vi.useFakeTimers();
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
      expect(taskList.transitionTask).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
    } finally {
      vi.useRealTimers();
      window.matchMedia = originalMatchMedia;
      cleanup(root, container);
    }
  });

  it('does not move whole-task focus to another task after pointer completion', async () => {
    vi.useFakeTimers();
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
      const firstRow = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      const secondRow = container.querySelector<HTMLElement>('[data-task-row-id="task-b"]')!;
      const complete = firstRow.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete Existing task"]',
      )!;
      await act(async () => {
        firstRow.focus();
        complete.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          detail: 1,
        }));
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_401);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      expect(secondRow).not.toHaveAttribute('aria-current');
      expect(document.activeElement).not.toBe(secondRow);
      expect(container.querySelector('[data-task-row-id][aria-current="true"]')).toBeNull();
    } finally {
      vi.useRealTimers();
      cleanup(root, container);
    }
  });

  it('moves whole-task focus to the next task after keyboard shortcut completion', async () => {
    vi.useFakeTimers();
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
      const firstRow = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      const secondRow = container.querySelector<HTMLElement>('[data-task-row-id="task-b"]')!;
      await act(async () => {
        firstRow.focus();
        firstRow.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
          cancelable: true,
        }));
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'x',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_401);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(50);
      });

      expect(taskList.transitionTask).toHaveBeenCalledWith('task-a', 'complete');
      expect(secondRow).toHaveAttribute('aria-current', 'true');
      expect(document.activeElement).toBe(secondRow);
    } finally {
      vi.useRealTimers();
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

      expect(taskList.transitionTask.mock.calls.some(
        ([taskId, transition]) => taskId === 'task-a' && transition === 'delete',
      )).toBe(true);
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
      expect(taskList.transitionTask.mock.calls.some(
        ([taskId, transition]) => taskId === 'task-a' && transition === 'delete',
      )).toBe(false);

      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Delete',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(taskList.transitionTask.mock.calls.some(
        ([taskId, transition]) => taskId === 'task-a' && transition === 'delete',
      )).toBe(true);
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
      expect(taskList.transitionTask.mock.calls.some(
        ([taskId, transition]) => taskId === 'task-a' && transition === 'delete',
      )).toBe(true);
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
    const deletionResolvers: Array<() => void> = [];
    const taskList = {
      ...defaultTaskList(),
      tasks: [task, secondTask],
      transitionTask: vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
        deletionResolvers.push(resolve);
      })),
    };
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
      });

      expect(taskList.transitionTask).toHaveBeenCalledTimes(2);
      expect(taskList.transitionTask.mock.calls.map(
        ([taskId, transition]) => [taskId, transition],
      )).toEqual(expect.arrayContaining([
        ['task-a', 'delete'],
        ['task-b', 'delete'],
      ]));
      const operationIds = taskList.transitionTask.mock.calls.map(
        (call) => call[3]?.operationId,
      );
      expect(operationIds[0]).toEqual(expect.any(String));
      expect(operationIds[1]).toBe(operationIds[0]);

      await act(async () => {
        deletionResolvers.forEach((resolve) => resolve());
        await Promise.resolve();
        await Promise.resolve();
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('clears whole-task focus after an actions-menu mutation', async () => {
    const taskList = defaultTaskList();
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await openTaskMenuSubmenu(container, 'Existing task', 'Actionability');
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      )!;
      const action = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent === 'Waiting')!;
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
      const picker = document.querySelector<HTMLElement>(
        '[data-task-row-temporal-picker="start"]',
      )!;
      expect(picker).not.toBeNull();
      await act(async () => {
        picker.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.querySelector('[data-task-row-temporal-picker]')).toBeNull();
      expect(row).not.toHaveAttribute('aria-current');
      expect(document.activeElement).not.toBe(row);
    } finally {
      cleanup(root, container);
    }
  });

  it('does not return focus to a task ellipsis trigger after pointer-outside dismissal', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();

    try {
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Existing task"]',
      )!;
      await act(async () => {
        actions.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.querySelector('[role="menu"]')).not.toBeNull();

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

      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).not.toBe(actions);
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
        'a[aria-label="Open Link for Existing task"]',
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
      expect(firstRow).toHaveClass('rounded-md', 'bg-info/10');
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
      const openPrimaryLink = container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Link"]',
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
      expect(editorTitle).toHaveAttribute('placeholder', 'New Task');
      expect(primaryLink).toHaveAttribute('aria-label', 'Link');
      expect(primaryLink).toHaveAttribute('placeholder', 'Link');
      expect(primaryLink.closest('[data-decorated-control]')?.querySelector(
        '[data-control-decoration] svg',
      )).toHaveClass('lucide-link-2');
      expect(deadline).toHaveTextContent('Deadline');
      expect(start.querySelector('[data-control-decoration] svg')).toBeTruthy();
      expect(deadline.querySelector('[data-control-decoration] svg')).toHaveClass('lucide-flag');
      expect(notes).toHaveClass(
        'border-input',
        'focus:border-ring',
        'focus:ring-ring/65',
      );
      expect(actionability).toHaveAttribute('role', 'combobox');
      expect(organization).toHaveAttribute('role', 'combobox');
      expect(actionability.querySelector('[data-control-decoration] svg'))
        .toHaveClass('lucide-arrow-big-right-dash');
      expect(organization.querySelector('[data-control-decoration] svg'))
        .toHaveClass('lucide-layers');
      expect(actionability).toHaveClass('border-input');
      expect(organization).toHaveClass('border-input');
      expect(Array.from(editor.querySelectorAll<HTMLElement>([
        '#task-notes-task-a',
        '#task-primary-link-task-a',
        '#task-start-task-a',
        '#task-deadline-task-a',
        '#task-actionability-task-a',
        '#task-organization-task-a',
      ].join(','))).map((control) => control.id)).toEqual([
        'task-start-task-a',
        'task-deadline-task-a',
        'task-organization-task-a',
        'task-actionability-task-a',
        'task-notes-task-a',
        'task-primary-link-task-a',
      ]);

      expect(document.activeElement).toBe(editorTitle);
      await tab();
      expect(document.activeElement).toBe(start);
      await tab();
      expect(document.activeElement).toBe(deadline);
      await tab();
      expect(document.activeElement).toBe(organization);
      await tab();
      expect(document.activeElement).toBe(actionability);
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
      await tab(true);
      expect(document.activeElement).toBe(openPrimaryLink);

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

      await act(async () => {
        container.querySelector<HTMLButtonElement>('#task-start-task-a')?.click();
      });
      await waitFor(() => expect(document.querySelector(
        '[data-task-start-picker]',
      )).not.toBeNull());
      const picker = document.querySelector<HTMLElement>(
        '[data-task-start-picker]',
      )!;
      expect(picker).not.toBeNull();
      expect(picker.querySelector('[data-dialog-header]')).toBeNull();
      expect(picker.querySelector('button[aria-label="Close"]')).toBeNull();
      expectInteractiveControlsToHaveNames(picker);
    } finally {
      cleanup(root, container);
    }

    expect(document.body).not.toHaveAttribute('data-tasks-motion-scope');
  });

  it('keeps Quick Find inside a compact named dialog with input-owned selection', async () => {
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
        'input[aria-label="Find Tasks"]',
      )!;
      const resultsListbox = dialog.querySelector<HTMLElement>(
        '[role="listbox"][aria-label="Quick Find Results"]',
      )!;
      expect(dialog).toHaveAccessibleName('Quick Find');
      expect(document.activeElement).toBe(searchInput);
      expectInteractiveControlsToHaveNames(dialog);

      expect(dialog.querySelector('[data-modal-close="true"]')).toBeNull();
      expect(dialog.querySelector('[data-dialog-header]')).toBeNull();
      expect(dialog).toHaveClass('p-2');
      expect(dialog).not.toHaveClass('gap-2');
      expect(searchInput).not.toHaveAttribute('aria-activedescendant');
      expect(dialog).not.toHaveTextContent('See All Results');
      expect(resultsListbox).toHaveClass('mt-2');
      expect(dialog).toHaveTextContent('No matches');
      await act(async () => {
        setInputValue(searchInput, '');
        await Promise.resolve();
      });
      expect(resultsListbox).not.toHaveClass('mt-2');
      expect(dialog).not.toHaveTextContent('No matches');
      await act(async () => {
        setInputValue(searchInput, 'Existing');
        await Promise.resolve();
      });
      expect(resultsListbox).toHaveClass('mt-2');
      expect(dialog).toHaveTextContent('Existing task');
      expect(dialog).toHaveTextContent('See All Results');
      await act(async () => {
        setInputValue(searchInput, 'No matching task exists');
        await Promise.resolve();
      });
      expect(resultsListbox).toHaveClass('mt-2');
      expect(dialog).toHaveTextContent('No matches');
      await act(async () => {
        searchInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', bubbles: true, cancelable: true,
        }));
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
        top: 304,
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
        top: 136,
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
        listbox!.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape',
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
        container.querySelector<HTMLButtonElement>(
          '[data-task-editor-region] [data-bathos-form-cancel="true"]',
        )?.click();
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
          '[data-task-completion-control]',
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
      expect(rowHeader).not.toHaveClass('px-1.5', 'bg-inherit');
      expect(metadata).toHaveClass(
        'gap-x-2.5',
        'leading-4',
        'overflow-hidden',
        'whitespace-nowrap',
        'mt-px',
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
      expect(row).toHaveClass('rounded-md', 'bg-info/10');
      expect(row).not.toHaveClass('bg-popover');
      expect(rowHeader).not.toHaveClass('bg-inherit');
      expect(rowHeader?.parentElement).toHaveClass('bg-inherit');
      const editorRegion = row?.querySelector('[data-task-editor-region]');
      expect(editorRegion).not.toBeNull();
      expect(editorRegion?.parentElement).toHaveClass('bg-inherit');
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
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [{ ...task, primary_link: 'https://example.test/reminder-source' }],
    });
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
      expect(reminderMetadata).toHaveClass('text-muted-foreground');
      expect(reminderMetadata).not.toHaveClass('text-info');
      expect(
        container.querySelector('a[aria-label="Open Link for Existing task"]'),
      ).toHaveClass('text-info');
    } finally {
      cleanup(root, container);
    }
  });

  it('orders optional task-row metadata while omitting redundant Anytime Area labels and Start', () => {
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
        'horizon',
        'reminder',
        'actionability',
        'deadline',
        'notes',
        'checklist',
      ]);
      expect(
        completeMetadata?.querySelector('[data-task-metadata-kind="area"]'),
      ).toBeNull();
      expect(
        completeMetadata?.querySelector('[data-task-metadata-kind="horizon"]'),
      ).toHaveClass('text-task-horizon-next');
      expect(completeMetadata).toHaveTextContent('1:30 PM');
      expect(completeMetadata).toHaveTextContent('5 days');
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

      expect(partialMetadata).toBeNull();

      expect(container.querySelector('[aria-label^="Starts "]')).toBeNull();
      expect(container.querySelector('[data-task-row-metadata] svg.lucide-play')).toBeNull();
      expect(completeMetadata).not.toHaveTextContent('In 2 days');
    } finally {
      cleanup(root, container);
    }
  });

  it('preserves Area metadata on task views that do not use Area buckets', () => {
    const areaTask = taskTodoFixture({
      ...task,
      id: 'task-area-metadata',
      title: 'Area metadata',
      area_id: 'area-home',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [areaTask],
    });
    mockTaskHierarchy.mockReturnValue({
      areas: [taskAreaFixture({ id: 'area-home', title: 'Home' })],
      loading: false,
      error: null,
    });
    const { container, root } = renderShell('/tasks/today');

    try {
      const areaMetadata = container.querySelector(
        '[data-task-id="task-area-metadata"] [data-task-metadata-kind="area"]',
      );
      expect(areaMetadata).toHaveTextContent('Home');
      expect(areaMetadata).not.toHaveClass('text-info');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses compact d offsets and numeric distant dates in mobile Deadline copy while preserving full wording', async () => {
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
    const distantOverdueTask = taskTodoFixture({
      ...task,
      id: 'task-distant-overdue',
      title: 'Distant overdue task',
      start_date: null,
      today_section: null,
      deadline: '2026-07-10',
    });
    const distantFutureTask = taskTodoFixture({
      ...task,
      id: 'task-distant-future',
      title: 'Distant future task',
      start_date: null,
      today_section: null,
      deadline: '2026-07-30',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [
        overdueTask,
        dueTodayTask,
        futureTask,
        distantOverdueTask,
        distantFutureTask,
      ],
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      expect(container.querySelector('[aria-label="Deadline -1 day"]')).toHaveClass('text-destructive');
      expect(container.querySelector('[aria-label="Deadline Today"]')).toHaveClass('text-destructive');
      expect(container.querySelector('[aria-label="Deadline Tomorrow"]')).not.toHaveClass('text-destructive');
      expect(container.querySelector('[aria-label="Deadline -1 day"] [data-task-deadline-compact]'))
        .toHaveTextContent('-1d');
      expect(container.querySelector('[aria-label="Deadline Today"] [data-task-deadline-compact]'))
        .toHaveTextContent('Today');
      expect(container.querySelector('[aria-label="Deadline Tomorrow"] [data-task-deadline-compact]'))
        .toHaveTextContent('1d');
      expect(container.querySelector('[aria-label="Deadline Jul 10"] [data-task-deadline-compact]'))
        .toHaveTextContent('7-10');
      expect(container.querySelector('[aria-label="Deadline Jul 10"] [data-task-deadline-full]'))
        .toHaveTextContent('Jul 10');
      expect(container.querySelector('[aria-label="Deadline Jul 30"] [data-task-deadline-compact]'))
        .toHaveTextContent('7-30');
      expect(container.querySelector('[aria-label="Deadline Jul 30"] [data-task-deadline-full]'))
        .toHaveTextContent('Jul 30');
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
      expect(container.querySelector('[aria-label="Deadline -1 day"] [data-task-deadline-compact]'))
        .toHaveClass('sm:hidden');
      expect(container.querySelector('[aria-label="Deadline -1 day"] [data-task-deadline-full]'))
        .toHaveClass('hidden', 'sm:inline');
      expect(container.querySelector('[aria-label="Deadline -1 day"] [data-task-deadline-full]'))
        .toHaveTextContent('-1 day');
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
      expect(document.querySelector('[data-date-picker-placement="anchored"]'))
        .toHaveAttribute('data-align', 'end');
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

  it('allows selecting a deadline before the current planning date', async () => {
    const datedTask = {
      ...task,
      start_date: '2026-07-20',
      deadline: '2026-07-24',
    };
    const taskList = { ...defaultTaskList(), tasks: [datedTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[data-task-id="task-a"]')?.click();
      });

      await act(async () => {
        container.querySelector<HTMLButtonElement>('#task-deadline-task-a')?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const pastDeadline = document.querySelector<HTMLButtonElement>(
        'button[data-calendar-date="2026-07-18"]',
      );
      expect(pastDeadline).not.toBeDisabled();

      await act(async () => {
        pastDeadline?.click();
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        deadline: '2026-07-18',
      });
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

  it('hides Reminder controls while a task has no Start planning', async () => {
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
        await Promise.resolve();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await Promise.resolve();
      });

      expect(document.querySelector('[data-task-start-reminder-group]')).toBeNull();
      expect(document.querySelector('#task-start-reminder-task-a')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('warns without opening Start when the reminder shortcut targets unplanned work', async () => {
    const unplannedTask = taskTodoFixture({
      ...task,
      destination: 'anytime',
      start_date: null,
      today_section: null,
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [unplannedTask] });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      const row = container.querySelector<HTMLElement>('[data-task-row-id="task-a"]')!;
      row.focus();
      const shortcut = new KeyboardEvent('keydown', {
        key: 'y',
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
      expect(document.querySelector('[data-task-start-picker]')).toBeNull();
      expect(mockToast).toHaveBeenCalledWith({
        description: 'Set a start date before setting a reminder.',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('hides Reminder controls in a Someday task Start picker', async () => {
    const somedayTask = taskTodoFixture({
      ...task,
      destination: 'someday',
      start_date: null,
      today_section: null,
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [somedayTask] });
    const { container, root } = renderShell('/tasks/someday');

    try {
      await openTaskMenuSurface(container, 'Existing task', "Start...");
      expect(document.querySelector('[data-task-start-reminder-group]')).toBeNull();
      expect(document.querySelector('#task-start-reminder-task-a')).toBeNull();
    } finally {
      cleanup(root, container);
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
      const startDecoration = container.querySelector(
        '#task-start-task-a [data-control-decoration]',
      );
      expect(startDecoration?.querySelector('svg')).toHaveClass('lucide-clock-5');
      expect(startDecoration).toHaveClass('text-task-horizon-next');
      expect(startDecoration).not.toHaveClass('text-muted-foreground');
      expect(container.querySelector('#task-deadline-task-a [data-control-decoration] svg'))
        .toHaveClass('lucide-flag');
      const readyDecoration = container.querySelector(
        '#task-actionability-task-a [data-control-decoration]',
      );
      expect(readyDecoration?.querySelector('svg'))
        .toHaveClass('lucide-arrow-big-right-dash');
      expect(readyDecoration).toHaveClass('text-muted-foreground');
      expect(container.querySelector('button[aria-label="Clear Deadline"]')).toBeNull();
      expect(container.querySelector('#task-start-task-a')).toHaveClass(
        'bg-background',
      );
      expect(container.querySelector('#task-deadline-task-a')).toHaveClass(
        'bg-background',
        'text-sm',
      );
      expect(container.querySelector('#task-deadline-task-a')).not.toHaveClass('text-base');
    } finally {
      cleanup(root, container);
    }
  });

  it.each(['waiting', 'rechecking'] as const)(
    'colors the %s decoration purple and an urgent Deadline decoration and value red',
    async (actionability) => {
      const decoratedTask = taskTodoFixture({
        ...task,
        actionability,
        deadline: '2026-07-20',
      });
      mockTaskList.mockReturnValue({
        ...defaultTaskList(),
        tasks: [decoratedTask],
      });
      const { container, root } = renderShell();

      try {
        await act(async () => {
          container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
        });

        const actionabilityDecoration = container.querySelector(
          '#task-actionability-task-a [data-control-decoration]',
        );
        expect(actionabilityDecoration).toHaveClass('text-admin');
        expect(actionabilityDecoration).not.toHaveClass('text-muted-foreground');

        const deadlineTrigger = container.querySelector('#task-deadline-task-a');
        const deadlineDecoration = deadlineTrigger?.querySelector('[data-control-decoration]');
        expect(deadlineTrigger).toHaveClass('text-destructive');
        expect(deadlineDecoration).toHaveClass('text-destructive');
        expect(deadlineDecoration).not.toHaveClass('text-muted-foreground');
      } finally {
        cleanup(root, container);
      }
    },
  );

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
      await waitFor(() => {
        expect(document.activeElement).toBe(
          document.querySelector('[data-task-start-horizon="inbox"]'),
        );
      });
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

  it('advances repeated Control+E focus from the unplanned Inbox fallback to tomorrow', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    const unplannedTask = taskTodoFixture({
      ...task,
      destination: 'anytime',
      start_date: null,
      today_section: null,
    });
    const taskList = { ...defaultTaskList(), tasks: [unplannedTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/anytime');

    const invokeStartCommand = async () => {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'e',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
    };

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });

      await invokeStartCommand();
      expect(document.activeElement).toBe(
        document.querySelector('[data-task-start-horizon="inbox"]'),
      );

      await invokeStartCommand();
      await waitFor(() => {
        expect(document.activeElement).toBe(
          document.querySelector('button[data-calendar-date="2026-07-21"]'),
        );
      });
      expect(taskList.updateTask).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      cleanup(root, container);
    }
  });

  it.each(['inbox', 'now', 'next', 'later'] as const)(
    'advances a Today %s task directly to tomorrow without cycling horizons',
    async (todaySection) => {
      const originalPlatform = navigator.platform;
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: 'MacIntel',
      });
      const todayTask = taskTodoFixture({
        ...task,
        destination: 'anytime',
        start_date: null,
        today_section: todaySection,
      });
      const taskList = { ...defaultTaskList(), tasks: [todayTask] };
      mockTaskList.mockReturnValue(taskList);
      const { container, root } = renderShell('/tasks/today');

      const invokeStartCommand = async () => {
        await act(async () => {
          window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'e',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }));
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        });
      };

      try {
        await act(async () => {
          container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
        });

        await invokeStartCommand();
        await waitFor(() => {
          expect(document.activeElement).toBe(
            document.querySelector(`[data-task-start-horizon="${todaySection}"]`),
          );
        });

        await invokeStartCommand();
        await waitFor(() => {
          expect(document.activeElement).toBe(
            document.querySelector('button[data-calendar-date="2026-07-21"]'),
          );
        });
        expect(taskList.updateTask).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(navigator, 'platform', {
          configurable: true,
          value: originalPlatform,
        });
        cleanup(root, container);
      }
    },
  );

  it('pages repeated Control+E forward while arrow focus stays inside the visible calendar grid', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-31',
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
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'e',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(
        document.querySelector('button[data-calendar-date="2026-07-31"]'),
      );

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'e',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      await waitFor(() => {
        expect(document.querySelector('button[name="caption-month-year"]'))
          .toHaveTextContent('August 2026');
        expect(document.activeElement).toBe(
          document.querySelector('button[data-calendar-date="2026-08-01"]'),
        );
      });

      await act(async () => {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      await waitFor(() => {
        expect(document.querySelector('button[name="caption-month-year"]'))
          .toHaveTextContent('August 2026');
        expect(document.activeElement).toBe(
          document.querySelector('button[data-calendar-date="2026-07-31"]'),
        );
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'e',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      await waitFor(() => {
        expect(document.querySelector('button[name="caption-month-year"]'))
          .toHaveTextContent('August 2026');
        expect(document.activeElement).toBe(
          document.querySelector('button[data-calendar-date="2026-08-01"]'),
        );
      });
      expect(taskList.updateTask).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
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

  it('offers only remaining whole hours from the grouped Reminder control for Today', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T20:54:00.000Z'));
    const todayTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-20',
      today_section: 'next',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [todayTask] });
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
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
      const group = time.closest<HTMLElement>('[data-slot="input-group"]');
      const hourButton = group?.querySelector<HTMLButtonElement>(
        '[data-task-reminder-hour-trigger]',
      );
      expect(group).toBeTruthy();
      expect(hourButton).toBeEnabled();
      expect(hourButton).toHaveClass(
        'border-0',
        'border-l',
        'h-full',
        'w-10',
        'bg-transparent',
        'text-foreground',
      );
      expect(hourButton).not.toHaveClass('hover:bg-muted/35', 'hover:text-foreground');
      expect(hourButton?.querySelector('svg')).toHaveClass('lucide-alarm-clock');

      await user.click(hourButton!);
      await waitFor(() => {
        expect(document.querySelector('[data-task-reminder-hour-menu]')).toBeTruthy();
      });
      expect(Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
        .map((item) => item.textContent?.trim())).toEqual([
        '2:00 pm',
        '3:00 pm',
        '4:00 pm',
        '5:00 pm',
        '6:00 pm',
        '7:00 pm',
        '8:00 pm',
        '9:00 pm',
        '10:00 pm',
        '11:00 pm',
      ]);
      expect(document.querySelector('[data-task-reminder-hour-menu]'))
        .toHaveClass('overflow-y-auto');
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('dismisses the Reminder hour menu without closing Start or the task editor', async () => {
    const user = userEvent.setup();
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-24',
      today_section: null,
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [futureTask] });
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
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
      const hourButton = document.querySelector<HTMLButtonElement>(
        '[data-task-reminder-hour-trigger]',
      )!;

      await user.click(hourButton);
      await waitFor(() => {
        expect(document.querySelector('[data-task-reminder-hour-menu]')).toBeTruthy();
      });
      expect(document.querySelector('[data-task-reminder-hour-menu]'))
        .toHaveAttribute('data-task-editor-owned-surface', 'true');

      await user.click(hourButton);
      await waitFor(() => {
        expect(document.querySelector('[data-task-reminder-hour-menu]')).toBeNull();
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();
      expect(container.querySelector('#task-title-task-a')).toBeTruthy();

      await user.click(hourButton);
      await waitFor(() => {
        expect(document.querySelector('[data-task-reminder-hour-menu]')).toBeTruthy();
      });
      await user.click(time);
      await waitFor(() => {
        expect(document.querySelector('[data-task-reminder-hour-menu]')).toBeNull();
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();
      expect(container.querySelector('#task-title-task-a')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('disables the whole-hour action after 11 pm Today without disabling typed Reminder', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-21T06:00:00.000Z'));
    const todayTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-20',
      today_section: 'next',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [todayTask] });
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
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

      expect(document.querySelector<HTMLInputElement>('#task-start-reminder-task-a'))
        .toBeEnabled();
      const hourButton = document.querySelector<HTMLButtonElement>(
        '[data-task-reminder-hour-trigger]',
      );
      expect(hourButton).toBeDisabled();
      expect(hourButton).toHaveClass(
        'border-l',
        'disabled:bg-transparent',
        'disabled:text-muted-foreground/40',
      );
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('disables the whole-hour action after 11 pm for Today work', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-21T06:00:00.000Z'));
    const unplannedTask = taskTodoFixture({
      ...task,
      start_date: null,
      today_section: 'inbox',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [unplannedTask] });
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), dueItems: [],
      mode: 'connected', planningTimeZone: 'America/Los_Angeles', loading: false,
      error: null, save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a', 'reminder');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });

      expect(document.querySelector<HTMLInputElement>('#task-start-reminder-task-a'))
        .toBeEnabled();
      expect(document.querySelector<HTMLButtonElement>('[data-task-reminder-hour-trigger]'))
        .toBeDisabled();
    } finally {
      cleanup(root, container);
      vi.useRealTimers();
    }
  });

  it('selects a canonical reminder hour without closing Start', async () => {
    const user = userEvent.setup();
    const saveReminder = vi.fn().mockResolvedValue(undefined);
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-24',
      today_section: null,
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [futureTask] });
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
      await user.click(
        document.querySelector<HTMLButtonElement>('[data-task-reminder-hour-trigger]')!,
      );
      const twoPm = await waitFor(() => {
        const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
          .find((candidate) => candidate.textContent?.trim() === '2:00 pm');
        expect(item).toBeTruthy();
        return item!;
      });
      await user.click(twoPm);

      expect(saveReminder).toHaveBeenCalledWith(expect.objectContaining({
        rootType: 'todo',
        rootId: 'task-a',
        localTime: '14:00',
      }));
      expect(document.querySelector<HTMLInputElement>('#task-start-reminder-task-a'))
        .toHaveValue('2:00 pm');
      expect(document.querySelector('[data-task-reminder-hour-menu]')).toBeNull();
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('moves through Reminder clear and hour actions while keeping nested menu keys local', async () => {
    const user = userEvent.setup();
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-24',
      today_section: null,
    });
    const activeReminder = taskReminderFixture({
      root_type: 'todo',
      task_id: 'task-a',
      local_time: '09:00:00',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [futureTask] });
    mockTaskReminders.mockReturnValue({
      reminders: [activeReminder],
      byRootId: new Map([['task-a', activeReminder]]),
      dueItems: [],
      mode: 'connected',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save: vi.fn(),
      cancel: vi.fn(),
      acknowledge: vi.fn(),
      claimDue: vi.fn(),
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
      const hourButton = document.querySelector<HTMLButtonElement>(
        '[data-task-reminder-hour-trigger]',
      )!;
      const clearButton = document.querySelector<HTMLButtonElement>(
        '[data-task-reminder-clear]',
      )!;

      time.setSelectionRange(2, 2);
      await act(async () => {
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(time);

      time.setSelectionRange(time.value.length, time.value.length);
      await act(async () => {
        time.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(clearButton);

      await act(async () => {
        clearButton.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(hourButton);

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(document.querySelector('[data-task-reminder-hour-menu]')).toBeTruthy();
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(document.querySelector('[data-task-reminder-hour-menu]')).toBeNull();
        expect(document.activeElement).toBe(hourButton);
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();

      await act(async () => {
        hourButton.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(clearButton);

      await act(async () => {
        clearButton.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(document.activeElement).toBe(time);
      expect(time.selectionStart).toBe(time.value.length);
      expect(time.selectionEnd).toBe(time.value.length);
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps Shift+horizontal arrows native in Reminder and clears a value inline', async () => {
    const user = userEvent.setup();
    const cancelReminder = vi.fn().mockResolvedValue(undefined);
    const futureTask = taskTodoFixture({
      ...task,
      start_date: '2026-07-24',
      today_section: null,
    });
    const activeReminder = taskReminderFixture({
      root_type: 'todo',
      task_id: 'task-a',
      local_time: '09:00:00',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [futureTask] });
    mockTaskReminders.mockReturnValue({
      reminders: [activeReminder],
      byRootId: new Map([['task-a', activeReminder]]),
      dueItems: [],
      mode: 'connected',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save: vi.fn(),
      cancel: cancelReminder,
      acknowledge: vi.fn(),
      claimDue: vi.fn(),
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
      const clearButton = document.querySelector<HTMLButtonElement>('[data-task-reminder-clear]')!;
      const hourButton = document.querySelector<HTMLButtonElement>('[data-task-reminder-hour-trigger]')!;
      expect(clearButton).toBeTruthy();
      expect(clearButton.compareDocumentPosition(hourButton) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();

      for (const key of ['ArrowLeft', 'ArrowRight']) {
        const selectionEvent = new KeyboardEvent('keydown', {
          key,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        });
        await act(async () => {
          time.focus();
          time.dispatchEvent(selectionEvent);
        });
        expect(selectionEvent.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(time);
      }
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();

      await user.click(clearButton);
      expect(time).toHaveValue('');
      expect(cancelReminder).toHaveBeenCalledWith(activeReminder);
      expect(document.querySelector('[data-task-reminder-clear]')).toBeNull();
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();
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
      ));
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
          container.querySelector('#task-title-task-a'),
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

  it('shows a claimed due reminder as a persistent info toast and retires it on dismissal', async () => {
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
      await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
      expect(container.querySelector('section[aria-label="Due Reminders"]')).toBeNull();
      const reminderToast = mockToast.mock.calls[0][0];
      expect(reminderToast).toEqual(expect.objectContaining({
        description: '9:00 AM: Existing task',
        variant: 'info',
        duration: Number.POSITIVE_INFINITY,
        onOpenChange: expect.any(Function),
      }));
      expect(React.isValidElement(reminderToast.title)).toBe(true);
      const reminderTitle = reminderToast.title as React.ReactElement<{
        children: React.ReactNode[];
      }>;
      expect(reminderTitle.props.children).toContain('Reminder');
      expect((reminderTitle.props.children[0] as React.ReactElement<{ className: string }>)
        .props.className).toContain('h-3 w-3');
      expect(acknowledge).not.toHaveBeenCalled();

      await act(async () => {
        reminderToast.onOpenChange(false);
        await Promise.resolve();
      });
      await waitFor(() => expect(acknowledge).toHaveBeenCalledWith('delivery-a'));
      expect(acknowledge).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('stacks every simultaneously claimed due reminder', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected',
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
      dueItems: [
        {
          delivery_id: 'delivery-a', occurrence_id: 'occurrence-a',
          reminder_id: 'reminder-a', root_type: 'todo', root_id: 'task-a',
          title: 'First task', resolved_at: '2026-07-20T16:00:00Z', attempt_count: 1,
        },
        {
          delivery_id: 'delivery-b', occurrence_id: 'occurrence-b',
          reminder_id: 'reminder-b', root_type: 'todo', root_id: 'task-b',
          title: 'Second task', resolved_at: '2026-07-20T16:00:00Z', attempt_count: 1,
        },
      ],
    });
    const { container, root } = renderShell();

    try {
      await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(2));
      expect(mockToast.mock.calls.map(([configuration]) => configuration.description))
        .toEqual(['9:00 AM: First task', '9:00 AM: Second task']);
    } finally {
      cleanup(root, container);
    }
  });

  it('defers to an active browser notification subscription', async () => {
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected',
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge, claimDue: vi.fn(),
      webPush: { status: 'active' },
      dueItems: [{
        delivery_id: 'delivery-a', occurrence_id: 'occurrence-a',
        reminder_id: 'reminder-a', root_type: 'todo', root_id: 'task-a',
        title: 'Existing task', resolved_at: '2026-07-20T16:00:00Z', attempt_count: 1,
      }],
    });
    const { container, root } = renderShell();

    try {
      await waitFor(() => expect(mockToast).not.toHaveBeenCalled());
      expect(acknowledge).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('falls back to an in-app reminder when browser notifications are blocked', async () => {
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected',
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge, claimDue: vi.fn(),
      webPush: { status: 'denied' },
      dueItems: [{
        delivery_id: 'delivery-blocked', occurrence_id: 'occurrence-blocked',
        reminder_id: 'reminder-blocked', root_type: 'todo', root_id: 'task-a',
        title: 'Blocked browser reminder', resolved_at: '2026-07-20T16:00:00Z',
        attempt_count: 1,
      }],
    });
    const { container, root } = renderShell();

    try {
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        description: '9:00 AM: Blocked browser reminder',
        variant: 'info',
        duration: Number.POSITIVE_INFINITY,
      })));
      expect(acknowledge).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('defers to enabled native notifications', async () => {
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    const nativeWindow = window as Window & {
      __bathosTasksNative?: {
        schemaVersion: number;
        installationId: string;
        notificationsEnabled: boolean;
      };
      webkit?: {
        messageHandlers?: {
          bathosTasksWidget?: { postMessage: (message: unknown) => void };
        };
      };
    };
    nativeWindow.__bathosTasksNative = {
      schemaVersion: 2,
      installationId: '53a4b5c1-3a4e-4fab-a5bf-4c1b114fc690',
      notificationsEnabled: true,
    };
    nativeWindow.webkit = {
      messageHandlers: {
        bathosTasksWidget: { postMessage: vi.fn() },
      },
    };
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected',
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge, claimDue: vi.fn(),
      webPush: { status: 'available' },
      dueItems: [{
        delivery_id: 'delivery-a', occurrence_id: 'occurrence-a',
        reminder_id: 'reminder-a', root_type: 'todo', root_id: 'task-a',
        title: 'Existing task', resolved_at: '2026-07-20T16:00:00Z', attempt_count: 1,
      }],
    });
    const { container, root } = renderShell();

    try {
      await waitFor(() => expect(mockToast).not.toHaveBeenCalled());
      expect(acknowledge).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
      Reflect.deleteProperty(window, '__bathosTasksNative');
      Reflect.deleteProperty(window, 'webkit');
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
      await waitFor(() => expect(mockToast.mock.calls.filter(([configuration]) => (
        configuration.description === '9:00 AM: Existing task'
      ))).toHaveLength(1));
      const reminderToast = mockToast.mock.calls.find(([configuration]) => (
        configuration.description === '9:00 AM: Existing task'
      ))![0];
      expect(acknowledge).not.toHaveBeenCalled();
      await act(async () => {
        reminderToast.onOpenChange(false);
        await Promise.resolve();
      });

      expect(acknowledge).toHaveBeenCalledWith('delivery-a');
      expect(acknowledge).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Reminder Could Not Be Acknowledged',
        description: 'The reminder acknowledgement failed. The reminder remains available to retry.',
        variant: 'destructive',
      });
      await waitFor(() => {
        expect(mockToast.mock.calls.filter(([configuration]) => (
          configuration.description === '9:00 AM: Existing task'
        ))).toHaveLength(2);
      });
      expect(JSON.stringify(mockToast.mock.calls)).not.toContain('provider receipt');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps a failed due-reminder check out of task lists and reports it only on Settings', () => {
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
      expect(container.textContent).toContain('Notifications');
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
      expect(container.textContent).toContain('Notifications');
      expect(container.textContent).not.toContain('provider endpoint');

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

  it('uses a toggle for active browser notifications', async () => {
    const disable = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected', dueItems: [],
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
      webPush: {
        status: 'active', busy: false, error: null,
        enable: vi.fn().mockResolvedValue(undefined), disable,
      },
    });
    const { container, root } = renderShell('/tasks/config');

    try {
      const toggle = container.querySelector<HTMLButtonElement>(
        '[role="switch"][aria-label="Notifications"]',
      );
      expect(toggle).toHaveAttribute('data-state', 'checked');
      await act(async () => toggle?.click());
      expect(disable).toHaveBeenCalledTimes(1);
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps blocked browser notifications explanatory and non-operative', () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    mockTaskReminders.mockReturnValue({
      reminders: [], byRootId: new Map(), mode: 'connected', dueItems: [],
      planningTimeZone: 'America/Los_Angeles', loading: false, error: null,
      save: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), claimDue: vi.fn(),
      webPush: {
        status: 'denied', busy: false, error: null,
        enable: vi.fn().mockResolvedValue(undefined),
        disable: vi.fn().mockResolvedValue(undefined),
      },
    });
    const { container, root } = renderShell('/tasks/config');

    try {
      expect(container.textContent).toContain('Blocked in Browser Settings');
      expect(Array.from(container.querySelectorAll('button'))
        .some((button) => button.textContent === 'Enable')).toBe(false);
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
      const divider = footer?.querySelector('[data-task-start-footer-divider]');
      const reminderInput = document.querySelector<HTMLInputElement>(
        '#task-start-reminder-task-a',
      );
      const todayLayout = document.querySelector('[data-task-start-today-layout]');
      const todayRail = document.querySelector('[data-task-start-today-rail]');
      const reminderGroup = document.querySelector('[data-task-start-reminder-group]');
      const startPicker = document.querySelector('[data-task-start-picker]');
      expect(footer).toHaveClass('relative', 'gap-0');
      expect(divider).toHaveClass(
        'inset-y-2',
        'w-px',
        'bg-[hsl(var(--grid-sticky-line)/0.35)]',
      );
      expect(clear).toBeTruthy();
      expect(someday).toBeTruthy();
      expect(clear?.parentElement).toBe(someday?.parentElement);
      expect(clear).toHaveClass('justify-center');
      expect(someday).toHaveClass('justify-center');
      expect(clear).toHaveClass('h-9');
      expect(someday).toHaveClass('h-9');
      expect(todayLayout).toHaveClass('grid-cols-[1.25rem_minmax(0,1fr)]');
      expect(todayRail).toHaveClass('[writing-mode:vertical-rl]', 'rotate-180');
      expect(reminderGroup).toHaveClass('h-9');
      expect(startPicker).toHaveClass(
        'box-border',
        'w-[276px]',
        'max-w-[calc(100vw-2rem)]',
      );
      expect(reminderInput).toHaveAttribute('placeholder', 'No Reminder');
      expect(reminderInput).toHaveClass('w-full', 'pl-9', 'h-9', 'py-1.5');
      expect(reminderInput?.closest('[data-decorated-control]')?.querySelector(
        '[data-control-decoration] svg',
      )).toHaveClass('lucide-bell');
      expect(document.querySelector(`label[for="${reminderInput?.id}"]`)).toBeNull();

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
      const reopen = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Reopen Existing task"]',
      );
      const row = reopen?.closest<HTMLElement>('article') ?? null;
      const rowHeader = row?.querySelector<HTMLElement>('[data-task-row-header]') ?? null;
      expect(rowHeader).toHaveClass('h-11');
      expect(rowHeader).toHaveClass('pl-1', 'pr-1.5');
      expect(rowHeader).not.toHaveClass('px-1.5');
      expect(row).not.toHaveClass('rounded-md', 'border', 'bg-foreground/[0.05]');
      expect(row?.querySelector('[data-task-title-control]')).toHaveClass('font-normal');
      expect(row?.querySelector('[data-task-title-control]')).not.toHaveClass('font-medium');
      expect(row).toHaveAttribute('tabindex', '0');
      expect(reopen).toHaveClass('text-muted-foreground');
      expect(reopen).not.toHaveClass('text-success');
      expect(reopen?.querySelector('.lucide-trash-2')).toBeNull();
      expect(reopen?.querySelector('.lucide-square-x')).toBeTruthy();
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
      expect(row).toHaveClass('rounded-md', 'bg-info/10');
      expect(row).not.toHaveClass('ring-2', 'ring-inset', 'ring-ring');
      await act(async () => {
        reopen?.click();
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
        expect.any(Function),
      );
      expect(container).toHaveTextContent(
        'Items in Done are permanently deleted after 30 days.',
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('hides independently deleted checklist items from Done while retaining recovery history', () => {
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
      expect(container.textContent).not.toContain('Deleted Checklist Item');
      expect(container.textContent).toContain('Done is empty');
      const restoreButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Restore');
      expect(restoreButton).toBeUndefined();
      expect(restore).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('previews and confirms permanent deletion for an individual task in Done', async () => {
    const deletedTask = {
      ...task,
      disposition: 'deleted' as const,
      deleted_at: '2026-07-20T04:05:00.000Z',
      deletion_root_id: 'task-a',
    };
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [deletedTask] });
    const preview = {
      root: { type: 'todo' as const, id: 'task-a', title: 'Existing task' },
      hierarchy: { todos: ['task-a'], checklist_items: [] },
      related: {
        task_history_events: [],
        hierarchy_history_events: [],
        mail_sources: [],
        mail_source_events: [],
        reminders: [],
        reminder_occurrences: [],
        reminder_deliveries: [],
      },
      preserved_receipts: {
        hierarchy_operations: [],
        recurrence_occurrences: [],
      },
      erased_record_count: 1,
      scope_digest: 'a'.repeat(64),
    };
    const permanentDeletionService = {
      preview: vi.fn().mockResolvedValue(preview),
      execute: vi.fn()
        .mockRejectedValueOnce(new Error('Permanent deletion failed'))
        .mockResolvedValueOnce({ outcome: 'accepted' }),
    };
    mockTasksRuntime.mockReturnValue({
      ...defaultTasksRuntime(),
      mode: 'connected',
      syncState: 'connected',
      permanentDeletionService,
    });
    const { container, root } = renderShell('/tasks/done');

    try {
      const openPermanentDeletion = async () => {
        const actions = container.querySelector<HTMLButtonElement>(
          'button[aria-label="Actions for Existing task"]',
        )!;
        await act(async () => {
          actions.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
          actions.click();
          await Promise.resolve();
        });
        const menuItem = Array.from(
          document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        ).find((item) => item.textContent?.trim() === 'Delete Permanently...')!;
        await act(async () => {
          menuItem.click();
          await Promise.resolve();
        });
        await waitFor(() => expect(permanentDeletionService.preview).toHaveBeenCalledWith(
          'todo',
          'task-a',
        ));
      };

      await openPermanentDeletion();
      expect(document.body).toHaveTextContent('Delete Task Permanently?');
      expect(document.body).toHaveTextContent('This cannot be undone.');
      expect(document.body).toHaveTextContent('1 record will be permanently deleted.');
      const cancel = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Cancel')!;
      await act(async () => {
        cancel.click();
        await Promise.resolve();
      });
      expect(permanentDeletionService.execute).not.toHaveBeenCalled();

      await openPermanentDeletion();
      const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Delete Permanently')!;
      await act(async () => {
        confirm.click();
        await Promise.resolve();
      });
      await waitFor(() => expect(permanentDeletionService.execute).toHaveBeenCalledWith(
        preview,
        'PERMANENTLY DELETE',
      ));
      expect(document.body).toHaveTextContent('Delete Task Permanently?');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Task Could Not Be Permanently Deleted',
        variant: 'destructive',
      }));

      await act(async () => {
        confirm.click();
        await Promise.resolve();
      });
      await waitFor(() => expect(permanentDeletionService.execute).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(container).not.toHaveTextContent('Existing task'));
    } finally {
      cleanup(root, container);
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
      expect(document.querySelector('[data-task-row-temporal-picker="start"]')).not.toBeNull();
      expect(document.querySelector(
        '[data-task-row-temporal-picker="start"] [data-dialog-header]',
      )).toBeNull();
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
    } finally {
      cleanup(root, container);
    }
  });

  it('shows outstanding after-completion recurrence definitions below dated Upcoming work', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-waiting',
      name: 'Water Plants',
      status: 'active',
    });
    const setRecurrenceStatus = vi.fn().mockResolvedValue(undefined);
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
      openOccurrenceByDefinitionId: new Map([[
        definition.id,
        {
          recurrence_id: definition.id,
          root_id: '53a4b5c1-3a4e-4fab-a5bf-4c1b114fc690',
          scheduled_date: '2026-07-20',
          destination: 'anytime',
          today_section: 'inbox',
          start_date: null,
          deadline: null,
        },
      ]]),
      datedPrototypes: [],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      save: vi.fn(),
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: setRecurrenceStatus,
      evaluate: vi.fn(),
    });
    const { container, locations, root } = renderShell('/tasks/upcoming');

    try {
      const waiting = container.querySelector<HTMLElement>(
        '[data-task-waiting-recurrence]',
      );
      expect(container.textContent).toContain('Repeating Tasks');
      expect(waiting).toHaveTextContent('Waiting');
      expect(waiting).toHaveTextContent('Water Plants');
      expect(waiting).not.toHaveAttribute('draggable');
      expect(container.textContent).not.toContain('No upcoming tasks');

      await act(async () => {
        const actions = container.querySelector<HTMLButtonElement>(
          'button[aria-label="Actions for Water Plants"]',
        );
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(
        (item) => item.textContent?.trim(),
      )).toEqual(['Edit Repeat', 'Go to Instance', 'Delete']);
      expect(document.body).toHaveTextContent('Edit Repeat');

      const deletePrototype = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find((item) => item.textContent?.trim() === 'Delete');
      await act(async () => {
        deletePrototype?.click();
        await Promise.resolve();
      });
      expect(setRecurrenceStatus).toHaveBeenCalledWith(definition, 'archived');

      await act(async () => {
        const actions = container.querySelector<HTMLButtonElement>(
          'button[aria-label="Actions for Water Plants"]',
        );
        actions?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
      });
      const goToInstance = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find((item) => item.textContent?.trim() === 'Go to Instance');
      expect(goToInstance).toBeTruthy();
      await act(async () => {
        goToInstance?.click();
        await Promise.resolve();
      });
      expect(locations).toContain(
        '/tasks/today?native_task=53a4b5c1-3a4e-4fab-a5bf-4c1b114fc690',
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('presents a calendar recurrence prototype as an independent Upcoming schedule', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-prototype',
      name: 'Quarterly Review',
      next_occurrence_date: '2026-08-04',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      rule_mode: 'calendar',
      frequency: 'monthly',
      start_date: '2026-08-04',
      date_basis: 'deadline',
      deadline_after_start_days: 3,
      rule_config: { monthly_kind: 'day_of_month', month_day: 1 },
      deadline_offset_days: 3,
      target_area_id: 'area-work',
      prototype_snapshot: {
        version: 2,
        kind: 'todo',
        root: {
          node_id: 'prototype-quarterly-review',
          title: 'Quarterly Review',
          notes: 'Prototype notes',
          primary_link: null,
          actionability: 'rechecking',
          destination: 'anytime',
          today_section: null,
          order_key: 'a0',
          start_offset_days: 0,
          deadline_offset_days: null,
          checklist: [{
            node_id: 'prototype-quarterly-review-checklist',
            title: 'Prepare packet',
            completed: false,
            order_key: '000000001024',
          }],
        },
      },
    });
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-work', title: 'Work' }],
      loading: false,
      error: null,
    });
    const editRecurrence = vi.fn().mockResolvedValue({
      outcome: 'accepted',
      definition: { ...definition, current_revision: 2, record_revision: 2 },
      revision: { ...revision, revision: 2 },
    });
    const setRecurrenceStatus = vi.fn().mockResolvedValue(undefined);
    const ordinaryTask = taskTodoFixture({
      id: 'ordinary-upcoming-task',
      title: 'Ordinary Upcoming Task',
      destination: 'anytime',
      start_date: '2026-08-04',
      today_section: null,
      order_key: 'b0',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [ordinaryTask] });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{
        definition,
        revision,
        scheduledDate: '2026-08-01',
      }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: editRecurrence,
      setStatus: setRecurrenceStatus,
      evaluate: vi.fn(),
    });
    mockTaskDragHandleVisibility.mockReturnValue({
      visibility: 'always',
      loading: false,
      error: null,
      pending: false,
      setVisibility: vi.fn().mockResolvedValue(undefined),
    });
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const row = container.querySelector<HTMLElement>(
        `[data-task-recurrence-prototype="${definition.id}"]`,
      )!;
      expect(row).toHaveTextContent('Quarterly Review');
      expect(row.querySelector('[aria-label="Repeating Schedule"]')).toBeTruthy();
      expect(row.querySelector('[data-task-completion-control]')).toBeNull();
      expect(row).not.toHaveAttribute('draggable');
      expect(row.querySelector('[data-task-drag-handle]')).toHaveAttribute('draggable', 'true');
      expect(row).toHaveAttribute('data-task-row-id', `recurrence:${definition.id}`);
      expect(row.querySelector('[data-task-metadata-kind="area"]')).toHaveTextContent('Work');
      expect(row.querySelector('[data-task-metadata-kind="start"]'))
        .toHaveAccessibleName('Start Aug 1');
      expect(row.querySelector('[data-task-start-compact]')).toHaveTextContent('8-1');
      expect(row.querySelector('[data-task-start-full]')).toHaveTextContent('Aug 1');
      expect(row.querySelector('[data-task-metadata-kind="actionability"]'))
        .toHaveAttribute('aria-label', 'Rechecking');
      expect(row.querySelector('[data-task-metadata-kind="deadline"]'))
        .toHaveAttribute('aria-label', 'Deadline Aug 4');
      expect(row.querySelector('[data-task-deadline-compact]'))
        .toHaveTextContent('8-4');
      expect(row.querySelector('[data-task-deadline-full]'))
        .toHaveTextContent('Aug 4');
      expect(row.querySelector('[data-task-metadata-kind="notes"]')).toBeTruthy();
      expect(row.querySelector('[data-task-metadata-kind="checklist"]')).toBeTruthy();

      const actions = row.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Quarterly Review"]',
      )!;
      const prototypeHandle = row.querySelector<HTMLButtonElement>(
        '[data-task-drag-handle-control]',
      )!;
      expect(actions.closest('[data-task-row-trailing-controls]')).toHaveClass('gap-0.5');
      expect(actions.nextElementSibling).toBe(prototypeHandle);
      await act(async () => {
        actions.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions.click();
      });
      expect(Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(
        (item) => item.textContent?.trim(),
      )).toEqual(['Edit Repeat', 'Delete']);

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
      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).not.toBe(actions);

      await act(async () => {
        actions.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions.click();
      });

      const deletePrototype = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find((item) => item.textContent?.trim() === 'Delete');
      await act(async () => {
        deletePrototype?.click();
        await Promise.resolve();
      });
      expect(setRecurrenceStatus).toHaveBeenCalledWith(definition, 'archived');

      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }));
        row.querySelector<HTMLButtonElement>('button[aria-label="Open Quarterly Review"]')?.click();
      });
      const openingEditor = row.querySelector<HTMLElement>(
        '[data-task-recurrence-prototype-editor]',
      )!;
      expect(openingEditor).toHaveAttribute('data-state', 'opening');
      expect(openingEditor).toHaveClass(
        'grid-rows-[0fr]',
        'pt-0',
        'opacity-0',
        'transition-[grid-template-rows,opacity,padding-top]',
      );
      await waitFor(() => {
        expect(openingEditor).toHaveAttribute('data-state', 'open');
        expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
      });
      const editor = row.querySelector<HTMLElement>('[data-task-recurrence-prototype-editor]')!;
      expect(editor).toHaveClass('grid-rows-[1fr]', 'pt-[6px]', 'opacity-100');
      expect(editor.style.transitionDuration).toBe('220ms');
      expect(editor.querySelector('[data-task-editor-content]')).toHaveClass('min-h-0');
      const prototypeOpenMotionClass = editor.className;
      const prototypeHighlightSurface = row.querySelector<HTMLElement>(
        '[data-task-open-highlight-surface]',
      )!;
      const ordinaryHighlightSurface = container.querySelector<HTMLElement>(
        '[data-task-planning-card][data-task-row-id="ordinary-upcoming-task"] [data-task-open-highlight-surface]',
      )!;
      expect(prototypeHighlightSurface).toHaveClass('bg-inherit');
      expect(prototypeHighlightSurface.className).toBe(ordinaryHighlightSurface.className);
      expect(editor.querySelector('[data-task-metadata-drawer-fields]')).not.toHaveClass('pt-[6px]');
      expect(editor.querySelector('[data-task-editor-form]')).toBeTruthy();
      expect(editor.querySelector('[data-task-checklist]')).toBeTruthy();
      expect(editor.querySelector('input[aria-label="Checklist Item"]')).toHaveClass('h-8');
      const summary = editor.querySelector<HTMLInputElement>('input[aria-label="Summary"]')!;
      expect(summary.value).toBe('Quarterly Review');
      expect(editor.querySelector('button[aria-label="Start"]')).toBeNull();
      expect(editor.querySelector('button[aria-label="Deadline"]')).toBeNull();
      await act(async () => {
        setInputValue(summary, 'Quarterly Review Updated');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 400));
      });
      expect(editRecurrence).toHaveBeenCalledWith(expect.objectContaining({
        ruleMode: revision.rule_mode,
        frequency: revision.frequency,
        nextStartDate: '2026-08-01',
        dateBasis: 'deadline',
        deadlineAfterStartDays: 3,
        prototypeSnapshot: expect.objectContaining({
          root: expect.objectContaining({ title: 'Quarterly Review Updated' }),
        }),
      }));
      expect(editRecurrence.mock.calls.at(-1)?.[0]).not.toHaveProperty('name');

      const prototypeChecklistToggle = editor.querySelector<HTMLButtonElement>(
        'button[aria-label="Complete Prepare packet"]',
      );
      expect(prototypeChecklistToggle).toHaveClass(
        'h-8',
        'w-8',
        'rounded-sm',
        'text-muted-foreground',
      );
      await act(async () => {
        prototypeChecklistToggle?.click();
        await Promise.resolve();
      });
      expect(editRecurrence).toHaveBeenLastCalledWith(expect.objectContaining({
        prototypeSnapshot: expect.objectContaining({
          root: expect.objectContaining({
            checklist: [expect.objectContaining({
              node_id: 'prototype-quarterly-review-checklist',
              title: 'Prepare packet',
              completed: true,
            })],
          }),
        }),
      }));

      await act(async () => {
        const ordinaryRow = container.querySelector<HTMLElement>(
          '[data-task-planning-card][data-task-row-id="ordinary-upcoming-task"]',
        );
        expect(ordinaryRow).toBeTruthy();
        ordinaryRow?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(editor).toHaveAttribute('data-state', 'closing');
      });
      expect(editor).toHaveAttribute('aria-hidden', 'true');
      expect(editor).toHaveAttribute('inert');
      expect(editor).toHaveClass(
        'grid-rows-[0fr]',
        'pt-0',
        'opacity-0',
        'pointer-events-none',
      );
      await waitFor(() => {
        expect(row.querySelector('[data-task-recurrence-prototype-editor]')).toBeNull();
        expect(container.querySelector('[data-task-planning-card][data-task-row-id="ordinary-upcoming-task"] [data-task-editor-form]'))
          .toBeTruthy();
      });
      const ordinaryEditor = container.querySelector<HTMLElement>(
        '[data-task-planning-card][data-task-row-id="ordinary-upcoming-task"] [data-task-editor-region]',
      )!;
      await waitFor(() => expect(ordinaryEditor).toHaveAttribute('data-state', 'open'));
      expect(ordinaryEditor.className).toBe(prototypeOpenMotionClass);
      expect(ordinaryEditor.style.transitionDuration).toBe(editor.style.transitionDuration);

      await act(async () => {
        row.querySelector<HTMLButtonElement>('button[aria-label^="Open Quarterly Review"]')
          ?.click();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(row.querySelector('[data-task-recurrence-prototype-editor]')).toBeTruthy();
        expect(container.querySelector('[data-task-planning-card][data-task-row-id="ordinary-upcoming-task"] [data-task-editor-form]'))
          .toBeNull();
      });

      const reopenedEditor = row.querySelector<HTMLElement>(
        '[data-task-recurrence-prototype-editor]',
      )!;
      const editRepeat = Array.from(reopenedEditor.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Edit Repeat...')!;
      await act(async () => editRepeat.click());
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog).toHaveTextContent('Edit Repeat');
      expect(dialog.querySelector('input[aria-label="Summary"]')).toBeNull();
      expect(dialog.querySelector('input[aria-label="Link"]')).toBeNull();
      expect(dialog.querySelector('[aria-label="Checklist"]')).toBeNull();
    } finally {
      scrollBy.mockRestore();
      cleanup(root, container);
      vi.unstubAllGlobals();
    }
  });

  it('replaces an open recurrence prototype with another from one title click', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const firstDefinition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-first-open',
      name: 'First Repeat',
      next_occurrence_date: '2026-08-01',
      upcoming_order_key: 'a0',
    });
    const secondDefinition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-second-open',
      name: 'Second Repeat',
      next_occurrence_date: '2026-08-01',
      upcoming_order_key: 'b0',
    });
    const firstRevision = taskRecurrenceRevisionFixture({
      recurrence_id: firstDefinition.id,
      start_date: '2026-08-01',
      prototype_snapshot: {
        version: 2,
        kind: 'todo',
        root: {
          node_id: 'first-repeat-root',
          title: 'First Repeat',
          notes: '',
          primary_link: null,
          actionability: 'ready',
          destination: 'anytime',
          today_section: null,
          order_key: 'a0',
          start_offset_days: 0,
          deadline_offset_days: null,
          checklist: [],
        },
      },
    });
    const secondRevision = taskRecurrenceRevisionFixture({
      recurrence_id: secondDefinition.id,
      start_date: '2026-08-01',
      prototype_snapshot: {
        version: 2,
        kind: 'todo',
        root: {
          node_id: 'second-repeat-root',
          title: 'Second Repeat',
          notes: '',
          primary_link: null,
          actionability: 'ready',
          destination: 'anytime',
          today_section: null,
          order_key: 'b0',
          start_offset_days: 0,
          deadline_offset_days: null,
          checklist: [],
        },
      },
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [] });
    mockTaskRecurrences.mockReturnValue({
      definitions: [firstDefinition, secondDefinition],
      revisions: new Map([
        [firstDefinition.id, firstRevision],
        [secondDefinition.id, secondRevision],
      ]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [
        { definition: firstDefinition, revision: firstRevision, scheduledDate: '2026-08-01' },
        { definition: secondDefinition, revision: secondRevision, scheduledDate: '2026-08-01' },
      ],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: vi.fn().mockResolvedValue(undefined),
      setStatus: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const firstRow = container.querySelector<HTMLElement>(
        `[data-task-recurrence-prototype="${firstDefinition.id}"]`,
      )!;
      const secondRow = container.querySelector<HTMLElement>(
        `[data-task-recurrence-prototype="${secondDefinition.id}"]`,
      )!;
      const firstTitle = firstRow.querySelector<HTMLButtonElement>('[data-task-title-control]')!;
      const secondTitle = secondRow.querySelector<HTMLButtonElement>('[data-task-title-control]')!;

      await act(async () => firstTitle.click());
      await waitFor(() => {
        expect(firstRow.querySelector('[data-task-recurrence-prototype-editor]')).toBeTruthy();
      });

      await act(async () => {
        secondTitle.dispatchEvent(new MouseEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
        }));
        secondTitle.click();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(firstRow.querySelector('[data-task-recurrence-prototype-editor]')).toBeNull();
        expect(secondRow.querySelector('[data-task-recurrence-prototype-editor]')).toBeTruthy();
      });
    } finally {
      cleanup(root, container);
      vi.unstubAllGlobals();
    }
  });

  it('reorders an Upcoming recurrence prototype among ordinary tasks in the same date bucket', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-reorder',
      name: 'Repeat Beside Task',
      next_occurrence_date: '2026-08-01',
      upcoming_order_key: 'a0',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      start_date: '2026-08-01',
    });
    const ordinaryTask = taskTodoFixture({
      id: 'task-beside-repeat',
      title: 'Ordinary Beside Repeat',
      start_date: '2026-08-01',
      today_section: null,
      upcoming_order_key: 'a1',
    });
    const reorderProjection = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [ordinaryTask] });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{ definition, revision, scheduledDate: '2026-08-01' }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
      reorderProjection,
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const source = container.querySelector<HTMLElement>(
        `[data-task-recurrence-prototype="${definition.id}"]`,
      )!;
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]')!;
      const target = container.querySelector<HTMLElement>(
        `[data-task-row-id="${ordinaryTask.id}"]`,
      )!;
      const dropSurface = container.querySelector<HTMLElement>('[data-task-module-drop-surface]')!;
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
        sourceHandle.dispatchEvent(dragStart);
        target.dispatchEvent(dragOver);
        dropSurface.dispatchEvent(drop);
        await Promise.resolve();
      });

      expect(reorderProjection).toHaveBeenCalledWith(definition, expect.any(String));
      expect(reorderProjection.mock.calls[0][1]).not.toBe(definition.upcoming_order_key);
    } finally {
      cleanup(root, container);
    }
  });

  it('groups mixed month rows by effective Start before applying Upcoming rank', () => {
    const earlyDefinition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-month-early',
      name: 'Early Repeat',
      next_occurrence_date: '2026-08-10',
      upcoming_order_key: 'a0',
    });
    const lateDefinition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-month-late',
      name: 'Late Repeat',
      next_occurrence_date: '2026-08-20',
      upcoming_order_key: 'a0',
    });
    const earlyRevision = taskRecurrenceRevisionFixture({
      recurrence_id: earlyDefinition.id,
      start_date: '2026-08-10',
    });
    const lateRevision = taskRecurrenceRevisionFixture({
      recurrence_id: lateDefinition.id,
      start_date: '2026-08-20',
    });
    const earlyTask = taskTodoFixture({
      id: 'task-month-early',
      title: 'Early Task',
      start_date: '2026-08-10',
      today_section: null,
      upcoming_order_key: 'a1',
    });
    const lateDeadlineOnlyTask = taskTodoFixture({
      id: 'task-month-late',
      title: 'Late Deadline Task',
      start_date: null,
      deadline: '2026-08-20',
      today_section: null,
      upcoming_order_key: 'a1',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [lateDeadlineOnlyTask, earlyTask],
    });
    mockTaskRecurrences.mockReturnValue({
      definitions: [lateDefinition, earlyDefinition],
      revisions: new Map([
        [earlyDefinition.id, earlyRevision],
        [lateDefinition.id, lateRevision],
      ]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [
        { definition: lateDefinition, revision: lateRevision, scheduledDate: '2026-08-20' },
        { definition: earlyDefinition, revision: earlyRevision, scheduledDate: '2026-08-10' },
      ],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
      reorderProjection: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const augustSection = container.querySelector(
        '[aria-labelledby="tasks-month-2026-08-heading"] [data-task-planning-list]',
      );
      expect(Array.from(
        augustSection?.querySelectorAll<HTMLElement>(':scope > [data-task-row-id]') ?? [],
        (row) => row.dataset.taskRowId,
      )).toEqual([
        `recurrence:${earlyDefinition.id}`,
        earlyTask.id,
        `recurrence:${lateDefinition.id}`,
        lateDeadlineOnlyTask.id,
      ]);
    } finally {
      cleanup(root, container);
    }
  });

  it('selects dated recurrence prototypes with task gestures and toggles the active lasso', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-selection',
      name: 'Selectable Repeat',
      next_occurrence_date: '2026-08-01',
      upcoming_order_key: 'a1',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      start_date: '2026-08-01',
    });
    const firstTask = taskTodoFixture({
      id: 'selection-task-first',
      title: 'First Selection Task',
      start_date: '2026-08-01',
      upcoming_order_key: 'a0',
    });
    const lastTask = taskTodoFixture({
      id: 'selection-task-last',
      title: 'Last Selection Task',
      start_date: '2026-08-01',
      upcoming_order_key: 'a2',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [firstTask, lastTask] });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{ definition, revision, scheduledDate: '2026-08-01' }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
      reorderProjection: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const prototypeTitle = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Open Selectable Repeat"]',
      )!;
      const contextMenu = new MouseEvent('contextmenu', {
        ctrlKey: true,
        button: 2,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        prototypeTitle.dispatchEvent(new MouseEvent('mousedown', {
          ctrlKey: true,
          button: 0,
          bubbles: true,
          cancelable: true,
        }));
        prototypeTitle.dispatchEvent(new MouseEvent('click', {
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        prototypeTitle.dispatchEvent(contextMenu);
        await Promise.resolve();
      });
      expect(contextMenu.defaultPrevented).toBe(true);
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '1 Task',
      );
      expect(container.querySelector('[aria-label="Deselect Selectable Repeat"]'))
        .toHaveAttribute('aria-checked', 'true');
      expect(container.querySelector('button[aria-label="Actions for Selectable Repeat"]'))
        .toBeNull();

      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="selection-task-last"]')
          ?.dispatchEvent(new MouseEvent('click', {
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          }));
        await Promise.resolve();
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toHaveTextContent(
        '2 Tasks',
      );

      const lasso = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Select Tasks"]',
      )!;
      expect(lasso).toHaveAttribute('aria-pressed', 'true');
      await act(async () => {
        lasso.dispatchEvent(new MouseEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
        }));
        lasso.click();
        await Promise.resolve();
      });
      expect(container.querySelector('[aria-label="Task Selection"]')).toBeNull();
      expect(lasso).toHaveAttribute('aria-pressed', 'false');
      expect(container.querySelector('button[aria-label="Actions for Selectable Repeat"]'))
        .toBeTruthy();

      await act(async () => {
        lasso.click();
        await Promise.resolve();
      });
      const toolbar = container.querySelector<HTMLElement>('[aria-label="Task Selection"]')!;
      await act(async () => {
        Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
          .find(({ textContent }) => textContent === 'Select All')
          ?.click();
      });
      expect(toolbar).toHaveTextContent('3 Tasks');
      expect(
        Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
          .find(({ textContent }) => textContent === 'Edit...'),
      ).not.toBeDisabled();
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      cleanup(root, container);
    }
  });

  it('applies shared bulk edits and Delete to mixed Upcoming task and prototype selections', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-mixed-edit',
      name: 'Mixed Edit Repeat',
      next_occurrence_date: '2026-08-01',
      upcoming_order_key: 'a1',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      start_date: '2026-08-01',
    });
    const ordinaryTask = taskTodoFixture({
      id: 'mixed-edit-task',
      title: 'Mixed Edit Task',
      start_date: '2026-08-01',
      upcoming_order_key: 'a0',
    });
    const taskList = { ...defaultTaskList(), tasks: [ordinaryTask] };
    const editRecurrence = vi.fn().mockResolvedValue({
      outcome: 'accepted',
      definition,
      revision,
    });
    const setRecurrenceStatus = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(taskList);
    mockTaskHierarchy.mockReturnValue({
      areas: [{ id: 'area-house', title: 'House' }],
      loading: false,
      error: null,
    });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{ definition, revision, scheduledDate: '2026-08-01' }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: editRecurrence,
      setStatus: setRecurrenceStatus,
      evaluate: vi.fn(),
      reorderProjection: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    const openBulkEdit = async () => {
      const edit = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Edit...')!;
      await act(async () => {
        edit.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        edit.click();
        await Promise.resolve();
      });
    };
    const openSubmenu = async (label: string) => {
      const trigger = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find(({ textContent }) => textContent?.trim() === label)!;
      expect(trigger).not.toHaveAttribute('data-disabled');
      await act(async () => {
        trigger.focus();
        trigger.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
    };

    try {
      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="mixed-edit-task"]')
          ?.dispatchEvent(new MouseEvent('click', {
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }));
        await Promise.resolve();
      });
      await act(async () => {
        container.querySelector<HTMLElement>('button[aria-label="Open Mixed Edit Repeat"]')
          ?.dispatchEvent(new MouseEvent('click', {
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }));
        await Promise.resolve();
      });

      const toolbar = container.querySelector<HTMLElement>('[aria-label="Task Selection"]')!;
      expect(toolbar).toHaveTextContent('2 Tasks');
      const edit = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button'))
        .find(({ textContent }) => textContent === 'Edit...')!;
      expect(edit).not.toBeDisabled();

      await openBulkEdit();
      let menuItems = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      expect(menuItems.map(({ textContent }) => textContent?.trim())).toEqual(
        expect.arrayContaining(['Area', 'Actionability', 'Delete']),
      );
      expect(menuItems.some(({ textContent }) => textContent?.trim() === 'Start...')).toBe(false);
      expect(menuItems.some(({ textContent }) => textContent?.trim() === 'Deadline...')).toBe(false);

      await openSubmenu('Area');
      const house = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find(({ textContent }) => textContent?.trim() === 'House')!;
      await act(async () => {
        house.click();
        await Promise.resolve();
      });
      expect(taskList.applyTaskPatches).toHaveBeenCalledWith([
        { taskId: ordinaryTask.id, patch: { area_id: 'area-house' } },
      ]);
      expect(editRecurrence).toHaveBeenCalledWith(expect.objectContaining({
        definition,
        revision,
        targetAreaId: 'area-house',
      }));
      expect(toolbar).toHaveTextContent('2 Tasks');

      await openBulkEdit();
      await openSubmenu('Actionability');
      const waiting = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find(({ textContent }) => textContent?.trim() === 'Waiting')!;
      await act(async () => {
        waiting.click();
        await Promise.resolve();
      });
      expect(taskList.applyTaskPatches).toHaveBeenLastCalledWith([
        { taskId: ordinaryTask.id, patch: { actionability: 'waiting' } },
      ]);
      expect(editRecurrence).toHaveBeenLastCalledWith(expect.objectContaining({
        prototypeSnapshot: expect.objectContaining({
          root: expect.objectContaining({ actionability: 'waiting' }),
        }),
      }));

      await openBulkEdit();
      menuItems = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      const deleteSelection = menuItems.find(
        ({ textContent }) => textContent?.trim() === 'Delete',
      )!;
      await act(async () => {
        deleteSelection.click();
        await Promise.resolve();
      });
      await waitFor(() => expect(taskList.transitionTask).toHaveBeenCalledWith(
        ordinaryTask.id,
        'delete',
        undefined,
        { operationId: expect.any(String) },
      ));
      expect(setRecurrenceStatus).toHaveBeenCalledWith(definition, 'archived');
    } finally {
      cleanup(root, container);
    }
  });

  it('drags selected tasks and prototypes together while keeping prototypes in their scheduled day', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-group-drag',
      name: 'Grouped Repeat',
      next_occurrence_date: '2026-08-01',
      upcoming_order_key: 'a1',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      start_date: '2026-08-01',
    });
    const selectedTask = taskTodoFixture({
      id: 'group-drag-task',
      title: 'Grouped Task',
      start_date: '2026-08-01',
      upcoming_order_key: 'a0',
    });
    const sameDayTarget = taskTodoFixture({
      id: 'same-day-target',
      title: 'Same Day Target',
      start_date: '2026-08-01',
      upcoming_order_key: 'a2',
    });
    const otherDayTarget = taskTodoFixture({
      id: 'other-day-target',
      title: 'Other Day Target',
      start_date: '2026-09-01',
      upcoming_order_key: 'a0',
    });
    const taskList = {
      ...defaultTaskList(),
      tasks: [selectedTask, sameDayTarget, otherDayTarget],
    };
    const reorderProjection = vi.fn().mockResolvedValue(undefined);
    mockTaskList.mockReturnValue(taskList);
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{ definition, revision, scheduledDate: '2026-08-01' }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
      reorderProjection,
    });
    const { container, root } = renderShell('/tasks/upcoming');
    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => ''),
    } as unknown as DataTransfer;
    const dispatchDrop = async (target: HTMLElement, sourceSelector: string) => {
      const source = container.querySelector<HTMLElement>(sourceSelector)!;
      const dropSurface = container.querySelector<HTMLElement>(
        '[data-task-module-drop-surface]',
      )!;
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
        source.dispatchEvent(dragStart);
        target.dispatchEvent(dragOver);
        dropSurface.dispatchEvent(drop);
        await Promise.resolve();
      });
    };

    try {
      await act(async () => {
        container.querySelector<HTMLElement>('[data-task-id="group-drag-task"]')
          ?.dispatchEvent(new MouseEvent('click', {
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }));
        await Promise.resolve();
      });
      await act(async () => {
        container.querySelector<HTMLElement>('button[aria-label="Open Grouped Repeat"]')
          ?.dispatchEvent(new MouseEvent('click', {
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }));
        await Promise.resolve();
      });

      await dispatchDrop(container.querySelector<HTMLElement>(
        `[data-task-row-id="${sameDayTarget.id}"]`,
      )!, `[data-task-recurrence-prototype="${definition.id}"] [data-task-drag-handle]`);
      expect(taskList.applyTaskPatches).toHaveBeenCalledWith([
        expect.objectContaining({
          taskId: selectedTask.id,
          patch: expect.objectContaining({ upcoming_order_key: expect.any(String) }),
        }),
      ]);
      expect(reorderProjection).toHaveBeenCalledWith(definition, expect.any(String));

      taskList.applyTaskPatches.mockClear();
      taskList.updateTask.mockClear();
      reorderProjection.mockClear();
      await dispatchDrop(container.querySelector<HTMLElement>(
        `[data-task-row-id="${otherDayTarget.id}"]`,
      )!, `[data-task-row-id="${selectedTask.id}"] [data-task-drag-handle]`);
      expect(taskList.updateTask).toHaveBeenCalledWith(
        selectedTask.id,
        expect.objectContaining({
          start_date: '2026-09-01',
          destination: 'anytime',
        }),
      );
      expect(reorderProjection).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps a recurrence prototype visible and reports a failed Delete action', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-delete-failure',
      name: 'Retained Repetition',
      next_occurrence_date: '2026-08-04',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      start_date: '2026-08-04',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [] });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{ definition, revision, scheduledDate: '2026-08-04' }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn().mockRejectedValue(new Error('write failed')),
      evaluate: vi.fn(),
      reorderProjection: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const actions = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Actions for Retained Repetition"]',
      )!;
      await act(async () => {
        actions.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions.click();
        await Promise.resolve();
      });
      const deletePrototype = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find((item) => item.textContent?.trim() === 'Delete');
      await act(async () => {
        deletePrototype?.click();
        await Promise.resolve();
      });

      await waitFor(() => expect(mockToast).toHaveBeenCalledWith({
        title: 'Repeating Task Could Not Be Deleted',
        description: 'write failed',
        variant: 'destructive',
      }));
      expect(container.querySelector(
        `[data-task-recurrence-prototype="${definition.id}"]`,
      )).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('uses recurrence prototypes as Upcoming section-edge reorder targets', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-edge-target',
      name: 'Edge Target',
      next_occurrence_date: '2026-08-01',
      upcoming_order_key: 'a1',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      start_date: '2026-08-01',
    });
    const ordinaryTask = taskTodoFixture({
      id: 'task-edge-source',
      title: 'Edge Source',
      start_date: '2026-08-01',
      today_section: null,
      upcoming_order_key: 'a0',
    });
    const taskList = { ...defaultTaskList(), tasks: [ordinaryTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{ definition, revision, scheduledDate: '2026-08-01' }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
      reorderProjection: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const source = container.querySelector<HTMLElement>(
        `[data-task-row-id="${ordinaryTask.id}"]`,
      )!;
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]')!;
      const section = container.querySelector<HTMLElement>('[data-task-upcoming-section]')!;
      const dropSurface = container.querySelector<HTMLElement>('[data-task-module-drop-surface]')!;
      const dataTransfer = {
        effectAllowed: 'none', dropEffect: 'none', setData: vi.fn(), getData: vi.fn(() => ''),
      } as unknown as DataTransfer;
      vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
        top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100,
        x: 0, y: 0, toJSON: () => ({}),
      });
      const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
      Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer });
      const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperties(dragOver, {
        dataTransfer: { value: dataTransfer },
        clientY: { value: 90 },
      });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });

      await act(async () => {
        sourceHandle.dispatchEvent(dragStart);
        section.dispatchEvent(dragOver);
        dropSurface.dispatchEvent(drop);
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith(
        ordinaryTask.id,
        { upcoming_order_key: expect.any(String) },
      );
      expect(
        taskList.updateTask.mock.calls[0][1].upcoming_order_key.localeCompare(
          definition.upcoming_order_key ?? '',
        ),
      ).toBeGreaterThan(0);
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps a cross-section ordinary drop positioned around its prototype target', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-cross-section-target',
      name: 'August Prototype',
      next_occurrence_date: '2026-08-01',
      upcoming_order_key: 'a1',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      start_date: '2026-08-01',
    });
    const ordinaryTask = taskTodoFixture({
      id: 'task-cross-section-source',
      title: 'Tomorrow Task',
      start_date: '2026-07-21',
      today_section: null,
      upcoming_order_key: 'a0',
    });
    const taskList = { ...defaultTaskList(), tasks: [ordinaryTask] };
    mockTaskList.mockReturnValue(taskList);
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{ definition, revision, scheduledDate: '2026-08-01' }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected', loading: false, error: null,
      createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn(), evaluate: vi.fn(),
      reorderProjection: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const source = container.querySelector<HTMLElement>(
        `[data-task-row-id="${ordinaryTask.id}"]`,
      )!;
      const sourceHandle = source.querySelector<HTMLElement>('[data-task-drag-handle]')!;
      const target = container.querySelector<HTMLElement>(
        `[data-task-recurrence-prototype="${definition.id}"]`,
      )!;
      const dropSurface = container.querySelector<HTMLElement>('[data-task-module-drop-surface]')!;
      const dataTransfer = {
        effectAllowed: 'none', dropEffect: 'none', setData: vi.fn(), getData: vi.fn(() => ''),
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
        clientY: { value: 25 },
      });
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });

      await act(async () => {
        sourceHandle.dispatchEvent(dragStart);
        target.dispatchEvent(dragOver);
        dropSurface.dispatchEvent(drop);
        await Promise.resolve();
      });

      expect(taskList.updateTask).toHaveBeenCalledWith(
        ordinaryTask.id,
        expect.objectContaining({
          destination: 'anytime',
          start_date: '2026-08-01',
          today_section: null,
          upcoming_order_key: expect.any(String),
        }),
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('uses the same stable identity tie-breaker to render mixed Upcoming rows', () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-tied-order',
      name: 'Tied Prototype',
      next_occurrence_date: '2026-08-01',
      upcoming_order_key: 'a0',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      start_date: '2026-08-01',
    });
    const ordinaryTask = taskTodoFixture({
      id: 'task-tied-order',
      title: 'Tied Task',
      start_date: '2026-08-01',
      today_section: null,
      upcoming_order_key: 'a0',
    });
    mockTaskList.mockReturnValue({ ...defaultTaskList(), tasks: [ordinaryTask] });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [], openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{ definition, revision, scheduledDate: '2026-08-01' }],
      evaluationFailures: new Set(), planningDate: '2026-07-20',
      mode: 'connected', loading: false, error: null,
      createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn(), evaluate: vi.fn(),
      reorderProjection: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const rowIds = Array.from(container.querySelectorAll<HTMLElement>(
        '[data-task-planning-list] > [data-task-row-id]',
      )).map((row) => row.dataset.taskRowId);
      expect(rowIds).toEqual([
        `recurrence:${definition.id}`,
        ordinaryTask.id,
      ]);
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps a deferred recurrence instance ordinary while its prototype advances independently', () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-independent',
      name: 'Exercise',
      next_occurrence_date: '2026-08-08',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      prototype_snapshot: {
        version: 2,
        kind: 'todo',
        root: {
          node_id: 'prototype-exercise',
          title: 'Exercise',
          notes: '',
          primary_link: null,
          actionability: 'actionable',
          destination: 'anytime',
          today_section: 'inbox',
          order_key: 'a0',
          start_offset_days: 0,
          deadline_offset_days: null,
          checklist: [],
        },
      },
    });
    const deferredInstance = taskTodoFixture({
      id: 'task-exercise-instance',
      title: 'Exercise',
      start_date: '2026-08-01',
      today_section: null,
      recurrence_definition_id: definition.id,
      recurrence_revision: revision.revision,
      recurrence_occurrence_id: 'occurrence-exercise',
      recurrence_logical_key: 'calendar:2026-07-31',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [deferredInstance],
    });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [{
        definition,
        revision,
        scheduledDate: '2026-08-08',
      }],
      evaluationFailures: new Set(),
      planningDate: '2026-07-31',
      mode: 'connected',
      loading: false,
      error: null,
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const instanceRow = container.querySelector<HTMLElement>(
        '[data-task-row-id="task-exercise-instance"]',
      )!;
      const prototypeRow = container.querySelector<HTMLElement>(
        `[data-task-recurrence-prototype="${definition.id}"]`,
      )!;
      expect(instanceRow).toBeTruthy();
      expect(instanceRow.querySelector('[data-task-completion-control]')).toBeTruthy();
      expect(instanceRow.querySelector('[data-task-drag-handle]')).toBeTruthy();
      expect(prototypeRow).toBeTruthy();
      expect(prototypeRow.querySelector('[data-task-completion-control]')).toBeNull();
      expect(instanceRow.querySelector('[data-task-title-control]')).toBeTruthy();
      expect(prototypeRow.querySelector(
        'button[aria-label="Open Exercise"]',
      )).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('restores a deleted recurrence instance as an ordinary editable task', async () => {
    const deletedInstance = taskTodoFixture({
      id: 'task-deleted-prototype',
      title: 'Retained Prototype',
      lifecycle: 'open',
      disposition: 'deleted',
      deleted_at: '2026-07-20T08:00:00.000Z',
      recurrence_definition_id: 'recurrence-deleted-prototype',
      recurrence_revision: 2,
      recurrence_occurrence_id: 'occurrence-deleted-prototype',
      recurrence_logical_key: 'calendar:2026-08-01',
    });
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-deleted-prototype',
      name: deletedInstance.title,
      status: 'paused',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      revision: 2,
    });
    const taskList = {
      ...defaultTaskList(),
      tasks: [deletedInstance],
    };
    mockTaskList.mockReturnValue(taskList);
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set(),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      save: vi.fn(),
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/done');

    try {
      const row = container.querySelector<HTMLElement>(
        `[data-task-row-id="${deletedInstance.id}"]`,
      )!;
      await act(async () => {
        row.querySelector<HTMLButtonElement>('[data-task-title-control]')?.click();
      });
      expect(row.querySelector('[data-task-editor-region]')).toBeTruthy();
      expect(row.querySelector('[data-task-editor-temporal-grid]')).toBeTruthy();

      await act(async () => {
        row.querySelector<HTMLButtonElement>('[data-bathos-form-submit]')?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
      });

      const closedRow = container.querySelector<HTMLElement>(
        `[data-task-row-id="${deletedInstance.id}"]`,
      )!;
      const actions = closedRow.querySelector<HTMLButtonElement>(
        `button[aria-label="Actions for ${deletedInstance.title}"]`,
      )!;
      await act(async () => {
        actions.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actions.click();
        await Promise.resolve();
      });
      const menuItems = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      );
      expect(menuItems.map((item) => item.textContent?.trim()))
        .toEqual(expect.arrayContaining(['Area', 'Actionability', 'Reopen']));
      expect(menuItems.some((item) => item.textContent?.trim() === 'Edit Repeat')).toBe(false);
      expect(menuItems.some((item) => item.textContent?.trim() === 'Delete')).toBe(false);
      const reopen = menuItems.find((item) => item.textContent?.trim() === 'Reopen')!;
      await act(async () => {
        reopen.click();
      });
      await waitFor(() => expect(taskList.transitionTask).toHaveBeenCalledWith(
        deletedInstance.id,
        'restore',
        undefined,
      ));
    } finally {
      cleanup(root, container);
    }
  });

  it('presents a reached recurrence occurrence as an ordinary editable Upcoming task', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-reached',
      name: 'Reached Recurrence',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      rule_mode: 'calendar',
    });
    const reachedInstance = taskTodoFixture({
      id: 'task-recurrence-reached',
      title: 'Reached Recurrence Instance',
      start_date: '2026-07-20',
      deadline: '2026-07-25',
      today_section: 'inbox',
      recurrence_definition_id: definition.id,
      recurrence_revision: revision.revision,
      recurrence_occurrence_id: 'occurrence-reached',
      recurrence_logical_key: 'calendar:2026-07-20',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [reachedInstance],
    });
    mockTaskRecurrences.mockReturnValue({
      definitions: [definition],
      revisions: new Map([[definition.id, revision]]),
      occurrences: [],
      openOccurrenceDefinitionIds: new Set([definition.id]),
      openOccurrenceByDefinitionId: new Map(),
      datedPrototypes: [],
      evaluationFailures: new Set(),
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      save: vi.fn(),
      createFromTask: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      evaluate: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');

    try {
      const row = container.querySelector<HTMLElement>(
        '[data-task-row-id="task-recurrence-reached"]',
      )!;
      expect(row.querySelector('[data-task-recurrence-projection-control]')).toBeNull();
      expect(row.querySelector('[data-task-completion-control]')).toBeTruthy();

      await act(async () => {
        row.querySelector<HTMLButtonElement>('[data-task-title-control]')?.click();
        await Promise.resolve();
      });
      expect(row.querySelector('[data-task-editor-region]')).toBeTruthy();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
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
        expect.any(Function),
      );
      expect(container.querySelector('input[aria-label="Add a Task"]')).toBeNull();
      expect(container.querySelector('section[aria-label="Anytime Tasks"]')).toBeTruthy();
      expect(container.querySelector('section[aria-label="Unassigned Tasks"]')).toBeTruthy();
      expect(Array.from(container.querySelectorAll('h3')).some(
        (heading) => heading.textContent?.trim() === 'Tasks',
      )).toBe(false);

      await openTaskMenuSurface(container, 'Existing task', 'Start...');
      const moveSomeday = document.querySelector<HTMLButtonElement>(
        '[data-task-start-someday]',
      );
      await act(async () => {
        moveSomeday?.click();
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        destination: 'someday',
        start_date: null,
        today_section: null,
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

  it('retains an open Anytime task in its rendered Area until the editor closes', async () => {
    const initialTask = taskTodoFixture({
      ...task,
      id: 'task-area-retained',
      title: 'Move Areas Later',
      area_id: 'area-work',
    });
    let acceptedTasks = [initialTask];
    const taskList = defaultTaskList();
    mockTaskList.mockImplementation((
      _ownerId: string,
      _view: string,
      retainedTaskId: string | null,
    ) => ({
      ...taskList,
      tasks: acceptedTasks,
      retainedTaskPlacement: retainedTaskId === initialTask.id
        ? {
            destination: initialTask.destination,
            today_section: initialTask.today_section,
            start_date: initialTask.start_date,
            deadline: initialTask.deadline,
            actionability: initialTask.actionability,
            order_key: initialTask.order_key,
            area_id: initialTask.area_id,
          }
        : null,
    }));
    mockTaskHierarchy.mockReturnValue({
      areas: [
        taskAreaFixture({ id: 'area-work', title: 'Work', order_key: 'a0' }),
        taskAreaFixture({ id: 'area-home', title: 'Home', order_key: 'a1' }),
      ],
      loading: false,
      error: null,
    });
    const { container, root, rerender } = renderShell('/tasks/anytime');
    const sectionContainingTask = (area: string) => container.querySelector(
      `section[aria-labelledby="tasks-area-${area}-heading"] `
        + '[data-task-row-id="task-area-retained"]',
    );

    try {
      await act(async () => {
        container.querySelector<HTMLElement>(
          '[data-task-row-id="task-area-retained"]',
        )?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', bubbles: true, cancelable: true,
        }));
      });
      await selectBathosOption(
        container.querySelector<HTMLButtonElement>(
          '#task-organization-task-area-retained',
        )!,
        'Home',
      );
      expect(taskList.updateTask).toHaveBeenCalledWith('task-area-retained', {
        area_id: 'area-home',
      });
      acceptedTasks = [{ ...initialTask, area_id: 'area-home' }];
      await act(async () => {
        rerender();
        await Promise.resolve();
      });

      expect(sectionContainingTask('area-work')).toBeTruthy();
      expect(sectionContainingTask('area-home')).toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[data-task-row-id="task-area-retained"] [data-bathos-form-submit]',
        )?.click();
        await Promise.resolve();
      });
      expect(sectionContainingTask('area-work')).toBeTruthy();
      expect(sectionContainingTask('area-home')).toBeNull();

      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
        rerender();
      });
      expect(sectionContainingTask('area-work')).toBeNull();
      expect(sectionContainingTask('area-home')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('retains a cleared open Today task in its current horizon until the editor closes', async () => {
    const initialTask = taskTodoFixture({
      ...task,
      id: 'task-today-retained',
      title: 'Leave Today on close',
      start_date: '2026-07-20',
      today_section: 'inbox',
    });
    let acceptedTasks = [initialTask];
    const taskList = defaultTaskList();
    mockTaskList.mockImplementation((
      _ownerId: string,
      _view: string,
      retainedTaskId: string | null,
    ) => ({
      ...taskList,
      tasks: acceptedTasks,
      retainedTaskPlacement: retainedTaskId === initialTask.id
        ? {
            destination: initialTask.destination,
            today_section: initialTask.today_section,
            start_date: initialTask.start_date,
            deadline: initialTask.deadline,
            actionability: initialTask.actionability,
            order_key: initialTask.order_key,
            area_id: initialTask.area_id,
          }
        : null,
    }));
    const { container, root, rerender } = renderShell('/tasks/today');
    const retainedInboxRow = () => container.querySelector(
      'section[aria-labelledby="tasks-inbox-heading"] '
        + '[data-task-row-id="task-today-retained"]',
    );

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[data-task-id="task-today-retained"]',
        )?.click();
      });
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
      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-today-retained'], {
        destination: 'anytime',
        todaySection: null,
        startDate: null,
      });

      acceptedTasks = [{
        ...initialTask,
        start_date: null,
        today_section: null,
      }];
      await act(async () => {
        rerender();
        await Promise.resolve();
      });
      expect(retainedInboxRow()).toBeTruthy();

      acceptedTasks = [];
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[data-task-row-id="task-today-retained"] [data-bathos-form-submit]',
        )?.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
        rerender();
      });
      expect(retainedInboxRow()).toBeNull();
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
      container.querySelectorAll<HTMLElement>('[data-task-row-id]'),
    ).map((row) => row.querySelector<HTMLInputElement>('[data-task-editor-title]')?.value
      ?? row.querySelector<HTMLElement>('[data-task-row-title]')?.textContent?.trim());

    try {
      expect(visibleTitles()).toEqual(['Initially Ready', 'Rechecking']);
      await act(async () => {
        container.querySelector<HTMLElement>(
          '[data-task-row-id="task-ready"]',
        )?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', bubbles: true, cancelable: true,
        }));
      });
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
      expect(taskList.updateTask).toHaveBeenCalledWith('task-ready', {
        actionability: 'waiting',
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
          '[data-task-row-id="task-ready"] [data-bathos-form-submit]',
        )?.click();
        await Promise.resolve();
      });
      expect(visibleTitles()).toEqual(['Initially Ready', 'Rechecking']);

      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
        rerender();
      });
      expect(visibleTitles()).toEqual(['Rechecking', 'Initially Ready']);
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps an open Anytime task in its exact rendered slot through all planning changes', async () => {
    let automaticSortEnabled = false;
    mockTaskAutomaticListSorting.mockImplementation(() => ({
      enabled: automaticSortEnabled,
      loading: false,
      error: null,
      pending: false,
      setEnabled: vi.fn(),
    }));
    const retainedTask = taskTodoFixture({
      ...task,
      id: 'task-slot-retained',
      title: 'Retained slot',
      area_id: 'area-work',
      deadline: null,
      today_section: 'later',
      actionability: 'waiting',
      order_key: 'a0',
    });
    const workTask = taskTodoFixture({
      ...task,
      id: 'task-work-peer',
      title: 'Work peer',
      area_id: 'area-work',
      deadline: '2026-07-20',
      today_section: 'now',
      actionability: 'actionable',
      order_key: 'a1',
    });
    let acceptedTasks = [retainedTask, workTask];
    const taskList = defaultTaskList();
    mockTaskList.mockImplementation((
      _ownerId: string,
      _view: string,
      retainedTaskId: string | null,
    ) => ({
      ...taskList,
      tasks: acceptedTasks,
      retainedTaskPlacement: retainedTaskId === retainedTask.id
        ? {
            destination: retainedTask.destination,
            today_section: retainedTask.today_section,
            start_date: retainedTask.start_date,
            deadline: retainedTask.deadline,
            actionability: retainedTask.actionability,
            order_key: retainedTask.order_key,
            area_id: retainedTask.area_id,
          }
        : null,
    }));
    mockTaskHierarchy.mockReturnValue({
      areas: [
        taskAreaFixture({ id: 'area-work', title: 'Work', order_key: 'a0' }),
        taskAreaFixture({ id: 'area-home', title: 'Home', order_key: 'a1' }),
      ],
      loading: false,
      error: null,
    });
    const { container, root, rerender } = renderShell('/tasks/anytime');
    const sectionTitles = (area: string) => Array.from(container.querySelectorAll<HTMLElement>(
      `section[aria-labelledby="tasks-area-${area}-heading"] [data-task-row-id]`,
    )).map((row) => row.querySelector<HTMLInputElement>('[data-task-editor-title]')?.value
      ?? row.querySelector<HTMLElement>('[data-task-row-title]')?.textContent?.trim());

    try {
      expect(sectionTitles('area-work')).toEqual(['Retained slot', 'Work peer']);
      await act(async () => {
        container.querySelector<HTMLElement>(
          '[data-task-row-id="task-slot-retained"]',
        )?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', bubbles: true, cancelable: true,
        }));
      });

      automaticSortEnabled = true;
      acceptedTasks = [{
        ...retainedTask,
        area_id: 'area-home',
        start_date: '2026-07-31',
        deadline: '2026-08-31',
        today_section: 'inbox',
        actionability: 'actionable',
        order_key: 'z9',
      }, workTask];
      await act(async () => {
        rerender();
        await Promise.resolve();
      });

      expect(sectionTitles('area-work')).toEqual(['Retained slot', 'Work peer']);
      expect(sectionTitles('area-home')).toEqual([]);

      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          '[data-task-row-id="task-slot-retained"] [data-bathos-form-submit]',
        )?.click();
        await Promise.resolve();
      });
      expect(sectionTitles('area-work')).toEqual(['Retained slot', 'Work peer']);

      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
        rerender();
      });
      expect(sectionTitles('area-work')).toEqual(['Work peer']);
      expect(sectionTitles('area-home')).toEqual(['Retained slot']);
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
      const bucketButton = container.querySelector<HTMLButtonElement>(
        '[aria-label="Add Task to Work"]',
      )!;
      expect(bucketButton).toHaveClass('cursor-pointer');
      expect(bucketButton.querySelectorAll('svg')).toHaveLength(1);

      await act(async () => {
        bucketButton.click();
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

  it('groups Someday tasks in the manual Area order maintained in Settings', () => {
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
      expect(reopen).toHaveClass('text-success');
      expect(reopen).not.toHaveClass('text-muted-foreground');
      expect(reopen?.querySelector('svg.lucide-square-check')).toBeTruthy();
      expect(reopen?.className).not.toContain('hover:');
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

      await openTaskMenuSurface(container, 'Now task', 'Start...');
      const moveEvening = Array.from(document.querySelectorAll<HTMLButtonElement>(
        '[data-task-start-horizon]',
      )).find((item) => item.textContent?.includes('Later'));
      await act(async () => {
        moveEvening?.click();
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith('task-now', {
        destination: 'anytime',
        start_date: null,
        today_section: 'later',
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
        key: 't',
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
    } finally {
      cleanup(root, container);
    }
  });

  it('moves an open Start picker focus to the Today horizon assigned by Control+T', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    const todayTask = taskTodoFixture({
      ...task,
      start_date: null,
      today_section: 'next',
    });
    const taskList = { ...defaultTaskList(), tasks: [todayTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/anytime');

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const calendarCaption = document.querySelector<HTMLButtonElement>(
        'button[name="caption-month-year"]',
      )!;
      calendarCaption.focus();

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 't',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a'], {
        destination: 'anytime',
        todaySection: 'later',
        startDate: null,
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(
          document.querySelector('[data-task-start-horizon="later"]'),
        );
      });
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      cleanup(root, container);
    }
  });

  it('applies Control+T to a focused task without opening its closed Start picker', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    const todayTask = taskTodoFixture({
      ...task,
      start_date: null,
      today_section: 'next',
    });
    const taskList = { ...defaultTaskList(), tasks: [todayTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell('/tasks/anytime');

    try {
      const row = container.querySelector<HTMLElement>(
        '[data-task-row-focus-target][data-task-row-id="task-a"]',
      )!;
      await act(async () => {
        row.focus();
        row.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
          cancelable: true,
        }));
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 't',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });

      expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a'], {
        destination: 'anytime',
        todaySection: 'later',
        startDate: null,
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeNull();
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
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
          key: 't',
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
          key: 't',
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
      });
      await act(async () => {
        requestTaskStartPickerOpenForTest(container, 'task-a');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeTruthy();
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
      await waitFor(() => {
        expect(taskList.moveTasks).toHaveBeenCalledWith(['task-a'], {
          destination: 'anytime',
          todaySection: null,
          startDate: null,
        });
      });
      expect(document.querySelector('[data-task-start-picker]')).toBeNull();
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
      expect(toolbar.textContent).toContain('Done');
      expect(toolbar).toHaveClass(
        'fixed',
        'bottom-[calc(var(--mobile-bottom-nav-bottom-offset)+4.25rem)]',
      );
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
      expect(taskList.applyTaskPatches).toHaveBeenCalledWith([
        { taskId: 'task-a', patch: { actionability: 'waiting' } },
        { taskId: 'task-b', patch: { actionability: 'waiting' } },
      ]);
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
      expect(document.querySelector(
        '[data-task-row-temporal-picker="deadline"]',
      )).not.toBeNull();
      expect(container.querySelector('#task-title-task-a')).toBeNull();
      expect(document.querySelector<HTMLButtonElement>(
        'button[data-calendar-date="2026-07-19"]',
      )).not.toBeDisabled();
      await waitFor(() => {
        expect(document.activeElement).toBe(
          document.querySelector('button[data-calendar-date="2026-07-20"]'),
        );
      });
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'd', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(
          document.querySelector('button[data-calendar-date="2026-07-21"]'),
        );
      });
      expect(document.querySelector(
        '[data-task-row-temporal-picker="deadline"]',
      )).not.toBeNull();
      expect(taskList.updateTask).not.toHaveBeenCalled();
      await act(async () => {
        document.querySelector<HTMLElement>(
          '[data-task-row-temporal-picker="deadline"]',
        )?.dispatchEvent(new KeyboardEvent('keydown', {
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
          key: 'y', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(document.activeElement).toBe(document.querySelector('#task-start-reminder-task-a'));
    } finally {
      cleanup(root, container);
    }
  });

  it('advances Control+D in an open task Deadline picker instead of closing it', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    const deadlineTask = taskTodoFixture({
      ...task,
      deadline: '2026-07-31',
    });
    const taskList = { ...defaultTaskList(), tasks: [deadlineTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    const invokeDeadlineCommand = async () => {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'd',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
    };

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await invokeDeadlineCommand();
      await waitFor(() => {
        expect(document.activeElement).toBe(
          document.querySelector('button[data-calendar-date="2026-07-31"]'),
        );
      });

      await invokeDeadlineCommand();
      await waitFor(() => {
        expect(document.querySelector('button[name="caption-month-year"]'))
          .toHaveTextContent('August 2026');
        expect(document.activeElement).toBe(
          document.querySelector('button[data-calendar-date="2026-08-01"]'),
        );
      });
      expect(document.querySelector(
        '[data-date-picker-command-scope="task-deadline"]',
      )).not.toBeNull();
      expect(taskList.updateTask).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      cleanup(root, container);
    }
  });

  it('advances an overdue yesterday deadline to today before tomorrow', async () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });
    const deadlineTask = taskTodoFixture({
      ...task,
      deadline: '2026-07-19',
    });
    const taskList = { ...defaultTaskList(), tasks: [deadlineTask] };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();

    const invokeDeadlineCommand = async () => {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'd',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
    };

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      await invokeDeadlineCommand();
      expect(document.querySelector(
        '[data-date-picker-command-scope="task-deadline"]',
      )).not.toBeNull();
      expect(document.querySelector<HTMLButtonElement>(
        'button[data-calendar-date="2026-07-18"]',
      )).not.toBeDisabled();

      await invokeDeadlineCommand();
      await waitFor(() => {
        expect(document.activeElement).toHaveAttribute('data-calendar-date', '2026-07-20');
      });

      await invokeDeadlineCommand();
      await waitFor(() => {
        expect(document.activeElement).toHaveAttribute('data-calendar-date', '2026-07-21');
      });
      expect(taskList.updateTask).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
      cleanup(root, container);
    }
  });

  it('preserves the active editor field and caret while cycling Area', async () => {
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
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const title = container.querySelector<HTMLInputElement>('#task-title-task-a')!;
      title.focus();
      title.setSelectionRange(3, 3);

      await act(async () => {
        title.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'v',
          altKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
      });

      expect(taskList.updateTask).toHaveBeenCalledWith('task-a', {
        area_id: 'area-work',
      });
      expect(document.activeElement).toBe(title);
      expect(title.selectionStart).toBe(3);
      expect(title.selectionEnd).toBe(3);
    } finally {
      cleanup(root, container);
    }
  });

  it('cycles a mixed bulk Area selection together through every configured value', async () => {
    const secondTask = taskTodoFixture({
      ...task,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
      area_id: 'area-home',
    });
    let currentTasks = [
      { ...task, area_id: 'area-work' },
      secondTask,
    ];
    const applyTaskPatches = vi.fn().mockImplementation(async (inputs: Array<{
      taskId: string;
      patch: Partial<typeof task>;
    }>) => {
      const inputById = new Map(inputs.map((input) => [input.taskId, input.patch]));
      currentTasks = currentTasks.map((candidate) => ({
        ...candidate,
        ...(inputById.get(candidate.id) ?? {}),
      }));
      return currentTasks.filter((candidate) => inputById.has(candidate.id));
    });
    const taskList = { ...defaultTaskList(), applyTaskPatches };
    mockTaskList.mockImplementation(() => ({ ...taskList, tasks: currentTasks }));
    mockTaskHierarchy.mockReturnValue({
      areas: [
        { id: 'area-work', owner_id: 'owner-a', title: 'Work' },
        { id: 'area-home', owner_id: 'owner-a', title: 'Home' },
      ],
      loading: false,
      error: null,
    });
    const { container, rerender, root } = renderShell();
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
      const invokeAreaCycle = async () => {
        await act(async () => {
          window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'v', altKey: true, shiftKey: true, bubbles: true, cancelable: true,
          }));
          await Promise.resolve();
        });
        act(() => rerender());
      };

      await invokeAreaCycle();
      expect(document.querySelector<HTMLElement>('[role="dialog"]')).toBeNull();
      expect(applyTaskPatches).toHaveBeenNthCalledWith(1, [
        { taskId: 'task-a', patch: { area_id: null } },
        { taskId: 'task-b', patch: { area_id: null } },
      ]);

      await invokeAreaCycle();
      expect(applyTaskPatches).toHaveBeenNthCalledWith(2, [
        { taskId: 'task-a', patch: { area_id: 'area-work' } },
        { taskId: 'task-b', patch: { area_id: 'area-work' } },
      ]);

      await invokeAreaCycle();
      expect(applyTaskPatches).toHaveBeenNthCalledWith(3, [
        { taskId: 'task-a', patch: { area_id: 'area-home' } },
        { taskId: 'task-b', patch: { area_id: 'area-home' } },
      ]);

      await invokeAreaCycle();
      expect(applyTaskPatches).toHaveBeenNthCalledWith(4, [
        { taskId: 'task-a', patch: { area_id: null } },
        { taskId: 'task-b', patch: { area_id: null } },
      ]);
    } finally {
      cleanup(root, container);
    }
  });

  it('suppresses the Reminder shortcut without opening or mutating reminders in selection mode', async () => {
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
    const cancelReminder = vi.fn().mockResolvedValue(undefined);
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
      cancel: cancelReminder,
      acknowledge: vi.fn(),
      claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/anytime');
    const invokeReminderShortcut = async () => {
      const shortcut = new KeyboardEvent('keydown', {
        key: 'y',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        window.dispatchEvent(shortcut);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      expect(shortcut.defaultPrevented).toBe(true);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(saveReminder).not.toHaveBeenCalled();
      expect(cancelReminder).not.toHaveBeenCalled();
    };
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await invokeReminderShortcut();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-b"]')?.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
      });
      await invokeReminderShortcut();
      expect(document.body.textContent).toContain('2 Tasks');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses the standard URL control and opens Link without a clear button', async () => {
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
      const input = container.querySelector<HTMLInputElement>('#task-primary-link-task-a')!;
      const openLink = container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Link"]',
      )!;
      expect(input).toHaveAttribute('type', 'url');
      expect(input).toHaveClass('border-input');
      expect(container.querySelector('[aria-label="Clear Link"]')).toBeNull();
      expect(openLink).toHaveAttribute('href', 'https://example.test');
      expect(openLink).toHaveAttribute('target', '_blank');
      expect(openLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(openLink).toHaveClass('border-info', 'text-info');
      expect(openLink.querySelector('svg')).toHaveClass('lucide-external-link');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps checklist content above the stable optional-content row after Start moves to Someday', async () => {
    const checklistItem = taskChecklistItemFixture({
      id: 'checklist-a',
      task_id: task.id,
      title: 'Confirm backlog priority',
    });
    const taskList = {
      ...defaultTaskList(),
      tasks: [task],
      checklistTaskIds: new Set([task.id]),
    };
    mockTaskList.mockReturnValue(taskList);
    mockTaskChecklist.mockReturnValue(defaultTaskChecklist([checklistItem]));
    const { container, rerender, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const disclosures = container.querySelector('[data-task-editor-disclosures]');
      const checklist = container.querySelector('[data-task-checklist]');
      expect(disclosures).toHaveAttribute('data-layout', 'optional-content');
      expect(disclosures).toHaveClass('grid', 'grid-cols-1', 'gap-2');
      expect(disclosures?.querySelector('[aria-label="Add Link"]'))
        .toHaveClass('w-full', 'border-primary', 'text-primary', 'text-center');
      expect(checklist).toBeTruthy();
      expect(disclosures?.contains(checklist)).toBe(false);
      expect(disclosures?.querySelector('[data-task-editor-disclosure-divider]')).toBeNull();

      await act(async () => {
        requestTaskStartPickerOpenForTest(container, task.id);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      });
      const someday = document.querySelector<HTMLButtonElement>('[data-task-start-someday]');
      await act(async () => {
        someday?.click();
        await Promise.resolve();
      });
      expect(taskList.updateTask).toHaveBeenCalledWith(task.id, {
        destination: 'someday',
        start_date: null,
        today_section: null,
      });

      taskList.checklistTaskIds = new Set();
      await act(async () => {
        rerender();
        await Promise.resolve();
      });

      expect(disclosures).toHaveAttribute('data-layout', 'optional-content');
      expect(disclosures?.querySelector('[aria-label="Add Link"]'))
        .toHaveClass('w-full', 'border-primary', 'text-primary', 'text-center');
      expect(container.querySelector('[data-task-checklist]')).toBeTruthy();
      expect(disclosures?.querySelector('[data-task-editor-disclosure-divider]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('uses reduced drawer padding when Checklist is the final content and no add actions remain', async () => {
    const checklistItem = taskChecklistItemFixture({
      id: 'checklist-padding',
      task_id: task.id,
      title: 'Final checklist item',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [taskTodoFixture({
        ...task,
        notes: 'Existing notes',
        primary_link: 'https://example.test',
      })],
      checklistTaskIds: new Set([task.id]),
    });
    mockTaskChecklist.mockReturnValue(defaultTaskChecklist([checklistItem]));
    const { container, root } = renderShell();

    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const drawer = container.querySelector('[data-task-metadata-drawer-fields]');
      expect(drawer).toHaveClass('pb-2');
      expect(drawer).not.toHaveClass('pb-3');
      expect(container.querySelector('[data-task-editor-disclosures]')).toBeNull();
      expect(container.querySelector('[data-task-checklist]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('uses protocol identity inside Primary Link while keeping External Link on its action', async () => {
    const taskList = {
      ...defaultTaskList(),
      tasks: [taskTodoFixture({
        ...task,
        primary_link: 'https://usgbc.atlassian.net/browse/PF-766',
      })],
    };
    mockTaskList.mockReturnValue(taskList);
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const jiraLink = container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Jira Link"]',
      )!;
      expect(jiraLink).toHaveAttribute(
        'href',
        'https://usgbc.atlassian.net/browse/PF-766',
      );
      expect(jiraLink).toHaveAttribute('target', '_blank');
      expect(jiraLink.querySelector('svg')).toHaveClass('lucide-external-link');

      const input = container.querySelector<HTMLInputElement>('#task-primary-link-task-a')!;
      const disclosures = container.querySelector('[data-task-editor-disclosures]');
      expect(disclosures).toHaveAttribute('data-layout', 'optional-content');
      expect(disclosures).toHaveClass('grid', 'grid-cols-1', 'gap-2');
      expect(disclosures?.querySelector('[data-task-checklist-disclosure]'))
        .toHaveClass('w-full', 'border-primary', 'text-primary', 'text-center');
      expect(disclosures?.querySelector('[data-task-editor-disclosure-divider]')).toBeNull();
      expect(input.closest('[data-decorated-control]')?.querySelector(
        '[data-control-decoration] svg',
      )).toHaveClass('lucide-zap');
      await act(async () => {
        setInputValue(input, 'obsidian://open?vault=Personal&file=Tasks');
      });
      const obsidianLink = container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open Obsidian Link"]',
      )!;
      expect(obsidianLink).toHaveAttribute(
        'href',
        'obsidian://open?vault=Personal&file=Tasks',
      );
      expect(obsidianLink).not.toHaveAttribute('target');
      expect(obsidianLink.querySelector('svg')).toHaveClass('lucide-external-link');
      expect(input.closest('[data-decorated-control]')?.querySelector(
        '[data-control-decoration] svg',
      )).toHaveClass('lucide-file-text');
    } finally {
      cleanup(root, container);
    }
  });

  it('reveals the Link action for any nonempty value', async () => {
    mockTaskList.mockReturnValue(defaultTaskList());
    const { container, root } = renderShell();
    try {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      const addLink = container.querySelector<HTMLButtonElement>(
        '[aria-label="Add Link"]',
      )!;
      expect(addLink).toBeTruthy();
      expect(container.querySelector('#task-primary-link-task-a')).toBeNull();
      await act(async () => addLink.click());
      const input = container.querySelector<HTMLInputElement>('#task-primary-link-task-a')!;
      expect(document.activeElement).toBe(input);
      expect(container.querySelector('[aria-label="Open Link"]')).toBeNull();

      await act(async () => {
        setInputValue(input, 'x');
      });
      expect(container.querySelector('[aria-label="Open Link"]')).toBeEnabled();

      await act(async () => {
        setInputValue(input, 'https://example.test');
      });
      expect(container.querySelector('[aria-label="Open Link"]')).toBeEnabled();
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
        .toBeNull();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-task-id="task-a"]')?.click();
      });
      expect(container.querySelector<HTMLInputElement>('#task-primary-link-task-a')).toBeNull();
      expect(container.querySelector('[aria-label="Add Link"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('shows explicit and deadline-implied Starts in Upcoming month buckets while omitting nearby Starts', () => {
    const nearbyTask = taskTodoFixture({
      ...task,
      id: 'task-nearby',
      start_date: '2026-07-22',
      deadline: '2026-07-25',
    });
    const distantTask = taskTodoFixture({
      ...task,
      id: 'task-distant',
      title: 'Distant task',
      notes: '',
      area_id: 'area-work',
      start_date: '2026-08-03',
      deadline: null,
    });
    const nearbyMonthTask = taskTodoFixture({
      ...task,
      id: 'task-nearby-month',
      title: 'Nearby month task',
      notes: '',
      area_id: null,
      start_date: '2026-07-29',
      deadline: null,
    });
    const deadlineOnlyTask = taskTodoFixture({
      ...task,
      id: 'task-deadline-only',
      title: 'Deadline-only task',
      notes: '',
      area_id: null,
      start_date: null,
      deadline: '2026-08-05',
    });
    const reminder = taskReminderFixture({
      task_id: distantTask.id,
      local_date: distantTask.start_date!,
      local_time: '09:30:00',
    });
    mockTaskList.mockReturnValue({
      ...defaultTaskList(),
      tasks: [nearbyTask, distantTask, nearbyMonthTask, deadlineOnlyTask],
    });
    mockTaskHierarchy.mockReturnValue({
      areas: [taskAreaFixture({ id: 'area-work', title: 'Work' })],
      loading: false,
      error: null,
    });
    mockTaskReminders.mockReturnValue({
      reminders: [reminder],
      byRootId: new Map([[distantTask.id, reminder]]),
      dueItems: [],
      mode: 'connected',
      planningTimeZone: 'America/Los_Angeles',
      loading: false,
      error: null,
      save: vi.fn(),
      cancel: vi.fn(),
      acknowledge: vi.fn(),
      claimDue: vi.fn(),
    });
    const { container, root } = renderShell('/tasks/upcoming');
    try {
      expect(container.querySelector(
        '[data-task-id="task-nearby"] [data-task-metadata-kind="start"]',
      )).toBeNull();
      expect(container.querySelector('[aria-label="Deadline 5 days"]')).toBeTruthy();
      const nearbyMonthMetadata = container.querySelector(
        '[data-task-id="task-nearby-month"] [data-task-row-metadata]',
      );
      expect(nearbyMonthMetadata?.querySelector('[data-task-metadata-kind="start"]'))
        .toHaveAccessibleName('Start 9 days');
      expect(nearbyMonthMetadata?.querySelector('[data-task-start-compact]'))
        .toHaveTextContent('9d');
      expect(nearbyMonthMetadata?.querySelector('[data-task-start-full]'))
        .toHaveTextContent('9 days');
      const metadata = container.querySelector(
        '[data-task-id="task-distant"] [data-task-row-metadata]',
      );
      expect(Array.from(metadata?.children ?? [], (item) => (
        item.getAttribute('data-task-metadata-kind')
      ))).toEqual(['area', 'start', 'reminder']);
      expect(metadata?.querySelector('[data-task-metadata-kind="start"]'))
        .toHaveAccessibleName('Start Aug 3');
      expect(metadata?.querySelector('[data-task-start-compact]')).toHaveTextContent('8-3');
      expect(metadata?.querySelector('[data-task-start-compact]')).toHaveClass('sm:hidden');
      expect(metadata?.querySelector('[data-task-start-full]')).toHaveTextContent('Aug 3');
      expect(metadata?.querySelector('[data-task-start-full]')).toHaveClass('hidden', 'sm:inline');
      expect(metadata?.querySelector('[data-task-metadata-kind="reminder"]'))
        .toHaveAccessibleName('Reminder 9:30 AM');
      expect(metadata?.querySelector('[data-task-reminder-time]')).toHaveTextContent('9:30 AM');
      expect(metadata?.querySelector('[data-task-reminder-time]')).toHaveClass('hidden', 'sm:inline');
      expect(metadata?.querySelector('[data-task-metadata-kind="start"] svg'))
        .toHaveClass('lucide-play');
      const deadlineOnlyMetadata = container.querySelector(
        '[data-task-id="task-deadline-only"] [data-task-row-metadata]',
      );
      expect(Array.from(deadlineOnlyMetadata?.children ?? [], (item) => (
        item.getAttribute('data-task-metadata-kind')
      ))).toEqual(['start', 'deadline']);
      expect(deadlineOnlyMetadata?.querySelector('[data-task-metadata-kind="start"]'))
        .toHaveAccessibleName('Start Aug 5');
      expect(deadlineOnlyMetadata?.querySelector('[data-task-start-compact]'))
        .toHaveTextContent('8-5');
    } finally {
      cleanup(root, container);
    }
  });

  it('multi-selects actionability quick filters and resets an empty selection to all', async () => {
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
      const filterItems = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
      );
      expect(filterItems.map((item) => item.textContent)).toEqual([
        'Ready',
        'Rechecking',
        'Waiting',
      ]);
      expect(filterItems.every((item) => item.getAttribute('aria-checked') === 'true')).toBe(true);

      await user.click(filterItems.find((item) => item.textContent === 'Rechecking')!);
      await waitFor(() => {
        const trigger = container.querySelector<HTMLButtonElement>(
          '[aria-label="Quick Filters: Only Ready & Waiting"]',
        );
        expect(trigger).toBeTruthy();
        expect(trigger).toHaveAttribute('aria-pressed', 'true');
        expect(trigger).toHaveClass('h-9', 'w-9', 'rounded-md', 'bg-info/10', 'text-info');
        expect(trigger).not.toHaveTextContent('Only Ready & Waiting');
        expect(container.querySelector('[data-task-active-quick-filter]'))
          .toHaveTextContent('Only Ready & Waiting');
      });
      expect(container.querySelector('[data-task-id="task-actionable"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-waiting"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-rechecking"]')).toBeNull();

      await user.click(Array.from(document.querySelectorAll<HTMLElement>(
        '[role="menuitemcheckbox"]',
      )).find((item) => item.textContent === 'Waiting')!);
      await waitFor(() => {
        expect(container.querySelector('[aria-label="Quick Filters: Only Ready"]'))
          .toBeTruthy();
      });
      expect(container.querySelector('[data-task-id="task-actionable"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-waiting"]')).toBeNull();
      expect(container.querySelector('[data-task-id="task-rechecking"]')).toBeNull();

      await user.click(Array.from(document.querySelectorAll<HTMLElement>(
        '[role="menuitemcheckbox"]',
      )).find((item) => item.textContent === 'Ready')!);
      await waitFor(() => {
        expect(container.querySelector('[aria-label="Quick Filters"]')).toBeTruthy();
      });
      expect(container.querySelector('[aria-label="Quick Filters"]'))
        .toHaveAttribute('aria-pressed', 'false');
      expect(container.querySelector('[data-task-active-quick-filter]')).toBeNull();
      expect(container.querySelector('[data-task-id="task-actionable"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-waiting"]')).toBeTruthy();
      expect(container.querySelector('[data-task-id="task-rechecking"]')).toBeTruthy();
      expect(Array.from(document.querySelectorAll<HTMLElement>(
        '[role="menuitemcheckbox"]',
      )).every((item) => item.getAttribute('aria-checked') === 'true')).toBe(true);
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
      await user.click(Array.from(document.querySelectorAll<HTMLElement>(
        '[role="menuitemcheckbox"]',
      )).find((item) => item.textContent === 'Ready')!);
      await user.click(Array.from(document.querySelectorAll<HTMLElement>(
        '[role="menuitemcheckbox"]',
      )).find((item) => item.textContent === 'Rechecking')!);
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
      await user.click(Array.from(document.querySelectorAll<HTMLElement>(
        '[role="menuitemcheckbox"]',
      )).find((item) => item.textContent === 'Ready')!);
      await user.click(Array.from(document.querySelectorAll<HTMLElement>(
        '[role="menuitemcheckbox"]',
      )).find((item) => item.textContent === 'Rechecking')!);
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
      expect(container.querySelector('[data-task-active-quick-filter]'))
        .toHaveTextContent('Only Waiting');

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '6',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
        await Promise.resolve();
      });
      expect(container.querySelector('[data-task-view-heading]')).toHaveTextContent('Settings');
      expect(container.querySelector('[data-task-quick-filter-trigger]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });


  it('opens Settings with the Windows application command', async () => {
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
      expect(container.querySelector('[data-task-view-heading]')?.textContent).toContain('Settings');
    } finally {
      cleanup(root, container);
    }
  });
});
