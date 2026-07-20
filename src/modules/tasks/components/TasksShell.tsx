import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import {
  CalendarDays,
  Circle,
  Cloud,
  CornerDownLeft,
  HardDrive,
  Inbox,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { CARD_PAGE_BOTTOM_PADDING_CLASS } from '@/lib/pageLayout';
import { useTaskList, type TaskListView } from '@/modules/tasks/hooks/useTaskList';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskTodo } from '@/modules/tasks/types/tasks';
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
  { path: '/trash', label: 'Trash', icon: Trash2 },
] as const;

export function TasksShell({ userId, displayName, onSignOut }: TasksShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const view: TaskListView = location.pathname.endsWith('/inbox')
    ? 'inbox'
    : location.pathname.endsWith('/trash')
      ? 'trash'
      : 'today';
  const { mode, prepareForSignOut } = useTasksRuntime();
  const { tasks, loading, error, createTask, updateTask, transitionTask } = useTaskList(
    userId,
    view,
  );
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
          <h2 className="text-3xl font-semibold leading-none tracking-tight">
            <span className="md:hidden">{view === 'inbox' ? 'Inbox' : view === 'trash' ? 'Trash' : 'Today'}</span>
            <span className="hidden md:inline">Tasks</span>
          </h2>

          <nav
            aria-label="Task views"
            className="hidden grid-cols-3 rounded-md border border-[hsl(var(--grid-sticky-line))] p-1 md:grid"
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

          {view !== 'trash' ? (
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

          <section aria-label={view === 'inbox' ? 'Inbox Tasks' : view === 'trash' ? 'Deleted Tasks' : 'Today Tasks'}>
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
                {view === 'trash' ? 'Trash Is Empty' : 'No Tasks'}
              </p>
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
                  ) : <TaskRow
                    key={task.id}
                    task={task}
                    selected={selectedTaskId === task.id}
                    onSelect={() => setSelectedTaskId((current) => (current === task.id ? null : task.id))}
                    onUpdate={async (patch) => {
                      try {
                        await updateTask(task.id, patch);
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
                    onMove={async () => {
                      try {
                        await updateTask(task.id, {
                          destination: view === 'inbox' ? 'today' : 'inbox',
                        });
                      } catch (moveError) {
                        showTaskError('Task Could Not Be Moved', moveError);
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
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <MobileBottomNav
        items={taskViews}
        isActive={(path) => view === path.slice(1)}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
        hrefForPath={(path) => `${basePath}${path}`}
      />
    </div>
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
          {task.destination === 'inbox' ? 'Inbox' : 'Today'}
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

function TaskRow({
  task,
  selected,
  onSelect,
  onUpdate,
  onComplete,
  onMove,
  onDelete,
}: {
  task: TaskTodo;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: { title?: string; notes?: string }) => Promise<void>;
  onComplete: () => Promise<void>;
  onMove: () => Promise<void>;
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
          {task.title}
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
            <DropdownMenuItem onSelect={() => void run(onMove)}>
              Move to {task.destination === 'inbox' ? 'Today' : 'Inbox'}
            </DropdownMenuItem>
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
  onSave: (patch: { title?: string; notes?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [saving, setSaving] = useState(false);

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
    if (!normalizedTitle || saving) {
      return;
    }

    const patch: { title?: string; notes?: string } = {};
    if (normalizedTitle !== task.title) {
      patch.title = normalizedTitle;
    }
    if (notes !== task.notes) {
      patch.notes = notes;
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="clear" size="sm" disabled={saving} onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!title.trim() || saving}>
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
