import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Bell,
  BellRing,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Circle,
  CircleCheckBig,
  CircleDashed,
  CircleSlash2,
  Cloud,
  Clock2,
  Clock5,
  Clock8,
  DatabaseBackup,
  ExternalLink,
  Hourglass,
  Inbox,
  ListTodo,
  LayoutTemplate,
  MoreHorizontal,
  FlagTriangleRight,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Square,
  SquareCheckBig,
  Trash2,
  FolderKanban,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { CARD_PAGE_BOTTOM_PADDING_CLASS } from '@/lib/pageLayout';
import type {
  EditableTaskPatch,
  TaskPlanningMoveInput,
} from '@/modules/tasks/data/taskRepository';
import type { TaskPortabilityService } from '@/modules/tasks/data/taskPortability';
import { TaskClipboardService } from '@/modules/tasks/data/taskClipboardService';
import {
  addTaskCalendarDays,
  formatTaskDateControlLabel,
  formatTaskRelativeCalendarDate,
  isTaskCalendarDate,
} from '@/modules/tasks/domain/taskDates';
import {
  TaskKeyboardHelpDialog,
  TaskBulkCommandDialog,
  TaskBulkWhenDialog,
  TaskDoDialog,
  TaskMoveDialog,
  TaskSearchDialog,
  type TaskTemporalAction,
  type TaskBulkCommandMode,
} from '@/modules/tasks/components/TaskCommandSurfaces';
import {
  TaskStartDialog,
  TaskStartPickerField,
} from '@/modules/tasks/components/TaskStartPicker';
import {
  requestTaskStartPickerOpen,
  type TaskStartPickerFocusTarget,
} from '@/modules/tasks/components/taskStartPickerEvents';
import {
  TaskQuickFindDialog,
  TaskSearchResultsView,
} from '@/modules/tasks/components/TaskQuickFind';
import { TaskCountBadge } from '@/modules/tasks/components/TaskCountBadge';
import {
  getTaskTodayMembershipSection,
  getTodayTaskSection,
  taskIsVisible,
  taskWithRetainedViewPlacement,
  useTaskList,
  type RetainedTaskViewPlacement,
  type TaskListView,
  type TodayTaskSection,
} from '@/modules/tasks/hooks/useTaskList';
import { useTaskHierarchy, type TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import { useTaskSearch } from '@/modules/tasks/hooks/useTaskSearch';
import {
  UnsafeTaskRedoError,
  UnsafeTaskUndoError,
} from '@/modules/tasks/domain/taskHistory';
import {
  useTaskUndo,
  type TaskForwardMutationReservation,
} from '@/modules/tasks/hooks/useTaskUndo';
import { useTaskReminders } from '@/modules/tasks/hooks/useTaskReminders';
import type { TaskWebPushModel } from '@/modules/tasks/hooks/useTaskWebPush';
import {
  useTaskDeletedHierarchyRoots,
  type DeletedTaskHierarchyRoot,
} from '@/modules/tasks/hooks/useTaskDeletedHierarchyRoots';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type {
  TaskReminder,
  TaskProject,
  TaskTodaySection,
  TaskTodo,
} from '@/modules/tasks/types/tasks';
import { normalizeTaskEditorPlanningPatch } from '@/modules/tasks/components/taskEditorPlanning';
import {
  getTaskPrimaryLinkHref,
  getTaskPrimaryLinkKind,
} from '@/modules/tasks/domain/taskPrimaryLink';
import { TaskProjectDetailView } from '@/modules/tasks/components/TaskProjectDetailView';
import { TaskAreaDetailView } from '@/modules/tasks/components/TaskAreaDetailView';
import { TaskProjectsView } from '@/modules/tasks/components/TaskProjectsView';
import { TaskTemplatesView } from '@/modules/tasks/components/TaskTemplatesView';
import { TaskDataPortabilityDialog } from '@/modules/tasks/components/TaskDataPortabilityDialog';
import {
  TASK_PLANNING_ITEM_BACKGROUND_CLASS,
  TASK_PLANNING_ITEM_FRAME_CLASS,
  TASK_PLANNING_LIST_CLASS,
  TaskPlanningProjectItem,
  TaskPlanningProjects,
} from '@/modules/tasks/components/TaskPlanningProjects';
import { TaskSourceIndicator } from '@/modules/tasks/components/TaskSourceIndicator';
import { TaskSyncDiagnosticsDialog } from '@/modules/tasks/components/TaskSyncDiagnosticsDialog';
import {
  getTaskReminderAvailability,
  getTaskReminderUnavailableMessage,
  type TaskReminderAvailability,
} from '@/modules/tasks/components/taskReminderAvailability';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';
import { deriveTaskViewProjects } from '@/modules/tasks/domain/taskProjectViews';
import {
  getTaskUpcomingSections,
} from '@/modules/tasks/domain/taskUpcoming';
import {
  applyTaskSelectionGesture,
  isMacLikeTaskPlatform,
} from '@/modules/tasks/domain/taskSelection';
import {
  getTaskKeyboardCommand,
  type TaskKeyboardCommand,
} from '@/modules/tasks/domain/taskKeyboardCommands';
import {
  parseTaskClipboard,
  serializeTaskClipboard,
  type TaskClipboardDestination,
  type TaskClipboardSnapshot,
} from '@/modules/tasks/domain/taskClipboard';
import {
  getTaskTodayShortcutHorizon,
} from '@/modules/tasks/domain/taskShortcutPlanning';
import { getNextTaskActionability } from '@/modules/tasks/domain/taskActionability';
import { formatTaskReminderTimeDisplay } from '@/modules/tasks/domain/taskReminderTimeInput';
import {
  NEW_TASK_DRAFT_ID,
  applyTaskCreationDraftPatch,
  createTaskCreationDraft,
  getTaskCreationInput,
  type TaskCreationDraft,
} from '@/modules/tasks/domain/taskCreationDraft';

type TasksShellProps = {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
};

const TaskMarkdownNotes = lazy(async () => {
  const module = await import('@/modules/tasks/components/TaskMarkdownNotes');
  return { default: module.TaskMarkdownNotes };
});

const TASK_EDITOR_TEXT_AUTOSAVE_DELAY_MS = 400;
const TASK_EDITOR_EXPANSION_DURATION_MS = 220;
const TASK_POST_CLOSE_SETTLE_DELAY_MS = 180;
const TASK_PLACEMENT_ANIMATION_DURATION_MS = 240;
const TASK_TERMINAL_SETTLE_DELAY_MS = 180;
const TASK_TERMINAL_EXIT_ANIMATION_DURATION_MS = 220;

const primaryTaskViews = [
  { path: '/today', label: 'Today', icon: CalendarDays },
  { path: '/upcoming', label: 'Upcoming', icon: CalendarRange },
  { path: '/anytime', label: 'Anytime', icon: ListTodo },
  { path: '/someday', label: 'Someday', icon: CircleDashed },
] as const;

const secondaryTaskViews = [
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/templates', label: 'Templates', icon: LayoutTemplate },
  { path: '/done', label: 'Done', icon: SquareCheckBig },
  { path: '/config', label: 'Config', icon: Settings },
] as const;

const taskViews = [...primaryTaskViews, ...secondaryTaskViews] as const;

const taskCommandPaths: Partial<Record<TaskKeyboardCommand, string>> = {
  'view-today': '/today',
  'view-upcoming': '/upcoming',
  'view-anytime': '/anytime',
  'view-someday': '/someday',
  'view-done': '/done',
  'view-config': '/config',
};

type TaskShellView = TaskListView | 'projects' | 'project' | 'area' | 'templates' | 'config' | 'search';

function taskMotionAllowed(): boolean {
  return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function waitForTaskMotion(milliseconds: number): Promise<void> {
  if (!taskMotionAllowed()) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function taskPlacementChanged(
  task: TaskTodo | undefined,
  retainedPlacement: RetainedTaskViewPlacement | null | undefined,
): boolean {
  if (task === undefined || retainedPlacement == null) return false;
  return task.destination !== retainedPlacement.destination
    || task.today_section !== retainedPlacement.today_section
    || task.start_date !== retainedPlacement.start_date
    || task.deadline !== retainedPlacement.deadline
    || task.order_key !== retainedPlacement.order_key;
}

function animateTaskPlacementAfterClose(
  taskId: string,
  initialPosition: { left: number; top: number },
): void {
  if (!taskMotionAllowed()) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const taskRow = document.querySelector<HTMLElement>(
        `[data-task-row-focus-target][data-task-row-id="${CSS.escape(taskId)}"]`,
      );
      if (taskRow === null || typeof taskRow.animate !== 'function') return;
      const finalRect = taskRow.getBoundingClientRect();
      const deltaX = initialPosition.left - finalRect.left;
      const deltaY = initialPosition.top - finalRect.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
      taskRow.animate([
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0, 0)' },
      ], {
        duration: TASK_PLACEMENT_ANIMATION_DURATION_MS,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
    });
  });
}

function isTaskEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const editable = target.closest<HTMLElement>(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
  );
  if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
    return !editable.disabled && !editable.readOnly;
  }
  if (editable instanceof HTMLSelectElement) return !editable.disabled;
  return editable !== null;
}

function isTaskInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    'button, a[href], input, textarea, select, summary, '
      + '[contenteditable]:not([contenteditable="false"]), '
      + '[role="button"], [role="checkbox"], [role="combobox"], [role="link"], '
      + '[role="menuitem"], [role="option"], [role="switch"], [role="tab"]',
  ) !== null;
}

function taskNestedSurfaceOwnsEscape(target: EventTarget | null): boolean {
  if (target instanceof Element && target.closest(
    '[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"], [role="listbox"]',
  )) return true;
  return document.querySelector(
    '[data-radix-popper-content-wrapper] [data-state="open"], '
      + '[role="dialog"][data-state="open"], '
      + '[role="menu"][data-state="open"], '
      + '[role="listbox"][data-state="open"]',
  ) !== null;
}

export function TasksShell({ userId, displayName, onSignOut }: TasksShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const view = getTaskViewFromPath(location.pathname);
  const projectId = getTaskProjectIdFromPath(location.pathname);
  const areaId = getTaskAreaIdFromPath(location.pathname);
  const taskListView: TaskListView = view === 'projects'
    || view === 'project'
    || view === 'area'
    || view === 'templates'
    || view === 'config'
    || view === 'search'
    ? 'today'
    : view;
  const bulkEligible = view === 'today'
    || view === 'upcoming'
    || view === 'anytime'
    || view === 'someday'
    || view === 'done';
  const {
    database,
    repository,
    hierarchyRepository,
    reminderService,
    recurrenceService,
    mode,
    syncState,
    pendingUploadCount,
    portabilityService,
    planningTimeZone,
    prepareForSignOut,
  } = useTasksRuntime();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [closingTaskId, setClosingTaskId] = useState<string | null>(null);
  const retainedTaskId = selectedTaskId ?? closingTaskId;
  const hierarchy = useTaskHierarchy(userId);
  const deletedHierarchyRoots = useTaskDeletedHierarchyRoots(userId);
  const {
    pending: taskUndoPending,
    undoWhenAvailable: undoLastTaskChange,
    redoWhenAvailable: redoLastTaskChange,
    reserveForwardMutation,
    registerForwardMutation,
  } = useTaskUndo(userId);
  const {
    tasks: projectedTasks,
    loading,
    error,
    createTask,
    updateTask,
    moveTask,
    moveTasks,
    reorderTaskTo,
    transitionTask,
    planningDate,
    retainedTaskPlacement,
  } = useTaskList(
    userId,
    taskListView,
    retainedTaskId,
    registerForwardMutation,
    reserveForwardMutation,
  );
  const projectedTasksRef = useRef(projectedTasks);
  const retainedTaskPlacementRef = useRef(retainedTaskPlacement);
  const transitionTaskRef = useRef(transitionTask);
  projectedTasksRef.current = projectedTasks;
  retainedTaskPlacementRef.current = retainedTaskPlacement;
  transitionTaskRef.current = transitionTask;
  const planningProjects = useMemo(() => deriveTaskViewProjects(
    hierarchy.projects,
    userId,
    taskListView,
    planningDate,
  ), [hierarchy.projects, planningDate, taskListView, userId]);
  const [creationDraft, setCreationDraft] = useState<TaskCreationDraft | null>(null);
  const tasks = useMemo(
    () => creationDraft?.persistedTaskId
      ? projectedTasks.filter((task) => task.id !== creationDraft.persistedTaskId)
      : projectedTasks,
    [creationDraft?.persistedTaskId, projectedTasks],
  );
  const selectableTasks = useMemo(
    () => tasks.filter((task) => task.disposition === 'present'
      && (view === 'done' ? task.lifecycle !== 'open' : task.lifecycle === 'open')),
    [tasks, view],
  );
  const taskClipboardService = useMemo(() => new TaskClipboardService(
    database,
    repository,
    hierarchyRepository,
    reminderService,
    recurrenceService,
    userId,
  ), [
    database,
    hierarchyRepository,
    recurrenceService,
    reminderService,
    repository,
    userId,
  ]);
  const [deferredCompletionTaskIds, setDeferredCompletionTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(() => new Set());
  const [bulkSelectionAnchorId, setBulkSelectionAnchorId] = useState<string | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [bulkWhenOpen, setBulkWhenOpen] = useState(false);
  const [bulkCommandMode, setBulkCommandMode] = useState<TaskBulkCommandMode | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [searchTargetTaskId, setSearchTargetTaskId] = useState<string | null>(null);
  const taskSearch = useTaskSearch(userId, searchOpen || quickFindOpen || view === 'search');
  const reminders = useTaskReminders(userId);
  const reminderAvailability = getTaskReminderAvailability(
    reminders.mode,
    reminders.loading,
    reminders.projectionError,
  );
  const acknowledgeReminderDelivery = reminders.acknowledge;
  const commandReturnFocusRef = useRef<HTMLElement | null>(null);
  const acknowledgedPushDeliveriesRef = useRef(new Set<string>());
  const selectedTaskIdRef = useRef<string | null>(null);
  const openTaskSequenceRef = useRef(0);
  const focusedTaskIdRef = useRef<string | null>(null);
  const visibleTaskIdsRef = useRef<string[]>([]);
  const creationDraftRef = useRef<TaskCreationDraft | null>(null);
  const deferredCompletionTaskIdsRef = useRef<Set<string>>(new Set());
  const taskEditorAutosaveRef = useRef<{
    taskId: string;
    flush: () => Promise<void>;
  } | null>(null);
  const macLikePlatform = useMemo(
    () => isMacLikeTaskPlatform(globalThis.navigator?.platform ?? ''),
    [],
  );
  const doneRoots = deletedHierarchyRoots.roots;
  const taskViewIsEmpty = creationDraft === null && (view === 'done'
    ? tasks.length === 0 && doneRoots.length === 0 && planningProjects.length === 0
    : tasks.length === 0 && planningProjects.length === 0);
  const serverReplacementAvailable = mode === 'connected'
    && syncState === 'connected'
    && pendingUploadCount === 0;
  const serverReplacementUnavailableReason = pendingUploadCount > 0
    ? 'Wait for pending task changes to synchronize'
    : syncState !== 'connected'
      ? 'Reconnect to preview the current server deletion scope'
      : undefined;

  const runTaskUndo = useCallback(async () => {
    try {
      const task = await undoLastTaskChange();
      if (task === null) showTaskHistoryBoundaryToast('undo');
    } catch (undoError) {
      if (undoError instanceof UnsafeTaskUndoError) {
        showTaskHistoryBoundaryToast('undo');
      } else {
        showTaskError('Task Change Could Not Be Undone', undoError);
      }
    }
  }, [undoLastTaskChange]);

  const runTaskRedo = useCallback(async () => {
    try {
      const task = await redoLastTaskChange();
      if (task === null) showTaskHistoryBoundaryToast('redo');
    } catch (redoError) {
      if (redoError instanceof UnsafeTaskRedoError) {
        showTaskHistoryBoundaryToast('redo');
      } else {
        showTaskError('Task Change Could Not Be Redone', redoError);
      }
    }
  }, [redoLastTaskChange]);

  const replaceCreationDraft = useCallback((next: TaskCreationDraft | null) => {
    creationDraftRef.current = next;
    setCreationDraft(next);
  }, []);

  const saveCreationDraftPatch = useCallback(async (patch: EditableTaskPatch) => {
    const current = creationDraftRef.current;
    if (current === null) throw new Error('No task draft is open');
    const normalizedPatch = normalizeTaskEditorPlanningPatch(
      current.task,
      patch,
      planningDate,
    );
    let next = applyTaskCreationDraftPatch(current, normalizedPatch);
    replaceCreationDraft(next);

    if (next.persistedTaskId === null) {
      if (!next.task.title.trim()) return;
      const created = await createTask(getTaskCreationInput(next));
      next = {
        ...next,
        persistedTaskId: created.id,
        task: { ...created, id: NEW_TASK_DRAFT_ID },
      };
      replaceCreationDraft(next);
      if (next.pendingReminder !== null) {
        try {
          await reminders.save({
            rootType: 'todo',
            rootId: created.id,
            reminder: null,
            ...next.pendingReminder,
          });
          next = { ...next, pendingReminder: null };
          replaceCreationDraft(next);
        } catch (reminderError) {
          showTaskError('Reminder Could Not Be Saved', reminderError);
        }
      }
      return;
    }

    const updated = await updateTask(next.persistedTaskId, normalizedPatch);
    replaceCreationDraft({
      ...next,
      task: { ...updated, id: NEW_TASK_DRAFT_ID },
    });
  }, [createTask, planningDate, reminders, replaceCreationDraft, updateTask]);

  const saveCreationDraftReminder = useCallback(async (input: {
    localTime: string;
    ambiguityChoice: 'earlier' | 'later';
  }) => {
    const current = creationDraftRef.current;
    if (current === null) return;
    const next = { ...current, pendingReminder: input };
    replaceCreationDraft(next);
    if (next.persistedTaskId === null) return;
    await reminders.save({
      rootType: 'todo',
      rootId: next.persistedTaskId,
      reminder: reminders.byRootId.get(next.persistedTaskId) ?? null,
      ...input,
    });
    replaceCreationDraft({ ...next, pendingReminder: null });
  }, [reminders, replaceCreationDraft]);

  const cancelCreationDraftReminder = useCallback(async () => {
    const current = creationDraftRef.current;
    if (current === null) return;
    replaceCreationDraft({ ...current, pendingReminder: null });
    if (current.persistedTaskId === null) return;
    const reminder = reminders.byRootId.get(current.persistedTaskId);
    if (reminder) await reminders.cancel(reminder);
  }, [reminders, replaceCreationDraft]);

  const finishCreationDraft = useCallback((skipVisibilityToast = false) => {
    const current = creationDraftRef.current;
    replaceCreationDraft(null);
    if (current?.persistedTaskId === null || current === null || skipVisibilityToast) return;
    const persistedTask = { ...current.task, id: current.persistedTaskId };
    if (taskIsVisible(persistedTask, userId, current.view, planningDate)) return;
    toast({
      title: 'Task Saved',
      description: 'The task is not visible in the current list.',
    });
  }, [planningDate, replaceCreationDraft, userId]);

  const setDeferredCompletions = useCallback((next: Set<string>) => {
    deferredCompletionTaskIdsRef.current = next;
    setDeferredCompletionTaskIds(next);
  }, []);

  const toggleDeferredCompletion = useCallback((taskId: string) => {
    const next = new Set(deferredCompletionTaskIdsRef.current);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setDeferredCompletions(next);
  }, [setDeferredCompletions]);

  const finalizeDeferredCompletion = useCallback((taskId: string) => {
    if (!deferredCompletionTaskIdsRef.current.has(taskId)) return;
    const next = new Set(deferredCompletionTaskIdsRef.current);
    next.delete(taskId);
    setDeferredCompletions(next);
    const persistedTaskId = taskId === NEW_TASK_DRAFT_ID
      ? creationDraftRef.current?.persistedTaskId ?? null
      : taskId;
    if (persistedTaskId === null) return;
    void transitionTaskRef.current(persistedTaskId, 'complete').catch((completeError) => {
      showTaskError('Task Could Not Be Completed', completeError);
    });
  }, [setDeferredCompletions]);

  const registerTaskEditorAutosave = useCallback((
    taskId: string,
    flush: () => Promise<void>,
  ) => {
    taskEditorAutosaveRef.current = { taskId, flush };
  }, []);

  const setOpenTask = useCallback(async (
    taskId: string | null,
    clearPageFocus = false,
  ): Promise<boolean> => {
    const sequence = ++openTaskSequenceRef.current;
    const currentTaskId = selectedTaskIdRef.current;
    if (currentTaskId === taskId) return true;
    const autosave = currentTaskId !== null
      && taskEditorAutosaveRef.current?.taskId === currentTaskId
      ? taskEditorAutosaveRef.current
      : null;
    if (autosave !== null) {
      try {
        await autosave.flush();
      } catch {
        return false;
      }
    }
    if (selectedTaskIdRef.current !== currentTaskId) return false;
    if (taskEditorAutosaveRef.current === autosave) taskEditorAutosaveRef.current = null;
    const closingTaskRect = currentTaskId !== null && currentTaskId !== NEW_TASK_DRAFT_ID
      ? document.querySelector<HTMLElement>(
          `[data-task-row-focus-target][data-task-row-id="${CSS.escape(currentTaskId)}"]`,
        )?.getBoundingClientRect() ?? null
      : null;
    if (clearPageFocus && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const closingCreationDraft = currentTaskId === NEW_TASK_DRAFT_ID;
    const completingCreationDraft = closingCreationDraft
      && deferredCompletionTaskIdsRef.current.has(NEW_TASK_DRAFT_ID);
    const completingCurrentTask = currentTaskId !== null
      && deferredCompletionTaskIdsRef.current.has(currentTaskId);
    const currentTask = currentTaskId === null || closingCreationDraft
      ? undefined
      : projectedTasksRef.current.find((task) => task.id === currentTaskId);
    const shouldSettleBeforeProjection = currentTaskId !== null && (
      closingCreationDraft
      || completingCurrentTask
      || taskPlacementChanged(currentTask, retainedTaskPlacementRef.current)
    );
    if (taskId !== null) {
      focusedTaskIdRef.current = null;
      setFocusedTaskId(null);
      setBulkSelection(new Set());
      setBulkSelectionAnchorId(null);
      setBulkMode(false);
    }
    selectedTaskIdRef.current = null;
    setSelectedTaskId(null);
    setClosingTaskId(
      shouldSettleBeforeProjection && !closingCreationDraft ? currentTaskId : null,
    );
    if (currentTaskId !== null) finalizeDeferredCompletion(currentTaskId);
    if (shouldSettleBeforeProjection) {
      await waitForTaskMotion(
        TASK_EDITOR_EXPANSION_DURATION_MS + TASK_POST_CLOSE_SETTLE_DELAY_MS,
      );
      if (openTaskSequenceRef.current !== sequence) return false;
    }
    setClosingTaskId(null);
    if (closingCreationDraft) finishCreationDraft(completingCreationDraft);
    if (shouldSettleBeforeProjection && currentTaskId !== null && closingTaskRect !== null) {
      animateTaskPlacementAfterClose(currentTaskId, {
        left: closingTaskRect.left,
        top: closingTaskRect.top,
      });
    }
    selectedTaskIdRef.current = taskId;
    setSelectedTaskId(taskId);
    return true;
  }, [
    finalizeDeferredCompletion,
    finishCreationDraft,
  ]);

  const clearTaskSelection = useCallback(() => {
    if (
      document.activeElement instanceof HTMLElement
      && document.activeElement.matches('[data-task-row-focus-target]')
    ) {
      document.activeElement.blur();
    }
    focusedTaskIdRef.current = null;
    setFocusedTaskId(null);
    setBulkSelection(new Set());
    setBulkSelectionAnchorId(null);
    setBulkMode(false);
  }, []);

  const clearWholeTaskFocusPreservingDomFocus = useCallback(() => {
    focusedTaskIdRef.current = null;
    setFocusedTaskId(null);
    setBulkSelectionAnchorId(null);
  }, []);

  const focusTaskRow = useCallback((
    taskId: string | null,
    forceDomFocus = false,
  ) => {
    focusedTaskIdRef.current = taskId;
    setFocusedTaskId(taskId);
    setBulkSelection((current) => current.size === 0 ? current : new Set());
    setBulkSelectionAnchorId(taskId);
    setBulkMode((current) => current ? false : current);
    if (taskId === null) return;
    window.setTimeout(() => {
      if (focusedTaskIdRef.current !== taskId) return;
      const activeElement = document.activeElement;
      if (
        !forceDomFocus
        &&
        activeElement !== document.body
        && activeElement instanceof Element
        && !activeElement.closest('[data-task-row-id]')
      ) return;
      const target = Array.from(document.querySelectorAll<HTMLElement>(
        '[data-task-row-focus-target][data-task-row-id]',
      )).find((row) => row.dataset.taskRowId === taskId);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: 'nearest' });
    }, 0);
  }, []);

  const moveTaskRowFocus = useCallback((
    taskId: string,
    direction: -1 | 1,
    wrap: boolean,
  ) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-task-row-focus-target][data-task-row-id]',
    ));
    const currentIndex = rows.findIndex((row) => row.dataset.taskRowId === taskId);
    if (currentIndex < 0 || rows.length === 0) return;
    let targetIndex = currentIndex + direction;
    if (wrap) {
      targetIndex = (targetIndex + rows.length) % rows.length;
    } else {
      targetIndex = Math.max(0, Math.min(rows.length - 1, targetIndex));
    }
    const targetTaskId = rows[targetIndex]?.dataset.taskRowId ?? null;
    if (targetTaskId !== null) focusTaskRow(targetTaskId);
  }, [focusTaskRow]);

  const closeOpenTaskToFocus = useCallback(async (): Promise<boolean> => {
    const currentTaskId = selectedTaskIdRef.current;
    const closed = await setOpenTask(null);
    if (!closed) return false;
    if (currentTaskId !== null && currentTaskId !== NEW_TASK_DRAFT_ID) {
      focusTaskRow(currentTaskId);
    }
    return true;
  }, [focusTaskRow, setOpenTask]);

  const openRelativeTask = useCallback((direction: -1 | 1) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-task-row-focus-target][data-task-row-id]',
    ));
    if (rows.length === 0) return;
    const openTaskId = selectedTaskIdRef.current;
    const currentTaskId = openTaskId ?? focusedTaskIdRef.current;
    const currentIndex = currentTaskId === null
      ? -1
      : rows.findIndex((row) => row.dataset.taskRowId === currentTaskId);
    const targetIndex = currentTaskId === null
      ? direction === 1 ? 0 : rows.length - 1
      : currentIndex + direction;
    const targetTaskId = rows[targetIndex]?.dataset.taskRowId ?? null;
    if (targetTaskId !== null) {
      void setOpenTask(targetTaskId);
      return;
    }
    if (openTaskId !== null) void closeOpenTaskToFocus();
  }, [closeOpenTaskToFocus, setOpenTask]);

  const beginTaskCreation = useCallback(async () => {
    if (selectedTaskIdRef.current === NEW_TASK_DRAFT_ID) {
      document.querySelector<HTMLInputElement>(
        `[data-task-editor-title][id="task-title-${NEW_TASK_DRAFT_ID}"]`,
      )?.focus();
      return;
    }
    const targetView: TaskListView = view === 'today'
      || view === 'upcoming'
      || view === 'anytime'
      || view === 'someday'
      ? view
      : 'today';
    const closed = await setOpenTask(null);
    if (!closed) return;
    clearTaskSelection();
    setBulkWhenOpen(false);
    setBulkCommandMode(null);
    const draft = createTaskCreationDraft(userId, targetView);
    replaceCreationDraft(draft);
    selectedTaskIdRef.current = NEW_TASK_DRAFT_ID;
    setSelectedTaskId(NEW_TASK_DRAFT_ID);
    if (targetView !== view) navigate(`${basePath}/${targetView}`);
  }, [
    basePath,
    clearTaskSelection,
    navigate,
    replaceCreationDraft,
    setOpenTask,
    userId,
    view,
  ]);

  useEffect(() => {
    if (!bulkMode && focusedTaskId === null) return undefined;

    const handleOutsideTaskPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-task-row-id], [data-task-bulk-selection-surface]')) return;
      if (
        (bulkWhenOpen || bulkCommandMode !== null)
        && target.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"], [role="listbox"]',
        )
      ) return;
      clearTaskSelection();
    };

    document.addEventListener('pointerdown', handleOutsideTaskPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideTaskPointerDown, true);
    };
  }, [
    bulkCommandMode,
    bulkMode,
    bulkWhenOpen,
    clearTaskSelection,
    focusedTaskId,
  ]);

  useEffect(() => {
    const previousMotionScope = document.body.getAttribute('data-tasks-motion-scope');
    document.body.setAttribute('data-tasks-motion-scope', 'true');
    return () => {
      if (previousMotionScope === null) {
        document.body.removeAttribute('data-tasks-motion-scope');
      } else {
        document.body.setAttribute('data-tasks-motion-scope', previousMotionScope);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedTaskId === null) return undefined;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // Radix can retarget a pointer that dismisses an editor-owned Select through
      // its outside layer. Let that interaction close the nested Select only.
      if (document.querySelector(
        '[data-task-editor-owned-surface="true"][data-state="open"]',
      )) return;

      const taskRow = target.closest<HTMLElement>('[data-task-row-id]');
      if (taskRow?.dataset.taskRowId === selectedTaskId) return;

      // Another title owns the direct replace interaction and flushes this editor itself.
      if (target.closest('[data-task-title-control]')) return;

      // Radix renders editor-owned calendars, menus, and dialogs outside the task row.
      if (target.closest(
        '[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"], [role="listbox"]',
      )) return;

      void setOpenTask(null);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
  }, [selectedTaskId, setOpenTask]);

  useEffect(() => {
    clearTaskSelection();
    setBulkWhenOpen(false);
    const draft = creationDraftRef.current;
    if (
      selectedTaskIdRef.current === NEW_TASK_DRAFT_ID
      && draft?.view === view
    ) return;
    void setOpenTask(null);
  }, [clearTaskSelection, setOpenTask, view]);

  useEffect(() => {
    const previousVisibleIds = visibleTaskIdsRef.current;
    const nextVisibleIds = selectableTasks.map(({ id }) => id);
    const visibleIds = new Set(selectableTasks.map(({ id }) => id));
    const remainingSelection = new Set(
      Array.from(bulkSelection).filter((taskId) => visibleIds.has(taskId)),
    );
    if (remainingSelection.size !== bulkSelection.size) {
      setBulkSelection(remainingSelection);
    }
    setBulkSelectionAnchorId((current) => (
      current === null || visibleIds.has(current)
        ? current
        : Array.from(bulkSelection).find((taskId) => visibleIds.has(taskId)) ?? null
    ));
    if (bulkMode && remainingSelection.size < 2) {
      const remainingId = remainingSelection.size === 1
        ? [...remainingSelection][0]
        : null;
      if (remainingId !== null) focusTaskRow(remainingId);
      else clearTaskSelection();
    } else {
      const currentFocusedId = focusedTaskIdRef.current;
      if (currentFocusedId !== null && !visibleIds.has(currentFocusedId)) {
        const previousIndex = previousVisibleIds.indexOf(currentFocusedId);
        const fallbackId = nextVisibleIds[previousIndex]
          ?? nextVisibleIds[previousIndex - 1]
          ?? null;
        focusTaskRow(fallbackId);
      }
    }
    visibleTaskIdsRef.current = nextVisibleIds;
  }, [
    bulkMode,
    bulkSelection,
    clearTaskSelection,
    focusTaskRow,
    selectableTasks,
  ]);

  useEffect(() => {
    if (focusedTaskId === null) return;
    const frame = window.requestAnimationFrame(() => {
      if (focusedTaskIdRef.current !== focusedTaskId) return;
      const activeElement = document.activeElement;
      if (
        activeElement !== document.body
        && activeElement instanceof Element
        && !activeElement.closest('[data-task-row-id]')
      ) return;
      const target = Array.from(document.querySelectorAll<HTMLElement>(
        '[data-task-row-focus-target][data-task-row-id]',
      )).find((row) => row.dataset.taskRowId === focusedTaskId);
      if (!target || document.activeElement === target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedTaskId, selectableTasks]);

  useEffect(() => {
    const parameters = new URLSearchParams(location.search);
    const deliveryId = parameters.get('reminder_delivery');
    if (!deliveryId || acknowledgedPushDeliveriesRef.current.has(deliveryId)) return;
    acknowledgedPushDeliveriesRef.current.add(deliveryId);
    void acknowledgeReminderDelivery(deliveryId).then(() => {
      parameters.delete('reminder_delivery');
      const remainingSearch = parameters.toString();
      navigate({
        pathname: location.pathname,
        search: remainingSearch ? `?${remainingSearch}` : '',
        hash: location.hash,
      }, { replace: true });
    }).catch(() => {
      acknowledgedPushDeliveriesRef.current.delete(deliveryId);
      showReminderDeliveryError('Reminder Could Not Be Acknowledged');
    });
  }, [acknowledgeReminderDelivery, location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!searchTargetTaskId) return;
    const target = tasks.find(({ id }) => id === searchTargetTaskId);
    if (!target) return;
    if (target.lifecycle === 'open') {
      void setOpenTask(target.id);
    } else {
      document.querySelector<HTMLElement>(
        `[data-task-search-id="${target.id}"]`,
      )?.focus();
    }
    setSearchTargetTaskId(null);
  }, [searchTargetTaskId, setOpenTask, tasks]);

  const getTaskCommandTargets = useCallback((): TaskTodo[] => {
    if (bulkMode && bulkSelection.size >= 2) {
      return selectableTasks.filter((task) => bulkSelection.has(task.id));
    }
    const taskId = selectedTaskIdRef.current ?? focusedTaskIdRef.current;
    if (taskId === null) return [];
    if (taskId === NEW_TASK_DRAFT_ID && creationDraftRef.current !== null) {
      return [creationDraftRef.current.task];
    }
    const task = selectableTasks.find((candidate) => candidate.id === taskId);
    return task ? [task] : [];
  }, [bulkMode, bulkSelection, selectableTasks]);

  const cancelTaskReminders = useCallback(async (targets: readonly TaskTodo[]) => {
    for (const task of targets) {
      const reminder = reminders.byRootId.get(task.id);
      if (reminder) await reminders.cancel(reminder);
    }
  }, [reminders]);

  const rescheduleTaskReminders = useCallback(async (targets: readonly TaskTodo[]) => {
    for (const task of targets) {
      const reminder = reminders.byRootId.get(task.id);
      if (!reminder) continue;
      await reminders.save({
        rootType: 'todo',
        rootId: task.id,
        reminder,
        localTime: reminder.local_time.slice(0, 5),
        ambiguityChoice: reminder.ambiguity_choice,
      });
    }
  }, [reminders]);

  const runDirectStartShortcut = useCallback(async (
    destination: 'anytime' | 'someday',
  ) => {
    const targets = getTaskCommandTargets();
    if (targets.length === 0) return;
    try {
      const includesDraft = targets.some((task) => task.id === NEW_TASK_DRAFT_ID);
      if (includesDraft) {
        await saveCreationDraftPatch({
          destination,
          today_section: null,
          start_date: null,
        });
        await cancelCreationDraftReminder();
      }
      const persistedTargets = targets.filter((task) => task.id !== NEW_TASK_DRAFT_ID);
      if (persistedTargets.length > 0) {
        await moveTasks(persistedTargets.map(({ id }) => id), {
          destination,
          todaySection: null,
          startDate: null,
        });
        await cancelTaskReminders(persistedTargets);
      }
    } catch (shortcutError) {
      showTaskError('Task Start Could Not Be Changed', shortcutError);
    }
  }, [
    cancelCreationDraftReminder,
    cancelTaskReminders,
    getTaskCommandTargets,
    moveTasks,
    saveCreationDraftPatch,
  ]);

  const runHorizonShortcut = useCallback(async () => {
    const targets = getTaskCommandTargets();
    if (targets.length === 0) return;
    try {
      const groups = new Map<string, {
        todaySection: TaskTodaySection;
        tasks: TaskTodo[];
      }>();
      for (const task of targets) {
        const horizon = getTaskTodayShortcutHorizon(task, planningDate);
        const key = horizon;
        const group = groups.get(key);
        if (group) group.tasks.push(task);
        else groups.set(key, { todaySection: horizon, tasks: [task] });
      }
      for (const group of groups.values()) {
        const draftInGroup = group.tasks.some((task) => task.id === NEW_TASK_DRAFT_ID);
        if (draftInGroup) {
          await saveCreationDraftPatch({
            destination: 'anytime',
            today_section: group.todaySection,
            start_date: null,
          });
        }
        const persistedIds = group.tasks
          .filter((task) => task.id !== NEW_TASK_DRAFT_ID)
          .map(({ id }) => id);
        if (persistedIds.length > 0) {
          await moveTasks(persistedIds, {
            destination: 'anytime',
            todaySection: group.todaySection,
            startDate: null,
          });
        }
      }
    } catch (shortcutError) {
      showTaskError('Task Command Could Not Be Applied', shortcutError);
    }
  }, [
    getTaskCommandTargets,
    moveTasks,
    planningDate,
    saveCreationDraftPatch,
  ]);

  const runDuplicateShortcut = useCallback(async () => {
    const targets = getTaskCommandTargets();
    if (targets.length === 0) return;
    try {
      const snapshotTargets = targets.flatMap((task) => {
        if (task.id !== NEW_TASK_DRAFT_ID) return [task];
        const persistedTaskId = creationDraftRef.current?.persistedTaskId;
        return persistedTaskId ? [{ ...task, id: persistedTaskId }] : [];
      });
      if (snapshotTargets.length === 0) return;
      const openTaskId = selectedTaskIdRef.current;
      const focusedClosedTaskId = focusedTaskIdRef.current;
      const duplicatesOpenTask = targets.length === 1
        && openTaskId !== null
        && targets[0].id === openTaskId;
      const duplicatesFocusedTask = targets.length === 1
        && openTaskId === null
        && focusedClosedTaskId !== null
        && targets[0].id === focusedClosedTaskId;
      if (duplicatesOpenTask) {
        const closed = await setOpenTask(null);
        if (!closed) return;
      }
      const snapshots = await taskClipboardService.snapshot(snapshotTargets);
      const duplicated = await taskClipboardService.reconstruct(snapshots, {
        destination: 'source',
        connected: mode === 'connected',
        planningDate,
        planningTimeZone,
        atTop: false,
      });
      if (bulkMode) clearTaskSelection();
      if (duplicatesOpenTask && duplicated[0]) await setOpenTask(duplicated[0].id);
      if (duplicatesFocusedTask && duplicated[0]) focusTaskRow(duplicated[0].id);
      toast({
        title: duplicated.length === 1 ? 'Task Duplicated' : 'Tasks Duplicated',
        description: `${duplicated.length} ${duplicated.length === 1 ? 'task' : 'tasks'} created.`,
      });
    } catch (duplicateError) {
      showTaskError('Task Could Not Be Duplicated', duplicateError);
    }
  }, [
    bulkMode,
    clearTaskSelection,
    focusTaskRow,
    getTaskCommandTargets,
    mode,
    planningDate,
    planningTimeZone,
    setOpenTask,
    taskClipboardService,
  ]);

  const getClipboardDestination = useCallback((): TaskClipboardDestination | null => {
    if (view === 'today' || view === 'anytime' || view === 'someday') {
      return { kind: view };
    }
    if (view === 'area' && areaId) return { kind: 'area', areaId };
    if (view === 'project' && projectId) {
      const project = hierarchy.projects.find((candidate) => candidate.id === projectId);
      if (!project) return null;
      return {
        kind: 'project',
        projectId,
        areaId: project.area_id,
      };
    }
    return null;
  }, [areaId, hierarchy.projects, projectId, view]);

  const runTaskClipboardWrite = useCallback(async (
    operation: 'copy' | 'cut',
    event: ClipboardEvent,
  ) => {
    const targets = getTaskCommandTargets();
    if (targets.length === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (operation === 'cut' && targets.some((task) => (
      task.lifecycle !== 'open' || task.disposition !== 'present'
    ))) {
      toast({
        title: 'Cut Not Available',
        description: 'Tasks in Done can be copied or duplicated, but not cut.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const serialized = taskClipboardService.snapshot(targets)
        .then((snapshots) => serializeTaskClipboard(operation, snapshots));
      await writeTaskClipboardText(serialized, event);
      if (operation === 'cut') {
        setBulkPending(true);
        try {
          for (const task of targets) await transitionTask(task.id, 'delete');
          if (bulkMode) clearTaskSelection();
        } finally {
          setBulkPending(false);
        }
      }
      toast({
        title: operation === 'copy' ? 'Tasks Copied' : 'Tasks Cut',
        description: `${targets.length} ${targets.length === 1 ? 'task' : 'tasks'} ${operation === 'copy' ? 'copied' : 'cut'}.`,
      });
    } catch (clipboardError) {
      showTaskError(operation === 'copy' ? 'Tasks Could Not Be Copied' : 'Tasks Could Not Be Cut', clipboardError);
    }
  }, [
    bulkMode,
    clearTaskSelection,
    getTaskCommandTargets,
    taskClipboardService,
    transitionTask,
  ]);

  const runTaskPaste = useCallback(async (text: string) => {
    const destination = getClipboardDestination();
    if (destination === null) {
      toast({
        title: 'Paste Not Available',
        description: 'Tasks can be pasted into Today, Anytime, Someday, an area, or a project.',
        variant: 'destructive',
      });
      return;
    }
    const parsed = parseTaskClipboard(text);
    if (parsed.kind === 'empty') return;
    if (parsed.kind === 'invalid-task-payload') {
      toast({
        title: 'Tasks Could Not Be Pasted',
        description: parsed.reason,
        variant: 'destructive',
      });
      return;
    }
    const snapshots: TaskClipboardSnapshot[] = parsed.kind === 'tasks'
      ? parsed.envelope.tasks
      : [createPlainTextTaskSnapshot(parsed.title)];
    setBulkPending(true);
    try {
      const created = await taskClipboardService.reconstruct(snapshots, {
        destination,
        connected: mode === 'connected',
        planningDate,
        planningTimeZone,
        atTop: true,
      });
      clearTaskSelection();
      toast({
        title: created.length === 1 ? 'Task Pasted' : 'Tasks Pasted',
        description: `${created.length} ${created.length === 1 ? 'task' : 'tasks'} pasted.`,
      });
    } catch (pasteError) {
      showTaskError('Tasks Could Not Be Pasted', pasteError);
    } finally {
      setBulkPending(false);
    }
  }, [
    clearTaskSelection,
    getClipboardDestination,
    mode,
    planningDate,
    planningTimeZone,
    taskClipboardService,
  ]);

  const runCycleActionabilityShortcut = useCallback(async () => {
    const targets = getTaskCommandTargets();
    if (targets.length === 0) return;
    const actionability = getNextTaskActionability(
      targets.map((task) => task.actionability),
    );
    if (actionability === null) return;
    try {
      for (const task of targets) {
        if (task.id === NEW_TASK_DRAFT_ID) {
          await saveCreationDraftPatch({ actionability });
        } else if (task.lifecycle === 'open' && task.disposition === 'present') {
          await updateTask(task.id, { actionability });
        }
      }
    } catch (cycleError) {
      showTaskError('Task Actionability Could Not Be Changed', cycleError);
    }
  }, [getTaskCommandTargets, saveCreationDraftPatch, updateTask]);

  const openTaskCommandField = useCallback(async (
    mode: TaskBulkCommandMode,
  ) => {
    const targets = getTaskCommandTargets();
    if (bulkMode && bulkSelection.size >= 2) {
      const eligibleTargets = mode === 'reminder'
        ? targets.filter((task) => task.start_date !== null || task.today_section !== null)
        : targets;
      if (eligibleTargets.length === 0) return;
      commandReturnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      setBulkCommandMode(mode);
      return;
    }
    const task = targets[0];
    if (!task) return;
    if (
      selectedTaskIdRef.current === null
      && focusedTaskIdRef.current === task.id
    ) {
      const opened = await setOpenTask(task.id);
      if (!opened) return;
    }
    const controlId = mode === 'start' || mode === 'reminder'
      ? `task-start-${task.id}`
      : mode === 'deadline'
        ? `task-deadline-${task.id}`
        : `task-organization-${task.id}`;
    window.setTimeout(() => {
      const control = document.getElementById(controlId);
      if (!(control instanceof HTMLElement)) return;
      if (mode === 'start' || mode === 'reminder') {
        requestTaskStartPickerOpen(
          control,
          mode satisfies TaskStartPickerFocusTarget,
        );
        return;
      }
      control.focus();
      if (mode === 'deadline') {
        control.click();
      } else if (mode === 'organization' && control instanceof HTMLSelectElement) {
        const showPicker = (control as HTMLSelectElement & { showPicker?: () => void }).showPicker;
        if (showPicker) {
          try {
            showPicker.call(control);
          } catch {
            // Focus remains on the native selector when programmatic opening is unavailable.
          }
        }
      }
    }, 0);
  }, [bulkMode, bulkSelection.size, getTaskCommandTargets, setOpenTask]);

  const runToggleCompletionShortcut = useCallback(async () => {
    if (bulkMode && bulkSelection.size >= 2) {
      const targets = selectableTasks.filter((task) => bulkSelection.has(task.id));
      const reservations = new Map(targets.map((task) => [
        task.id,
        reserveForwardMutation(task),
      ]));
      setBulkPending(true);
      try {
        if (targets.some((task) => task.lifecycle === 'open')) {
          await waitForTaskMotion(TASK_TERMINAL_SETTLE_DELAY_MS);
        }
        for (const task of targets) {
          const transition = task.lifecycle === 'open' ? 'complete' : 'reopen';
          const reservation = reservations.get(task.id);
          if (reservation) await transitionTask(task.id, transition, reservation);
          else await transitionTask(task.id, transition);
        }
        clearTaskSelection();
      } catch (completeError) {
        for (const reservation of reservations.values()) reservation.cancel();
        showTaskError('Selected Tasks Could Not Be Toggled', completeError);
      } finally {
        setBulkPending(false);
      }
      return;
    }
    const taskId = selectedTaskIdRef.current;
    if (taskId !== null) toggleDeferredCompletion(taskId);
    const focusedId = focusedTaskIdRef.current;
    if (taskId === null && focusedId !== null) {
      const task = selectableTasks.find((candidate) => candidate.id === focusedId);
      if (!task) return;
      if (task.lifecycle === 'open') {
        const completionControl = document.querySelector<HTMLButtonElement>(
          `[data-task-row-focus-target][data-task-row-id="${CSS.escape(focusedId)}"] `
          + '[data-task-completion-control]',
        );
        if (completionControl !== null) {
          completionControl.click();
          return;
        }
      }
      try {
        await transitionTask(
          focusedId,
          task.lifecycle === 'open' ? 'complete' : 'reopen',
        );
      } catch (completeError) {
        showTaskError('Task Could Not Be Toggled', completeError);
      }
    }
  }, [
    bulkMode,
    bulkSelection,
    clearTaskSelection,
    reserveForwardMutation,
    selectableTasks,
    toggleDeferredCompletion,
    transitionTask,
  ]);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (isTaskEditableTarget(event.target)) return;
      void runTaskClipboardWrite('copy', event);
    };
    const handleCut = (event: ClipboardEvent) => {
      if (isTaskEditableTarget(event.target)) return;
      void runTaskClipboardWrite('cut', event);
    };
    const handlePaste = (event: ClipboardEvent) => {
      if (isTaskEditableTarget(event.target)) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (!text) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void runTaskPaste(text);
    };
    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('cut', handleCut, true);
    window.addEventListener('paste', handlePaste, true);
    return () => {
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('cut', handleCut, true);
      window.removeEventListener('paste', handlePaste, true);
    };
  }, [runTaskClipboardWrite, runTaskPaste]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && taskNestedSurfaceOwnsEscape(event.target)) return;
      if (
        event.key === 'Escape'
        && !bulkMode
        && selectedTaskIdRef.current === null
        && event.target instanceof HTMLElement
        && event.target.closest('[data-task-row-focus-target]')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        clearTaskSelection();
        return;
      }
      if (
        event.key === 'Escape'
        && bulkMode
        && !bulkWhenOpen
        && bulkCommandMode === null
        && !searchOpen
        && !quickFindOpen
        && !keyboardHelpOpen
        && !(event.target instanceof Element && event.target.closest('[role="dialog"]'))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (
          document.activeElement instanceof HTMLElement
          && document.activeElement.closest('[data-task-row-focus-target]')
        ) {
          document.activeElement.blur();
        }
        clearTaskSelection();
        return;
      }
      if (
        event.key === ' '
        && !event.shiftKey
        && !event.metaKey
        && !event.ctrlKey
        && !event.altKey
        && !event.isComposing
      ) {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-task-row-focus-target]')) return;
        if (
          event.repeat
          || selectedTaskIdRef.current !== null
          || focusedTaskIdRef.current !== null
          || bulkMode
          || taskNestedSurfaceOwnsEscape(event.target)
          || isTaskInteractiveTarget(event.target)
        ) return;
        const ownsEligibleSurface = event.target === document.body
          || event.target === document.documentElement
          || (target !== null && target.closest('[data-task-space-entry-surface]') !== null);
        if (!ownsEligibleSurface) return;
        const firstTaskRow = document.querySelector<HTMLElement>(
          '[data-task-row-focus-target][data-task-row-id]',
        );
        const firstTaskId = firstTaskRow?.dataset.taskRowId ?? null;
        if (firstTaskId === null) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        focusTaskRow(firstTaskId, true);
        return;
      }
      const command = getTaskKeyboardCommand(event, macLikePlatform);
      if (command === null) return;
      if (command === 'keyboard-help' && event.isComposing) return;
      if (
        (command === 'copy' || command === 'cut' || command === 'paste')
        && isTaskEditableTarget(event.target)
      ) return;
      if (command === 'copy' || command === 'cut' || command === 'paste') return;
      if (
        command === 'close-task'
        && selectedTaskIdRef.current === null
        && focusedTaskIdRef.current === null
      ) return;
      if (command === 'duplicate' && getTaskCommandTargets().length === 0) return;
      if (command === 'select-all') {
        if (
          isTaskEditableTarget(event.target)
          || !bulkEligible
          || selectableTasks.length === 0
        ) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.isComposing) return;
        const visibleTaskIds = selectableTasks.map(({ id }) => id);
        void setOpenTask(null).then((closed) => {
          if (!closed) return;
          if (visibleTaskIds.length === 1) {
            focusTaskRow(visibleTaskIds[0]);
            return;
          }
          focusedTaskIdRef.current = null;
          setFocusedTaskId(null);
          setBulkMode(true);
          setBulkSelection(new Set(visibleTaskIds));
          setBulkSelectionAnchorId(visibleTaskIds[0]);
        });
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.isComposing) return;

      if (command === 'keyboard-help') {
        commandReturnFocusRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        setKeyboardHelpOpen(true);
        return;
      }
      if (command === 'undo') {
        if (!taskUndoPending) void runTaskUndo();
        return;
      }
      if (command === 'redo') {
        if (!taskUndoPending) void runTaskRedo();
        return;
      }
      if (command === 'capture') {
        void beginTaskCreation();
        return;
      }
      const path = taskCommandPaths[command];
      if (path) {
        void setOpenTask(null).then((closed) => {
          if (!closed) return;
          clearTaskSelection();
          navigate(`${basePath}${path}`);
        });
        return;
      }
      if (command === 'toggle-completion') {
        void runToggleCompletionShortcut();
        return;
      }
      if (command === 'cycle-horizon') {
        void runHorizonShortcut();
        return;
      }
      if (command === 'cycle-actionability') {
        void runCycleActionabilityShortcut();
        return;
      }
      if (command === 'duplicate') {
        void runDuplicateShortcut();
        return;
      }
      if (command === 'open-start-date') {
        void openTaskCommandField('start');
        return;
      }
      if (command === 'clear-start') {
        void runDirectStartShortcut('anytime');
        return;
      }
      if (command === 'set-someday') {
        void runDirectStartShortcut('someday');
        return;
      }
      if (command === 'open-deadline') {
        void openTaskCommandField('deadline');
        return;
      }
      if (command === 'open-organization') {
        void openTaskCommandField('organization');
        return;
      }
      if (command === 'focus-reminder') {
        void openTaskCommandField('reminder');
        return;
      }
      if (command === 'open-next') {
        openRelativeTask(1);
        return;
      }
      if (command === 'open-previous') {
        openRelativeTask(-1);
        return;
      }
      if (command === 'open-checklist') return;
      if (command === 'close-task') {
        if (selectedTaskIdRef.current !== null) {
          void closeOpenTaskToFocus();
        } else if (focusedTaskIdRef.current !== null) {
          void setOpenTask(focusedTaskIdRef.current);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    basePath,
    beginTaskCreation,
    bulkCommandMode,
    bulkEligible,
    bulkMode,
    bulkWhenOpen,
    clearTaskSelection,
    focusTaskRow,
    closeOpenTaskToFocus,
    getTaskCommandTargets,
    keyboardHelpOpen,
    macLikePlatform,
    navigate,
    openTaskCommandField,
    openRelativeTask,
    runDuplicateShortcut,
    runCycleActionabilityShortcut,
    runDirectStartShortcut,
    runHorizonShortcut,
    runToggleCompletionShortcut,
    runTaskRedo,
    runTaskUndo,
    setOpenTask,
    taskUndoPending,
    selectableTasks,
    searchOpen,
    quickFindOpen,
  ]);

  const openCommandSurface = (open: (value: boolean) => void) => {
    commandReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    open(true);
  };
  const restoreCommandFocus = () => {
    const returnFocus = commandReturnFocusRef.current;
    commandReturnFocusRef.current = null;
    returnFocus?.focus();
  };

  const focusTaskListFallback = () => {
    commandReturnFocusRef.current = null;
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-task-view-heading]')?.focus();
    }, 0);
  };

  const handleSignOut = async () => {
    try {
      await prepareForSignOut();
      await onSignOut();
    } catch (signOutError) {
      showTaskError('Tasks Could Not Sign Out Safely', signOutError);
    }
  };

  const planningActionsForTask = (task: TaskTodo): TaskTemporalAction[] => {
    const action = (
      label: string,
      input: Parameters<typeof moveTask>[1],
    ): TaskTemporalAction => ({
      label,
      run: async () => {
        try {
          if (task.id === NEW_TASK_DRAFT_ID) {
            await saveCreationDraftPatch({
              destination: input.destination,
              today_section: input.todaySection ?? null,
              start_date: input.startDate ?? null,
            });
            if (input.startDate === null && input.todaySection === null) {
              await cancelCreationDraftReminder();
            } else {
              const persistedTaskId = creationDraftRef.current?.persistedTaskId;
              if (persistedTaskId) {
                await rescheduleTaskReminders([{ ...task, id: persistedTaskId }]);
              }
            }
          } else {
            await moveTask(task.id, input);
            if (input.startDate === null && input.todaySection === null) {
              await cancelTaskReminders([task]);
            } else {
              await rescheduleTaskReminders([task]);
            }
          }
        } catch (moveError) {
          showTaskError('Task Could Not Be Moved', moveError);
          throw moveError;
        }
      },
    });

    const moveToTodayLater = action(view === 'upcoming' ? 'Move to Today Later' : 'Add to Today Later', {
      destination: 'anytime',
      todaySection: 'later',
      startDate: null,
    });
    const moveToAnytime = action('Move to Anytime', {
      destination: 'anytime',
      todaySection: null,
      startDate: null,
    });
    const moveToSomeday = action('Move to Someday', {
      destination: 'someday',
      todaySection: null,
      startDate: null,
    });

    if (view === 'upcoming') {
      return [moveToTodayLater, moveToAnytime, moveToSomeday];
    }
    if (view === 'anytime') {
      const todayActions = task.today_section === null
        ? [
          action('Add to Today Inbox', { destination: 'anytime', todaySection: 'inbox', startDate: null }),
          action('Add to Today Now', { destination: 'anytime', todaySection: 'now', startDate: null }),
          action('Add to Today Next', { destination: 'anytime', todaySection: 'next', startDate: null }),
          moveToTodayLater,
        ]
        : [action('Remove from Today', {
          destination: 'anytime', todaySection: null, startDate: null,
        })];
      return [...todayActions, moveToSomeday];
    }
    if (view === 'someday') {
      return [moveToTodayLater, moveToAnytime];
    }

    const section = getTodayTaskSection(task, planningDate);
    const actions: TaskTemporalAction[] = (
      ['inbox', 'now', 'next', 'later'] as const
    ).filter((candidate) => candidate !== section).map((candidate) => action(
      `Move to Today ${candidate[0].toUpperCase()}${candidate.slice(1)}`,
      { destination: 'anytime', todaySection: candidate, startDate: null },
    ));
    actions.push(
      action('Move to Tomorrow', {
        destination: 'anytime',
        todaySection: null,
        startDate: addTaskCalendarDays(planningDate, 1),
      }),
      action('Remove from Today', {
        destination: 'anytime', todaySection: null, startDate: null,
      }),
      moveToSomeday,
    );
    return actions;
  };

  const applyBulkPlanning = async (input: TaskPlanningMoveInput) => {
    if (bulkPending) return;
    const taskIds = tasks
      .filter(({ id }) => bulkSelection.has(id))
      .map(({ id }) => id);
    if (taskIds.length === 0) return;
    setBulkPending(true);
    try {
      await moveTasks(taskIds, input);
      const selectedTasks = tasks.filter(({ id }) => bulkSelection.has(id));
      if (input.startDate === null && input.todaySection === null) {
        await cancelTaskReminders(selectedTasks);
      } else {
        await rescheduleTaskReminders(selectedTasks);
      }
      clearTaskSelection();
      focusTaskListFallback();
    } catch (moveError) {
      showTaskError('Selected Tasks Could Not Be Planned', moveError);
      throw moveError;
    } finally {
      setBulkPending(false);
    }
  };

  const bulkAction = (
    label: string,
    input: TaskPlanningMoveInput,
  ): TaskTemporalAction => ({ label, run: () => applyBulkPlanning(input) });
  const bulkPlanningActions: TaskTemporalAction[] = [
    bulkAction('Move to Today Inbox', {
      destination: 'anytime', todaySection: 'inbox', startDate: null,
    }),
    bulkAction('Move to Today Now', {
      destination: 'anytime', todaySection: 'now', startDate: null,
    }),
    bulkAction('Move to Today Next', {
      destination: 'anytime', todaySection: 'next', startDate: null,
    }),
    bulkAction('Move to Today Later', {
      destination: 'anytime', todaySection: 'later', startDate: null,
    }),
    bulkAction('Remove from Today', {
      destination: 'anytime', todaySection: null, startDate: null,
    }),
    {
      label: 'Move to Tomorrow',
      run: async () => {
        if (bulkPending) return;
        const selectedTasks = tasks.filter(({ id }) => bulkSelection.has(id));
        if (selectedTasks.length === 0) return;
        setBulkPending(true);
        try {
          await moveTasks(selectedTasks.map(({ id }) => id), {
            destination: 'anytime',
            todaySection: null,
            startDate: addTaskCalendarDays(planningDate, 1),
          });
          await rescheduleTaskReminders(selectedTasks);
          clearTaskSelection();
          focusTaskListFallback();
        } catch (moveError) {
          showTaskError('Selected Tasks Could Not Be Planned', moveError);
          throw moveError;
        } finally {
          setBulkPending(false);
        }
      },
    },
    bulkAction('Move to Anytime', {
      destination: 'anytime', todaySection: null, startDate: null,
    }),
    bulkAction('Move to Someday', {
      destination: 'someday', todaySection: null, startDate: null,
    }),
  ];

  const handleTaskPointerSelection = (
    event: MouseEvent<HTMLElement>,
    taskId: string,
  ) => {
    const next = applyTaskSelectionGesture({
      active: bulkMode,
      anchorId: bulkSelectionAnchorId,
      focusedId: focusedTaskId,
      selectedIds: bulkSelection,
    }, {
      taskId,
      visibleTaskIds: selectableTasks.map(({ id }) => id),
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      macLikePlatform,
    });
    if (!bulkEligible || next === null) {
      if (selectedTaskIdRef.current === taskId) {
        void closeOpenTaskToFocus();
      } else {
        void setOpenTask(taskId);
      }
      return;
    }
    event.preventDefault();
    void setOpenTask(null).then((closed) => {
      if (!closed) return;
      focusedTaskIdRef.current = next.focusedId;
      setFocusedTaskId(next.focusedId);
      setBulkMode(next.active);
      setBulkSelectionAnchorId(next.anchorId);
      setBulkSelection(next.selectedIds);
      if (next.focusedId !== null) focusTaskRow(next.focusedId);
    });
  };

  const handleDoneTaskPointerSelection = (
    event: MouseEvent<HTMLElement>,
    taskId: string,
  ) => {
    const next = applyTaskSelectionGesture({
      active: bulkMode,
      anchorId: bulkSelectionAnchorId,
      focusedId: focusedTaskId,
      selectedIds: bulkSelection,
    }, {
      taskId,
      visibleTaskIds: selectableTasks.map(({ id }) => id),
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      macLikePlatform,
    });
    if (next === null) {
      focusTaskRow(taskId);
      return;
    }
    event.preventDefault();
    focusedTaskIdRef.current = next.focusedId;
    setFocusedTaskId(next.focusedId);
    setBulkMode(next.active);
    setBulkSelectionAnchorId(next.anchorId);
    setBulkSelection(next.selectedIds);
    if (next.focusedId !== null) focusTaskRow(next.focusedId);
  };

  const toggleTaskFromKeyboard = (taskId: string) => {
    if (!bulkMode) {
      void setOpenTask(taskId);
      return;
    }
    const next = applyTaskSelectionGesture({
      active: bulkMode,
      anchorId: bulkSelectionAnchorId,
      focusedId: focusedTaskId,
      selectedIds: bulkSelection,
    }, {
      taskId,
      visibleTaskIds: selectableTasks.map(({ id }) => id),
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform,
    });
    if (next === null) return;
    focusedTaskIdRef.current = next.focusedId;
    setFocusedTaskId(next.focusedId);
    setBulkMode(next.active);
    setBulkSelectionAnchorId(next.anchorId);
    setBulkSelection(next.selectedIds);
    if (next.focusedId !== null) focusTaskRow(next.focusedId);
  };

  const renderActiveTask = (task: TaskTodo, sectionTasks: TaskTodo[]) => {
    const isCreationDraft = task.id === NEW_TASK_DRAFT_ID;
    const persistedDraftTaskId = isCreationDraft
      ? creationDraftRef.current?.persistedTaskId ?? null
      : null;
    return (
      <TaskRow
        key={task.id}
        task={task}
        hierarchy={hierarchy}
        selected={selectedTaskId === task.id}
        focused={focusedTaskId === task.id}
        onSelect={(event) => handleTaskPointerSelection(event, task.id)}
        onActivate={() => toggleTaskFromKeyboard(task.id)}
        onCloseEditor={() => void closeOpenTaskToFocus()}
        onFocusTask={() => {
          if (!bulkMode) focusTaskRow(task.id);
        }}
        onRestoreTaskFocus={(taskId) => focusTaskRow(taskId, true)}
        onClearTaskFocus={clearWholeTaskFocusPreservingDomFocus}
        onMoveFocus={(direction, wrap) => moveTaskRowFocus(task.id, direction, wrap)}
        onRegisterAutosave={registerTaskEditorAutosave}
        completionRequested={deferredCompletionTaskIds.has(task.id)}
        onToggleDeferredCompletion={() => toggleDeferredCompletion(task.id)}
        reserveTerminalMutation={() => (
          isCreationDraft ? undefined : reserveForwardMutation(task)
        )}
        bulkSelection={bulkMode && !isCreationDraft ? {
          selected: bulkSelection.has(task.id),
          onKeyboardToggle: () => toggleTaskFromKeyboard(task.id),
          onToggle: (event) => handleTaskPointerSelection(event, task.id),
        } : undefined}
        onUpdate={async (patch) => {
          try {
            if (isCreationDraft) {
              await saveCreationDraftPatch(patch);
              return;
            }
            const normalizedPatch = normalizeTaskEditorPlanningPatch(
              task,
              patch,
              planningDate,
            );
            await updateTask(task.id, normalizedPatch);
          } catch (updateError) {
            showTaskError('Task Could Not Be Updated', updateError);
            throw updateError;
          }
        }}
        onComplete={async (reservation) => {
          try {
            if (isCreationDraft) {
              if (persistedDraftTaskId) {
                await transitionTask(persistedDraftTaskId, 'complete');
              }
              await setOpenTask(null);
            } else {
              if (reservation) await transitionTask(task.id, 'complete', reservation);
              else await transitionTask(task.id, 'complete');
            }
          } catch (completeError) {
            showTaskError('Task Could Not Be Completed', completeError);
            throw completeError;
          }
        }}
        planningActions={planningActionsForTask(task)}
        draggableTask={!isCreationDraft
          && !bulkMode
          && (view === 'today' || view === 'anytime' || view === 'someday')
          && (view === 'today' ? tasks.length > 1 : sectionTasks.length > 1)}
        onDropTask={async (draggedTaskId, placement) => {
          try {
            await reorderTaskTo(draggedTaskId, task.id, placement);
          } catch (reorderError) {
            showTaskError('Task Could Not Be Reordered', reorderError);
            throw reorderError;
          }
        }}
        planningLabel={view === 'today' ? null : undefined}
        planningDate={planningDate}
        todayMarker={view === 'anytime'
          ? getTaskTodayMembershipSection(task, planningDate) ?? undefined
          : view === 'upcoming' && task.today_section !== null
            ? task.today_section
            : undefined}
        todayMarkerContext={view === 'upcoming' ? 'Day Horizon' : 'Today'}
        reminder={reminders.byRootId.get(persistedDraftTaskId ?? task.id) ?? null}
        reminderMode={reminderAvailability}
        reminderTimeZone={reminders.planningTimeZone}
        onSaveReminder={async (input) => {
          try {
            if (isCreationDraft) {
              await saveCreationDraftReminder(input);
              return;
            }
            await reminders.save({
              ...input,
              rootType: 'todo',
              rootId: task.id,
              reminder: reminders.byRootId.get(task.id) ?? null,
            });
          } catch (reminderError) {
            showTaskError('Reminder Could Not Be Saved', reminderError);
            throw reminderError;
          }
        }}
        onCancelReminder={async () => {
          if (isCreationDraft) {
            await cancelCreationDraftReminder();
            return;
          }
          const reminder = reminders.byRootId.get(task.id);
          if (!reminder) return;
          try {
            await reminders.cancel(reminder);
          } catch (reminderError) {
            showTaskError('Reminder Could Not Be Canceled', reminderError);
            throw reminderError;
          }
        }}
        onDelete={async (reservation) => {
          try {
            if (isCreationDraft) {
              if (persistedDraftTaskId) {
                await transitionTask(persistedDraftTaskId, 'delete');
              }
              await setOpenTask(null);
            } else {
              if (reservation) await transitionTask(task.id, 'delete', reservation);
              else await transitionTask(task.id, 'delete');
            }
          } catch (deleteError) {
            showTaskError('Task Could Not Be Deleted', deleteError);
            throw deleteError;
          }
        }}
      />
    );
  };

  const searchQuery = view === 'search'
    ? new URLSearchParams(location.search).get('q') ?? ''
    : '';

  const applyBulkCommandDate = async (value: string) => {
    const mode = bulkCommandMode;
    const targets = getTaskCommandTargets();
    if (mode === null || targets.length === 0) return;
    setBulkPending(true);
    try {
      if (mode === 'start') {
        await moveTasks(targets.map(({ id }) => id), {
          destination: 'anytime',
          todaySection: null,
          startDate: value,
        });
        await rescheduleTaskReminders(targets);
      } else if (mode === 'deadline') {
        for (const task of targets) await updateTask(task.id, { deadline: value });
      }
      setBulkCommandMode(null);
    } catch (commandError) {
      showTaskError('Selected Tasks Could Not Be Updated', commandError);
    } finally {
      setBulkPending(false);
    }
  };

  const applyBulkOrganization = async (patch: EditableTaskPatch) => {
    setBulkPending(true);
    try {
      for (const task of getTaskCommandTargets()) await updateTask(task.id, patch);
      setBulkCommandMode(null);
    } catch (commandError) {
      showTaskError('Selected Tasks Could Not Be Moved', commandError);
    } finally {
      setBulkPending(false);
    }
  };

  const applyBulkReminder = async (localTime: string) => {
    setBulkPending(true);
    try {
      const targets = getTaskCommandTargets().filter(
        (task) => task.start_date !== null || task.today_section !== null,
      );
      for (const task of targets) {
        await reminders.save({
          rootType: 'todo',
          rootId: task.id,
          reminder: reminders.byRootId.get(task.id) ?? null,
          localTime,
          ambiguityChoice: 'earlier',
        });
      }
      setBulkCommandMode(null);
    } catch (commandError) {
      showTaskError('Selected Reminders Could Not Be Saved', commandError);
    } finally {
      setBulkPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ToplineHeader
        title="Tasks"
        moduleId="tasks"
        userId={userId}
        displayName={displayName}
        onSignOut={handleSignOut}
        showAppSwitcher
      />

      <main
        data-task-space-entry-surface
        className={`mx-auto w-full max-w-3xl px-4 pt-8 md:pt-10 ${bulkMode ? 'pb-44 md:pb-36' : CARD_PAGE_BOTTOM_PADDING_CLASS}`}
      >
        <div className="space-y-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2
              tabIndex={-1}
              data-task-view-heading
              className="text-3xl font-semibold leading-none tracking-tight"
            >
              {getTaskViewLabel(view)}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="clear"
                size="icon"
                aria-label="New Task"
                aria-keyshortcuts="Control+A Control+Shift+A"
                onClick={() => void beginTaskCreation()}
                className="h-9 w-9 text-muted-foreground"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="clear"
                size="icon"
                aria-label="Search Tasks and Views"
                onClick={() => openCommandSurface(setSearchOpen)}
                className="h-9 w-9 text-muted-foreground"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {reminders.dueItems.length > 0 ? (
            <TaskDueReminders
              items={reminders.dueItems}
              onAcknowledge={async (deliveryId) => {
                try {
                  await reminders.acknowledge(deliveryId);
                } catch {
                  showReminderDeliveryError('Reminder Could Not Be Acknowledged');
                }
              }}
            />
          ) : null}

          {reminders.claimError ? (
            <TaskReminderClaimFailure onRetry={reminders.claimDue} />
          ) : null}

          {reminders.projectionError ? <TaskReminderProjectionFailure /> : null}

          <TaskDesktopNavigation view={view} basePath={basePath} navigate={navigate} />

          {creationDraft ? (
            <section aria-label="New Task">
              <div className={TASK_PLANNING_LIST_CLASS} data-task-planning-list>
                {renderActiveTask(creationDraft.task, [creationDraft.task])}
              </div>
            </section>
          ) : null}

          {view === 'search' ? (
            <TaskSearchResultsView
              query={searchQuery}
              basePath={basePath}
              tasks={taskSearch.tasks}
              hierarchy={hierarchy}
              planningDate={planningDate}
              loading={taskSearch.loading}
              error={taskSearch.error}
              onQueryChange={(query) => {
                navigate({
                  pathname: `${basePath}/search`,
                  search: query ? `?q=${encodeURIComponent(query)}` : '',
                }, { replace: true });
              }}
              onSelectTask={(task, path) => {
                setSearchTargetTaskId(task.id);
                navigate(path);
              }}
            />
          ) : view === 'area' && areaId ? (
            <TaskAreaDetailView
              ownerId={userId}
              areaId={areaId}
              hierarchy={hierarchy}
              planningDate={planningDate}
              onOpenTask={(taskId, href) => {
                setSearchTargetTaskId(taskId);
                navigate(href);
              }}
            />
          ) : view === 'project' && projectId ? (
            <TaskProjectDetailView
              ownerId={userId}
              projectId={projectId}
              hierarchy={hierarchy}
              planningDate={planningDate}
              reminder={reminders.byRootId.get(projectId) ?? null}
              reminderMode={reminderAvailability}
              onTaskMutation={registerForwardMutation}
              reserveTaskMutation={reserveForwardMutation}
              onSaveReminder={async (input) => {
                try {
                  await reminders.save({
                    rootType: 'project',
                    rootId: projectId,
                    reminder: reminders.byRootId.get(projectId) ?? null,
                    ...input,
                  });
                } catch (reminderError) {
                  showTaskError('Project Reminder Could Not Be Saved', reminderError);
                  throw reminderError;
                }
              }}
              onCancelReminder={async () => {
                const reminder = reminders.byRootId.get(projectId);
                if (!reminder) return;
                try {
                  await reminders.cancel(reminder);
                } catch (reminderError) {
                  showTaskError('Project Reminder Could Not Be Canceled', reminderError);
                  throw reminderError;
                }
              }}
            />
          ) : view === 'projects' ? <TaskProjectsView hierarchy={hierarchy} />
            : view === 'templates' ? <TaskTemplatesView ownerId={userId} hierarchy={hierarchy} />
              : view === 'config' ? (
                <TaskConfigView
                  keyboardHelpShortcut={macLikePlatform ? '⌘/' : '⌃/'}
                  webPush={reminders.webPush}
                  connected={reminders.mode === 'connected'}
                  onEnableBrowserReminders={async () => {
                    if (!reminders.webPush) return;
                    try {
                      await reminders.webPush.enable();
                    } catch {
                      showBrowserReminderError('Browser Reminders Could Not Be Enabled');
                    }
                  }}
                  onDisableBrowserReminders={async () => {
                    if (!reminders.webPush) return;
                    try {
                      await reminders.webPush.disable();
                    } catch {
                      showBrowserReminderError('Browser Reminders Could Not Be Disabled');
                    }
                  }}
                  portabilityService={portabilityService}
                  replaceAvailable={serverReplacementAvailable}
                  replaceUnavailableReason={serverReplacementUnavailableReason}
                />
              )
              : <section aria-label={getTaskSectionLabel(taskListView)}>
            {loading || hierarchy.loading || (view === 'done' && deletedHierarchyRoots.loading) ? (
              <div className="flex min-h-40 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : error || hierarchy.error || (view === 'done' && deletedHierarchyRoots.error) ? (
              <p role="alert" className="py-12 text-center text-sm text-destructive">
                Tasks Could Not Be Loaded
              </p>
            ) : taskViewIsEmpty ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {view === 'done' ? 'Done Is Empty' : 'No Tasks'}
              </p>
            ) : view === 'done' ? (
              <div className="space-y-7">
                {doneRoots.length > 0 ? (
                  <section aria-labelledby="task-done-deleted-heading">
                    <h3
                      id="task-done-deleted-heading"
                      className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"
                    >
                      Deleted
                      <TaskCountBadge count={doneRoots.length} label="Deleted Items" />
                    </h3>
                  <div className={TASK_PLANNING_LIST_CLASS}>
                    {doneRoots.map((root) => (
                      <DeletedHierarchyRow
                        key={`${root.root_type}:${root.id}`}
                        root={root}
                        onRestore={async () => {
                          try {
                            await deletedHierarchyRoots.restore(root);
                          } catch (restoreError) {
                            showTaskError('Hierarchy Could Not Be Restored', restoreError);
                          }
                        }}
                      />
                    ))}
                  </div>
                  </section>
                ) : null}
                <TaskPlanningProjects
                  projects={planningProjects}
                  areas={hierarchy.areas}
                  basePath={basePath}
                  view={taskListView}
                  planningDate={planningDate}
                  onMove={async () => undefined}
                  onReorder={async () => undefined}
                  onReopen={async (project) => {
                    try {
                      await hierarchy.transitionProject(project.id, 'reopen_project');
                    } catch (reopenError) {
                      showTaskError('Project Could Not Be Reopened', reopenError);
                      throw reopenError;
                    }
                  }}
                />
                {tasks.length > 0 ? (
                  <section aria-labelledby="task-done-todos-heading">
                    <h3
                      id="task-done-todos-heading"
                      className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"
                    >
                      Tasks
                      <TaskCountBadge count={tasks.length} label="Tasks" />
                    </h3>
                    <div className={TASK_PLANNING_LIST_CLASS} data-task-planning-list>
                      {tasks.map((task) => task.disposition === 'deleted' ? (
                        <DeletedTaskRow
                          key={task.id}
                          task={task}
                          focused={focusedTaskId === task.id}
                          onFocusTask={() => {
                            if (!bulkMode) focusTaskRow(task.id);
                          }}
                          onRestoreTaskFocus={(taskId) => focusTaskRow(taskId, true)}
                          onClearTaskFocus={clearWholeTaskFocusPreservingDomFocus}
                          onMoveFocus={(direction, wrap) => (
                            moveTaskRowFocus(task.id, direction, wrap)
                          )}
                          bulkSelection={bulkMode ? {
                            active: true,
                            selected: bulkSelection.has(task.id),
                            onSelect: (event) => handleDoneTaskPointerSelection(event, task.id),
                          } : {
                            active: false,
                            selected: false,
                            onSelect: (event) => handleDoneTaskPointerSelection(event, task.id),
                          }}
                          onRestore={async () => {
                            try {
                              await transitionTask(task.id, 'restore');
                            } catch (restoreError) {
                              showTaskError('Task Could Not Be Restored', restoreError);
                            }
                          }}
                        />
                      ) : (
                        <DoneTaskRow
                          key={task.id}
                          task={task}
                          focused={focusedTaskId === task.id}
                          onFocusTask={() => {
                            if (!bulkMode) focusTaskRow(task.id);
                          }}
                          onRestoreTaskFocus={(taskId) => focusTaskRow(taskId, true)}
                          onClearTaskFocus={clearWholeTaskFocusPreservingDomFocus}
                          onMoveFocus={(direction, wrap) => (
                            moveTaskRowFocus(task.id, direction, wrap)
                          )}
                          bulkSelection={bulkMode ? {
                            active: true,
                            selected: bulkSelection.has(task.id),
                            onSelect: (event) => handleDoneTaskPointerSelection(event, task.id),
                          } : {
                            active: false,
                            selected: false,
                            onSelect: (event) => handleDoneTaskPointerSelection(event, task.id),
                          }}
                          onReopen={async () => {
                            try {
                              await transitionTask(task.id, 'reopen');
                            } catch (reopenError) {
                              showTaskError('Task Could Not Be Reopened', reopenError);
                            }
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : view === 'today' ? (
              <div className="space-y-7">
                <TaskPlanningProjects
                  projects={planningProjects}
                  areas={hierarchy.areas}
                  basePath={basePath}
                  view={taskListView}
                  planningDate={planningDate}
                  onMove={async (project, input) => {
                    try {
                      await hierarchy.moveProjectInPlanning(project.id, input);
                    } catch (moveError) {
                      showTaskError('Project Could Not Be Moved', moveError);
                      throw moveError;
                    }
                  }}
                  onReorder={async (project, direction) => {
                    try {
                      await hierarchy.reorderProjectInPlanning(
                        project.id,
                        direction,
                        taskListView,
                        planningDate,
                      );
                    } catch (reorderError) {
                      showTaskError('Project Could Not Be Reordered', reorderError);
                      throw reorderError;
                    }
                  }}
                  onReopen={async (project) => hierarchy.transitionProject(
                    project.id,
                    'reopen_project',
                  )}
                />
                <TodayTaskSections
                  tasks={tasks}
                  planningDate={planningDate}
                  retainedTaskId={retainedTaskId}
                  retainedTaskPlacement={retainedTaskPlacement}
                  renderTask={renderActiveTask}
                />
              </div>
            ) : (
              <div className="space-y-7">
                {view === 'upcoming' ? (
                  <UpcomingTaskSections
                    projects={planningProjects}
                    tasks={tasks}
                    planningDate={planningDate}
                    retainedTaskId={retainedTaskId}
                    retainedTaskPlacement={retainedTaskPlacement}
                    renderProject={(project) => (
                      <TaskPlanningProjectItem
                        key={project.id}
                        project={project}
                        projects={planningProjects}
                        areas={hierarchy.areas}
                        basePath={basePath}
                        view={taskListView}
                        planningDate={planningDate}
                        onMove={async (candidate, input) => {
                          try {
                            await hierarchy.moveProjectInPlanning(candidate.id, input);
                          } catch (moveError) {
                            showTaskError('Project Could Not Be Moved', moveError);
                            throw moveError;
                          }
                        }}
                        onReorder={async (candidate, direction) => {
                          try {
                            await hierarchy.reorderProjectInPlanning(
                              candidate.id,
                              direction,
                              taskListView,
                              planningDate,
                            );
                          } catch (reorderError) {
                            showTaskError('Project Could Not Be Reordered', reorderError);
                            throw reorderError;
                          }
                        }}
                        onReopen={async (candidate) => {
                          try {
                            await hierarchy.transitionProject(candidate.id, 'reopen_project');
                          } catch (reopenError) {
                            showTaskError('Project Could Not Be Reopened', reopenError);
                            throw reopenError;
                          }
                        }}
                      />
                    )}
                    renderTask={renderActiveTask}
                  />
                ) : (
                  <>
                    <TaskPlanningProjects
                      projects={planningProjects}
                      areas={hierarchy.areas}
                      basePath={basePath}
                      view={taskListView}
                      planningDate={planningDate}
                      onMove={async (project, input) => {
                        try {
                          await hierarchy.moveProjectInPlanning(project.id, input);
                        } catch (moveError) {
                          showTaskError('Project Could Not Be Moved', moveError);
                          throw moveError;
                        }
                      }}
                      onReorder={async (project, direction) => {
                        try {
                          await hierarchy.reorderProjectInPlanning(
                            project.id,
                            direction,
                            taskListView,
                            planningDate,
                          );
                        } catch (reorderError) {
                          showTaskError('Project Could Not Be Reordered', reorderError);
                          throw reorderError;
                        }
                      }}
                      onReopen={async (project) => {
                        try {
                          await hierarchy.transitionProject(project.id, 'reopen_project');
                        } catch (reopenError) {
                          showTaskError('Project Could Not Be Reopened', reopenError);
                          throw reopenError;
                        }
                      }}
                    />
                    {tasks.length > 0 ? (
                      <section aria-label="Tasks">
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          Tasks
                          <TaskCountBadge count={tasks.length} label="Tasks" />
                        </h3>
                        <div className={TASK_PLANNING_LIST_CLASS} data-task-planning-list>
                          {tasks.map((task) => renderActiveTask(task, tasks))}
                        </div>
                      </section>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </section>}
        </div>
      </main>

      {bulkMode ? (
        <TaskBulkToolbar
          selectedCount={bulkSelection.size}
          totalCount={selectableTasks.length}
          pending={bulkPending}
          planningAvailable={view !== 'done'}
          onSelectAll={() => {
            const ids = selectableTasks.map(({ id }) => id);
            if (ids.length === 1) focusTaskRow(ids[0]);
            else setBulkSelection(new Set(ids));
          }}
          onClear={clearTaskSelection}
          onPlan={() => openCommandSurface(setBulkWhenOpen)}
          onDone={() => {
            clearTaskSelection();
            focusTaskListFallback();
          }}
        />
      ) : null}

      <MobileBottomNav
        items={primaryTaskViews}
        overflowItems={secondaryTaskViews}
        isActive={(path) => isTaskNavigationActive(view, path)}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
        hrefForPath={(path) => `${basePath}${path}`}
      />
      <TaskSearchDialog
        open={searchOpen}
        basePath={basePath}
        tasks={taskSearch.tasks}
        hierarchy={hierarchy}
        planningDate={planningDate}
        loading={taskSearch.loading}
        error={taskSearch.error}
        onOpenChange={setSearchOpen}
        onCloseAutoFocus={restoreCommandFocus}
        onNavigate={(path) => {
          commandReturnFocusRef.current = null;
          setSearchOpen(false);
          navigate(path);
        }}
        onSelectTask={(task, path) => {
          commandReturnFocusRef.current = null;
          setSearchOpen(false);
          setSearchTargetTaskId(task.id);
          navigate(path);
        }}
      />
      <TaskQuickFindDialog
        open={quickFindOpen}
        basePath={basePath}
        tasks={taskSearch.tasks}
        hierarchy={hierarchy}
        planningDate={planningDate}
        loading={taskSearch.loading}
        error={taskSearch.error}
        onOpenChange={setQuickFindOpen}
        onCloseAutoFocus={restoreCommandFocus}
        onNavigate={(path) => {
          commandReturnFocusRef.current = null;
          setQuickFindOpen(false);
          navigate(path);
        }}
        onSelectTask={(task, path) => {
          commandReturnFocusRef.current = null;
          setQuickFindOpen(false);
          setSearchTargetTaskId(task.id);
          navigate(path);
        }}
      />
      <TaskKeyboardHelpDialog
        open={keyboardHelpOpen}
        onOpenChange={setKeyboardHelpOpen}
        onCloseAutoFocus={restoreCommandFocus}
      />
      <TaskBulkWhenDialog
        open={bulkWhenOpen}
        selectedCount={bulkSelection.size}
        actions={bulkPlanningActions}
        onOpenChange={setBulkWhenOpen}
        onCloseAutoFocus={restoreCommandFocus}
      />
      <TaskBulkCommandDialog
        mode={bulkCommandMode}
        pending={bulkPending}
        selectedCount={bulkCommandMode === 'reminder'
          ? tasks.filter((task) => (
            bulkSelection.has(task.id)
            && (task.start_date !== null || task.today_section !== null)
          )).length
          : bulkSelection.size}
        hierarchy={hierarchy}
        planningDate={planningDate}
        onOpenChange={(open) => {
          if (!open) setBulkCommandMode(null);
        }}
        onApplyDate={applyBulkCommandDate}
        onApplyOrganization={applyBulkOrganization}
        onApplyReminder={applyBulkReminder}
      />
    </div>
  );
}

function TaskBulkToolbar({
  selectedCount,
  totalCount,
  pending,
  planningAvailable,
  onSelectAll,
  onClear,
  onPlan,
  onDone,
}: {
  selectedCount: number;
  totalCount: number;
  pending: boolean;
  planningAvailable: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onPlan: () => void;
  onDone: () => void;
}) {
  return (
    <section
      aria-label="Task Selection"
      data-task-bulk-selection-surface
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 flex-wrap items-center gap-2 rounded-md border border-info/40 bg-background p-3 md:bottom-6"
    >
      <p className="mr-auto text-sm font-medium text-foreground" aria-live="polite">
        {selectedCount} {selectedCount === 1 ? 'Task' : 'Tasks'} Selected
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || selectedCount === totalCount}
        onClick={onSelectAll}
      >
        Select All
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || selectedCount === 0}
        onClick={onClear}
      >
        Select None
      </Button>
      {planningAvailable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || selectedCount === 0}
          onClick={onPlan}
        >
          Plan Selected
        </Button>
      ) : null}
      <Button type="button" variant="clear" size="sm" disabled={pending} onClick={onDone}>
        Done
      </Button>
    </section>
  );
}

function TaskDueReminders({
  items,
  onAcknowledge,
}: {
  items: Array<{
    delivery_id: string;
    title: string;
    resolved_at: string;
  }>;
  onAcknowledge: (deliveryId: string) => Promise<void>;
}) {
  return (
    <section
      aria-label="Due Reminders"
      className="rounded-md border border-info/40 bg-info/5 p-4"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-info">
        <BellRing className="h-4 w-4" aria-hidden="true" />
        Due Reminders
      </h3>
      <div className="mt-3 divide-y divide-info/20">
        {items.map((item) => (
          <div key={item.delivery_id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              <time className="text-xs text-muted-foreground" dateTime={item.resolved_at}>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(item.resolved_at))}
              </time>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onAcknowledge(item.delivery_id)}
            >
              Acknowledge
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskReminderClaimFailure({
  onRetry,
}: {
  onRetry: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);

  return (
    <section
      aria-label="Reminder Delivery Check"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning/5 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Reminder Check Failed</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Due reminders could not be checked. Scheduled reminders remain unchanged.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline-warning"
        size="sm"
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          void onRetry().finally(() => setRetrying(false));
        }}
      >
        Retry
      </Button>
    </section>
  );
}

function TaskReminderProjectionFailure() {
  return (
    <section
      aria-label="Reminder Data Status"
      aria-live="polite"
      className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
    >
      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">Reminder Data Unavailable</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Current schedules could not be loaded. Reminder editing is disabled until synchronization recovers.
        </p>
      </div>
    </section>
  );
}

function TaskDesktopNavigation({
  view,
  basePath,
  navigate,
}: {
  view: TaskShellView;
  basePath: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const overflowActive = secondaryTaskViews.some(({ path }) => (
    isTaskNavigationActive(view, path)
  ));
  const itemClassName = (active: boolean) => (
    `inline-flex h-10 items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
    }`
  );

  return (
    <nav
      aria-label="Task views"
      className="hidden grid-cols-5 rounded-md border border-[hsl(var(--grid-sticky-line))] p-1 md:grid"
    >
      {primaryTaskViews.map(({ path, label, icon: Icon }) => {
        const href = `${basePath}${path}`;
        const active = isTaskNavigationActive(view, path);
        return (
          <a
            key={path}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={(event) => handleClientSideLinkNavigation(event, navigate, href)}
            className={itemClassName(active)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </a>
        );
      })}
      <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More Task Views"
            aria-pressed={overflowActive}
            className={itemClassName(overflowActive)}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            More
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {secondaryTaskViews.map(({ path, label, icon: Icon }) => {
            const href = `${basePath}${path}`;
            const active = isTaskNavigationActive(view, path);
            return (
              <DropdownMenuItem key={path} onSelect={() => setMoreOpen(false)} asChild>
                <a
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={(event) => {
                    setMoreOpen(false);
                    handleClientSideLinkNavigation(event, navigate, href);
                  }}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </a>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

function TaskConfigView({
  keyboardHelpShortcut,
  webPush,
  connected,
  onEnableBrowserReminders,
  onDisableBrowserReminders,
  portabilityService,
  replaceAvailable,
  replaceUnavailableReason,
}: {
  keyboardHelpShortcut: string;
  webPush: TaskWebPushModel | null;
  connected: boolean;
  onEnableBrowserReminders: () => Promise<void>;
  onDisableBrowserReminders: () => Promise<void>;
  portabilityService: TaskPortabilityService;
  replaceAvailable: boolean;
  replaceUnavailableReason?: string;
}) {
  return (
    <div className="space-y-4">
      <p
        data-task-keyboard-help-cue
        className="text-xs text-muted-foreground"
      >
        Press{' '}
        <kbd className="font-mono text-foreground">{keyboardHelpShortcut}</kbd>
        {' '}to view all keyboard commands.
      </p>

      <TaskConfigSection title="Browser Reminders" icon={Bell}>
        {webPush ? (
          <TaskWebPushCapability
            model={webPush}
            connected={connected}
            onEnable={onEnableBrowserReminders}
            onDisable={onDisableBrowserReminders}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Unavailable for this installation</p>
        )}
      </TaskConfigSection>

      <TaskConfigSection title="Synchronization" icon={Cloud}>
        <TaskSyncDiagnosticsDialog triggerVariant="config" />
      </TaskConfigSection>

      <TaskConfigSection title="Backup and Restore" icon={DatabaseBackup}>
        <TaskDataPortabilityDialog
          service={portabilityService}
          replaceAvailable={replaceAvailable}
          replaceUnavailableReason={replaceUnavailableReason}
          triggerVariant="config"
        />
      </TaskConfigSection>
    </div>
  );
}

function TaskConfigSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Bell;
  children: ReactNode;
}) {
  const headingId = `task-config-${title.toLowerCase().replaceAll(' ', '-')}`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-md border border-[hsl(var(--grid-sticky-line))] p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 id={headingId} className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="sm:ml-auto">{children}</div>
    </section>
  );
}

function TaskWebPushCapability({
  model,
  connected,
  onEnable,
  onDisable,
}: {
  model: TaskWebPushModel;
  connected: boolean;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
}) {
  if (model.status === 'checking') return null;

  const active = model.status === 'active';
  const canEnable = connected && ['available', 'revoked', 'error'].includes(model.status);
  const heading = (() => {
    switch (model.status) {
      case 'active': return 'Browser Reminders On';
      case 'available': return 'Background Reminders Off';
      case 'denied': return 'Notifications Blocked';
      case 'unsupported': return 'Background Reminders Unavailable';
      case 'revoked': return 'Reminder Subscription Expired';
      case 'error': return 'Background Reminders Degraded';
      default: return 'Background Reminders Unconfigured';
    }
  })();
  const detail = (() => {
    if (!connected) return 'Background reminders require connected task storage.';
    switch (model.status) {
      case 'active':
        return 'This browser can receive reminders while Tasks is closed. Notifications show task titles.';
      case 'available':
        return 'Enable notifications on this browser to receive reminders while Tasks is closed.';
      case 'denied':
        return 'Allow notifications in this browser or system settings. In-app reminders remain available.';
      case 'unsupported':
        return 'This browser cannot receive standards-based Web Push. In-app reminders remain available.';
      case 'revoked':
        return 'The notification provider expired this browser subscription. Enable it again to register a new one.';
      case 'error':
        return 'The browser reminder capability could not be verified. In-app reminders remain available.';
      default:
        return 'The Web Push provider keys have not been configured for this installation.';
    }
  })();

  return (
    <div
      aria-label="Browser Reminder Capability"
      aria-live="polite"
      className="flex flex-col gap-3 sm:items-end"
    >
      <div className="min-w-0 sm:text-right">
        <p className={`text-sm font-medium ${active ? 'text-success' : 'text-warning'}`}>{heading}</p>
        <p className="mt-1 max-w-xl text-xs text-muted-foreground">{detail}</p>
      </div>
      {active ? (
        <Button type="button" variant="outline" size="sm" disabled={model.busy} onClick={() => void onDisable()}>
          Disable
        </Button>
      ) : canEnable ? (
        <Button type="button" variant="outline" size="sm" disabled={model.busy} onClick={() => void onEnable()}>
          Enable
        </Button>
      ) : null}
    </div>
  );
}

function DoneTaskRow({
  task,
  focused,
  onFocusTask,
  onRestoreTaskFocus,
  onClearTaskFocus,
  onMoveFocus,
  bulkSelection,
  onReopen,
}: {
  task: TaskTodo;
  focused: boolean;
  onFocusTask: () => void;
  onRestoreTaskFocus: (taskId: string | null) => void;
  onClearTaskFocus: () => void;
  onMoveFocus: (direction: -1 | 1, wrap: boolean) => void;
  bulkSelection: {
    active: boolean;
    selected: boolean;
    onSelect: (event: MouseEvent<HTMLElement>) => void;
  };
  onReopen: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const completed = task.lifecycle === 'completed';
  const terminalAt = completed ? task.completed_at : task.canceled_at;
  const restoreWholeTaskFocus = (preferCurrent: boolean) => {
    const article = articleRef.current;
    const main = article?.closest('main') ?? null;
    const rows = Array.from(main?.querySelectorAll<HTMLElement>(
      '[data-task-row-focus-target][data-task-row-id]',
    ) ?? []);
    const currentIndex = rows.indexOf(article!);
    window.setTimeout(() => {
      if (preferCurrent && articleRef.current?.isConnected) {
        onRestoreTaskFocus(task.id);
        return;
      }
      const remaining = Array.from(main?.querySelectorAll<HTMLElement>(
        '[data-task-row-focus-target][data-task-row-id]',
      ) ?? []).filter((row) => row.dataset.taskRowId !== task.id);
      const target = remaining[currentIndex] ?? remaining[currentIndex - 1] ?? null;
      const targetTaskId = target?.dataset.taskRowId ?? null;
      if (targetTaskId !== null) {
        onRestoreTaskFocus(targetTaskId);
        return;
      }
      onRestoreTaskFocus(null);
      main?.querySelector<HTMLElement>('[data-task-view-heading]')?.focus();
    }, 0);
  };
  const run = async (operation: () => Promise<void>) => {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await operation();
      restoreWholeTaskFocus(false);
    } catch {
      restoreWholeTaskFocus(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <article
      ref={articleRef}
      tabIndex={0}
      role="group"
      aria-label={task.title}
      aria-current={focused ? 'true' : undefined}
      aria-keyshortcuts="Space Shift+Space ArrowUp ArrowDown"
      data-task-row-id={task.id}
      data-task-row-focus-target
      data-task-search-id={task.id}
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;
        bulkSelection.onSelect(event);
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Tab' && focused) {
          onClearTaskFocus();
          return;
        }
        if (event.target !== event.currentTarget) return;
        if (event.key === ' ' && !bulkSelection.active) {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          event.preventDefault();
          if (event.repeat) return;
          if (!focused) {
            onFocusTask();
            return;
          }
          onMoveFocus(event.shiftKey ? -1 : 1, true);
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          if (!focused) return;
          event.preventDefault();
          onMoveFocus(event.key === 'ArrowUp' ? -1 : 1, true);
        }
      }}
      className={[
        `flex h-14 items-center gap-2 px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-3 ${TASK_PLANNING_ITEM_FRAME_CLASS}`,
        focused ? 'ring-2 ring-inset ring-ring' : '',
        bulkSelection.selected ? 'bg-info/10 ring-1 ring-inset ring-info/40' : '',
        !bulkSelection.selected ? TASK_PLANNING_ITEM_BACKGROUND_CLASS : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        role={completed ? 'checkbox' : undefined}
        aria-checked={completed ? true : undefined}
        aria-label={completed
          ? `Mark Incomplete ${task.title}`
          : `Reopen Canceled ${task.title}`}
        disabled={pending}
        data-task-completion-control={completed ? true : undefined}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-success transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        onClick={() => void run(onReopen)}
      >
        {completed ? (
          <SquareCheckBig className="h-6 w-6" aria-hidden="true" />
        ) : (
          <CircleSlash2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        aria-pressed={bulkSelection.selected}
        aria-label={`${bulkSelection.selected ? 'Deselect' : 'Select'} ${task.title}`}
        className="flex h-full min-w-0 flex-1 items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={bulkSelection.onSelect}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium leading-5 text-foreground">
            {task.title}
          </span>
          <span className="block text-xs text-muted-foreground">
            {completed ? 'Completed' : 'Canceled'}
            {terminalAt ? (
              <>
                {' · '}
                <time dateTime={terminalAt}>{formatTaskTerminalDate(terminalAt)}</time>
              </>
            ) : null}
          </span>
        </span>
      </button>
      <TaskSourceIndicator task={task} />
    </article>
  );
}

function DeletedHierarchyRow({
  root,
  onRestore,
}: {
  root: DeletedTaskHierarchyRoot;
  onRestore: () => Promise<void>;
}) {
  const label = root.root_type === 'checklist_item'
    ? 'Checklist Item'
    : root.root_type[0].toUpperCase() + root.root_type.slice(1);
  return (
    <article className="flex min-h-14 items-center gap-3 px-3 py-2 sm:px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{root.title}</p>
        <p className="text-xs text-muted-foreground">
          Deleted {label} · <time dateTime={root.deleted_at}>{formatTaskTerminalDate(root.deleted_at)}</time>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void onRestore()}>
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Restore
        </Button>
      </div>
    </article>
  );
}

function DeletedTaskRow({
  task,
  focused,
  onFocusTask,
  onRestoreTaskFocus,
  onClearTaskFocus,
  onMoveFocus,
  bulkSelection,
  onRestore,
}: {
  task: TaskTodo;
  focused: boolean;
  onFocusTask: () => void;
  onRestoreTaskFocus: (taskId: string | null) => void;
  onClearTaskFocus: () => void;
  onMoveFocus: (direction: -1 | 1, wrap: boolean) => void;
  bulkSelection: {
    active: boolean;
    selected: boolean;
    onSelect: (event: MouseEvent<HTMLElement>) => void;
  };
  onRestore: () => Promise<void>;
}) {
  const [restoring, setRestoring] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const restoreWholeTaskFocus = (preferCurrent: boolean) => {
    const article = articleRef.current;
    const main = article?.closest('main') ?? null;
    const rows = Array.from(main?.querySelectorAll<HTMLElement>(
      '[data-task-row-focus-target][data-task-row-id]',
    ) ?? []);
    const currentIndex = rows.indexOf(article!);
    window.setTimeout(() => {
      if (preferCurrent && articleRef.current?.isConnected) {
        onRestoreTaskFocus(task.id);
        return;
      }
      const remaining = Array.from(main?.querySelectorAll<HTMLElement>(
        '[data-task-row-focus-target][data-task-row-id]',
      ) ?? []).filter((row) => row.dataset.taskRowId !== task.id);
      const target = remaining[currentIndex] ?? remaining[currentIndex - 1] ?? null;
      const targetTaskId = target?.dataset.taskRowId ?? null;
      if (targetTaskId !== null) {
        onRestoreTaskFocus(targetTaskId);
        return;
      }
      onRestoreTaskFocus(null);
      main?.querySelector<HTMLElement>('[data-task-view-heading]')?.focus();
    }, 0);
  };

  return (
    <article
      ref={articleRef}
      tabIndex={0}
      role="group"
      aria-label={task.title}
      aria-current={focused ? 'true' : undefined}
      aria-keyshortcuts="Space Shift+Space ArrowUp ArrowDown"
      data-task-row-id={task.id}
      data-task-row-focus-target
      data-task-search-id={task.id}
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;
        bulkSelection.onSelect(event);
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Tab' && focused) {
          onClearTaskFocus();
          return;
        }
        if (event.target !== event.currentTarget) return;
        if (event.key === ' ' && !bulkSelection.active) {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          event.preventDefault();
          if (event.repeat) return;
          if (!focused) {
            onFocusTask();
            return;
          }
          onMoveFocus(event.shiftKey ? -1 : 1, true);
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          if (!focused) return;
          event.preventDefault();
          onMoveFocus(event.key === 'ArrowUp' ? -1 : 1, true);
        }
      }}
      className={[
        `flex h-14 items-center gap-2 px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-3 ${TASK_PLANNING_ITEM_FRAME_CLASS}`,
        focused ? 'ring-2 ring-inset ring-ring' : '',
        bulkSelection.selected ? 'bg-info/10 ring-1 ring-inset ring-info/40' : '',
        !bulkSelection.selected ? TASK_PLANNING_ITEM_BACKGROUND_CLASS : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        disabled={restoring}
        aria-label={`Restore ${task.title}`}
        className="group/restore inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        onClick={() => {
          setRestoring(true);
          void onRestore()
            .then(() => restoreWholeTaskFocus(false))
            .catch(() => restoreWholeTaskFocus(true))
            .finally(() => setRestoring(false));
        }}
      >
        <Trash2
          className="h-5 w-5 group-hover/restore:hidden group-focus-visible/restore:hidden"
          aria-hidden="true"
        />
        <RotateCcw
          className="hidden h-5 w-5 group-hover/restore:block group-focus-visible/restore:block"
          aria-hidden="true"
        />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-5 text-foreground">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {task.lifecycle === 'open' ? 'Open' : task.lifecycle === 'completed' ? 'Completed' : 'Canceled'}
          {' · '}
          {task.deleted_at ? formatTaskTerminalDate(task.deleted_at) : getTaskViewLabel(task.destination)}
        </p>
      </div>
      <TaskSourceIndicator task={task} />
    </article>
  );
}

function TodayTaskSections({
  tasks,
  planningDate,
  retainedTaskId,
  retainedTaskPlacement,
  renderTask,
}: {
  tasks: TaskTodo[];
  planningDate: string;
  retainedTaskId: string | null;
  retainedTaskPlacement: RetainedTaskViewPlacement | null;
  renderTask: (task: TaskTodo, sectionTasks: TaskTodo[]) => ReactNode;
}) {
  const sections: Array<{
    id: TodayTaskSection;
    label: string;
    icon: typeof Clock2;
  }> = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'now', label: 'Now', icon: Clock2 },
    { id: 'next', label: 'Next', icon: Clock5 },
    { id: 'later', label: 'Later', icon: Clock8 },
  ];

  return (
    <div className="space-y-7">
      {sections.map(({ id, label, icon: Icon }) => {
        const sectionTasks = tasks.filter((task) => getTodayTaskSection(
          taskWithRetainedViewPlacement(task, retainedTaskId, retainedTaskPlacement),
          planningDate,
        ) === id);
        if (sectionTasks.length === 0) {
          return null;
        }
        return (
          <section key={id} aria-labelledby={`tasks-${id}-heading`}>
            <h3
              id={`tasks-${id}-heading`}
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              <TaskCountBadge count={sectionTasks.length} label="Tasks" />
            </h3>
            <div className={TASK_PLANNING_LIST_CLASS} data-task-planning-list>
              {sectionTasks.map((task) => renderTask(task, sectionTasks))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function UpcomingTaskSections({
  projects,
  tasks,
  planningDate,
  retainedTaskId,
  retainedTaskPlacement,
  renderProject,
  renderTask,
}: {
  projects: TaskProject[];
  tasks: TaskTodo[];
  planningDate: string;
  retainedTaskId: string | null;
  retainedTaskPlacement: RetainedTaskViewPlacement | null;
  renderProject: (project: TaskProject) => ReactNode;
  renderTask: (task: TaskTodo, sectionTasks: TaskTodo[]) => ReactNode;
}) {
  const currentTaskById = new Map(tasks.map((task) => [task.id, task]));
  const placementTasks = tasks.map((task) => taskWithRetainedViewPlacement(
    task,
    retainedTaskId,
    retainedTaskPlacement,
  ));
  const sections = getTaskUpcomingSections(projects, placementTasks, planningDate);
  if (sections.length === 0) return null;

  return (
    <div className="space-y-7" aria-label="Upcoming Tasks">
      {sections.map((section) => {
        const sectionTasks = section.entries.flatMap((entry) => (
          entry.kind === 'task'
            ? [currentTaskById.get(entry.item.id) ?? entry.item]
            : []
        ));
        return (
          <section
            key={section.key}
            aria-labelledby={`tasks-${section.key.replace(':', '-')}-heading`}
          >
            <h3
              id={`tasks-${section.key.replace(':', '-')}-heading`}
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"
            >
              {section.label}
              <TaskCountBadge count={section.entries.length} label="Items" />
            </h3>
            <div className={TASK_PLANNING_LIST_CLASS} data-task-planning-list>
              {section.entries.map((entry) => entry.kind === 'project'
                ? renderProject(entry.item)
                : renderTask(
                  currentTaskById.get(entry.item.id) ?? entry.item,
                  sectionTasks,
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskRow({
  task,
  hierarchy,
  selected,
  focused,
  onSelect,
  onActivate,
  onCloseEditor,
  onFocusTask,
  onRestoreTaskFocus,
  onClearTaskFocus,
  onMoveFocus,
  onRegisterAutosave,
  completionRequested,
  onToggleDeferredCompletion,
  reserveTerminalMutation,
  bulkSelection,
  onUpdate,
  onComplete,
  planningActions,
  draggableTask,
  onDropTask,
  planningLabel,
  planningDate,
  todayMarker,
  todayMarkerContext,
  reminder,
  reminderMode,
  reminderTimeZone,
  onSaveReminder,
  onCancelReminder,
  onDelete,
}: {
  task: TaskTodo;
  hierarchy: TaskHierarchyModel;
  selected: boolean;
  focused: boolean;
  onSelect: (event: MouseEvent<HTMLElement>) => void;
  onActivate: () => void;
  onCloseEditor: () => void;
  onFocusTask: () => void;
  onRestoreTaskFocus: (taskId: string | null) => void;
  onClearTaskFocus: () => void;
  onMoveFocus: (direction: -1 | 1, wrap: boolean) => void;
  onRegisterAutosave: (taskId: string, flush: () => Promise<void>) => void;
  completionRequested: boolean;
  onToggleDeferredCompletion: () => void;
  reserveTerminalMutation: () => TaskForwardMutationReservation | undefined;
  bulkSelection?: {
    selected: boolean;
    onKeyboardToggle: () => void;
    onToggle: (event: MouseEvent<HTMLElement>) => void;
  };
  onUpdate: (patch: EditableTaskPatch) => Promise<void>;
  onComplete: (reservation?: TaskForwardMutationReservation) => Promise<void>;
  planningActions: TaskTemporalAction[];
  draggableTask: boolean;
  onDropTask: (draggedTaskId: string, placement: 'before' | 'after') => Promise<void>;
  planningLabel?: string | null;
  planningDate: string;
  todayMarker?: TodayTaskSection;
  todayMarkerContext: 'Today' | 'Day Horizon';
  reminder: TaskReminder | null;
  reminderMode: TaskReminderAvailability;
  reminderTimeZone: string;
  onSaveReminder: (input: {
    localTime: string;
    ambiguityChoice: 'earlier' | 'later';
  }) => Promise<void>;
  onCancelReminder: () => Promise<void>;
  onDelete: (reservation?: TaskForwardMutationReservation) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [doOpen, setDoOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [dragPlacement, setDragPlacement] = useState<'before' | 'after' | null>(null);
  const [terminalSettling, setTerminalSettling] = useState(false);
  const [terminalExiting, setTerminalExiting] = useState(false);
  const [editorMounted, setEditorMounted] = useState(selected);
  const [editorExpanded, setEditorExpanded] = useState(selected);
  const articleRef = useRef<HTMLElement>(null);
  const editorRegionRef = useRef<HTMLDivElement>(null);
  const editorAnimationFrameRef = useRef<number | null>(null);
  const editorScrollFrameRef = useRef<number | null>(null);
  const editorUnmountTimerRef = useRef<number | null>(null);
  const suppressActionMenuAutoFocusRef = useRef(false);
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const suppressClickUntilRef = useRef(0);
  const pendingRef = useRef(false);
  const hierarchyLabel = getTaskHierarchyLabel(task, hierarchy);
  const taskLabel = task.title || 'New Task';
  const TodayMarkerIcon = todayMarker === 'now'
    ? Clock2
    : todayMarker === 'next'
      ? Clock5
      : todayMarker === 'later'
        ? Clock8
        : Inbox;
  const deadlineIsUrgent = task.deadline !== null
    && isTaskCalendarDate(task.deadline)
    && isTaskCalendarDate(planningDate)
    && task.deadline <= planningDate;

  useEffect(() => {
    const cancelScheduledMotion = () => {
      if (editorAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(editorAnimationFrameRef.current);
        editorAnimationFrameRef.current = null;
      }
      if (editorScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(editorScrollFrameRef.current);
        editorScrollFrameRef.current = null;
      }
      if (editorUnmountTimerRef.current !== null) {
        window.clearTimeout(editorUnmountTimerRef.current);
        editorUnmountTimerRef.current = null;
      }
    };
    cancelScheduledMotion();

    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ?? true;
    if (selected) {
      setEditorMounted(true);
      if (reducedMotion) {
        setEditorExpanded(true);
        editorScrollFrameRef.current = window.requestAnimationFrame(() => {
          editorScrollFrameRef.current = null;
          articleRef.current?.querySelector<HTMLElement>('[data-task-editor-title]')
            ?.scrollIntoView?.({ block: 'nearest' });
        });
        return cancelScheduledMotion;
      }

      setEditorExpanded(false);
      editorAnimationFrameRef.current = window.requestAnimationFrame(() => {
        editorAnimationFrameRef.current = window.requestAnimationFrame(() => {
          editorAnimationFrameRef.current = null;
          setEditorExpanded(true);
          editorScrollFrameRef.current = window.requestAnimationFrame(() => {
            editorScrollFrameRef.current = null;
            articleRef.current?.querySelector<HTMLElement>('[data-task-editor-title]')
              ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
          });
        });
      });
      return cancelScheduledMotion;
    }

    setEditorExpanded(false);
    if (reducedMotion) {
      setEditorMounted(false);
      return cancelScheduledMotion;
    }
    editorUnmountTimerRef.current = window.setTimeout(() => {
      editorUnmountTimerRef.current = null;
      setEditorMounted(false);
    }, TASK_EDITOR_EXPANSION_DURATION_MS);
    return cancelScheduledMotion;
  }, [selected]);

  useLayoutEffect(() => {
    const region = editorRegionRef.current;
    if (region === null) return;
    if (selected) region.removeAttribute('inert');
    else region.setAttribute('inert', '');
  }, [editorMounted, selected]);

  const run = async (operation: () => Promise<void>): Promise<boolean> => {
    if (pendingRef.current) {
      return false;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      await operation();
      return true;
    } catch {
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const getTaskTitleControls = () => Array.from(
    articleRef.current?.closest('main')?.querySelectorAll<HTMLElement>(
      '[data-task-row-focus-target][data-task-row-id]',
    ) ?? [],
  );

  const captureTaskFocus = () => {
    const controls = getTaskTitleControls();
    return {
      currentIndex: controls.indexOf(articleRef.current!),
      main: articleRef.current?.closest('main') ?? null,
    };
  };

  const restoreTaskFocus = (
    { main, currentIndex }: ReturnType<typeof captureTaskFocus>,
    preferCurrentTask = false,
    delay = 0,
  ) => {
    window.setTimeout(() => {
      if (preferCurrentTask && articleRef.current?.isConnected) {
        onRestoreTaskFocus(task.id);
        return;
      }
      const remaining = Array.from(main?.querySelectorAll<HTMLElement>(
        '[data-task-row-focus-target][data-task-row-id]',
      ) ?? []).filter(
        (control) => control.dataset.taskRowId !== task.id,
      );
      const fallback = main?.querySelector<HTMLElement>('[data-task-view-heading]');
      const target = remaining[currentIndex] ?? remaining[currentIndex - 1] ?? null;
      const targetTaskId = target?.dataset.taskRowId ?? null;
      if (targetTaskId !== null) {
        onRestoreTaskFocus(targetTaskId);
        return;
      }
      onRestoreTaskFocus(null);
      fallback?.focus();
    }, delay);
  };

  const restoreCurrentTaskFocus = () => {
    if (articleRef.current?.isConnected) onRestoreTaskFocus(task.id);
  };

  const runTerminalAction = async (
    operation: (reservation?: TaskForwardMutationReservation) => Promise<void>,
    animate = true,
    focusDelay = 0,
  ) => {
    if (pendingRef.current) return;
    suppressActionMenuAutoFocusRef.current = true;
    const focus = captureTaskFocus();
    const reservation = reserveTerminalMutation();
    pendingRef.current = true;
    setPending(true);
    if (animate) {
      setTerminalSettling(true);
      await waitForTaskMotion(TASK_TERMINAL_SETTLE_DELAY_MS);
      setTerminalSettling(false);
      setTerminalExiting(true);
      await waitForTaskMotion(TASK_TERMINAL_EXIT_ANIMATION_DURATION_MS);
    }
    try {
      await operation(reservation);
      restoreTaskFocus(focus, false, focusDelay);
    } catch {
      reservation?.cancel();
      setTerminalSettling(false);
      setTerminalExiting(false);
      window.setTimeout(restoreCurrentTaskFocus, 0);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const runMovementAction = async (operation: () => Promise<void>) => {
    const focus = captureTaskFocus();
    await operation();
    onCloseEditor();
    restoreTaskFocus(focus, true);
  };

  const movementPlanningActions = planningActions.map((action) => ({
    ...action,
    run: () => runMovementAction(action.run),
  }));
  const reminderTime = reminder?.local_time.slice(0, 5) ?? '';
  const applyStartPlanning = async ({
    destination,
    startDate,
    todaySection,
  }: {
    destination: TaskTodo['destination'];
    startDate: string | null;
    todaySection: TaskTodaySection | null;
  }) => {
    if (destination === 'someday' && (reminder || reminderTime)) {
      await onCancelReminder();
    }
    await onUpdate({
      destination,
      start_date: startDate,
      today_section: todaySection,
    });
  };
  const applyStartReminder = async (localTime: string) => {
    if (!localTime) {
      await onCancelReminder();
      return;
    }
    if (task.start_date === null && task.today_section === null) {
      await onUpdate({
        destination: 'anytime',
        start_date: null,
        today_section: 'inbox',
      });
    }
    await onSaveReminder({
      localTime,
      ambiguityChoice: 'earlier',
    });
  };
  const clearStart = async () => {
    if (reminder || reminderTime) await onCancelReminder();
    await onUpdate({
      destination: 'anytime',
      start_date: null,
      today_section: null,
    });
  };

  return (
    <article
      ref={articleRef}
      tabIndex={selected ? -1 : 0}
      role="group"
      aria-label={taskLabel}
      aria-current={focused ? 'true' : undefined}
      aria-keyshortcuts="Enter Space Shift+Space ArrowUp ArrowDown"
      data-task-row-id={task.id}
      data-task-row-focus-target
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (
          target?.closest(
            'button, a, input, textarea, select, [role="button"], [data-task-editor-region]',
          )
        ) return;
        onSelect(event);
      }}
      onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Tab' && focused) {
          onClearTaskFocus();
          return;
        }
        if (event.target !== event.currentTarget) return;
        if (event.key === ' ' && !bulkSelection) {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          event.preventDefault();
          if (event.repeat) return;
          if (!focused) {
            onFocusTask();
            return;
          }
          onMoveFocus(event.shiftKey ? -1 : 1, true);
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          if (!focused) return;
          event.preventDefault();
          onMoveFocus(event.key === 'ArrowUp' ? -1 : 1, true);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (bulkSelection) bulkSelection.onKeyboardToggle();
          else onActivate();
        }
      }}
      draggable={draggableTask && !pending}
      data-task-draggable={draggableTask ? 'true' : undefined}
      data-drag-placement={dragPlacement ?? undefined}
      onDragStart={(event) => {
        if (!draggableTask || pending) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-bathos-task-id', task.id);
        event.dataTransfer.setData('text/plain', task.id);
        suppressClickUntilRef.current = Date.now() + 1_000;
      }}
      onDragOver={(event) => {
        if (!draggableTask || pending) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const bounds = event.currentTarget.getBoundingClientRect();
        setDragPlacement(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragPlacement(null);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        const draggedTaskId = event.dataTransfer.getData('application/x-bathos-task-id')
          || event.dataTransfer.getData('text/plain');
        const placement = dragPlacement;
        setDragPlacement(null);
        if (!draggableTask || !draggedTaskId || draggedTaskId === task.id || placement === null) {
          return;
        }
        void run(() => onDropTask(draggedTaskId, placement));
      }}
      onDragEnd={() => {
        setDragPlacement(null);
        suppressClickUntilRef.current = Date.now() + 250;
      }}
      className={[
        `relative grid ${TASK_PLANNING_ITEM_FRAME_CLASS} transition-[grid-template-rows,opacity] ease-out focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none`,
        terminalExiting ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        focused ? 'ring-2 ring-inset ring-ring' : '',
        selected || bulkSelection?.selected
          ? 'bg-foreground/[0.05]'
          : TASK_PLANNING_ITEM_BACKGROUND_CLASS,
      ].filter(Boolean).join(' ') || undefined}
      style={{ transitionDuration: `${TASK_TERMINAL_EXIT_ANIMATION_DURATION_MS}ms` }}
      data-task-planning-card
      data-terminal-settling={terminalSettling ? 'true' : undefined}
      data-terminal-exiting={terminalExiting ? 'true' : undefined}
    >
      {dragPlacement ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-info ${
            dragPlacement === 'before' ? 'top-0' : 'bottom-0'
          }`}
        />
      ) : null}
      <div className="min-h-0 overflow-hidden">
      <div className="flex h-14 items-center gap-2 overflow-hidden px-1.5 sm:px-3" data-task-row-header>
        {bulkSelection ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={bulkSelection.selected}
            aria-label={`${bulkSelection.selected ? 'Deselect' : 'Select'} ${taskLabel}`}
            onClick={bulkSelection.onToggle}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-info transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {bulkSelection.selected ? (
              <CircleCheckBig className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Circle className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            aria-label={`${completionRequested ? 'Mark Incomplete' : 'Complete'} ${taskLabel}`}
            aria-pressed={selected ? completionRequested : undefined}
            data-task-completion-control
            onClick={() => {
              if (selected) {
                onToggleDeferredCompletion();
                return;
              }
              void runTerminalAction(onComplete);
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {completionRequested || terminalSettling ? (
              <SquareCheckBig className="h-6 w-6 text-success" aria-hidden="true" />
            ) : (
              <Square className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        )}
        <button
          ref={titleButtonRef}
          type="button"
          onClick={(event) => {
            if (Date.now() <= suppressClickUntilRef.current) {
              event.preventDefault();
              return;
            }
            onSelect(event);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
              return;
            }
          }}
          aria-expanded={bulkSelection ? undefined : selected}
          aria-label={task.title ? undefined : 'New Task'}
          aria-pressed={bulkSelection ? bulkSelection.selected : undefined}
          aria-keyshortcuts={bulkSelection
            ? 'Enter'
            : 'Enter'}
          data-task-title-control
          data-task-id={task.id}
          className={`flex h-full min-w-0 flex-1 flex-col justify-center overflow-hidden text-left text-[15px] font-medium leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${draggableTask ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {todayMarker ? (
              <span
                className="inline-flex shrink-0 text-warning"
                aria-label={`${todayMarkerContext} ${todayMarker[0].toUpperCase()}${todayMarker.slice(1)}`}
                title={`${todayMarkerContext} ${todayMarker[0].toUpperCase()}${todayMarker.slice(1)}`}
              >
                <TodayMarkerIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            ) : null}
            <span className="truncate">{task.title}</span>
          </span>
          {(
            hierarchyLabel
            || task.actionability !== 'actionable'
            || (planningLabel !== null && (planningLabel || task.start_date))
            || task.deadline
            || (reminder && (task.start_date || task.today_section))
          ) ? (
            <span
              className="mt-0.5 flex min-w-0 items-center gap-x-2.5 overflow-hidden whitespace-nowrap text-xs font-normal leading-4 text-muted-foreground"
              data-task-row-metadata
            >
              {hierarchyLabel ? (
                <span className="min-w-0 shrink truncate text-info" title={hierarchyLabel}>
                  {hierarchyLabel}
                </span>
              ) : null}
              {task.actionability === 'waiting' ? (
                <span className="inline-flex shrink-0 items-center gap-1" aria-label="Waiting">
                  <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
                  Waiting
                </span>
              ) : task.actionability === 'rechecking' ? (
                <span className="inline-flex shrink-0 items-center gap-1" aria-label="Rechecking">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Rechecking
                </span>
              ) : null}
              {planningLabel !== null && (planningLabel || task.start_date) ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1"
                  aria-label={`Starts ${planningLabel ?? formatTaskStartDateLabel(task.start_date!, planningDate)}`}
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  {planningLabel ?? formatTaskStartDateLabel(task.start_date!, planningDate)}
                </span>
              ) : null}
              {task.deadline ? (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 ${
                    deadlineIsUrgent ? 'text-destructive' : ''
                  }`}
                  aria-label={`Deadline ${formatTaskRelativeCalendarDate(task.deadline, planningDate)}`}
                >
                  <FlagTriangleRight className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatTaskRelativeCalendarDate(task.deadline, planningDate)}
                </span>
              ) : null}
              {reminder && (task.start_date || task.today_section) ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1 text-info"
                  aria-label={`Reminder ${formatReminderRowTime(reminder)}`}
                >
                  <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatReminderRowTime(reminder)}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
        {!bulkSelection ? <TaskSourceIndicator task={task} /> : null}
        {!bulkSelection ? <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="clear"
              size="icon"
              disabled={pending}
              aria-label={`Actions for ${taskLabel}`}
              className="h-10 w-10 text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (!suppressActionMenuAutoFocusRef.current) {
                restoreCurrentTaskFocus();
                return;
              }
              suppressActionMenuAutoFocusRef.current = false;
            }}
          >
            <DropdownMenuItem
              disabled={task.actionability === 'actionable'}
              onSelect={() => void run(() => onUpdate({ actionability: 'actionable' }))}
            >
              Mark as Actionable
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={task.actionability === 'waiting'}
              onSelect={() => void run(() => onUpdate({ actionability: 'waiting' }))}
            >
              Mark as Waiting
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={task.actionability === 'rechecking'}
              onSelect={() => void run(() => onUpdate({ actionability: 'rechecking' }))}
            >
              Mark as Rechecking
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => {
              suppressActionMenuAutoFocusRef.current = true;
              setMoveOpen(true);
            }}>
              Move...
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => {
              suppressActionMenuAutoFocusRef.current = true;
              setDoOpen(true);
            }}>
              Do...
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => {
              suppressActionMenuAutoFocusRef.current = true;
              setStartOpen(true);
            }}>
              Start...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => void runTerminalAction(onDelete, false, 50)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> : null}
      </div>
      {editorMounted && !bulkSelection ? (
        <div
          ref={editorRegionRef}
          data-bathos-form-scope="true"
          data-task-editor-region
          data-state={selected ? (editorExpanded ? 'open' : 'opening') : 'closing'}
          aria-hidden={selected ? undefined : true}
          className={[
            'grid overflow-hidden transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none',
            editorExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            selected ? '' : 'pointer-events-none',
          ].filter(Boolean).join(' ')}
          style={{ transitionDuration: `${TASK_EDITOR_EXPANSION_DURATION_MS}ms` }}
        >
          <div className="min-h-0 overflow-hidden">
            <TaskEditor
              task={task}
              hierarchy={hierarchy}
              onSave={onUpdate}
              reminder={reminder}
              reminderMode={reminderMode}
              reminderTimeZone={reminderTimeZone}
              planningDate={planningDate}
              onSaveReminder={onSaveReminder}
              onCancelReminder={onCancelReminder}
              onRegisterAutosave={onRegisterAutosave}
            />
            <button
              type="button"
              tabIndex={-1}
              data-bathos-form-submit="true"
              className="sr-only"
              onClick={onCloseEditor}
            >
              Close Task
            </button>
            <button
              type="button"
              tabIndex={-1}
              data-bathos-form-cancel="true"
              className="sr-only"
              onClick={onCloseEditor}
            >
              Close Task
            </button>
          </div>
        </div>
      ) : null}
      {!bulkSelection ? <TaskMoveDialog
        open={moveOpen}
        task={task}
        hierarchy={hierarchy}
        onOpenChange={(nextOpen) => {
          setMoveOpen(nextOpen);
        }}
        onCloseAutoFocus={restoreCurrentTaskFocus}
        onMove={(patch) => runMovementAction(() => onUpdate(patch))}
      /> : null}
      {!bulkSelection ? <TaskDoDialog
        open={doOpen}
        task={task}
        actions={movementPlanningActions}
        onOpenChange={(nextOpen) => {
          setDoOpen(nextOpen);
        }}
        onCloseAutoFocus={restoreCurrentTaskFocus}
      /> : null}
      {!bulkSelection ? <TaskStartDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        onCloseAutoFocus={restoreCurrentTaskFocus}
        task={task}
        reminder={reminder}
        reminderTime={reminderTime}
        reminderTimeZone={reminderTimeZone}
        reminderDisabled={reminderMode !== 'connected'}
        reminderUnavailableMessage={reminderMode === 'connected'
          ? null
          : getTaskReminderUnavailableMessage(reminderMode)}
        planningDate={planningDate}
        onPlanningChange={applyStartPlanning}
        onReminderChange={applyStartReminder}
        onClear={clearStart}
      /> : null}
      </div>
    </article>
  );
}

function TaskEditor({
  task,
  hierarchy,
  onSave,
  reminder,
  reminderMode,
  reminderTimeZone,
  planningDate,
  onSaveReminder,
  onCancelReminder,
  onRegisterAutosave,
}: {
  task: TaskTodo;
  hierarchy: TaskHierarchyModel;
  onSave: (patch: EditableTaskPatch) => Promise<void>;
  reminder: TaskReminder | null;
  reminderMode: TaskReminderAvailability;
  reminderTimeZone: string;
  planningDate: string;
  onSaveReminder: (input: {
    localTime: string;
    ambiguityChoice: 'earlier' | 'later';
  }) => Promise<void>;
  onCancelReminder: () => Promise<void>;
  onRegisterAutosave: (taskId: string, flush: () => Promise<void>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [primaryLink, setPrimaryLink] = useState(task.primary_link ?? '');
  const [actionability, setActionability] = useState(task.actionability);
  const [destination, setDestination] = useState(task.destination);
  const [startDate, setStartDate] = useState(task.start_date ?? '');
  const [todaySection, setTodaySection] = useState<TaskTodaySection | null>(task.today_section);
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [reminderTime, setReminderTime] = useState(reminder?.local_time.slice(0, 5) ?? '');
  const acceptedOrganization = taskOrganizationValue(task);
  const [organization, setOrganization] = useState(acceptedOrganization);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastOperationRef = useRef<Promise<void>>(Promise.resolve());
  const pendingTextPatchRef = useRef<EditableTaskPatch>({});
  const retryTaskPatchRef = useRef<EditableTaskPatch>({});
  const textAutosaveTimerRef = useRef<number | null>(null);
  const onSaveRef = useRef(onSave);
  const onSaveReminderRef = useRef(onSaveReminder);
  const onCancelReminderRef = useRef(onCancelReminder);
  onSaveRef.current = onSave;
  onSaveReminderRef.current = onSaveReminder;
  onCancelReminderRef.current = onCancelReminder;

  useEffect(() => {
    setActionability(task.actionability);
  }, [task.actionability]);

  useEffect(() => {
    setOrganization(acceptedOrganization);
  }, [acceptedOrganization]);

  useEffect(() => {
    setDestination(task.destination);
    setStartDate(task.start_date ?? '');
    setTodaySection(task.today_section);
  }, [task.destination, task.start_date, task.today_section]);

  useLayoutEffect(() => {
    const input = titleInputRef.current;
    if (input === null) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  }, [task.id]);

  const enqueueOperation = useCallback((operation: () => Promise<void>) => {
    const run = operationQueueRef.current.then(operation);
    operationQueueRef.current = run.catch(() => undefined);
    lastOperationRef.current = run;
    return run;
  }, []);

  const enqueueTaskPatch = useCallback((patch: EditableTaskPatch) => enqueueOperation(async () => {
    const retryPatch = retryTaskPatchRef.current;
    retryTaskPatchRef.current = {};
    const effectivePatch = { ...retryPatch, ...patch };
    if (Object.keys(effectivePatch).length === 0) return;
    try {
      await onSaveRef.current(effectivePatch);
    } catch (error) {
      retryTaskPatchRef.current = {
        ...effectivePatch,
        ...retryTaskPatchRef.current,
      };
      throw error;
    }
  }), [enqueueOperation]);

  const takePendingTextPatch = useCallback(() => {
    if (textAutosaveTimerRef.current !== null) {
      window.clearTimeout(textAutosaveTimerRef.current);
      textAutosaveTimerRef.current = null;
    }
    const patch = pendingTextPatchRef.current;
    pendingTextPatchRef.current = {};
    return patch;
  }, []);

  const scheduleTextPatch = useCallback((patch: EditableTaskPatch) => {
    pendingTextPatchRef.current = { ...pendingTextPatchRef.current, ...patch };
    if (textAutosaveTimerRef.current !== null) {
      window.clearTimeout(textAutosaveTimerRef.current);
    }
    textAutosaveTimerRef.current = window.setTimeout(() => {
      textAutosaveTimerRef.current = null;
      const pendingPatch = pendingTextPatchRef.current;
      pendingTextPatchRef.current = {};
      if (Object.keys(pendingPatch).length > 0) void enqueueTaskPatch(pendingPatch);
    }, TASK_EDITOR_TEXT_AUTOSAVE_DELAY_MS);
  }, [enqueueTaskPatch]);

  const removePendingTextField = useCallback((field: keyof EditableTaskPatch) => {
    const pendingPatch = { ...pendingTextPatchRef.current };
    delete pendingPatch[field];
    pendingTextPatchRef.current = pendingPatch;
    if (Object.keys(pendingPatch).length === 0 && textAutosaveTimerRef.current !== null) {
      window.clearTimeout(textAutosaveTimerRef.current);
      textAutosaveTimerRef.current = null;
    }
  }, []);

  const persistImmediateTaskPatch = useCallback((patch: EditableTaskPatch) => {
    const pendingTextPatch = takePendingTextPatch();
    return enqueueTaskPatch({ ...pendingTextPatch, ...patch });
  }, [enqueueTaskPatch, takePendingTextPatch]);

  const flushAutosave = useCallback(async () => {
    const pendingTextPatch = takePendingTextPatch();
    if (Object.keys(pendingTextPatch).length > 0) enqueueTaskPatch(pendingTextPatch);
    try {
      await lastOperationRef.current;
      if (Object.keys(retryTaskPatchRef.current).length > 0) {
        await enqueueTaskPatch({});
      }
    } catch (error) {
      if (Object.keys(retryTaskPatchRef.current).length === 0) throw error;
      await enqueueTaskPatch({});
    }
  }, [enqueueTaskPatch, takePendingTextPatch]);

  useLayoutEffect(() => {
    onRegisterAutosave(task.id, flushAutosave);
    return () => {
      void flushAutosave().catch(() => undefined);
    };
  }, [flushAutosave, onRegisterAutosave, task.id]);

  const persistReminder = useCallback((localTime: string) => {
    const pendingTextPatch = takePendingTextPatch();
    if (Object.keys(pendingTextPatch).length > 0) enqueueTaskPatch(pendingTextPatch);
    return enqueueOperation(() => onSaveReminderRef.current({
      localTime,
      ambiguityChoice: 'earlier',
    }));
  }, [enqueueOperation, enqueueTaskPatch, takePendingTextPatch]);

  const cancelReminder = useCallback(() => {
    const pendingTextPatch = takePendingTextPatch();
    if (Object.keys(pendingTextPatch).length > 0) enqueueTaskPatch(pendingTextPatch);
    return enqueueOperation(() => onCancelReminderRef.current());
  }, [enqueueOperation, enqueueTaskPatch, takePendingTextPatch]);

  const changeStartPlanning = async ({
    destination: nextDestination,
    startDate: nextStartDate,
    todaySection: nextTodaySection,
  }: {
    destination: TaskTodo['destination'];
    startDate: string | null;
    todaySection: TaskTodaySection | null;
  }) => {
    const canonicalTodaySection = nextStartDate === null ? nextTodaySection : null;
    setDestination(nextDestination);
    setStartDate(nextStartDate ?? '');
    setTodaySection(canonicalTodaySection);
    if (nextDestination === 'someday') {
      setReminderTime('');
      if (reminder !== null || reminderTime) await cancelReminder();
    }
    await persistImmediateTaskPatch({
      destination: nextDestination,
      start_date: nextStartDate,
      today_section: canonicalTodaySection,
    });
  };

  const changeReminderTime = async (nextReminderTime: string) => {
    setReminderTime(nextReminderTime);
    if (nextReminderTime) {
      if (!startDate && todaySection === null) {
        setTodaySection('inbox');
        setDestination('anytime');
        await persistImmediateTaskPatch({
          destination: 'anytime',
          start_date: null,
          today_section: 'inbox',
        });
      }
      await persistReminder(nextReminderTime);
    } else if (reminder !== null || reminderTime) {
      await cancelReminder();
    }
  };

  const clearStartPlanning = async () => {
    setDestination('anytime');
    setStartDate('');
    setTodaySection(null);
    setReminderTime('');
    if (reminder !== null || reminderTime) {
      void cancelReminder();
    }
    await persistImmediateTaskPatch({
      destination: 'anytime',
      start_date: null,
      today_section: null,
    });
  };

  const primaryLinkHref = getTaskPrimaryLinkHref(primaryLink);
  const primaryLinkOpensBrowserTab = getTaskPrimaryLinkKind(primaryLink) === 'link';

  return (
    <div
      className="space-y-3 px-1.5 pb-3 pt-1 sm:px-3"
      data-task-editor-form
    >
      <label className="sr-only" htmlFor={`task-title-${task.id}`}>
        Task Title
      </label>
      <Input
        ref={titleInputRef}
        id={`task-title-${task.id}`}
        data-task-editor-title
        aria-keyshortcuts="Meta+Enter Meta+Escape Control+Enter Control+Q Control+Shift+Q"
        value={title}
        onChange={(event) => {
          const nextTitle = event.target.value;
          setTitle(nextTitle);
          const normalizedTitle = nextTitle.trim();
          if (normalizedTitle) scheduleTextPatch({ title: normalizedTitle });
          else removePendingTextField('title');
        }}
      />
      <Suspense fallback={<div className="min-h-28" aria-label="Loading Task Notes" />}>
        <TaskMarkdownNotes
          id={`task-notes-${task.id}`}
          notes={notes}
          onChange={(nextNotes) => {
            setNotes(nextNotes);
            scheduleTextPatch({ notes: nextNotes });
          }}
          disabled={false}
        />
      </Suspense>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor={`task-primary-link-${task.id}`}>
          Primary Link
        </label>
        <div className="flex gap-2">
          <Input
            id={`task-primary-link-${task.id}`}
            type="url"
            value={primaryLink}
            placeholder="No Primary Link"
            inputMode="url"
            onChange={(event) => {
              const nextPrimaryLink = event.target.value;
              setPrimaryLink(nextPrimaryLink);
              scheduleTextPatch({ primary_link: nextPrimaryLink || null });
            }}
            onBlur={() => {
              if (primaryLink !== '' || task.primary_link === null) return;
              removePendingTextField('primary_link');
              void persistImmediateTaskPatch({ primary_link: null });
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 border-[hsl(var(--grid-sticky-line))] bg-background"
            aria-label="Open Primary Link"
            disabled={primaryLinkHref === null}
            onClick={() => {
              if (primaryLinkHref === null) return;
              window.open(
                primaryLinkHref,
                primaryLinkOpensBrowserTab ? '_blank' : '_self',
                'noopener,noreferrer',
              );
            }}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div data-task-editor-temporal-grid className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-start-${task.id}`}>
            Start
          </label>
          <TaskStartPickerField
            task={{
              ...task,
              destination,
              start_date: startDate || null,
              today_section: todaySection,
            }}
            reminder={reminder}
            reminderTime={reminderTime}
            reminderTimeZone={reminderTimeZone}
            reminderDisabled={reminderMode !== 'connected'}
            reminderUnavailableMessage={reminderMode === 'connected'
              ? null
              : getTaskReminderUnavailableMessage(reminderMode)}
            planningDate={planningDate}
            onPlanningChange={changeStartPlanning}
            onReminderChange={changeReminderTime}
            onClear={clearStartPlanning}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-deadline-${task.id}`}>
            Deadline
          </label>
          <DatePickerField
            id={`task-deadline-${task.id}`}
            value={deadline}
            displayValue={deadline
              ? formatTaskDateControlLabel(deadline, planningDate)
              : undefined}
            onValueChange={(value) => {
              setDeadline(value);
              void persistImmediateTaskPatch({ deadline: value || null });
            }}
            placeholder="No Deadline"
            aria-label="Deadline"
            todayDate={planningDate}
            clearable
            clearLabel="Clear"
          />
        </div>
      </div>
      <div data-task-editor-identity-grid className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-actionability-${task.id}`}>
            Actionability
          </label>
          <Select
            value={actionability}
            onValueChange={(value) => {
              const nextActionability = value as TaskTodo['actionability'];
              setActionability(nextActionability);
              void persistImmediateTaskPatch({ actionability: nextActionability });
            }}
          >
            <SelectTrigger id={`task-actionability-${task.id}`} aria-label="Actionability">
              <SelectValue />
            </SelectTrigger>
            <SelectContent data-task-editor-owned-surface="true">
              <SelectItem value="actionable">Actionable</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="rechecking">Rechecking</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-organization-${task.id}`}>
            Organization
          </label>
          <Select
            value={organization}
            onValueChange={(nextOrganization) => {
              setOrganization(nextOrganization);
              void persistImmediateTaskPatch(parseTaskOrganization(nextOrganization));
            }}
            disabled={hierarchy.loading}
          >
            <SelectTrigger id={`task-organization-${task.id}`} aria-label="Organization">
              <SelectValue />
            </SelectTrigger>
            <SelectContent data-task-editor-owned-surface="true">
              <SelectItem value="none">No Area or Project</SelectItem>
              {hierarchy.areas.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Areas</SelectLabel>
                  {hierarchy.areas.map((area) => (
                    <SelectItem key={area.id} value={`area:${area.id}`}>{area.title}</SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {hierarchy.projects.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Projects</SelectLabel>
                  {hierarchy.projects.map((project) => (
                    <SelectItem key={project.id} value={`project:${project.id}`}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

async function writeTaskClipboardText(
  textPromise: Promise<string>,
  event: ClipboardEvent,
): Promise<void> {
  if (
    typeof ClipboardItem !== 'undefined'
    && globalThis.navigator?.clipboard?.write
  ) {
    const item = new ClipboardItem({
      'text/plain': textPromise.then((text) => new Blob([text], { type: 'text/plain' })),
    });
    await globalThis.navigator.clipboard.write([item]);
    return;
  }
  const text = await textPromise;
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', text);
    return;
  }
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(text);
    return;
  }
  throw new Error('The browser clipboard is unavailable');
}

function createPlainTextTaskSnapshot(title: string): TaskClipboardSnapshot {
  return {
    title,
    notes: '',
    primaryLink: null,
    destination: 'anytime',
    todaySection: null,
    startDate: null,
    deadline: null,
    actionability: 'actionable',
    areaId: null,
    projectId: null,
    checklist: [],
    reminder: null,
    recurrence: null,
  };
}

function showTaskError(title: string, error: unknown): void {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
}

function showTaskHistoryBoundaryToast(direction: 'undo' | 'redo'): void {
  toast({
    title: direction === 'undo' ? 'Nothing to Undo' : 'Nothing to Redo',
  });
}

function showBrowserReminderError(title: string): void {
  toast({
    title,
    description: 'The browser reminder operation failed. In-app reminders remain available.',
    variant: 'destructive',
  });
}

function showReminderDeliveryError(title: string): void {
  toast({
    title,
    description: 'The reminder acknowledgement failed. The reminder remains available to retry.',
    variant: 'destructive',
  });
}

function formatReminderRowTime(reminder: TaskReminder): string {
  return (
    formatTaskReminderTimeDisplay(reminder.local_time)?.toUpperCase()
    ?? reminder.local_time.slice(0, 5)
  );
}

function formatTaskStartDateLabel(startDate: string, planningDate: string): string {
  const relative = formatTaskRelativeCalendarDate(startDate, planningDate);
  const remainingMatch = relative.match(/^(\d+) days left$/);
  return remainingMatch ? `In ${remainingMatch[1]} days` : relative;
}

function getTaskViewLabel(view: TaskShellView): string {
  if (view === 'anytime') return 'Anytime';
  if (view === 'someday') return 'Someday';
  if (view === 'done') return 'Done';
  if (view === 'upcoming') return 'Upcoming';
  if (view === 'projects') return 'Projects';
  if (view === 'project') return 'Project';
  if (view === 'area') return 'Area';
  if (view === 'templates') return 'Templates';
  if (view === 'config') return 'Config';
  if (view === 'search') return 'Search';
  return 'Today';
}

function isTaskNavigationActive(view: TaskShellView, path: string): boolean {
  return view === path.slice(1)
    || (path === '/projects' && (view === 'project' || view === 'area'));
}

function getTaskViewFromPath(pathname: string): TaskShellView {
  if (pathname.endsWith('/anytime')) return 'anytime';
  if (pathname.endsWith('/someday')) return 'someday';
  if (pathname.endsWith('/done')) return 'done';
  if (pathname.endsWith('/upcoming')) return 'upcoming';
  if (pathname.endsWith('/templates')) return 'templates';
  if (pathname.endsWith('/config')) return 'config';
  if (pathname.endsWith('/search')) return 'search';
  if (getTaskAreaIdFromPath(pathname)) return 'area';
  if (getTaskProjectIdFromPath(pathname)) return 'project';
  if (pathname.endsWith('/projects')) return 'projects';
  return 'today';
}

function getTaskProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/projects\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getTaskAreaIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/areas\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getTaskSectionLabel(view: TaskListView): string {
  if (view === 'anytime') return 'Anytime Tasks';
  if (view === 'someday') return 'Someday Tasks';
  if (view === 'done') return 'Done Tasks';
  if (view === 'upcoming') return 'Upcoming Tasks';
  return 'Today Tasks';
}

function getTaskHierarchyLabel(task: TaskTodo, hierarchy: TaskHierarchyModel): string | null {
  if (task.project_id) {
    const project = hierarchy.projects.find(({ id }) => id === task.project_id);
    if (!project) return 'Unavailable Project';
    return project.title;
  }
  if (task.area_id) {
    return hierarchy.areas.find(({ id }) => id === task.area_id)?.title ?? 'Unavailable Area';
  }
  return null;
}

function taskOrganizationValue(task: TaskTodo): string {
  if (task.project_id) return `project:${task.project_id}`;
  if (task.area_id) return `area:${task.area_id}`;
  return 'none';
}

function parseTaskOrganization(
  organization: string,
): Pick<TaskTodo, 'area_id' | 'project_id'> {
  if (organization.startsWith('project:')) {
    return {
      area_id: null,
      project_id: organization.slice('project:'.length),
    };
  }
  if (organization.startsWith('area:')) {
    return {
      area_id: organization.slice('area:'.length),
      project_id: null,
    };
  }
  return { area_id: null, project_id: null };
}

function formatTaskTerminalDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf())
    ? timestamp
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
