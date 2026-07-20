import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Archive,
  Bell,
  BellRing,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleHelp,
  CircleSlash2,
  Cloud,
  CornerDownLeft,
  HardDrive,
  Hourglass,
  Inbox,
  ListChecks,
  ListTodo,
  LayoutTemplate,
  MoreHorizontal,
  Moon,
  Plus,
  RotateCcw,
  Search,
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { CARD_PAGE_BOTTOM_PADDING_CLASS } from '@/lib/pageLayout';
import type {
  EditableTaskPatch,
  TaskPlanningMoveInput,
} from '@/modules/tasks/data/taskRepository';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';
import {
  TaskKeyboardHelpDialog,
  TaskBulkWhenDialog,
  TaskMoveDialog,
  TaskSearchDialog,
  TaskWhenDialog,
  type TaskTemporalAction,
} from '@/modules/tasks/components/TaskCommandSurfaces';
import {
  getTodayTaskSection,
  useTaskList,
  type TaskListView,
  type TodayTaskSection,
} from '@/modules/tasks/hooks/useTaskList';
import { useTaskHierarchy, type TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import { useTaskSearch } from '@/modules/tasks/hooks/useTaskSearch';
import { useTaskReminders } from '@/modules/tasks/hooks/useTaskReminders';
import type { TaskWebPushModel } from '@/modules/tasks/hooks/useTaskWebPush';
import {
  useTaskHierarchyTrash,
  type DeletedTaskHierarchyRoot,
} from '@/modules/tasks/hooks/useTaskHierarchyTrash';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskReminder, TaskTodo } from '@/modules/tasks/types/tasks';
import { normalizeTaskEditorPlanningPatch } from '@/modules/tasks/components/taskEditorPlanning';
import { TaskProjectDetailView } from '@/modules/tasks/components/TaskProjectDetailView';
import { TaskProjectsView } from '@/modules/tasks/components/TaskProjectsView';
import { TaskTemplatesView } from '@/modules/tasks/components/TaskTemplatesView';
import { TaskPermanentDeletionButton } from '@/modules/tasks/components/TaskPermanentDeletionButton';
import { TaskDataPortabilityDialog } from '@/modules/tasks/components/TaskDataPortabilityDialog';
import { TaskPlanningProjects } from '@/modules/tasks/components/TaskPlanningProjects';
import {
  getTasksStorageStatusLabel,
  type TasksSyncState,
} from '@/modules/tasks/components/tasksStorageStatus';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';
import { deriveTaskViewProjects } from '@/modules/tasks/domain/taskProjectViews';

type TasksShellProps = {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
};

const taskViews = [
  { path: '/inbox', label: 'Inbox', icon: Inbox },
  { path: '/today', label: 'Today', icon: CalendarDays },
  { path: '/upcoming', label: 'Upcoming', icon: CalendarRange },
  { path: '/anytime', label: 'Anytime', icon: ListTodo },
  { path: '/someday', label: 'Someday', icon: CircleDashed },
  { path: '/logbook', label: 'Logbook', icon: Archive },
  { path: '/trash', label: 'Trash', icon: Trash2 },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/templates', label: 'Templates', icon: LayoutTemplate },
] as const;

const taskNavigationShortcuts: Record<string, string> = {
  i: '/inbox',
  t: '/today',
  u: '/upcoming',
  a: '/anytime',
  s: '/someday',
  l: '/logbook',
  p: '/projects',
  r: '/trash',
  e: '/templates',
};

type TaskShellView = TaskListView | 'projects' | 'project' | 'templates';

export function TasksShell({ userId, displayName, onSignOut }: TasksShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const view = getTaskViewFromPath(location.pathname);
  const projectId = getTaskProjectIdFromPath(location.pathname);
  const taskListView: TaskListView = view === 'projects' || view === 'project' || view === 'templates'
    ? 'inbox'
    : view;
  const {
    mode,
    syncState,
    pendingUploadCount,
    permanentDeletionService,
    portabilityService,
    prepareForSignOut,
  } = useTasksRuntime();
  const hierarchy = useTaskHierarchy(userId);
  const hierarchyTrash = useTaskHierarchyTrash(userId);
  const {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    moveTask,
    moveTasks,
    reorderTask,
    transitionTask,
    planningDate,
  } = useTaskList(userId, taskListView);
  const planningProjects = useMemo(() => deriveTaskViewProjects(
    hierarchy.projects,
    userId,
    taskListView,
    planningDate,
  ), [hierarchy.projects, planningDate, taskListView, userId]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(() => new Set());
  const [bulkWhenOpen, setBulkWhenOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [searchTargetTaskId, setSearchTargetTaskId] = useState<string | null>(null);
  const [permanentlyDeletedKeys, setPermanentlyDeletedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const taskSearch = useTaskSearch(userId, searchOpen);
  const reminders = useTaskReminders(userId);
  const acknowledgeReminderDelivery = reminders.acknowledge;
  const captureInputRef = useRef<HTMLInputElement>(null);
  const commandReturnFocusRef = useRef<HTMLElement | null>(null);
  const acknowledgedPushDeliveriesRef = useRef(new Set<string>());
  const pendingNavigationRef = useRef(false);
  const navigationResetRef = useRef<number | null>(null);
  const trashRoots = hierarchyTrash.roots.filter((root) => (
    !permanentlyDeletedKeys.has(`${root.root_type}:${root.id}`)
  ));
  const trashTasks = tasks.filter((task) => !permanentlyDeletedKeys.has(`todo:${task.id}`));
  const taskViewIsEmpty = view === 'trash'
    ? trashTasks.length === 0 && trashRoots.length === 0
    : tasks.length === 0 && planningProjects.length === 0;
  const permanentDeletionAvailable = mode === 'connected'
    && syncState === 'connected'
    && pendingUploadCount === 0;
  const permanentDeletionUnavailableReason = pendingUploadCount > 0
    ? 'Wait for pending task changes to synchronize'
    : syncState !== 'connected'
      ? 'Reconnect to preview the current server deletion scope'
      : undefined;

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
    setSelectedTaskId(null);
    setBulkMode(false);
    setBulkSelection(new Set());
    setBulkWhenOpen(false);
    captureInputRef.current?.focus();
  }, [view]);

  useEffect(() => {
    const visibleIds = new Set(tasks.map(({ id }) => id));
    setBulkSelection((current) => {
      const next = new Set(Array.from(current).filter((taskId) => visibleIds.has(taskId)));
      return next.size === current.size ? current : next;
    });
  }, [tasks]);

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
    }).catch((reminderError) => {
      acknowledgedPushDeliveriesRef.current.delete(deliveryId);
      showTaskError('Reminder Could Not Be Acknowledged', reminderError);
    });
  }, [acknowledgeReminderDelivery, location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!searchTargetTaskId) return;
    const target = tasks.find(({ id }) => id === searchTargetTaskId);
    if (!target) return;
    if (target.lifecycle === 'open') {
      setSelectedTaskId(target.id);
    }
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(
        target.lifecycle === 'open'
          ? `[data-task-title-control][data-task-id="${target.id}"]`
          : `[data-task-search-id="${target.id}"]`,
      )?.focus();
    }, 0);
    setSearchTargetTaskId(null);
  }, [searchTargetTaskId, tasks]);

  useEffect(() => {
    const clearPendingNavigation = () => {
      pendingNavigationRef.current = false;
      if (navigationResetRef.current !== null) {
        window.clearTimeout(navigationResetRef.current);
        navigationResetRef.current = null;
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const opensKeyboardHelp = event.key === '?' && event.shiftKey;
      if (
        event.defaultPrevented
        || event.isComposing
        || event.metaKey
        || event.ctrlKey
        || event.altKey
        || (event.shiftKey && !opensKeyboardHelp)
        || isTaskKeyboardInput(event.target)
        || document.querySelector('[role="dialog"], [role="menu"]')
      ) {
        clearPendingNavigation();
        return;
      }

      const key = event.key.toLowerCase();
      if (pendingNavigationRef.current) {
        clearPendingNavigation();
        const path = taskNavigationShortcuts[key];
        if (path) {
          event.preventDefault();
          navigate(`${basePath}${path}`);
        }
        return;
      }
      if (key === 'g') {
        event.preventDefault();
        pendingNavigationRef.current = true;
        navigationResetRef.current = window.setTimeout(clearPendingNavigation, 1200);
        return;
      }
      if (key === 'n') {
        event.preventDefault();
        if (captureInputRef.current) {
          captureInputRef.current.focus();
        } else {
          navigate(`${basePath}/inbox`);
        }
        return;
      }
      if (key === '/') {
        event.preventDefault();
        commandReturnFocusRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        setSearchOpen(true);
        return;
      }
      if (opensKeyboardHelp) {
        event.preventDefault();
        commandReturnFocusRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        setKeyboardHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearPendingNavigation();
    };
  }, [basePath, navigate]);

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
        } catch (moveError) {
          showTaskError('Task Could Not Be Moved', moveError);
          throw moveError;
        }
      },
    });

    const moveToToday = action(view === 'upcoming' ? 'Make Available Today' : 'Move to Today', {
      destination: 'today',
      todaySection: 'daytime',
      startDate: planningDate,
    });
    const moveToAnytime = action('Move to Anytime', {
      destination: 'anytime',
      todaySection: 'daytime',
      startDate: null,
    });
    const moveToSomeday = action('Move to Someday', {
      destination: 'someday',
      todaySection: 'daytime',
      startDate: null,
    });
    const moveToInbox = action('Move to Inbox', {
      destination: 'inbox',
      todaySection: 'daytime',
      startDate: null,
    });

    if (view === 'upcoming') {
      return [moveToToday, moveToAnytime, moveToSomeday, moveToInbox];
    }
    if (view === 'inbox') {
      return [moveToToday, moveToAnytime, moveToSomeday];
    }
    if (view === 'anytime') {
      return [moveToToday, moveToSomeday, moveToInbox];
    }
    if (view === 'someday') {
      return [moveToToday, moveToAnytime, moveToInbox];
    }

    const section = getTodayTaskSection(task, planningDate);
    const actions: TaskTemporalAction[] = [];
    if (section === 'unfinished') {
      actions.push(action('Reschedule for Today', {
        destination: 'today',
        todaySection: 'daytime',
        startDate: planningDate,
      }));
    }
    if (section !== 'evening') {
      actions.push(action('Move to This Evening', {
        destination: 'today',
        todaySection: 'evening',
        startDate: planningDate,
      }));
    } else {
      actions.push(action('Move to Earlier Today', {
        destination: 'today',
        todaySection: 'daytime',
        startDate: planningDate,
      }));
    }
    actions.push(
      action('Move to Tomorrow', {
        destination: 'today',
        todaySection: 'daytime',
        startDate: addTaskCalendarDays(planningDate, 1),
      }),
      moveToAnytime,
      moveToSomeday,
      moveToInbox,
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
      setBulkSelection(new Set());
      setBulkMode(false);
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
    bulkAction('Move to Inbox', {
      destination: 'inbox', todaySection: 'daytime', startDate: null,
    }),
    bulkAction('Move to Today', {
      destination: 'today', todaySection: 'daytime', startDate: planningDate,
    }),
    bulkAction('Move to This Evening', {
      destination: 'today', todaySection: 'evening', startDate: planningDate,
    }),
    bulkAction('Move to Tomorrow', {
      destination: 'today',
      todaySection: 'daytime',
      startDate: addTaskCalendarDays(planningDate, 1),
    }),
    bulkAction('Move to Anytime', {
      destination: 'anytime', todaySection: 'daytime', startDate: null,
    }),
    bulkAction('Move to Someday', {
      destination: 'someday', todaySection: 'daytime', startDate: null,
    }),
  ];

  const bulkEligible = view === 'inbox'
    || view === 'today'
    || view === 'upcoming'
    || view === 'anytime'
    || view === 'someday';

  const renderActiveTask = (task: TaskTodo, sectionTasks: TaskTodo[]) => {
    const index = sectionTasks.findIndex((candidate) => candidate.id === task.id);
    return (
      <TaskRow
        key={task.id}
        task={task}
        hierarchy={hierarchy}
        selected={selectedTaskId === task.id}
        onSelect={() => setSelectedTaskId((current) => (current === task.id ? null : task.id))}
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
            setSelectedTaskId(null);
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
        planningLabel={view === 'today' && getTodayTaskSection(task, planningDate) === 'unfinished'
          ? `Unfinished Since ${formatTaskCalendarDate(task.start_date ?? planningDate)}`
          : view === 'today' ? null : undefined}
        reminder={reminders.byRootId.get(task.id) ?? null}
        reminderMode={reminders.mode}
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
          }
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <ToplineHeader
        title="Tasks"
        userId={userId}
        displayName={displayName}
        onSignOut={handleSignOut}
        showAppSwitcher
        actionsAccessory={(
          <div className="flex items-center gap-1">
            <TaskDataPortabilityDialog
              service={portabilityService}
              replaceAvailable={permanentDeletionAvailable}
              replaceUnavailableReason={permanentDeletionUnavailableReason}
            />
            <TasksStorageStatus
              mode={mode}
              syncState={syncState}
              pendingUploadCount={pendingUploadCount}
            />
          </div>
        )}
      />

      <main className={`mx-auto w-full max-w-3xl px-4 pt-8 md:pt-10 ${CARD_PAGE_BOTTOM_PADDING_CLASS}`}>
        <div className="space-y-7">
          <div className="flex items-center justify-between gap-4">
            <h2
              tabIndex={-1}
              data-task-view-heading
              className="text-3xl font-semibold leading-none tracking-tight"
            >
              <span className="md:hidden">{getTaskViewLabel(view)}</span>
              <span className="hidden md:inline">Tasks</span>
            </h2>
            <div className="flex items-center gap-1">
              {bulkEligible && tasks.length > 0 ? (
                <Button
                  type="button"
                  variant="clear"
                  size="icon"
                  aria-label={bulkMode ? 'Exit Task Selection' : 'Select Tasks'}
                  aria-pressed={bulkMode}
                  onClick={() => {
                    setSelectedTaskId(null);
                    setBulkMode((current) => {
                      if (current) setBulkSelection(new Set());
                      return !current;
                    });
                  }}
                  className="h-9 w-9 text-muted-foreground"
                >
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="clear"
                size="icon"
                aria-label="Search Tasks and Views"
                aria-keyshortcuts="/"
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
                aria-keyshortcuts="?"
                onClick={() => openCommandSurface(setKeyboardHelpOpen)}
                className="h-9 w-9 text-muted-foreground"
              >
                <CircleHelp className="h-4 w-4" aria-hidden="true" />
              </Button>
              <MobileProjectsLink view={view} basePath={basePath} navigate={navigate} />
              <MobileTemplatesLink view={view} basePath={basePath} navigate={navigate} />
            </div>
          </div>

          {reminders.dueItems.length > 0 ? (
            <TaskDueReminders
              items={reminders.dueItems}
              onAcknowledge={async (deliveryId) => {
                try {
                  await reminders.acknowledge(deliveryId);
                } catch (reminderError) {
                  showTaskError('Reminder Could Not Be Acknowledged', reminderError);
                }
              }}
            />
          ) : null}

          {reminders.webPush ? (
            <TaskWebPushCapability
              model={reminders.webPush}
              connected={reminders.mode === 'connected'}
              onEnable={async () => {
                try {
                  await reminders.webPush.enable();
                } catch (reminderError) {
                  showTaskError('Browser Reminders Could Not Be Enabled', reminderError);
                }
              }}
              onDisable={async () => {
                try {
                  await reminders.webPush.disable();
                } catch (reminderError) {
                  showTaskError('Browser Reminders Could Not Be Disabled', reminderError);
                }
              }}
            />
          ) : null}

          <nav
            aria-label="Task views"
            className="hidden rounded-md border border-[hsl(var(--grid-sticky-line))] p-1 md:grid"
            style={{ gridTemplateColumns: `repeat(${taskViews.length}, minmax(0, 1fr))` }}
          >
            {taskViews.map(({ path, label, icon: Icon }) => {
              const href = `${basePath}${path}`;
              const active = view === path.slice(1) || (path === '/projects' && view === 'project');
              return (
                <a
                  key={path}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={(event) => handleClientSideLinkNavigation(event, navigate, href)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </a>
              );
            })}
          </nav>

          {bulkMode ? (
            <TaskBulkToolbar
              selectedCount={bulkSelection.size}
              totalCount={tasks.length}
              pending={bulkPending}
              onSelectAll={() => setBulkSelection(new Set(tasks.map(({ id }) => id)))}
              onClear={() => setBulkSelection(new Set())}
              onPlan={() => openCommandSurface(setBulkWhenOpen)}
              onDone={() => {
                setBulkSelection(new Set());
                setBulkMode(false);
                focusTaskListFallback();
              }}
            />
          ) : null}

          {!bulkMode && view !== 'projects' && view !== 'project' && view !== 'templates' && (view === 'inbox' || view === 'today' || view === 'anytime' || view === 'someday') ? (
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
                aria-keyshortcuts="N Enter"
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

          {view === 'project' && projectId ? (
            <TaskProjectDetailView
              ownerId={userId}
              projectId={projectId}
              hierarchy={hierarchy}
              planningDate={planningDate}
            />
          ) : view === 'projects' ? <TaskProjectsView hierarchy={hierarchy} />
            : view === 'templates' ? <TaskTemplatesView ownerId={userId} hierarchy={hierarchy} />
              : <section aria-label={getTaskSectionLabel(taskListView)}>
            {loading || hierarchy.loading || (view === 'trash' && hierarchyTrash.loading) ? (
              <div className="flex min-h-40 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : error || hierarchy.error || (view === 'trash' && hierarchyTrash.error) ? (
              <p role="alert" className="py-12 text-center text-sm text-destructive">
                Tasks Could Not Be Loaded
              </p>
            ) : taskViewIsEmpty ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {view === 'trash' ? 'Trash Is Empty' : view === 'logbook' ? 'Logbook Is Empty' : 'No Tasks'}
              </p>
            ) : view === 'trash' ? (
              <div className="space-y-5">
                {trashRoots.length > 0 ? (
                  <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                    {trashRoots.map((root) => (
                      <DeletedHierarchyRow
                        key={`${root.root_type}:${root.id}`}
                        root={root}
                        onRestore={async () => {
                          try {
                            await hierarchyTrash.restore(root);
                          } catch (restoreError) {
                            showTaskError('Hierarchy Could Not Be Restored', restoreError);
                          }
                        }}
                        permanentDeleteControl={mode === 'connected' && root.root_type === 'project' ? (
                          <TaskPermanentDeletionButton
                            rootType="project"
                            rootId={root.id}
                            title={root.title}
                            service={permanentDeletionService}
                            available={permanentDeletionAvailable}
                            unavailableReason={permanentDeletionUnavailableReason}
                            onDeleted={(result) => {
                              setPermanentlyDeletedKeys((current) => new Set(current).add(
                                `${result.root.type}:${result.root.id}`,
                              ));
                            }}
                          />
                        ) : undefined}
                      />
                    ))}
                  </div>
                ) : null}
                {trashTasks.length > 0 ? (
                  <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                    {trashTasks.map((task) => (
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
                        permanentDeleteControl={mode === 'connected' ? (
                          <TaskPermanentDeletionButton
                            rootType="todo"
                            rootId={task.id}
                            title={task.title}
                            service={permanentDeletionService}
                            available={permanentDeletionAvailable}
                            unavailableReason={permanentDeletionUnavailableReason}
                            onDeleted={(result) => {
                              setPermanentlyDeletedKeys((current) => new Set(current).add(
                                `${result.root.type}:${result.root.id}`,
                              ));
                            }}
                          />
                        ) : undefined}
                      />
                    ))}
                  </div>
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
                {tasks.length > 0 ? (
                  <section aria-label={view === 'logbook' ? 'To-Dos' : 'Tasks'}>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                      {view === 'logbook' ? `To-Dos (${tasks.length})` : `Tasks (${tasks.length})`}
                    </h3>
                    <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                      {tasks.map((task) => (
                        view === 'logbook' ? (
                          <LogbookTaskRow
                            key={task.id}
                            task={task}
                            onReopen={async () => {
                              try {
                                await transitionTask(task.id, 'reopen');
                              } catch (reopenError) {
                                showTaskError('Task Could Not Be Reopened', reopenError);
                              }
                            }}
                            onDelete={async () => {
                              try {
                                await transitionTask(task.id, 'delete');
                              } catch (deleteError) {
                                showTaskError('Task Could Not Be Deleted', deleteError);
                              }
                            }}
                          />
                        ) : renderActiveTask(task, tasks)
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </section>}
        </div>
      </main>

      <MobileBottomNav
        items={taskViews.filter(({ path }) => path !== '/projects' && path !== '/templates')}
        isActive={(path) => view === path.slice(1)}
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
      className="flex flex-wrap items-center gap-2 rounded-md border border-info/40 bg-info/5 p-3"
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
        Clear
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
        return model.error?.message ?? 'The browser reminder capability could not be verified.';
      default:
        return 'The Web Push provider keys have not been configured for this installation.';
    }
  })();

  return (
    <section
      aria-label="Browser Reminder Capability"
      aria-live="polite"
      className={`flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center ${
        active ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'
      }`}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-success' : 'text-warning'}`} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
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
    </section>
  );
}

function LogbookTaskRow({
  task,
  onReopen,
  onDelete,
}: {
  task: TaskTodo;
  onReopen: () => Promise<void>;
  onDelete: () => Promise<void>;
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
      <DropdownMenu>
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
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => void run(onDelete)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}

function DeletedHierarchyRow({
  root,
  onRestore,
  permanentDeleteControl,
}: {
  root: DeletedTaskHierarchyRoot;
  onRestore: () => Promise<void>;
  permanentDeleteControl?: ReactNode;
}) {
  const label = root.root_type === 'checklist_item'
    ? 'Checklist Item'
    : root.root_type[0].toUpperCase() + root.root_type.slice(1);
  return (
    <article className="flex min-h-14 items-center gap-3 px-3 py-2 sm:px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{root.title}</p>
        <p className="text-xs text-muted-foreground">Deleted {label}</p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void onRestore()}>
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Restore
        </Button>
        {permanentDeleteControl}
      </div>
    </article>
  );
}

function DeletedTaskRow({
  task,
  onRestore,
  permanentDeleteControl,
}: {
  task: TaskTodo;
  onRestore: () => Promise<void>;
  permanentDeleteControl?: ReactNode;
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
          {getTaskViewLabel(task.destination)}
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
        {permanentDeleteControl}
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
    icon?: typeof Moon;
    className?: string;
  }> = [
    { id: 'unfinished', label: 'Unfinished', className: 'text-warning' },
    { id: 'daytime', label: 'Today' },
    { id: 'evening', label: 'This Evening', icon: Moon },
  ];

  return (
    <div className="space-y-7">
      {sections.map(({ id, label, icon: Icon, className }) => {
        const sectionTasks = tasks.filter((task) => getTodayTaskSection(task, planningDate) === id);
        if (sectionTasks.length === 0) {
          return null;
        }
        return (
          <section key={id} aria-labelledby={`tasks-${id}-heading`}>
            <h3
              id={`tasks-${id}-heading`}
              className={`mb-2 flex items-center gap-2 text-sm font-semibold ${className ?? 'text-muted-foreground'}`}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
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

function TaskRow({
  task,
  hierarchy,
  selected,
  onSelect,
  bulkSelection,
  onUpdate,
  onComplete,
  planningActions,
  onMoveUp,
  onMoveDown,
  planningLabel,
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
  onSelect: () => void;
  bulkSelection?: {
    selected: boolean;
    onToggle: () => void;
  };
  onUpdate: (patch: EditableTaskPatch) => Promise<void>;
  onComplete: () => Promise<void>;
  planningActions: TaskTemporalAction[];
  onMoveUp?: () => Promise<void>;
  onMoveDown?: () => Promise<void>;
  planningLabel?: string | null;
  reminder: TaskReminder | null;
  reminderMode: 'local' | 'connected';
  reminderTimeZone: string;
  onSaveReminder: (input: {
    localDate: string;
    localTime: string;
    ambiguityChoice: 'earlier' | 'later';
  }) => Promise<void>;
  onCancelReminder: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const hierarchyLabel = getTaskHierarchyLabel(task, hierarchy);

  const run = async (operation: () => Promise<void>): Promise<boolean> => {
    if (pending) {
      return false;
    }
    setPending(true);
    try {
      await operation();
      return true;
    } catch {
      return false;
    } finally {
      setPending(false);
    }
  };

  const getTaskTitleControls = () => Array.from(
    titleButtonRef.current?.closest('main')?.querySelectorAll<HTMLButtonElement>(
      '[data-task-title-control]',
    ) ?? [],
  );

  const focusRelativeTask = (offset: -1 | 1) => {
    const controls = getTaskTitleControls();
    const currentIndex = controls.indexOf(titleButtonRef.current!);
    controls[currentIndex + offset]?.focus();
  };

  const focusAfterRemoval = (main: HTMLElement | null, currentIndex: number) => {
    window.setTimeout(() => {
      const remaining = Array.from(main?.querySelectorAll<HTMLButtonElement>(
        '[data-task-title-control]',
      ) ?? []).filter(
        (control) => control.dataset.taskId !== task.id,
      );
      const fallback = main?.querySelector<HTMLElement>('input[aria-label="Add a Task"]')
        ?? main?.querySelector<HTMLElement>('[data-task-view-heading]');
      (remaining[currentIndex] ?? remaining[currentIndex - 1] ?? fallback)?.focus();
    }, 0);
  };

  return (
    <article className={selected || bulkSelection?.selected ? 'bg-foreground/[0.04]' : undefined}>
      <div className="flex min-h-14 items-center gap-3 px-2 sm:px-4">
        {bulkSelection ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={bulkSelection.selected}
            aria-label={`${bulkSelection.selected ? 'Deselect' : 'Select'} ${task.title}`}
            onClick={bulkSelection.onToggle}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-info transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {bulkSelection.selected ? (
              <SquareCheckBig className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Square className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            aria-label={`Complete ${task.title}`}
            onClick={() => void run(onComplete)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Circle className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        <button
          ref={titleButtonRef}
          type="button"
          onClick={bulkSelection ? bulkSelection.onToggle : onSelect}
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
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              focusRelativeTask(event.key === 'ArrowUp' ? -1 : 1);
              return;
            }
            if (bulkSelection) {
              return;
            }
            if (event.key.toLowerCase() === 'c') {
              event.preventDefault();
              const controls = getTaskTitleControls();
              const currentIndex = controls.indexOf(event.currentTarget);
              const main = event.currentTarget.closest('main');
              void run(onComplete).then((applied) => {
                if (applied) {
                  focusAfterRemoval(main, currentIndex);
                } else {
                  window.setTimeout(() => titleButtonRef.current?.focus(), 0);
                }
              });
              return;
            }
            if (event.key.toLowerCase() === 'm') {
              event.preventDefault();
              setMoveOpen(true);
              return;
            }
            if (event.key.toLowerCase() === 'w') {
              event.preventDefault();
              setWhenOpen(true);
            }
          }}
          aria-expanded={bulkSelection ? undefined : selected}
          aria-pressed={bulkSelection ? bulkSelection.selected : undefined}
          aria-keyshortcuts={bulkSelection
            ? 'Enter ArrowUp ArrowDown'
            : 'Enter ArrowUp ArrowDown C M W Alt+ArrowUp Alt+ArrowDown'}
          data-task-title-control
          data-task-id={task.id}
          className="min-w-0 flex-1 py-4 text-left text-[15px] font-medium leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block">{task.title}</span>
          {hierarchyLabel ? (
            <span className="mt-1 block text-xs font-normal text-info">{hierarchyLabel}</span>
          ) : null}
          {task.actionability === 'waiting' ? (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
              Waiting
            </span>
          ) : null}
          {(
            (planningLabel !== null && (planningLabel || task.start_date))
            || task.deadline
          ) ? (
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              {planningLabel !== null
                ? planningLabel ?? (task.start_date ? `Starts ${formatTaskCalendarDate(task.start_date)}` : null)
                : null}
              {planningLabel !== null && (planningLabel || task.start_date) && task.deadline ? ' · ' : null}
              {task.deadline ? `Due ${formatTaskCalendarDate(task.deadline)}` : null}
            </span>
          ) : null}
          {reminder ? (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-normal text-info">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              {formatReminderIntent(reminder)}
            </span>
          ) : null}
        </button>
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
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => void run(() => onUpdate({
                actionability: task.actionability === 'waiting' ? 'actionable' : 'waiting',
              }))}
            >
              {task.actionability === 'waiting' ? 'Mark as Actionable' : 'Mark as Waiting'}
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
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => void run(onDelete)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> : null}
      </div>
      {selected && !bulkSelection ? (
        <TaskEditor
          task={task}
          hierarchy={hierarchy}
          returnFocusRef={titleButtonRef}
          onCancel={onSelect}
          onSave={onUpdate}
          reminder={reminder}
          reminderMode={reminderMode}
          reminderTimeZone={reminderTimeZone}
          onSaveReminder={onSaveReminder}
          onCancelReminder={onCancelReminder}
        />
      ) : null}
      {!bulkSelection ? <TaskMoveDialog
        open={moveOpen}
        task={task}
        hierarchy={hierarchy}
        onOpenChange={(nextOpen) => {
          setMoveOpen(nextOpen);
        }}
        onCloseAutoFocus={() => titleButtonRef.current?.focus()}
        onMove={onUpdate}
      /> : null}
      {!bulkSelection ? <TaskWhenDialog
        open={whenOpen}
        task={task}
        actions={planningActions}
        onOpenChange={(nextOpen) => {
          setWhenOpen(nextOpen);
        }}
        onCloseAutoFocus={() => titleButtonRef.current?.focus()}
      /> : null}
    </article>
  );
}

function TaskEditor({
  task,
  hierarchy,
  returnFocusRef,
  onCancel,
  onSave,
  reminder,
  reminderMode,
  reminderTimeZone,
  onSaveReminder,
  onCancelReminder,
}: {
  task: TaskTodo;
  hierarchy: TaskHierarchyModel;
  returnFocusRef: RefObject<HTMLButtonElement>;
  onCancel: () => void;
  onSave: (patch: EditableTaskPatch) => Promise<void>;
  reminder: TaskReminder | null;
  reminderMode: 'local' | 'connected';
  reminderTimeZone: string;
  onSaveReminder: (input: {
    localDate: string;
    localTime: string;
    ambiguityChoice: 'earlier' | 'later';
  }) => Promise<void>;
  onCancelReminder: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [actionability, setActionability] = useState(task.actionability);
  const [startDate, setStartDate] = useState(task.start_date ?? '');
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [reminderDate, setReminderDate] = useState(reminder?.local_date ?? '');
  const [reminderTime, setReminderTime] = useState(reminder?.local_time.slice(0, 5) ?? '09:00');
  const [ambiguityChoice, setAmbiguityChoice] = useState<'earlier' | 'later'>(
    reminder?.ambiguity_choice ?? 'earlier',
  );
  const [organization, setOrganization] = useState(taskOrganizationValue(task));
  const [headingId, setHeadingId] = useState(task.heading_id ?? '');
  const [saving, setSaving] = useState(false);
  const invalidDateRange = Boolean(startDate && deadline && deadline < startDate);
  const reminderChanged = reminderDate !== (reminder?.local_date ?? '')
    || (reminderDate !== '' && reminderTime !== (reminder?.local_time.slice(0, 5) ?? '09:00'))
    || ambiguityChoice !== (reminder?.ambiguity_choice ?? 'earlier');
  const invalidReminder = Boolean(reminderDate && !reminderTime);

  const restoreTitleFocus = () => {
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  };

  const handleCancel = () => {
    onCancel();
    restoreTitleFocus();
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle || saving || invalidDateRange || invalidReminder) {
      return;
    }

    const patch: EditableTaskPatch = {};
    if (normalizedTitle !== task.title) {
      patch.title = normalizedTitle;
    }
    if (notes !== task.notes) {
      patch.notes = notes;
    }
    if (actionability !== task.actionability) {
      patch.actionability = actionability;
    }
    if (startDate !== (task.start_date ?? '')) {
      patch.start_date = startDate || null;
    }
    if (deadline !== (task.deadline ?? '')) {
      patch.deadline = deadline || null;
    }
    const container = parseTaskOrganization(organization, headingId);
    if (
      container.area_id !== task.area_id
      || container.project_id !== task.project_id
      || container.heading_id !== task.heading_id
    ) {
      Object.assign(patch, container);
    }
    if (Object.keys(patch).length === 0 && !reminderChanged) {
      handleCancel();
      return;
    }

    setSaving(true);
    try {
      if (reminderChanged) {
        if (reminderDate) {
          await onSaveReminder({ localDate: reminderDate, localTime: reminderTime, ambiguityChoice });
        } else if (reminder) {
          await onCancelReminder();
        }
      }
      if (Object.keys(patch).length > 0) {
        await onSave(patch);
      } else {
        onCancel();
      }
      restoreTitleFocus();
    } catch {
      // The parent reports the error and keeps the editor open for retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter'
          && (event.metaKey || event.ctrlKey)
          && !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          handleCancel();
        }
      }}
      aria-keyshortcuts="Meta+Enter Escape"
      className="space-y-3 border-t border-[hsl(var(--grid-sticky-line))] px-4 py-4 sm:ml-14"
    >
      <label className="sr-only" htmlFor={`task-title-${task.id}`}>
        Task Title
      </label>
      <Input
        id={`task-title-${task.id}`}
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={saving}
      />
      <label className="sr-only" htmlFor={`task-notes-${task.id}`}>
        Notes
      </label>
      <Textarea
        id={`task-notes-${task.id}`}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        disabled={saving}
        placeholder="Notes"
        className="min-h-28 resize-y"
      />
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor={`task-actionability-${task.id}`}>
          Actionability
        </label>
        <select
          id={`task-actionability-${task.id}`}
          value={actionability}
          onChange={(event) => setActionability(event.target.value as TaskTodo['actionability'])}
          disabled={saving}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="actionable">Actionable</option>
          <option value="waiting">Waiting</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-organization-${task.id}`}>
            Organization
          </label>
          <select
            id={`task-organization-${task.id}`}
            value={organization}
            onChange={(event) => {
              setOrganization(event.target.value);
              setHeadingId('');
            }}
            disabled={saving || hierarchy.loading}
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
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-heading-${task.id}`}>
            Heading
          </label>
          <select
            id={`task-heading-${task.id}`}
            value={headingId}
            onChange={(event) => setHeadingId(event.target.value)}
            disabled={saving || !organization.startsWith('project:')}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">No Heading</option>
            {hierarchy.headings
              .filter(({ project_id }) => organization === `project:${project_id}`)
              .map((heading) => (
                <option key={heading.id} value={heading.id}>{heading.title}</option>
              ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-start-date-${task.id}`}>
            Start Date
          </label>
          <div className="flex gap-2">
            <DatePickerField
              id={`task-start-date-${task.id}`}
              value={startDate}
              onValueChange={setStartDate}
              disabled={saving}
              placeholder="No Start Date"
              aria-label="Start Date"
            />
            {startDate ? (
              <Button
                type="button"
                variant="clear"
                size="icon"
                disabled={saving}
                aria-label="Clear Start Date"
                onClick={() => setStartDate('')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`task-deadline-${task.id}`}>
            Deadline
          </label>
          <div className="flex gap-2">
            <DatePickerField
              id={`task-deadline-${task.id}`}
              value={deadline}
              onValueChange={setDeadline}
              disabled={saving}
              placeholder="No Deadline"
              aria-label="Deadline"
            />
            {deadline ? (
              <Button
                type="button"
                variant="clear"
                size="icon"
                disabled={saving}
                aria-label="Clear Deadline"
                onClick={() => setDeadline('')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <fieldset className="space-y-3 rounded-md border border-[hsl(var(--grid-sticky-line))] p-3">
        <legend className="px-1 text-sm font-medium text-foreground">Reminder</legend>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor={`task-reminder-date-${task.id}`}>
              Date
            </label>
            <div className="flex gap-2">
              <DatePickerField
                id={`task-reminder-date-${task.id}`}
                value={reminderDate}
                onValueChange={setReminderDate}
                disabled={saving || reminderMode !== 'connected'}
                placeholder="No Reminder"
                aria-label="Reminder Date"
              />
              {reminderDate ? (
                <Button
                  type="button"
                  variant="clear"
                  size="icon"
                  disabled={saving || reminderMode !== 'connected'}
                  aria-label="Clear Reminder"
                  onClick={() => setReminderDate('')}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor={`task-reminder-time-${task.id}`}>
              Time
            </label>
            <Input
              id={`task-reminder-time-${task.id}`}
              type="time"
              value={reminderTime}
              onChange={(event) => setReminderTime(event.target.value)}
              disabled={saving || reminderMode !== 'connected' || !reminderDate}
            />
          </div>
        </div>
        {reminderDate ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor={`task-reminder-ambiguity-${task.id}`}>
                Repeated Local Time
              </label>
              <select
                id={`task-reminder-ambiguity-${task.id}`}
                value={ambiguityChoice}
                onChange={(event) => setAmbiguityChoice(event.target.value as 'earlier' | 'later')}
                disabled={saving || reminderMode !== 'connected'}
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
        {reminderMode !== 'connected' ? (
          <p className="text-xs text-warning">
            Reminders require connected task storage so the server can own delivery identity.
          </p>
        ) : reminder?.resolution_kind === 'gap_forward' ? (
          <p className="text-xs text-warning">
            This local time was adjusted to the first valid instant after a daylight-saving gap.
          </p>
        ) : null}
      </fieldset>
      {invalidDateRange ? (
        <p role="alert" className="text-sm text-destructive">
          Deadline cannot be earlier than the start date.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="clear" size="sm" disabled={saving} onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={
            !title.trim()
            || saving
            || invalidDateRange
            || invalidReminder
            || (reminderChanged && reminderMode !== 'connected')
          }
        >
          Save
        </Button>
      </div>
    </form>
  );
}

function TasksStorageStatus({
  mode,
  syncState,
  pendingUploadCount,
}: {
  mode: 'local' | 'connected';
  syncState: TasksSyncState;
  pendingUploadCount: number;
}) {
  const Icon = mode === 'connected' ? Cloud : HardDrive;
  const label = getTasksStorageStatusLabel({ mode, syncState, pendingUploadCount });
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-info" aria-label="Task Sync Status">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function showTaskError(title: string, error: unknown): void {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
}

function formatReminderIntent(reminder: TaskReminder): string {
  const localTime = reminder.local_time.slice(0, 5);
  return `Remind ${formatTaskCalendarDate(reminder.local_date)} at ${localTime}`;
}

function getTaskViewLabel(view: TaskShellView): string {
  if (view === 'inbox') return 'Inbox';
  if (view === 'anytime') return 'Anytime';
  if (view === 'someday') return 'Someday';
  if (view === 'logbook') return 'Logbook';
  if (view === 'upcoming') return 'Upcoming';
  if (view === 'trash') return 'Trash';
  if (view === 'projects') return 'Projects';
  if (view === 'project') return 'Project';
  if (view === 'templates') return 'Templates';
  return 'Today';
}

function MobileProjectsLink({
  view,
  basePath,
  navigate,
}: {
  view: TaskShellView;
  basePath: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const destination = view === 'project' ? 'projects' : view === 'projects' ? 'today' : 'projects';
  const href = `${basePath}/${destination}`;
  const Icon = destination === 'today' ? CalendarDays : FolderKanban;
  const label = destination === 'today' ? 'Today' : 'Projects';
  return (
    <a
      href={href}
      aria-label={view === 'project'
        ? 'Return to Projects'
        : destination === 'projects' ? 'Open Projects' : 'Return to Today'}
      onClick={(event) => handleClientSideLinkNavigation(event, navigate, href)}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[hsl(var(--grid-sticky-line))] px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </a>
  );
}

function MobileTemplatesLink({
  view,
  basePath,
  navigate,
}: {
  view: TaskShellView;
  basePath: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const destination = view === 'templates' ? 'today' : 'templates';
  const href = `${basePath}/${destination}`;
  const Icon = destination === 'today' ? CalendarDays : LayoutTemplate;
  const label = destination === 'today' ? 'Today' : 'Templates';
  return (
    <a
      href={href}
      aria-label={destination === 'templates' ? 'Open Templates' : 'Return to Today'}
      onClick={(event) => handleClientSideLinkNavigation(event, navigate, href)}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[hsl(var(--grid-sticky-line))] px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </a>
  );
}

function isTaskKeyboardInput(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(
    'input, textarea, select, [contenteditable="true"]',
  ));
}

function getTaskViewFromPath(pathname: string): TaskShellView {
  if (pathname.endsWith('/inbox')) return 'inbox';
  if (pathname.endsWith('/anytime')) return 'anytime';
  if (pathname.endsWith('/someday')) return 'someday';
  if (pathname.endsWith('/logbook')) return 'logbook';
  if (pathname.endsWith('/upcoming')) return 'upcoming';
  if (pathname.endsWith('/trash')) return 'trash';
  if (pathname.endsWith('/templates')) return 'templates';
  if (getTaskProjectIdFromPath(pathname)) return 'project';
  if (pathname.endsWith('/projects')) return 'projects';
  return 'today';
}

function getTaskProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/projects\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getTaskSectionLabel(view: TaskListView): string {
  if (view === 'inbox') return 'Inbox Tasks';
  if (view === 'anytime') return 'Anytime Tasks';
  if (view === 'someday') return 'Someday Tasks';
  if (view === 'logbook') return 'Logbook Tasks';
  if (view === 'upcoming') return 'Upcoming Tasks';
  if (view === 'trash') return 'Deleted Tasks';
  return 'Today Tasks';
}

function getTaskHierarchyLabel(task: TaskTodo, hierarchy: TaskHierarchyModel): string | null {
  if (task.project_id) {
    const project = hierarchy.projects.find(({ id }) => id === task.project_id);
    const heading = hierarchy.headings.find(({ id }) => id === task.heading_id);
    if (!project) return 'Unavailable Project';
    return heading ? `${project.title} / ${heading.title}` : project.title;
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
  headingId: string,
): Pick<TaskTodo, 'area_id' | 'project_id' | 'heading_id'> {
  if (organization.startsWith('project:')) {
    return {
      area_id: null,
      project_id: organization.slice('project:'.length),
      heading_id: headingId || null,
    };
  }
  if (organization.startsWith('area:')) {
    return {
      area_id: organization.slice('area:'.length),
      project_id: null,
      heading_id: null,
    };
  }
  return { area_id: null, project_id: null, heading_id: null };
}

function formatTaskTerminalDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf())
    ? timestamp
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatTaskCalendarDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
