import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  CalendarDays,
  CalendarRange,
  CircleDashed,
  FolderKanban,
  LayoutTemplate,
  ListTodo,
  Search,
  Settings,
  SquareCheckBig,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
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
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';
import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import {
  createTaskSearchDocuments,
  filterTaskSearchDocuments,
  getTaskSearchSourceKinds,
  type TaskSearchFilters,
} from '@/modules/tasks/domain/taskSearch';
import { getTaskPlanningRoute } from '@/modules/tasks/domain/taskPlanningRoute';
import { isMacLikeTaskPlatform } from '@/modules/tasks/domain/taskSelection';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import type {
  TaskSourceKind,
  TaskTodaySection,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

export type TaskBulkCommandMode = 'start' | 'deadline' | 'organization' | 'reminder';

export function TaskBulkCommandDialog({
  mode,
  selectedCount,
  pending,
  hierarchy,
  planningDate,
  onOpenChange,
  onApplyDate,
  onApplyOrganization,
  onApplyReminder,
}: {
  mode: TaskBulkCommandMode | null;
  selectedCount: number;
  pending: boolean;
  hierarchy: TaskHierarchyModel;
  planningDate: string;
  onOpenChange: (open: boolean) => void;
  onApplyDate: (value: string) => Promise<void>;
  onApplyOrganization: (patch: EditableTaskPatch) => Promise<void>;
  onApplyReminder: (localTime: string) => Promise<void>;
}) {
  const [reminderTime, setReminderTime] = useState('');
  const dateRef = useRef<HTMLButtonElement>(null);
  const organizationRef = useRef<HTMLSelectElement>(null);
  const reminderRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode === null) return;
    const timer = window.setTimeout(() => {
      if (mode === 'start' || mode === 'deadline') dateRef.current?.click();
      else if (mode === 'organization') organizationRef.current?.focus();
      else reminderRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode]);
  const title = mode === 'start'
    ? 'Set Start Date'
    : mode === 'deadline'
      ? 'Set Due Date'
      : mode === 'organization'
        ? 'Move Selected To'
        : 'Set Reminder Time';

  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="shadow-none sm:max-w-sm"
        aria-describedby={undefined}
        data-task-bulk-selection-surface
      >
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Applies to {selectedCount} selected {selectedCount === 1 ? 'task' : 'tasks'}.
          </p>
          {mode === 'start' || mode === 'deadline' ? (
            <DatePickerField
              ref={dateRef}
              value=""
              onValueChange={(value) => void onApplyDate(value)}
              placeholder={mode === 'start' ? 'Select Start Date' : 'Select Due Date'}
              aria-label={mode === 'start' ? 'Start Date' : 'Due Date'}
              disabled={pending}
              minDate={mode === 'start' ? addTaskCalendarDays(planningDate, 1) : undefined}
              popoverAlign="center"
            />
          ) : mode === 'organization' ? (
            <select
              ref={organizationRef}
              defaultValue=""
              disabled={pending}
              aria-label="Area or Project"
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                const [kind, id] = value.split(':', 2);
                void onApplyOrganization(kind === 'project'
                  ? { project_id: id, area_id: null }
                  : kind === 'area'
                    ? { area_id: id, project_id: null }
                    : { area_id: null, project_id: null });
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>Select an Area or Project</option>
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
          ) : mode === 'reminder' ? (
            <div className="flex gap-2">
              <Input
                ref={reminderRef}
                type="time"
                value={reminderTime}
                aria-label="Reminder Time"
                disabled={pending}
                onChange={(event) => setReminderTime(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!reminderTime || pending}
                onClick={() => void onApplyReminder(reminderTime)}
              >
                Apply
              </Button>
            </div>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export type TaskTemporalAction = {
  label: string;
  run: () => Promise<void>;
};

const taskSearchViews = [
  { path: '/today', label: 'Today', icon: CalendarDays },
  { path: '/upcoming', label: 'Upcoming', icon: CalendarRange },
  { path: '/anytime', label: 'Anytime', icon: ListTodo },
  { path: '/someday', label: 'Someday', icon: CircleDashed },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/templates', label: 'Templates', icon: LayoutTemplate },
  { path: '/done', label: 'Done', icon: SquareCheckBig },
  { path: '/config', label: 'Config', icon: Settings },
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
  const { areas, projects } = hierarchy;
  const documents = useMemo(
    () => createTaskSearchDocuments(tasks, { areas, projects }),
    [areas, projects, tasks],
  );
  const filteredDocuments = useMemo(
    () => filterTaskSearchDocuments(documents, deferredQuery, filters),
    [deferredQuery, documents, filters],
  );
  const filtersActive = filters.destination !== 'all'
    || filters.lifecycle !== 'all'
    || filters.actionability !== 'all'
    || filters.sourceKind !== 'all';
  const resultLimit = normalizedQuery || filtersActive ? 100 : 20;
  const displayedDocuments = filteredDocuments.slice(0, resultLimit);
  const availableSourceKinds = useMemo(
    () => getTaskSearchSourceKinds(documents),
    [documents],
  );

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
        aria-describedby={undefined}
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
                ['rechecking', 'Rechecking'],
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
              Tasks ({filteredDocuments.length})
            </h3>
            {loading ? (
              <div className="flex min-h-24 items-center justify-center"><LoadingSpinner /></div>
            ) : error ? (
              <p role="alert" className="py-6 text-center text-sm text-destructive">
                Tasks Could Not Be Searched
              </p>
            ) : filteredDocuments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No Matching Tasks</p>
            ) : (
              <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
                {displayedDocuments.map(({ task, hierarchyLabel }) => {
                  const route = getTaskPlanningRoute(task, planningDate);
                  const href = `${basePath}/${route}`;
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
            {filteredDocuments.length > displayedDocuments.length ? (
              <p className="pt-3 text-center text-xs text-muted-foreground">
                Showing {displayedDocuments.length} of {filteredDocuments.length}. Refine the search to narrow results.
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
  const platform = globalThis.navigator?.platform ?? '';
  const currentPlatform = isMacLikeTaskPlatform(platform)
    ? 'mac'
    : /Win/i.test(platform)
      ? 'windows'
      : null;
  const groups = [
    {
      label: 'Everywhere',
      commands: [
        ['New Task', 'Command+N', 'Control+N'],
        ['Quick Find', 'Command+F', 'Control+F'],
        ['Show Keyboard Help', 'Command+/', 'Control+/'],
        ['Open Today', 'Command+1', 'Control+1'],
        ['Open Upcoming', 'Command+2', 'Control+2'],
        ['Open Anytime', 'Command+3', 'Control+3'],
        ['Open Someday', 'Command+4', 'Control+4'],
        ['Open Projects', 'Command+5', 'Control+5'],
        ['Open Templates', 'Command+6', 'Control+6'],
        ['Open Config', 'Command+,', 'Control+,'],
        ['Undo a Task Change', 'Command+Z', 'Control+Z'],
        ['Redo a Task Change', 'Command+Shift+Z', 'Control+Shift+Z'],
        ['Select All Visible To-Dos', 'Command+A', 'Control+A'],
      ],
    },
    {
      label: 'Task List',
      commands: [
        ['Open Next', 'Control+S', 'Control+Shift+S'],
        ['Open Previous', 'Control+W', 'Control+Shift+W'],
        ['Mark Open To-Do Complete', 'Control+D', 'Control+Shift+D'],
        ['Toggle Completion', 'Command+K', 'Control+K'],
        ['Close and Clear Focus', 'Control+X', 'Control+Shift+X'],
        ['Move to or Cycle Today', 'Command+T', 'Control+T'],
        ['Move to Anytime', 'Command+R', 'Control+R'],
        ['Move to Someday', 'Command+O', 'Control+O'],
        ['Choose Due Date', 'Command+D', 'Control+D'],
        ['Duplicate', 'Command+Shift+D', 'Unavailable'],
        ['Choose Start Date', 'Command+S', 'Control+S'],
        ['Choose Area or Project', 'Command+M', 'Control+M'],
        ['Cycle Day Horizon', 'Command+H', 'Control+H'],
        ['Edit Reminder Time', 'Command+E', 'Control+E'],
        ['Reorder by Keyboard', 'Option+Up/Down', 'Alt+Up/Down'],
        ['Add or Remove Selection', 'Command-click', 'Control-click'],
        ['Replace Anchored Range', 'Shift-click', 'Shift-click'],
        ['Toggle After Selection Starts', 'Click', 'Click'],
        ['Reorder Directly', 'Drag', 'Drag'],
      ],
    },
    {
      label: 'Editor and Surfaces',
      commands: [
        ['Close Open To-Do', 'Command+Return or Escape', 'Control+Return or Escape'],
        ['Move Through Controls', 'Tab/Shift+Tab', 'Tab/Shift+Tab'],
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="shadow-none"
        aria-describedby={undefined}
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
                <div className="overflow-x-auto border-y border-[hsl(var(--grid-sticky-line))]">
                  <table className="w-full min-w-[30rem] table-fixed text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-[hsl(var(--grid-sticky-line))]">
                        <th scope="col" className="w-[45%] py-2 pr-3 font-medium">Action</th>
                        <th scope="col" className="w-[27.5%] px-2 py-2 font-medium">
                          Mac{currentPlatform === 'mac' ? ' · Current' : ''}
                        </th>
                        <th scope="col" className="w-[27.5%] py-2 pl-2 font-medium">
                          Windows{currentPlatform === 'windows' ? ' · Current' : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--grid-sticky-line))]">
                      {group.commands.map(([description, macKeys, windowsKeys]) => (
                        <tr key={description}>
                          <th scope="row" className="py-2 pr-3 font-normal text-foreground">
                            {description}
                          </th>
                          <td className="px-2 py-2">
                            <kbd className="font-mono text-xs text-muted-foreground">{macKeys}</kbd>
                          </td>
                          <td className="py-2 pl-2">
                            <kbd className="font-mono text-xs text-muted-foreground">{windowsKeys}</kbd>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
        aria-describedby={undefined}
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
              onClick={() => void move({ area_id: null, project_id: null })}
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
                    current={task.project_id === project.id}
                    disabled={pending}
                    onClick={() => void move({
                      area_id: null,
                      project_id: project.id,
                    })}
                  />
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
  planningDate,
  onOpenChange,
  onCloseAutoFocus,
  onPlan,
}: {
  open: boolean;
  task: TaskTodo;
  actions: TaskTemporalAction[];
  planningDate: string;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
  onPlan: (patch: EditableTaskPatch) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [startDate, setStartDate] = useState(task.start_date ?? '');
  const [todaySection, setTodaySection] = useState<TaskTodaySection>(task.today_section ?? 'next');
  useEffect(() => {
    if (!open) return;
    setStartDate(task.start_date ?? '');
    setTodaySection(task.today_section ?? 'next');
  }, [open, task.start_date, task.today_section]);
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
  const savePlanning = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onPlan({
        ...(task.destination === 'someday' && startDate
          ? { destination: 'anytime' as const }
          : {}),
        start_date: startDate || null,
        today_section: startDate ? todaySection : task.today_section,
      });
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
        <DialogHeader><DialogTitle>Choose When</DialogTitle></DialogHeader>
        <DialogBody className="space-y-5 pt-4">
          <p className="mb-4 truncate text-sm font-medium text-foreground">{task.title}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor={`task-when-start-${task.id}`}>
                Start Date
              </label>
              <DatePickerField
                id={`task-when-start-${task.id}`}
                value={startDate}
                onValueChange={(value) => {
                  if (value && !startDate) setTodaySection('next');
                  setStartDate(value);
                }}
                disabled={pending}
                placeholder="No Start Date"
                aria-label="Start Date"
                minDate={addTaskCalendarDays(planningDate, 1)}
              />
            </div>
            {startDate || task.today_section !== null ? <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor={`task-when-horizon-${task.id}`}>
                Day Horizon
              </label>
              <select
                id={`task-when-horizon-${task.id}`}
                value={todaySection}
                onChange={(event) => setTodaySection(event.target.value as TaskTodaySection)}
                disabled={pending}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="inbox">Inbox</option>
                <option value="now">Now</option>
                <option value="next">Next</option>
                <option value="later">Later</option>
              </select>
            </div> : null}
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={pending} onClick={() => void savePlanning()}>
              Save Planning
            </Button>
          </div>
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
        data-task-bulk-selection-surface
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

function getTaskSearchMetadata(task: TaskTodo, hierarchyLabel: string | null): string {
  const metadata = [
    task.lifecycle === 'open' ? task.destination : task.lifecycle,
    task.actionability === 'waiting'
      ? 'waiting'
      : task.actionability === 'rechecking' ? 'rechecking' : null,
    hierarchyLabel,
    task.source_kind ? sourceKindLabels[task.source_kind] : null,
  ].filter(Boolean);
  return metadata.map((value) => value![0].toUpperCase() + value!.slice(1)).join(' / ');
}
