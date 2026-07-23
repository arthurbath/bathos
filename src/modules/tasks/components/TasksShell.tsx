import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type DragEvent,
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
  CircleHelp,
  CircleSlash2,
  Cloud,
  Clock2,
  Clock5,
  Clock8,
  CornerDownLeft,
  DatabaseBackup,
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
import { toast } from '@/hooks/use-toast';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { CARD_PAGE_BOTTOM_PADDING_CLASS } from '@/lib/pageLayout';
import type {
  EditableTaskPatch,
  TaskPlanningMoveInput,
} from '@/modules/tasks/data/taskRepository';
import type { TaskPortabilityService } from '@/modules/tasks/data/taskPortability';
import {
  addTaskCalendarDays,
  formatTaskRelativeCalendarDate,
} from '@/modules/tasks/domain/taskDates';
import {
  TaskKeyboardHelpDialog,
  TaskBulkCommandDialog,
  TaskBulkWhenDialog,
  TaskMoveDialog,
  TaskSearchDialog,
  TaskWhenDialog,
  type TaskTemporalAction,
  type TaskBulkCommandMode,
} from '@/modules/tasks/components/TaskCommandSurfaces';
import {
  TaskQuickFindDialog,
  TaskSearchResultsView,
} from '@/modules/tasks/components/TaskQuickFind';
import {
  getTaskTodayMembershipSection,
  getTodayTaskSection,
  useTaskList,
  type TaskListView,
  type TodayTaskSection,
} from '@/modules/tasks/hooks/useTaskList';
import { useTaskHierarchy, type TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import { useTaskSearch } from '@/modules/tasks/hooks/useTaskSearch';
import { useTaskUndo } from '@/modules/tasks/hooks/useTaskUndo';
import { useTaskReminders } from '@/modules/tasks/hooks/useTaskReminders';
import type { TaskWebPushModel } from '@/modules/tasks/hooks/useTaskWebPush';
import {
  useTaskDeletedHierarchyRoots,
  type DeletedTaskHierarchyRoot,
} from '@/modules/tasks/hooks/useTaskDeletedHierarchyRoots';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type {
  TaskReminder,
  TaskTodaySection,
  TaskTodo,
} from '@/modules/tasks/types/tasks';
import { normalizeTaskEditorPlanningPatch } from '@/modules/tasks/components/taskEditorPlanning';
import { TaskProjectDetailView } from '@/modules/tasks/components/TaskProjectDetailView';
import { TaskAreaDetailView } from '@/modules/tasks/components/TaskAreaDetailView';
import { TaskProjectsView } from '@/modules/tasks/components/TaskProjectsView';
import { TaskTemplatesView } from '@/modules/tasks/components/TaskTemplatesView';
import { TaskDataPortabilityDialog } from '@/modules/tasks/components/TaskDataPortabilityDialog';
import { TaskPlanningProjects } from '@/modules/tasks/components/TaskPlanningProjects';
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
  getTaskUpcomingDate,
  getTaskUpcomingGroup,
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
  cycleTaskShortcutHorizon,
  getTaskTodayShortcutHorizon,
} from '@/modules/tasks/domain/taskShortcutPlanning';

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
const TASK_EDITOR_EXPANSION_DURATION_MS = 150;

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
  'view-projects': '/projects',
  'view-templates': '/templates',
  'view-config': '/config',
};

type TaskShellView = TaskListView | 'projects' | 'project' | 'area' | 'templates' | 'config' | 'search';

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
    || view === 'someday';
  const {
    mode,
    syncState,
    pendingUploadCount,
    portabilityService,
    prepareForSignOut,
  } = useTasksRuntime();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const hierarchy = useTaskHierarchy(userId);
  const deletedHierarchyRoots = useTaskDeletedHierarchyRoots(userId);
  const {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    moveTask,
    moveTasks,
    reorderTask,
    reorderTaskTo,
    transitionTask,
    duplicateTask,
    planningDate,
  } = useTaskList(userId, taskListView, selectedTaskId);
  const {
    available: taskUndoAvailable,
    redoAvailable: taskRedoAvailable,
    pending: taskUndoPending,
    undo: undoLastTaskChange,
    redo: redoLastTaskChange,
  } = useTaskUndo(userId);
  const planningProjects = useMemo(() => deriveTaskViewProjects(
    hierarchy.projects,
    userId,
    taskListView,
    planningDate,
  ), [hierarchy.projects, planningDate, taskListView, userId]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deferredCompletionTaskIds, setDeferredCompletionTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(() => new Set());
  const [bulkSelectionAnchorId, setBulkSelectionAnchorId] = useState<string | null>(null);
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
  const captureInputRef = useRef<HTMLInputElement>(null);
  const commandReturnFocusRef = useRef<HTMLElement | null>(null);
  const acknowledgedPushDeliveriesRef = useRef(new Set<string>());
  const selectedTaskIdRef = useRef<string | null>(null);
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
  const taskViewIsEmpty = view === 'done'
    ? tasks.length === 0 && doneRoots.length === 0 && planningProjects.length === 0
    : tasks.length === 0 && planningProjects.length === 0;
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
      await undoLastTaskChange();
    } catch (undoError) {
      showTaskError('Task Change Could Not Be Undone', undoError);
    }
  }, [undoLastTaskChange]);

  const runTaskRedo = useCallback(async () => {
    try {
      await redoLastTaskChange();
    } catch (redoError) {
      showTaskError('Task Change Could Not Be Redone', redoError);
    }
  }, [redoLastTaskChange]);

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
    void transitionTask(taskId, 'complete').catch((completeError) => {
      showTaskError('Task Could Not Be Completed', completeError);
    });
  }, [setDeferredCompletions, transitionTask]);

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
    if (clearPageFocus && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    selectedTaskIdRef.current = taskId;
    setSelectedTaskId(taskId);
    if (currentTaskId !== null) finalizeDeferredCompletion(currentTaskId);
    return true;
  }, [finalizeDeferredCompletion]);

  const openRelativeTask = useCallback((direction: -1 | 1) => {
    const controls = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-task-title-control][data-task-id]',
    ));
    if (controls.length === 0) return;
    const currentTaskId = selectedTaskIdRef.current;
    const currentIndex = currentTaskId === null
      ? -1
      : controls.findIndex((control) => control.dataset.taskId === currentTaskId);
    const targetIndex = currentTaskId === null
      ? direction === 1 ? 0 : controls.length - 1
      : currentIndex + direction;
    const targetTaskId = controls[targetIndex]?.dataset.taskId ?? null;
    void setOpenTask(targetTaskId);
  }, [setOpenTask]);

  const clearTaskSelection = useCallback(() => {
    setBulkSelection(new Set());
    setBulkSelectionAnchorId(null);
    setBulkMode(false);
  }, []);

  useEffect(() => {
    if (!bulkMode) return undefined;

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
  }, [bulkCommandMode, bulkMode, bulkWhenOpen, clearTaskSelection]);

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
    void setOpenTask(null);
    clearTaskSelection();
    setBulkWhenOpen(false);
    captureInputRef.current?.focus();
  }, [clearTaskSelection, setOpenTask, view]);

  useEffect(() => {
    const visibleIds = new Set(tasks.map(({ id }) => id));
    setBulkSelection((current) => {
      const next = new Set(Array.from(current).filter((taskId) => visibleIds.has(taskId)));
      return next.size === current.size ? current : next;
    });
    setBulkSelectionAnchorId((current) => (
      current === null || visibleIds.has(current)
        ? current
        : Array.from(bulkSelection).find((taskId) => visibleIds.has(taskId)) ?? null
    ));
  }, [bulkSelection, tasks]);

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
    if (bulkMode && bulkSelection.size > 0) {
      return tasks.filter((task) => bulkSelection.has(task.id));
    }
    const taskId = selectedTaskIdRef.current;
    if (taskId === null) return [];
    const task = tasks.find((candidate) => candidate.id === taskId);
    return task ? [task] : [];
  }, [bulkMode, bulkSelection, tasks]);

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

  const runPlanningShortcut = useCallback(async (
    command: 'today' | 'anytime' | 'someday' | 'horizon',
  ) => {
    const targets = getTaskCommandTargets();
    if (targets.length === 0) return;
    try {
      if (command === 'anytime' || command === 'someday') {
        await moveTasks(targets.map(({ id }) => id), {
          destination: command,
          todaySection: null,
          startDate: null,
        });
        await cancelTaskReminders(targets);
        return;
      }
      const eligible = command === 'horizon'
        ? targets.filter((task) => task.start_date !== null)
        : targets;
      const groups = new Map<string, {
        todaySection: TaskTodaySection;
        startDate: string | null;
        tasks: TaskTodo[];
      }>();
      for (const task of eligible) {
        const horizon = command === 'today'
          ? getTaskTodayShortcutHorizon(task, planningDate)
          : cycleTaskShortcutHorizon(task.today_section);
        const startDate = command === 'today' ? null : task.start_date;
        const key = `${horizon}:${startDate ?? ''}`;
        const group = groups.get(key);
        if (group) group.tasks.push(task);
        else groups.set(key, { todaySection: horizon, startDate, tasks: [task] });
      }
      for (const group of groups.values()) {
        await moveTasks(group.tasks.map(({ id }) => id), {
          destination: 'anytime',
          todaySection: group.todaySection,
          startDate: group.startDate,
        });
      }
      if (command === 'today') await cancelTaskReminders(targets);
    } catch (shortcutError) {
      showTaskError('Task Command Could Not Be Applied', shortcutError);
    }
  }, [cancelTaskReminders, getTaskCommandTargets, moveTasks, planningDate]);

  const runDuplicateShortcut = useCallback(async () => {
    const targets = getTaskCommandTargets();
    if (targets.length === 0) return;
    try {
      for (const task of targets) await duplicateTask(task.id);
    } catch (duplicateError) {
      showTaskError('Task Could Not Be Duplicated', duplicateError);
    }
  }, [duplicateTask, getTaskCommandTargets]);

  const openTaskCommandField = useCallback((
    mode: TaskBulkCommandMode,
  ) => {
    const targets = getTaskCommandTargets();
    const eligibleTargets = mode === 'reminder'
      ? targets.filter((task) => task.start_date !== null)
      : targets;
    if (eligibleTargets.length === 0) return;
    if (bulkMode && bulkSelection.size > 0) {
      commandReturnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      setBulkCommandMode(mode);
      return;
    }
    const task = eligibleTargets[0];
    const controlId = mode === 'start'
      ? `task-start-date-${task.id}`
      : mode === 'deadline'
        ? `task-deadline-${task.id}`
        : mode === 'organization'
          ? `task-organization-${task.id}`
          : `task-reminder-time-${task.id}`;
    window.setTimeout(() => {
      const control = document.getElementById(controlId);
      if (!(control instanceof HTMLElement)) return;
      control.focus();
      if (mode === 'start' || mode === 'deadline') {
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
  }, [bulkMode, bulkSelection.size, getTaskCommandTargets]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
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
        clearTaskSelection();
        return;
      }
      const command = getTaskKeyboardCommand(event, macLikePlatform);
      if (command === null) return;
      if (command === 'select-all') {
        if (isTaskEditableTarget(event.target) || !bulkEligible || tasks.length === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.isComposing) return;
        const visibleTaskIds = tasks.map(({ id }) => id);
        void setOpenTask(null).then((closed) => {
          if (!closed) return;
          setBulkMode(true);
          setBulkSelection(new Set(visibleTaskIds));
          setBulkSelectionAnchorId(visibleTaskIds[0] ?? null);
        });
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.isComposing) return;

      if (command === 'undo') {
        if (taskUndoAvailable && !taskUndoPending) void runTaskUndo();
        return;
      }
      if (command === 'redo') {
        if (taskRedoAvailable && !taskUndoPending) void runTaskRedo();
        return;
      }
      if (command === 'capture') {
        if (captureInputRef.current) {
          captureInputRef.current.focus();
        } else {
          void setOpenTask(null).then((closed) => {
            if (closed) navigate(`${basePath}/today`);
          });
        }
        return;
      }
      if (command === 'find') {
        commandReturnFocusRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        setQuickFindOpen(true);
        return;
      }
      if (command === 'help') {
        commandReturnFocusRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        setKeyboardHelpOpen(true);
        return;
      }
      const path = taskCommandPaths[command];
      if (path) {
        void setOpenTask(null).then((closed) => {
          if (closed) navigate(`${basePath}${path}`);
        });
        return;
      }
      if (command === 'complete-open') {
        const taskId = selectedTaskIdRef.current;
        if (taskId !== null) toggleDeferredCompletion(taskId);
        return;
      }
      if (command === 'plan-today') {
        void runPlanningShortcut('today');
        return;
      }
      if (command === 'plan-anytime') {
        void runPlanningShortcut('anytime');
        return;
      }
      if (command === 'plan-someday') {
        void runPlanningShortcut('someday');
        return;
      }
      if (command === 'cycle-horizon') {
        void runPlanningShortcut('horizon');
        return;
      }
      if (command === 'duplicate') {
        void runDuplicateShortcut();
        return;
      }
      if (command === 'open-start-date') {
        openTaskCommandField('start');
        return;
      }
      if (command === 'open-deadline') {
        openTaskCommandField('deadline');
        return;
      }
      if (command === 'open-organization') {
        openTaskCommandField('organization');
        return;
      }
      if (command === 'focus-reminder') {
        openTaskCommandField('reminder');
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
      if (command === 'close-editor') void setOpenTask(null, true);
    };

    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (getTaskKeyboardCommand(event, macLikePlatform) !== 'close-editor') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.isComposing) void setOpenTask(null, true);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [
    basePath,
    bulkCommandMode,
    bulkEligible,
    bulkMode,
    bulkWhenOpen,
    clearTaskSelection,
    keyboardHelpOpen,
    macLikePlatform,
    navigate,
    openTaskCommandField,
    openRelativeTask,
    runDuplicateShortcut,
    runPlanningShortcut,
    runTaskRedo,
    runTaskUndo,
    setOpenTask,
    taskRedoAvailable,
    taskUndoAvailable,
    taskUndoPending,
    tasks,
    toggleDeferredCompletion,
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
      const fallback = captureInputRef.current
        ?? document.querySelector<HTMLElement>('[data-task-view-heading]');
      fallback?.focus();
    }, 0);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || creating) {
      return;
    }

    setCreating(true);
    try {
      await createTask(title);
      setNewTaskTitle('');
      captureInputRef.current?.focus();
    } catch (createError) {
      showTaskError('Task Could Not Be Added', createError);
    } finally {
      setCreating(false);
    }
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
          await moveTask(task.id, input);
          if (input.startDate === null) await cancelTaskReminders([task]);
          else if (input.startDate) await rescheduleTaskReminders([task]);
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
        todaySection: section,
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
      if (input.startDate === null) await cancelTaskReminders(selectedTasks);
      else if (input.startDate) await rescheduleTaskReminders(selectedTasks);
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
          const groups = new Map<TodayTaskSection, string[]>();
          for (const task of selectedTasks) {
            const section = getTodayTaskSection(task, planningDate);
            groups.set(section, [...(groups.get(section) ?? []), task.id]);
          }
          await Promise.all(Array.from(groups, ([todaySection, taskIds]) => moveTasks(taskIds, {
            destination: 'anytime',
            todaySection,
            startDate: addTaskCalendarDays(planningDate, 1),
          })));
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
    event: MouseEvent<HTMLButtonElement>,
    taskId: string,
  ) => {
    const next = applyTaskSelectionGesture({
      active: bulkMode,
      anchorId: bulkSelectionAnchorId,
      selectedIds: bulkSelection,
    }, {
      taskId,
      visibleTaskIds: tasks.map(({ id }) => id),
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      macLikePlatform,
    });
    if (!bulkEligible || next === null) {
      void setOpenTask(selectedTaskIdRef.current === taskId ? null : taskId);
      return;
    }
    event.preventDefault();
    void setOpenTask(null);
    setBulkMode(next.active);
    setBulkSelectionAnchorId(next.anchorId);
    setBulkSelection(next.selectedIds);
  };

  const renderActiveTask = (task: TaskTodo, sectionTasks: TaskTodo[]) => {
    const index = sectionTasks.findIndex((candidate) => candidate.id === task.id);
    return (
      <TaskRow
        key={task.id}
        task={task}
        hierarchy={hierarchy}
        selected={selectedTaskId === task.id}
        onSelect={(event) => handleTaskPointerSelection(event, task.id)}
        onCloseEditor={() => void setOpenTask(null)}
        onRegisterAutosave={registerTaskEditorAutosave}
        completionRequested={deferredCompletionTaskIds.has(task.id)}
        onToggleDeferredCompletion={() => toggleDeferredCompletion(task.id)}
        bulkSelection={bulkMode ? {
          selected: bulkSelection.has(task.id),
          onToggle: () => setBulkSelection((current) => {
            const next = new Set(current);
            if (next.has(task.id)) next.delete(task.id);
            else next.add(task.id);
            return next;
          }),
        } : undefined}
        onUpdate={async (patch) => {
          try {
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
        onComplete={async () => {
          try {
            await transitionTask(task.id, 'complete');
          } catch (completeError) {
            showTaskError('Task Could Not Be Completed', completeError);
            throw completeError;
          }
        }}
        onCancel={async () => {
          try {
            await transitionTask(task.id, 'cancel');
          } catch (cancelError) {
            showTaskError('Task Could Not Be Canceled', cancelError);
            throw cancelError;
          }
        }}
        planningActions={planningActionsForTask(task)}
        onMoveUp={(view === 'today' || view === 'anytime' || view === 'someday') && index > 0 ? async () => {
          try {
            await reorderTask(task.id, 'up');
          } catch (reorderError) {
            showTaskError('Task Could Not Be Reordered', reorderError);
            throw reorderError;
          }
        } : undefined}
        onMoveDown={(view === 'today' || view === 'anytime' || view === 'someday')
          && index >= 0
          && index < sectionTasks.length - 1 ? async () => {
          try {
            await reorderTask(task.id, 'down');
          } catch (reorderError) {
            showTaskError('Task Could Not Be Reordered', reorderError);
            throw reorderError;
          }
        } : undefined}
        draggableTask={!bulkMode
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
        reminder={reminders.byRootId.get(task.id) ?? null}
        reminderMode={reminderAvailability}
        reminderTimeZone={reminders.planningTimeZone}
        onSaveReminder={async (input) => {
          try {
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
          const reminder = reminders.byRootId.get(task.id);
          if (!reminder) return;
          try {
            await reminders.cancel(reminder);
          } catch (reminderError) {
            showTaskError('Reminder Could Not Be Canceled', reminderError);
            throw reminderError;
          }
        }}
        onDelete={async () => {
          try {
            await transitionTask(task.id, 'delete');
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
        const groups = new Map<TaskTodaySection, string[]>();
        for (const task of targets) {
          const todaySection = task.today_section ?? 'next';
          groups.set(todaySection, [...(groups.get(todaySection) ?? []), task.id]);
        }
        for (const [todaySection, taskIds] of groups) {
          await moveTasks(taskIds, {
            destination: 'anytime',
            todaySection,
            startDate: value,
          });
        }
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
      const targets = getTaskCommandTargets().filter((task) => task.start_date !== null);
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

      <main className={`mx-auto w-full max-w-3xl px-4 pt-8 md:pt-10 ${bulkMode ? 'pb-44 md:pb-36' : CARD_PAGE_BOTTOM_PADDING_CLASS}`}>
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
                aria-label="Search Tasks and Views"
                onClick={() => openCommandSurface(setSearchOpen)}
                className="h-9 w-9 text-muted-foreground"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="clear"
                size="icon"
                aria-label="Keyboard Commands"
                aria-keyshortcuts="Meta+/ Control+/"
                onClick={() => openCommandSurface(setKeyboardHelpOpen)}
                className="h-9 w-9 text-muted-foreground"
              >
                <CircleHelp className="h-4 w-4" aria-hidden="true" />
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

          {!bulkMode && view !== 'projects' && view !== 'project' && view !== 'area' && view !== 'templates' && view !== 'config' && (view === 'today' || view === 'anytime' || view === 'someday') ? (
            <form onSubmit={handleCreate} className="relative">
              <Plus
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={captureInputRef}
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={creating}
                aria-label="Add a Task"
                aria-keyshortcuts="Meta+N Control+N Enter"
                autoComplete="off"
                placeholder="Add a Task"
                className="h-14 rounded-md pl-12 pr-14 text-base"
              />
              <Button
                type="submit"
                variant="clear"
                size="icon"
                disabled={!newTaskTitle.trim() || creating}
                aria-label="Add Task"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <CornerDownLeft className="h-4 w-4" />
              </Button>
            </form>
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
              reminderTimeZone={reminders.planningTimeZone}
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
                      className="mb-2 text-sm font-semibold text-muted-foreground"
                    >
                      Deleted ({doneRoots.length})
                    </h3>
                  <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
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
                      className="mb-2 text-sm font-semibold text-muted-foreground"
                    >
                      To-Dos ({tasks.length})
                    </h3>
                    <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                      {tasks.map((task) => task.disposition === 'deleted' ? (
                        <DeletedTaskRow
                          key={task.id}
                          task={task}
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
                  renderTask={renderActiveTask}
                />
              </div>
            ) : (
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
                  onReopen={async (project) => {
                    try {
                      await hierarchy.transitionProject(project.id, 'reopen_project');
                    } catch (reopenError) {
                      showTaskError('Project Could Not Be Reopened', reopenError);
                      throw reopenError;
                    }
                  }}
                />
                {tasks.length > 0 && view === 'upcoming' ? (
                  <UpcomingTaskSections
                    tasks={tasks}
                    planningDate={planningDate}
                    renderTask={renderActiveTask}
                  />
                ) : tasks.length > 0 ? (
                  <section aria-label="Tasks">
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                      Tasks ({tasks.length})
                    </h3>
                    <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                      {tasks.map((task) => renderActiveTask(task, tasks))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </section>}
        </div>
      </main>

      {bulkMode ? (
        <TaskBulkToolbar
          selectedCount={bulkSelection.size}
          totalCount={tasks.length}
          pending={bulkPending}
          onSelectAll={() => setBulkSelection(new Set(tasks.map(({ id }) => id)))}
          onClear={() => setBulkSelection(new Set())}
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
          ? tasks.filter((task) => bulkSelection.has(task.id) && task.start_date !== null).length
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
  onSelectAll,
  onClear,
  onPlan,
  onDone,
}: {
  selectedCount: number;
  totalCount: number;
  pending: boolean;
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || selectedCount === 0}
        onClick={onPlan}
      >
        Plan Selected
      </Button>
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
  webPush,
  connected,
  onEnableBrowserReminders,
  onDisableBrowserReminders,
  portabilityService,
  replaceAvailable,
  replaceUnavailableReason,
}: {
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
  onReopen,
}: {
  task: TaskTodo;
  onReopen: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const completed = task.lifecycle === 'completed';
  const Icon = completed ? CheckCircle2 : CircleSlash2;
  const terminalAt = completed ? task.completed_at : task.canceled_at;
  const run = async (operation: () => Promise<void>) => {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await operation();
    } finally {
      setPending(false);
    }
  };

  return (
    <article
      tabIndex={-1}
      data-task-search-id={task.id}
      className="flex min-h-16 items-center gap-3 px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
    >
      <Icon
        className={`h-5 w-5 shrink-0 ${completed ? 'text-success' : 'text-muted-foreground'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 py-3">
        <p className="truncate text-[15px] font-medium leading-5 text-foreground">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {completed ? 'Completed' : 'Canceled'}
          {terminalAt ? (
            <>
              {' · '}
              <time dateTime={terminalAt}>{formatTaskTerminalDate(terminalAt)}</time>
            </>
          ) : null}
        </p>
      </div>
      <TaskSourceIndicator task={task} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label={`Reopen ${task.title}`}
        className="gap-1.5"
        onClick={() => void run(onReopen)}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Reopen
      </Button>
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
  onRestore,
}: {
  task: TaskTodo;
  onRestore: () => Promise<void>;
}) {
  const [restoring, setRestoring] = useState(false);

  return (
    <article className="flex min-h-16 items-center gap-3 px-2 sm:px-4">
      <Trash2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 py-3">
        <p className="truncate text-[15px] font-medium leading-5 text-foreground">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {task.lifecycle === 'open' ? 'Open' : task.lifecycle === 'completed' ? 'Completed' : 'Canceled'}
          {' · '}
          {task.deleted_at ? formatTaskTerminalDate(task.deleted_at) : getTaskViewLabel(task.destination)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={restoring}
          aria-label={`Restore ${task.title}`}
          className="gap-1.5"
          onClick={() => {
            setRestoring(true);
            void onRestore().finally(() => setRestoring(false));
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Restore
        </Button>
      </div>
    </article>
  );
}

function TodayTaskSections({
  tasks,
  planningDate,
  renderTask,
}: {
  tasks: TaskTodo[];
  planningDate: string;
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
        const sectionTasks = tasks.filter((task) => getTodayTaskSection(task, planningDate) === id);
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
              {label} ({sectionTasks.length})
            </h3>
            <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
              {sectionTasks.map((task) => renderTask(task, sectionTasks))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function UpcomingTaskSections({
  tasks,
  planningDate,
  renderTask,
}: {
  tasks: TaskTodo[];
  planningDate: string;
  renderTask: (task: TaskTodo, sectionTasks: TaskTodo[]) => ReactNode;
}) {
  const groups = new Map<string, {
    label: string;
    date: string;
    tasks: TaskTodo[];
  }>();
  for (const task of tasks) {
    const date = getTaskUpcomingDate(task, planningDate);
    if (date === null) continue;
    const group = getTaskUpcomingGroup(date, planningDate);
    const current = groups.get(group.key);
    if (current) {
      current.tasks.push(task);
    } else {
      groups.set(group.key, { label: group.label, date: group.date, tasks: [task] });
    }
  }

  return (
    <div className="space-y-7" aria-label="Upcoming Tasks">
      {[...groups.entries()]
        .sort(([, left], [, right]) => left.date.localeCompare(right.date))
        .map(([key, group]) => (
          <section key={key} aria-labelledby={`tasks-${key.replace(':', '-')}-heading`}>
            <h3
              id={`tasks-${key.replace(':', '-')}-heading`}
              className="mb-2 text-sm font-semibold text-muted-foreground"
            >
              {group.label} ({group.tasks.length})
            </h3>
            <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
              {group.tasks.map((task) => renderTask(task, group.tasks))}
            </div>
          </section>
        ))}
    </div>
  );
}

function TaskRow({
  task,
  hierarchy,
  selected,
  onSelect,
  onCloseEditor,
  onRegisterAutosave,
  completionRequested,
  onToggleDeferredCompletion,
  bulkSelection,
  onUpdate,
  onComplete,
  onCancel,
  planningActions,
  onMoveUp,
  onMoveDown,
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
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  onCloseEditor: () => void;
  onRegisterAutosave: (taskId: string, flush: () => Promise<void>) => void;
  completionRequested: boolean;
  onToggleDeferredCompletion: () => void;
  bulkSelection?: {
    selected: boolean;
    onToggle: () => void;
  };
  onUpdate: (patch: EditableTaskPatch) => Promise<void>;
  onComplete: () => Promise<void>;
  onCancel: () => Promise<void>;
  planningActions: TaskTemporalAction[];
  onMoveUp?: () => Promise<void>;
  onMoveDown?: () => Promise<void>;
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
  onDelete: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [dragPlacement, setDragPlacement] = useState<'before' | 'after' | null>(null);
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
  const TodayMarkerIcon = todayMarker === 'now'
    ? Clock2
    : todayMarker === 'next'
      ? Clock5
      : todayMarker === 'later'
        ? Clock8
        : Inbox;

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
        editorAnimationFrameRef.current = null;
        setEditorExpanded(true);
        editorScrollFrameRef.current = window.requestAnimationFrame(() => {
          editorScrollFrameRef.current = null;
          articleRef.current?.querySelector<HTMLElement>('[data-task-editor-title]')
            ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
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
    titleButtonRef.current?.closest('main')?.querySelectorAll<HTMLButtonElement>(
      '[data-task-title-control]',
    ) ?? [],
  );

  const captureTaskFocus = () => {
    const controls = getTaskTitleControls();
    return {
      currentIndex: controls.indexOf(titleButtonRef.current!),
      main: titleButtonRef.current?.closest('main') ?? null,
    };
  };

  const restoreTaskFocus = (
    { main, currentIndex }: ReturnType<typeof captureTaskFocus>,
    preferCurrentTask = false,
    delay = 0,
  ) => {
    window.setTimeout(() => {
      if (preferCurrentTask && titleButtonRef.current?.isConnected) {
        titleButtonRef.current.focus();
        return;
      }
      const remaining = Array.from(main?.querySelectorAll<HTMLButtonElement>(
        '[data-task-title-control]',
      ) ?? []).filter(
        (control) => control.dataset.taskId !== task.id,
      );
      const fallback = main?.querySelector<HTMLElement>('input[aria-label="Add a Task"]')
        ?? main?.querySelector<HTMLElement>('[data-task-view-heading]');
      (remaining[currentIndex] ?? remaining[currentIndex - 1] ?? fallback)?.focus();
    }, delay);
  };

  const runTerminalAction = async (
    operation: () => Promise<void>,
    animate = true,
    focusDelay = 0,
  ) => {
    if (pendingRef.current) return;
    suppressActionMenuAutoFocusRef.current = true;
    const focus = captureTaskFocus();
    pendingRef.current = true;
    setPending(true);
    if (animate) {
      setTerminalExiting(true);
      if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 160));
      }
    }
    try {
      await operation();
      restoreTaskFocus(focus, false, focusDelay);
    } catch {
      setTerminalExiting(false);
      window.setTimeout(() => titleButtonRef.current?.focus(), 0);
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

  return (
    <article
      ref={articleRef}
      data-task-row-id={task.id}
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
        'relative grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none',
        terminalExiting ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        selected || bulkSelection?.selected ? 'bg-foreground/[0.04]' : '',
      ].filter(Boolean).join(' ') || undefined}
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
      <div className="flex min-h-14 items-center gap-3 px-2 sm:px-4">
        {bulkSelection ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={bulkSelection.selected}
            aria-label={`${bulkSelection.selected ? 'Deselect' : 'Select'} ${task.title}`}
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
            aria-label={`${completionRequested ? 'Mark Incomplete' : 'Complete'} ${task.title}`}
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
            {completionRequested ? (
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
            if (
              !bulkSelection
              && event.altKey
              && !event.metaKey
              && !event.ctrlKey
              && !event.shiftKey
              && (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            ) {
              const reorder = event.key === 'ArrowUp' ? onMoveUp : onMoveDown;
              if (reorder) {
                event.preventDefault();
                void run(reorder).then(() => {
                  window.setTimeout(() => titleButtonRef.current?.focus(), 0);
                });
              }
              return;
            }
            if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
              return;
            }
          }}
          aria-expanded={bulkSelection ? undefined : selected}
          aria-pressed={bulkSelection ? bulkSelection.selected : undefined}
          aria-keyshortcuts={bulkSelection
            ? 'Enter'
            : 'Enter Alt+ArrowUp Alt+ArrowDown'}
          data-task-title-control
          data-task-id={task.id}
          className={`min-w-0 flex-1 py-4 text-left text-[15px] font-medium leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${draggableTask ? 'cursor-grab active:cursor-grabbing' : ''}`}
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
          {hierarchyLabel ? (
            <span className="mt-1 block text-xs font-normal text-info">{hierarchyLabel}</span>
          ) : null}
          {task.actionability === 'waiting' ? (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
              Waiting
            </span>
          ) : task.actionability === 'rechecking' ? (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Rechecking
            </span>
          ) : null}
          {(
            (planningLabel !== null && (planningLabel || task.start_date))
            || task.deadline
          ) ? (
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground">
              {planningLabel !== null && (planningLabel || task.start_date) ? (
                <span
                  className="inline-flex items-center gap-1"
                  aria-label={`Starts ${planningLabel ?? formatTaskStartDateLabel(task.start_date!, planningDate)}`}
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  {planningLabel ?? formatTaskStartDateLabel(task.start_date!, planningDate)}
                </span>
              ) : null}
              {task.deadline ? (
                <span
                  className="inline-flex items-center gap-1"
                  aria-label={`Due ${formatTaskRelativeCalendarDate(task.deadline, planningDate)}`}
                >
                  <FlagTriangleRight className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatTaskRelativeCalendarDate(task.deadline, planningDate)}
                </span>
              ) : null}
            </span>
          ) : null}
          {reminder && task.start_date ? (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-normal text-info">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              {formatReminderIntent(reminder, planningDate)}
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
              aria-label={`Actions for ${task.title}`}
              className="h-10 w-10 text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(event) => {
              if (!suppressActionMenuAutoFocusRef.current) return;
              event.preventDefault();
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
            <DropdownMenuItem onSelect={() => setMoveOpen(true)}>Move...</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setWhenOpen(true)}>When...</DropdownMenuItem>
            <DropdownMenuSeparator />
            {onMoveUp ? (
              <DropdownMenuItem onSelect={() => void run(onMoveUp)}>Move Up</DropdownMenuItem>
            ) : null}
            {onMoveDown ? (
              <DropdownMenuItem onSelect={() => void run(onMoveDown)}>Move Down</DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void runTerminalAction(onCancel, true, 50)}>
              Cancel
            </DropdownMenuItem>
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
          data-task-editor-region
          data-state={selected ? (editorExpanded ? 'open' : 'opening') : 'closing'}
          aria-hidden={selected ? undefined : true}
          className={[
            'grid overflow-hidden transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none',
            editorExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            selected ? '' : 'pointer-events-none',
          ].filter(Boolean).join(' ')}
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
        onCloseAutoFocus={() => titleButtonRef.current?.focus()}
        onMove={(patch) => runMovementAction(() => onUpdate(patch))}
      /> : null}
      {!bulkSelection ? <TaskWhenDialog
        open={whenOpen}
        task={task}
        actions={movementPlanningActions}
        planningDate={planningDate}
        onOpenChange={(nextOpen) => {
          setWhenOpen(nextOpen);
        }}
        onCloseAutoFocus={() => titleButtonRef.current?.focus()}
        onPlan={(patch) => runMovementAction(() => onUpdate(patch))}
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
  const [startDate, setStartDate] = useState(task.start_date ?? '');
  const [todaySection, setTodaySection] = useState<TaskTodaySection>(task.today_section ?? 'next');
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [reminderTime, setReminderTime] = useState(reminder?.local_time.slice(0, 5) ?? '');
  const [ambiguityChoice, setAmbiguityChoice] = useState<'earlier' | 'later'>(
    reminder?.ambiguity_choice ?? 'earlier',
  );
  const [organization, setOrganization] = useState(taskOrganizationValue(task));
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

  const persistReminder = useCallback((
    localTime: string,
    choice: 'earlier' | 'later',
  ) => {
    const pendingTextPatch = takePendingTextPatch();
    if (Object.keys(pendingTextPatch).length > 0) enqueueTaskPatch(pendingTextPatch);
    return enqueueOperation(() => onSaveReminderRef.current({
      localTime,
      ambiguityChoice: choice,
    }));
  }, [enqueueOperation, enqueueTaskPatch, takePendingTextPatch]);

  const cancelReminder = useCallback(() => {
    const pendingTextPatch = takePendingTextPatch();
    if (Object.keys(pendingTextPatch).length > 0) enqueueTaskPatch(pendingTextPatch);
    return enqueueOperation(() => onCancelReminderRef.current());
  }, [enqueueOperation, enqueueTaskPatch, takePendingTextPatch]);

  const changeStartDate = (value: string) => {
    const nextTodaySection = value ? (startDate ? todaySection : 'next') : todaySection;
    setStartDate(value);
    setTodaySection(nextTodaySection);
    void persistImmediateTaskPatch({
      start_date: value || null,
      today_section: nextTodaySection,
    });
    if (!value) {
      setReminderTime('');
      if (reminder !== null || reminderTime) void cancelReminder();
    } else if (reminderTime) {
      void persistReminder(reminderTime, ambiguityChoice);
    }
  };

  return (
    <div
      className="space-y-3 border-t border-[hsl(var(--grid-sticky-line))] px-4 py-4 sm:ml-14"
    >
      <label className="sr-only" htmlFor={`task-title-${task.id}`}>
        Task Title
      </label>
      <Input
        ref={titleInputRef}
        id={`task-title-${task.id}`}
        data-task-editor-title
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
            value={primaryLink}
            placeholder="No Primary Link"
            inputMode="url"
            onChange={(event) => {
              const nextPrimaryLink = event.target.value;
              setPrimaryLink(nextPrimaryLink);
              scheduleTextPatch({ primary_link: nextPrimaryLink || null });
            }}
          />
          {primaryLink ? (
            <Button
              type="button"
              variant="clear"
              size="icon"
              aria-label="Clear Primary Link"
              onClick={() => {
                setPrimaryLink('');
                removePendingTextField('primary_link');
                void persistImmediateTaskPatch({ primary_link: null });
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      <div data-task-editor-identity-grid className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor={`task-actionability-${task.id}`}>
          Actionability
        </label>
        <select
          id={`task-actionability-${task.id}`}
          value={actionability}
          onChange={(event) => {
            const nextActionability = event.target.value as TaskTodo['actionability'];
            setActionability(nextActionability);
            void persistImmediateTaskPatch({ actionability: nextActionability });
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="actionable">Actionable</option>
          <option value="waiting">Waiting</option>
          <option value="rechecking">Rechecking</option>
        </select>
      </div>
      <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-organization-${task.id}`}>
            Organization
          </label>
          <select
            id={`task-organization-${task.id}`}
            value={organization}
            onChange={(event) => {
              const nextOrganization = event.target.value;
              setOrganization(nextOrganization);
              void persistImmediateTaskPatch(parseTaskOrganization(nextOrganization));
            }}
            disabled={hierarchy.loading}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="none">No Area or Project</option>
            {hierarchy.areas.length > 0 ? (
              <optgroup label="Areas">
                {hierarchy.areas.map((area) => (
                  <option key={area.id} value={`area:${area.id}`}>{area.title}</option>
                ))}
              </optgroup>
            ) : null}
            {hierarchy.projects.length > 0 ? (
              <optgroup label="Projects">
                {hierarchy.projects.map((project) => (
                  <option key={project.id} value={`project:${project.id}`}>{project.title}</option>
                ))}
              </optgroup>
            ) : null}
          </select>
      </div>
      </div>
      <div data-task-editor-temporal-grid className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-start-date-${task.id}`}>
            Start Date
          </label>
          <div className="flex gap-2">
            <DatePickerField
              id={`task-start-date-${task.id}`}
              value={startDate}
              onValueChange={changeStartDate}
              placeholder="No Start Date"
              aria-label="Start Date"
              minDate={addTaskCalendarDays(planningDate, 1)}
            />
            {startDate ? (
              <Button
                type="button"
                variant="clear"
                size="icon"
                aria-label="Clear Start Date"
                onClick={() => changeStartDate('')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
        {startDate || task.today_section !== null ? <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-day-horizon-${task.id}`}>
            Day Horizon
          </label>
          <select
            id={`task-day-horizon-${task.id}`}
            value={todaySection}
            onChange={(event) => {
              const nextTodaySection = event.target.value as TaskTodaySection;
              setTodaySection(nextTodaySection);
              void persistImmediateTaskPatch({ today_section: nextTodaySection });
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="inbox">Inbox</option>
            <option value="now">Now</option>
            <option value="next">Next</option>
            <option value="later">Later</option>
          </select>
        </div> : null}
        {startDate ? <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-reminder-time-${task.id}`}>
            Reminder Time
          </label>
          <div className="flex gap-2">
            <Input
              id={`task-reminder-time-${task.id}`}
              type="time"
              value={reminderTime}
              onChange={(event) => {
                const nextReminderTime = event.target.value;
                setReminderTime(nextReminderTime);
                if (nextReminderTime) {
                  void persistReminder(nextReminderTime, ambiguityChoice);
                } else if (reminder !== null || reminderTime) {
                  void cancelReminder();
                }
              }}
              disabled={reminderMode !== 'connected'}
            />
            {reminderTime ? (
              <Button
                type="button"
                variant="clear"
                size="icon"
                disabled={reminderMode !== 'connected'}
                aria-label="Clear Reminder"
                onClick={() => {
                  setReminderTime('');
                  void cancelReminder();
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-deadline-${task.id}`}>
            Deadline
          </label>
          <div className="flex gap-2">
            <DatePickerField
              id={`task-deadline-${task.id}`}
              value={deadline}
              onValueChange={(value) => {
                setDeadline(value);
                void persistImmediateTaskPatch({ deadline: value || null });
              }}
              placeholder="No Deadline"
              aria-label="Deadline"
            />
            {deadline ? (
              <Button
                type="button"
                variant="clear"
                size="icon"
                aria-label="Clear Deadline"
                onClick={() => {
                  setDeadline('');
                  void persistImmediateTaskPatch({ deadline: null });
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {startDate && reminderTime ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor={`task-reminder-ambiguity-${task.id}`}>
              Repeated Local Time
            </label>
            <select
              id={`task-reminder-ambiguity-${task.id}`}
              value={ambiguityChoice}
              onChange={(event) => {
                const nextChoice = event.target.value as 'earlier' | 'later';
                setAmbiguityChoice(nextChoice);
                void persistReminder(reminderTime, nextChoice);
              }}
              disabled={reminderMode !== 'connected'}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="earlier">Earlier Instance</option>
              <option value="later">Later Instance</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Time Zone</span>
            <p className="flex h-10 items-center text-sm text-muted-foreground">
              {reminderTimeZone}
            </p>
          </div>
        </div>
      ) : null}
      {startDate && reminderMode !== 'connected' ? (
          <p className="text-xs text-warning">
            {getTaskReminderUnavailableMessage(reminderMode)}
          </p>
        ) : startDate && reminder?.resolution_kind === 'gap_forward' ? (
          <p className="text-xs text-warning">
            This local time was adjusted to the first valid instant after a daylight-saving gap.
          </p>
        ) : null}
    </div>
  );
}

function showTaskError(title: string, error: unknown): void {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
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

function formatReminderIntent(reminder: TaskReminder, planningDate: string): string {
  const localTime = reminder.local_time.slice(0, 5);
  return `Remind ${formatTaskRelativeCalendarDate(reminder.local_date, planningDate)} at ${localTime}`;
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
