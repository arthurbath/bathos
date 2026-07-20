import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Archive,
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
  ListTodo,
  LayoutTemplate,
  MoreHorizontal,
  Moon,
  Plus,
  RotateCcw,
  Search,
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
import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';
import {
  TaskKeyboardHelpDialog,
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
import {
  useTaskHierarchyTrash,
  type DeletedTaskHierarchyRoot,
} from '@/modules/tasks/hooks/useTaskHierarchyTrash';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { normalizeTaskEditorPlanningPatch } from '@/modules/tasks/components/taskEditorPlanning';
import { TaskProjectDetailView } from '@/modules/tasks/components/TaskProjectDetailView';
import { TaskProjectsView } from '@/modules/tasks/components/TaskProjectsView';
import { TaskTemplatesView } from '@/modules/tasks/components/TaskTemplatesView';
import {
  getTasksStorageStatusLabel,
  type TasksSyncState,
} from '@/modules/tasks/components/tasksStorageStatus';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

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
  const { mode, syncState, pendingUploadCount, prepareForSignOut } = useTasksRuntime();
  const hierarchy = useTaskHierarchy(userId);
  const hierarchyTrash = useTaskHierarchyTrash(userId);
  const {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    moveTask,
    reorderTask,
    transitionTask,
    planningDate,
  } = useTaskList(userId, taskListView);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [searchTargetTaskId, setSearchTargetTaskId] = useState<string | null>(null);
  const taskSearch = useTaskSearch(userId, searchOpen);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const commandReturnFocusRef = useRef<HTMLElement | null>(null);
  const pendingNavigationRef = useRef(false);
  const navigationResetRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedTaskId(null);
    captureInputRef.current?.focus();
  }, [view]);

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

  const renderActiveTask = (task: TaskTodo, sectionTasks: TaskTodo[]) => {
    const index = sectionTasks.findIndex((candidate) => candidate.id === task.id);
    return (
      <TaskRow
        key={task.id}
        task={task}
        hierarchy={hierarchy}
        selected={selectedTaskId === task.id}
        onSelect={() => setSelectedTaskId((current) => (current === task.id ? null : task.id))}
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
          <TasksStorageStatus
            mode={mode}
            syncState={syncState}
            pendingUploadCount={pendingUploadCount}
          />
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

          {view !== 'projects' && view !== 'project' && view !== 'templates' && (view === 'inbox' || view === 'today' || view === 'anytime' || view === 'someday') ? (
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
            />
          ) : view === 'projects' ? <TaskProjectsView hierarchy={hierarchy} />
            : view === 'templates' ? <TaskTemplatesView ownerId={userId} hierarchy={hierarchy} />
              : <section aria-label={getTaskSectionLabel(view)}>
            {loading || (view === 'trash' && hierarchyTrash.loading) ? (
              <div className="flex min-h-40 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : error || (view === 'trash' && hierarchyTrash.error) ? (
              <p role="alert" className="py-12 text-center text-sm text-destructive">
                Tasks Could Not Be Loaded
              </p>
            ) : tasks.length === 0 && (view !== 'trash' || hierarchyTrash.roots.length === 0) ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {view === 'trash' ? 'Trash Is Empty' : view === 'logbook' ? 'Logbook Is Empty' : 'No Tasks'}
              </p>
            ) : view === 'trash' ? (
              <div className="space-y-5">
                {hierarchyTrash.roots.length > 0 ? (
                  <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                    {hierarchyTrash.roots.map((root) => (
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
                      />
                    ))}
                  </div>
                ) : null}
                {tasks.length > 0 ? (
                  <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                    {tasks.map((task) => (
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
                    ))}
                  </div>
                ) : null}
              </div>
            ) : view === 'today' ? (
              <TodayTaskSections
                tasks={tasks}
                planningDate={planningDate}
                renderTask={renderActiveTask}
              />
            ) : (
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
    </div>
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
        <p className="text-xs text-muted-foreground">Deleted {label}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void onRestore()}>
        <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Restore
      </Button>
    </article>
  );
}

function DeletedTaskRow({ task, onRestore }: { task: TaskTodo; onRestore: () => Promise<void> }) {
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
  onUpdate,
  onComplete,
  planningActions,
  onMoveUp,
  onMoveDown,
  planningLabel,
  onDelete,
}: {
  task: TaskTodo;
  hierarchy: TaskHierarchyModel;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: EditableTaskPatch) => Promise<void>;
  onComplete: () => Promise<void>;
  planningActions: TaskTemporalAction[];
  onMoveUp?: () => Promise<void>;
  onMoveDown?: () => Promise<void>;
  planningLabel?: string | null;
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
    <article className={selected ? 'bg-foreground/[0.04]' : undefined}>
      <div className="flex min-h-14 items-center gap-3 px-2 sm:px-4">
        <button
          type="button"
          disabled={pending}
          aria-label={`Complete ${task.title}`}
          onClick={() => void run(onComplete)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Circle className="h-6 w-6" aria-hidden="true" />
        </button>
        <button
          ref={titleButtonRef}
          type="button"
          onClick={onSelect}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            if (
              event.altKey
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
          aria-expanded={selected}
          aria-keyshortcuts="Enter ArrowUp ArrowDown C M W Alt+ArrowUp Alt+ArrowDown"
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
        </button>
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
        </DropdownMenu>
      </div>
      {selected ? (
        <TaskEditor
          task={task}
          hierarchy={hierarchy}
          returnFocusRef={titleButtonRef}
          onCancel={onSelect}
          onSave={onUpdate}
        />
      ) : null}
      <TaskMoveDialog
        open={moveOpen}
        task={task}
        hierarchy={hierarchy}
        onOpenChange={(nextOpen) => {
          setMoveOpen(nextOpen);
        }}
        onCloseAutoFocus={() => titleButtonRef.current?.focus()}
        onMove={onUpdate}
      />
      <TaskWhenDialog
        open={whenOpen}
        task={task}
        actions={planningActions}
        onOpenChange={(nextOpen) => {
          setWhenOpen(nextOpen);
        }}
        onCloseAutoFocus={() => titleButtonRef.current?.focus()}
      />
    </article>
  );
}

function TaskEditor({
  task,
  hierarchy,
  returnFocusRef,
  onCancel,
  onSave,
}: {
  task: TaskTodo;
  hierarchy: TaskHierarchyModel;
  returnFocusRef: RefObject<HTMLButtonElement>;
  onCancel: () => void;
  onSave: (patch: EditableTaskPatch) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [actionability, setActionability] = useState(task.actionability);
  const [startDate, setStartDate] = useState(task.start_date ?? '');
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [organization, setOrganization] = useState(taskOrganizationValue(task));
  const [headingId, setHeadingId] = useState(task.heading_id ?? '');
  const [saving, setSaving] = useState(false);
  const invalidDateRange = Boolean(startDate && deadline && deadline < startDate);

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
    if (!normalizedTitle || saving || invalidDateRange) {
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
    if (Object.keys(patch).length === 0) {
      handleCancel();
      return;
    }

    setSaving(true);
    try {
      await onSave(patch);
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
      {invalidDateRange ? (
        <p role="alert" className="text-sm text-destructive">
          Deadline cannot be earlier than the start date.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="clear" size="sm" disabled={saving} onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!title.trim() || saving || invalidDateRange}>
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
      {label}
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
