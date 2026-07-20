import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  Archive,
  CalendarDays,
  CalendarRange,
  CircleDashed,
  FolderKanban,
  Inbox,
  ListTodo,
  Search,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { shouldHandleWithBrowser } from '@/lib/navigation';
import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import type { TaskLifecycle } from '@/modules/tasks/domain/taskState';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import type {
  TaskActionability,
  TaskDestination,
  TaskSourceKind,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

export type TaskTemporalAction = {
  label: string;
  run: () => Promise<void>;
};

type TaskSearchFilters = {
  destination: 'all' | TaskDestination;
  lifecycle: 'all' | TaskLifecycle;
  actionability: 'all' | TaskActionability;
  sourceKind: 'all' | 'none' | TaskSourceKind;
};

const taskSearchViews = [
  { path: '/inbox', label: 'Inbox', icon: Inbox },
  { path: '/today', label: 'Today', icon: CalendarDays },
  { path: '/upcoming', label: 'Upcoming', icon: CalendarRange },
  { path: '/anytime', label: 'Anytime', icon: ListTodo },
  { path: '/someday', label: 'Someday', icon: CircleDashed },
  { path: '/logbook', label: 'Logbook', icon: Archive },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/trash', label: 'Trash', icon: Trash2 },
] as const;

const sourceKindLabels: Record<TaskSourceKind, string> = {
  webpage: 'Webpage',
  mail_message: 'Mail Message',
  file: 'File',
  selected_text: 'Selected Text',
  reading_item: 'Reading Item',
  template: 'Template',
  other: 'Other',
};

export function TaskSearchDialog({
  open,
  basePath,
  tasks,
  hierarchy,
  planningDate,
  loading,
  error,
  onOpenChange,
  onCloseAutoFocus,
  onNavigate,
  onSelectTask,
}: {
  open: boolean;
  basePath: string;
  tasks: TaskTodo[];
  hierarchy: TaskHierarchyModel;
  planningDate: string;
  loading: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
  onNavigate: (path: string) => void;
  onSelectTask: (task: TaskTodo, path: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<TaskSearchFilters>({
    destination: 'all',
    lifecycle: 'all',
    actionability: 'all',
    sourceKind: 'all',
  });
  useEffect(() => {
    if (open) return;
    setQuery('');
    setFilters({
      destination: 'all',
      lifecycle: 'all',
      actionability: 'all',
      sourceKind: 'all',
    });
  }, [open]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const deferredQuery = useDeferredValue(normalizedQuery);
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (filters.destination !== 'all' && task.destination !== filters.destination) return false;
    if (filters.lifecycle !== 'all' && task.lifecycle !== filters.lifecycle) return false;
    if (
      filters.actionability !== 'all'
      && task.actionability !== filters.actionability
    ) return false;
    if (filters.sourceKind === 'none' && task.source_kind !== null) return false;
    if (
      filters.sourceKind !== 'all'
      && filters.sourceKind !== 'none'
      && task.source_kind !== filters.sourceKind
    ) return false;
    if (!deferredQuery) return true;
    const hierarchyLabel = getTaskHierarchyLabel(task, hierarchy);
    return [
      task.title,
      task.notes,
      task.source_title,
      task.source_url,
      hierarchyLabel,
    ].some((value) => value?.toLocaleLowerCase().includes(deferredQuery));
  }), [deferredQuery, filters, hierarchy, tasks]);
  const filtersActive = filters.destination !== 'all'
    || filters.lifecycle !== 'all'
    || filters.actionability !== 'all'
    || filters.sourceKind !== 'all';
  const resultLimit = normalizedQuery || filtersActive ? 100 : 20;
  const displayedTasks = filteredTasks.slice(0, resultLimit);
  const availableSourceKinds = useMemo(() => Array.from(new Set(
    tasks.flatMap((task) => (task.source_kind ? [task.source_kind] : [])),
  )).sort(), [tasks]);

  const handleViewClick = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (shouldHandleWithBrowser(event)) return;
    event.preventDefault();
    onNavigate(path);
  };
  const handleTaskClick = (
    event: MouseEvent<HTMLAnchorElement>,
    task: TaskTodo,
    path: string,
  ) => {
    if (shouldHandleWithBrowser(event)) return;
    event.preventDefault();
    onSelectTask(task, path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="shadow-none sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Search Tasks</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4 pt-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search Tasks and Views"
              placeholder="Search Tasks and Views"
              className="pl-9"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2" aria-label="Task Search Filters">
            <SearchFilter
              label="Placement"
              value={filters.destination}
              onChange={(destination) => setFilters((current) => ({
                ...current,
                destination: destination as TaskSearchFilters['destination'],
              }))}
              options={[
                ['all', 'All Placements'],
                ['inbox', 'Inbox'],
                ['today', 'Today'],
                ['anytime', 'Anytime'],
                ['someday', 'Someday'],
              ]}
            />
            <SearchFilter
              label="Status"
              value={filters.lifecycle}
              onChange={(lifecycle) => setFilters((current) => ({
                ...current,
                lifecycle: lifecycle as TaskSearchFilters['lifecycle'],
              }))}
              options={[
                ['all', 'All Statuses'],
                ['open', 'Open'],
                ['completed', 'Completed'],
                ['canceled', 'Canceled'],
              ]}
            />
            <SearchFilter
              label="Actionability"
              value={filters.actionability}
              onChange={(actionability) => setFilters((current) => ({
                ...current,
                actionability: actionability as TaskSearchFilters['actionability'],
              }))}
              options={[
                ['all', 'All Actionability'],
                ['actionable', 'Actionable'],
                ['waiting', 'Waiting'],
              ]}
            />
            <SearchFilter
              label="Source"
              value={filters.sourceKind}
              onChange={(sourceKind) => setFilters((current) => ({
                ...current,
                sourceKind: sourceKind as TaskSearchFilters['sourceKind'],
              }))}
              options={[
                ['all', 'All Sources'],
                ['none', 'No Source'],
                ...availableSourceKinds.map((sourceKind) => [
                  sourceKind,
                  sourceKindLabels[sourceKind],
                ] as const),
              ]}
            />
          </div>

          {!normalizedQuery ? (
            <section aria-labelledby="task-search-views-heading">
              <h3 id="task-search-views-heading" className="mb-2 text-xs font-semibold text-muted-foreground">
                Views
              </h3>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                {taskSearchViews.map(({ path, label, icon: Icon }) => {
                  const href = `${basePath}${path}`;
                  return (
                    <a
                      key={path}
                      href={href}
                      onClick={(event) => handleViewClick(event, href)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {label}
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="task-search-results-heading">
            <h3 id="task-search-results-heading" className="mb-2 text-xs font-semibold text-muted-foreground">
              Tasks ({filteredTasks.length})
            </h3>
            {loading ? (
              <div className="flex min-h-24 items-center justify-center"><LoadingSpinner /></div>
            ) : error ? (
              <p role="alert" className="py-6 text-center text-sm text-destructive">
                Tasks Could Not Be Searched
              </p>
            ) : filteredTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No Matching Tasks</p>
            ) : (
              <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                {displayedTasks.map((task) => {
                  const route = getTaskSearchRoute(task, planningDate);
                  const href = `${basePath}/${route}`;
                  const hierarchyLabel = getTaskHierarchyLabel(task, hierarchy);
                  return (
                    <a
                      key={task.id}
                      href={href}
                      onClick={(event) => handleTaskClick(event, task, href)}
                      className="block px-2 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">{task.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {getTaskSearchMetadata(task, hierarchyLabel)}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
            {filteredTasks.length > displayedTasks.length ? (
              <p className="pt-3 text-center text-xs text-muted-foreground">
                Showing {displayedTasks.length} of {filteredTasks.length}. Refine the search to narrow results.
              </p>
            ) : null}
          </section>
        </DialogBody>
        <div className="text-xs text-muted-foreground">Escape Closes</div>
      </DialogContent>
    </Dialog>
  );
}

function SearchFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export function TaskKeyboardHelpDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
}) {
  const groups = [
    {
      label: 'Everywhere',
      commands: [
        ['N', 'Capture a Task'],
        ['/', 'Search Tasks and Views'],
        ['?', 'Show Keyboard Help'],
        ['G then I/T/U/A/S/L/P/R/E', 'Navigate to a View'],
      ],
    },
    {
      label: 'Focused Task',
      commands: [
        ['Enter', 'Edit'],
        ['C', 'Complete'],
        ['M', 'Move to an Area, Project, or Heading'],
        ['W', 'Choose When'],
        ['Up/Down', 'Move Focus'],
        ['Option+Up/Down', 'Reorder'],
      ],
    },
    {
      label: 'Editor and Surfaces',
      commands: [
        ['Command+Enter', 'Save'],
        ['Escape', 'Cancel or Close'],
        ['Tab/Shift+Tab', 'Move Through Controls'],
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="shadow-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader><DialogTitle>Keyboard Commands</DialogTitle></DialogHeader>
        <DialogBody className="space-y-5 pt-4">
          {groups.map((group) => {
            const headingId = `task-keyboard-${group.label.toLocaleLowerCase().replaceAll(' ', '-')}`;
            return (
              <section key={group.label} aria-labelledby={headingId}>
                <h3
                  id={headingId}
                  className="mb-2 text-xs font-semibold text-muted-foreground"
                >
                  {group.label}
                </h3>
                <dl className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                  {group.commands.map(([keys, description]) => (
                    <div key={keys} className="flex items-center justify-between gap-4 py-2 text-sm">
                      <dt className="text-foreground">{description}</dt>
                      <dd><kbd className="font-mono text-xs text-muted-foreground">{keys}</kbd></dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </DialogBody>
        <div className="text-xs text-muted-foreground">Escape Closes</div>
      </DialogContent>
    </Dialog>
  );
}

export function TaskMoveDialog({
  open,
  task,
  hierarchy,
  onOpenChange,
  onCloseAutoFocus,
  onMove,
}: {
  open: boolean;
  task: TaskTodo;
  hierarchy: TaskHierarchyModel;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
  onMove: (patch: EditableTaskPatch) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const move = async (patch: EditableTaskPatch) => {
    if (pending) return;
    setPending(true);
    try {
      await onMove(patch);
      onOpenChange(false);
    } catch {
      // The task shell reports the error and keeps this surface available for retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent
        className="shadow-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader><DialogTitle>Move Task</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4 pt-4">
          <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
          <div className="border-y border-[hsl(var(--grid-sticky-line))]">
            <TaskCommandButton
              label="No Area or Project"
              current={!task.area_id && !task.project_id}
              disabled={pending}
              onClick={() => void move({ area_id: null, project_id: null, heading_id: null })}
            />
          </div>
          {hierarchy.areas.length > 0 ? (
            <TaskCommandGroup label="Areas">
              {hierarchy.areas.map((area) => (
                <TaskCommandButton
                  key={area.id}
                  label={area.title}
                  current={task.area_id === area.id}
                  disabled={pending}
                  onClick={() => void move({
                    area_id: area.id,
                    project_id: null,
                    heading_id: null,
                  })}
                />
              ))}
            </TaskCommandGroup>
          ) : null}
          {hierarchy.projects.length > 0 ? (
            <TaskCommandGroup label="Projects">
              {hierarchy.projects.map((project) => (
                <div key={project.id}>
                  <TaskCommandButton
                    label={project.title}
                    current={task.project_id === project.id && task.heading_id === null}
                    disabled={pending}
                    onClick={() => void move({
                      area_id: null,
                      project_id: project.id,
                      heading_id: null,
                    })}
                  />
                  {hierarchy.headings
                    .filter(({ project_id }) => project_id === project.id)
                    .map((heading) => (
                      <TaskCommandButton
                        key={heading.id}
                        label={`${project.title} / ${heading.title}`}
                        current={task.heading_id === heading.id}
                        disabled={pending}
                        nested
                        onClick={() => void move({
                          area_id: null,
                          project_id: project.id,
                          heading_id: heading.id,
                        })}
                      />
                    ))}
                </div>
              ))}
            </TaskCommandGroup>
          ) : null}
        </DialogBody>
        <div className="text-xs text-muted-foreground">Escape Closes</div>
      </DialogContent>
    </Dialog>
  );
}

export function TaskWhenDialog({
  open,
  task,
  actions,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  task: TaskTodo;
  actions: TaskTemporalAction[];
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
}) {
  const [pending, setPending] = useState(false);
  const apply = async (action: TaskTemporalAction) => {
    if (pending) return;
    setPending(true);
    try {
      await action.run();
      onOpenChange(false);
    } catch {
      // The task shell reports the error and keeps this surface available for retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent
        className="shadow-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader><DialogTitle>Choose When</DialogTitle></DialogHeader>
        <DialogBody className="pt-4">
          <p className="mb-4 truncate text-sm font-medium text-foreground">{task.title}</p>
          <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
            {actions.map((action) => (
              <TaskCommandButton
                key={action.label}
                label={action.label}
                disabled={pending}
                onClick={() => void apply(action)}
              />
            ))}
          </div>
        </DialogBody>
        <div className="text-xs text-muted-foreground">Escape Closes</div>
      </DialogContent>
    </Dialog>
  );
}

export function TaskBulkWhenDialog({
  open,
  selectedCount,
  actions,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  selectedCount: number;
  actions: TaskTemporalAction[];
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
}) {
  const [pending, setPending] = useState(false);
  const apply = async (action: TaskTemporalAction) => {
    if (pending) return;
    setPending(true);
    try {
      await action.run();
      onOpenChange(false);
    } catch {
      // The task shell reports the error and keeps this surface available for retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent
        className="shadow-none"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader><DialogTitle>Plan Selected Tasks</DialogTitle></DialogHeader>
        <DialogBody className="pt-4">
          <p className="mb-4 text-sm font-medium text-foreground">
            {selectedCount} {selectedCount === 1 ? 'Task' : 'Tasks'}
          </p>
          <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
            {actions.map((action) => (
              <TaskCommandButton
                key={action.label}
                label={action.label}
                disabled={pending || selectedCount === 0}
                onClick={() => void apply(action)}
              />
            ))}
          </div>
        </DialogBody>
        <div className="text-xs text-muted-foreground">Escape Closes</div>
      </DialogContent>
    </Dialog>
  );
}

function TaskCommandGroup({ label, children }: { label: string; children: ReactNode }) {
  const headingId = `task-command-${label.toLocaleLowerCase().replaceAll(' ', '-')}`;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-1 text-xs font-semibold text-muted-foreground">
        {label}
      </h3>
      <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
        {children}
      </div>
    </section>
  );
}

function TaskCommandButton({
  label,
  current = false,
  disabled,
  nested = false,
  onClick,
}: {
  label: string;
  current?: boolean;
  disabled: boolean;
  nested?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="clear"
      disabled={disabled || current}
      aria-current={current ? 'true' : undefined}
      onClick={onClick}
      className={`h-auto min-h-10 w-full justify-start rounded-none px-2 py-2 text-left ${
        nested ? 'pl-6 text-muted-foreground' : ''
      }`}
    >
      {label}{current ? ' (Current)' : ''}
    </Button>
  );
}

function getTaskSearchRoute(task: TaskTodo, planningDate: string): string {
  if (task.lifecycle !== 'open') return 'logbook';
  if (
    task.start_date
    && task.start_date > planningDate
    && (task.destination === 'today' || task.destination === 'anytime')
  ) return 'upcoming';
  return task.destination;
}

function getTaskSearchMetadata(task: TaskTodo, hierarchyLabel: string | null): string {
  const metadata = [
    task.lifecycle === 'open' ? task.destination : task.lifecycle,
    task.actionability === 'waiting' ? 'waiting' : null,
    hierarchyLabel,
    task.source_kind ? sourceKindLabels[task.source_kind] : null,
  ].filter(Boolean);
  return metadata.map((value) => value![0].toUpperCase() + value!.slice(1)).join(' / ');
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
