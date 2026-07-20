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
  CircleSlash2,
  Cloud,
  CornerDownLeft,
  HardDrive,
  Inbox,
  ListTodo,
  MoreHorizontal,
  Moon,
  Plus,
  RotateCcw,
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
  getTodayTaskSection,
  useTaskList,
  type TaskListView,
  type TodayTaskSection,
} from '@/modules/tasks/hooks/useTaskList';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { normalizeTaskEditorPlanningPatch } from '@/modules/tasks/components/taskEditorPlanning';
import { TaskProjectsView } from '@/modules/tasks/components/TaskProjectsView';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

type TasksShellProps = {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
};

type TaskRowAction = {
  label: string;
  run: () => Promise<void>;
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
] as const;

type TaskShellView = TaskListView | 'projects';

export function TasksShell({ userId, displayName, onSignOut }: TasksShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const view = getTaskViewFromPath(location.pathname);
  const taskListView: TaskListView = view === 'projects' ? 'inbox' : view;
  const { mode, prepareForSignOut } = useTasksRuntime();
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
  const captureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedTaskId(null);
    captureInputRef.current?.focus();
  }, [view]);

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

  const planningActionsForTask = (task: TaskTodo): TaskRowAction[] => {
    const action = (
      label: string,
      input: Parameters<typeof moveTask>[1],
    ): TaskRowAction => ({
      label,
      run: async () => {
        try {
          await moveTask(task.id, input);
        } catch (moveError) {
          showTaskError('Task Could Not Be Moved', moveError);
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
    const actions: TaskRowAction[] = [];
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
          }
        }}
        planningActions={planningActionsForTask(task)}
        onMoveUp={(view === 'today' || view === 'anytime' || view === 'someday') && index > 0 ? async () => {
          try {
            await reorderTask(task.id, 'up');
          } catch (reorderError) {
            showTaskError('Task Could Not Be Reordered', reorderError);
          }
        } : undefined}
        onMoveDown={(view === 'today' || view === 'anytime' || view === 'someday')
          && index >= 0
          && index < sectionTasks.length - 1 ? async () => {
          try {
            await reorderTask(task.id, 'down');
          } catch (reorderError) {
            showTaskError('Task Could Not Be Reordered', reorderError);
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
        actionsAccessory={<TasksStorageStatus mode={mode} />}
      />

      <main className={`mx-auto w-full max-w-3xl px-4 pt-8 md:pt-10 ${CARD_PAGE_BOTTOM_PADDING_CLASS}`}>
        <div className="space-y-7">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-3xl font-semibold leading-none tracking-tight">
              <span className="md:hidden">{getTaskViewLabel(view)}</span>
              <span className="hidden md:inline">Tasks</span>
            </h2>
            <MobileProjectsLink view={view} basePath={basePath} navigate={navigate} />
          </div>

          <nav
            aria-label="Task views"
            className="hidden rounded-md border border-[hsl(var(--grid-sticky-line))] p-1 md:grid"
            style={{ gridTemplateColumns: `repeat(${taskViews.length}, minmax(0, 1fr))` }}
          >
            {taskViews.map(({ path, label, icon: Icon }) => {
              const href = `${basePath}${path}`;
              const active = view === path.slice(1);
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

          {view !== 'projects' && (view === 'inbox' || view === 'today' || view === 'anytime' || view === 'someday') ? (
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
                aria-keyshortcuts="Enter"
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

          {view === 'projects' ? <TaskProjectsView ownerId={userId} /> : <section aria-label={getTaskSectionLabel(view)}>
            {loading ? (
              <div className="flex min-h-40 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <p role="alert" className="py-12 text-center text-sm text-destructive">
                Tasks Could Not Be Loaded
              </p>
            ) : tasks.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {view === 'trash' ? 'Trash Is Empty' : view === 'logbook' ? 'Logbook Is Empty' : 'No Tasks'}
              </p>
            ) : view === 'today' ? (
              <TodayTaskSections
                tasks={tasks}
                planningDate={planningDate}
                renderTask={renderActiveTask}
              />
            ) : (
              <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                {tasks.map((task) => (
                  view === 'trash' ? (
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
                  ) : view === 'logbook' ? (
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
        items={taskViews.filter(({ path }) => path !== '/projects')}
        isActive={(path) => view === path.slice(1)}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
        hrefForPath={(path) => `${basePath}${path}`}
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
    <article className="flex min-h-16 items-center gap-3 px-2 sm:px-4">
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
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: EditableTaskPatch) => Promise<void>;
  onComplete: () => Promise<void>;
  planningActions: TaskRowAction[];
  onMoveUp?: () => Promise<void>;
  onMoveDown?: () => Promise<void>;
  planningLabel?: string | null;
  onDelete: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const titleButtonRef = useRef<HTMLButtonElement>(null);

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
          aria-expanded={selected}
          className="min-w-0 flex-1 py-4 text-left text-[15px] font-medium leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block">{task.title}</span>
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
            {planningActions.map((action) => (
              <DropdownMenuItem key={action.label} onSelect={() => void run(action.run)}>
                {action.label}
              </DropdownMenuItem>
            ))}
            {onMoveUp || onMoveDown ? <DropdownMenuSeparator /> : null}
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
          returnFocusRef={titleButtonRef}
          onCancel={onSelect}
          onSave={onUpdate}
        />
      ) : null}
    </article>
  );
}

function TaskEditor({
  task,
  returnFocusRef,
  onCancel,
  onSave,
}: {
  task: TaskTodo;
  returnFocusRef: RefObject<HTMLButtonElement>;
  onCancel: () => void;
  onSave: (patch: EditableTaskPatch) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [startDate, setStartDate] = useState(task.start_date ?? '');
  const [deadline, setDeadline] = useState(task.deadline ?? '');
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
    if (startDate !== (task.start_date ?? '')) {
      patch.start_date = startDate || null;
    }
    if (deadline !== (task.deadline ?? '')) {
      patch.deadline = deadline || null;
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
        if (event.key === 'Escape') {
          event.preventDefault();
          handleCancel();
        }
      }}
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

function TasksStorageStatus({ mode }: { mode: 'local' | 'connected' }) {
  const Icon = mode === 'connected' ? Cloud : HardDrive;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-info">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {mode === 'connected' ? 'Sync' : 'Local'}
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
  const projects = view !== 'projects';
  const href = `${basePath}${projects ? '/projects' : '/today'}`;
  const Icon = projects ? FolderKanban : CalendarDays;
  const label = projects ? 'Projects' : 'Today';
  return (
    <a
      href={href}
      aria-label={projects ? 'Open Projects' : 'Return to Today'}
      onClick={(event) => handleClientSideLinkNavigation(event, navigate, href)}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[hsl(var(--grid-sticky-line))] px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

function getTaskViewFromPath(pathname: string): TaskShellView {
  if (pathname.endsWith('/inbox')) return 'inbox';
  if (pathname.endsWith('/anytime')) return 'anytime';
  if (pathname.endsWith('/someday')) return 'someday';
  if (pathname.endsWith('/logbook')) return 'logbook';
  if (pathname.endsWith('/upcoming')) return 'upcoming';
  if (pathname.endsWith('/trash')) return 'trash';
  if (pathname.endsWith('/projects')) return 'projects';
  return 'today';
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
