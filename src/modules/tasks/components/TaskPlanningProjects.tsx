import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleSlash2,
  FolderKanban,
  MoreHorizontal,
  RotateCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';
import {
  getTodayProjectSection,
  projectPlanningOrderSection,
} from '@/modules/tasks/domain/taskProjectViews';
import type { TaskProjectPlanningMoveInput } from '@/modules/tasks/hooks/useTaskHierarchy';
import type { TaskListView } from '@/modules/tasks/hooks/useTaskList';
import type { TaskArea, TaskProject } from '@/modules/tasks/types/tasks';

type TaskPlanningProjectsProps = {
  projects: TaskProject[];
  areas: TaskArea[];
  basePath: string;
  view: TaskListView;
  planningDate: string;
  onMove: (project: TaskProject, input: TaskProjectPlanningMoveInput) => Promise<unknown>;
  onReorder: (project: TaskProject, direction: 'up' | 'down') => Promise<unknown>;
  onReopen: (project: TaskProject) => Promise<unknown>;
};

export function TaskPlanningProjects({
  projects,
  areas,
  basePath,
  view,
  planningDate,
  onMove,
  onReorder,
  onReopen,
}: TaskPlanningProjectsProps) {
  const areasById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas],
  );
  if (projects.length === 0) return null;

  return (
    <section aria-labelledby="task-planning-projects-heading">
      <h3
        id="task-planning-projects-heading"
        className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"
      >
        <FolderKanban className="h-4 w-4" aria-hidden="true" />
        Projects ({projects.length})
      </h3>
      <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
        {projects.map((project, index) => {
          const section = projectPlanningOrderSection(project, view, planningDate);
          const previous = projects[index - 1];
          const next = projects[index + 1];
          return (
            <TaskPlanningProjectRow
              key={project.id}
              project={project}
              area={project.area_id ? areasById.get(project.area_id) ?? null : null}
              href={`${basePath}/projects/${project.id}`}
              view={view}
              planningDate={planningDate}
              onMove={(input) => onMove(project, input)}
              onMoveUp={previous
                && projectPlanningOrderSection(previous, view, planningDate) === section
                ? () => onReorder(project, 'up')
                : undefined}
              onMoveDown={next
                && projectPlanningOrderSection(next, view, planningDate) === section
                ? () => onReorder(project, 'down')
                : undefined}
              onReopen={() => onReopen(project)}
            />
          );
        })}
      </div>
    </section>
  );
}

function TaskPlanningProjectRow({
  project,
  area,
  href,
  view,
  planningDate,
  onMove,
  onMoveUp,
  onMoveDown,
  onReopen,
}: {
  project: TaskProject;
  area: TaskArea | null;
  href: string;
  view: TaskListView;
  planningDate: string;
  onMove: (input: TaskProjectPlanningMoveInput) => Promise<unknown>;
  onMoveUp?: () => Promise<unknown>;
  onMoveDown?: () => Promise<unknown>;
  onReopen: () => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const terminal = view === 'logbook';
  const completed = project.lifecycle === 'completed';
  const TerminalIcon = completed ? CheckCircle2 : CircleSlash2;

  const run = async (operation: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    try {
      await operation();
    } finally {
      setPending(false);
    }
  };

  const planningActions = terminal
    ? []
    : getProjectPlanningActions(project, view, planningDate);

  return (
    <article className="flex min-h-16 items-center gap-3 px-2 sm:px-4">
      {terminal ? (
        <TerminalIcon
          className={`h-5 w-5 shrink-0 ${completed ? 'text-success' : 'text-muted-foreground'}`}
          aria-hidden="true"
        />
      ) : (
        <FolderKanban className="h-5 w-5 shrink-0 text-info" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1 py-3">
        <a
          href={href}
          onClick={(event) => handleClientSideLinkNavigation(event, navigate, href)}
          className="block truncate text-[15px] font-medium leading-5 text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {project.title}
        </a>
        <p className="text-xs text-muted-foreground">
          {projectPlanningLabel(project, view, planningDate, area?.title ?? null)}
        </p>
      </div>
      {terminal ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          aria-label={`Reopen ${project.title}`}
          className="gap-1.5"
          onClick={() => void run(onReopen)}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reopen
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="clear"
              size="icon"
              disabled={pending}
              aria-label={`Planning actions for ${project.title}`}
              className="h-10 w-10 text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {planningActions.map(({ label, input }) => (
              <DropdownMenuItem key={label} onSelect={() => void run(() => onMove(input))}>
                {label}
              </DropdownMenuItem>
            ))}
            {onMoveUp || onMoveDown ? <DropdownMenuSeparator /> : null}
            {onMoveUp ? (
              <DropdownMenuItem onSelect={() => void run(onMoveUp)}>Move Up</DropdownMenuItem>
            ) : null}
            {onMoveDown ? (
              <DropdownMenuItem onSelect={() => void run(onMoveDown)}>Move Down</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </article>
  );
}

function getProjectPlanningActions(
  project: TaskProject,
  view: TaskListView,
  planningDate: string,
): Array<{ label: string; input: TaskProjectPlanningMoveInput }> {
  const today = {
    label: view === 'upcoming' ? 'Make Available Today' : 'Move to Today',
    input: { destination: 'today', todaySection: 'daytime', startDate: planningDate },
  } satisfies { label: string; input: TaskProjectPlanningMoveInput };
  const anytime = {
    label: 'Move to Anytime',
    input: { destination: 'anytime', todaySection: 'daytime', startDate: null },
  } satisfies { label: string; input: TaskProjectPlanningMoveInput };
  const someday = {
    label: 'Move to Someday',
    input: { destination: 'someday', todaySection: 'daytime', startDate: null },
  } satisfies { label: string; input: TaskProjectPlanningMoveInput };

  if (view === 'upcoming') return [today, anytime, someday];
  if (view === 'anytime') return [today, someday];
  if (view === 'someday') return [today, anytime];

  const section = getTodayProjectSection(project, planningDate);
  const actions: Array<{ label: string; input: TaskProjectPlanningMoveInput }> = [];
  if (section === 'unfinished') actions.push({
    label: 'Reschedule for Today',
    input: { destination: 'today', todaySection: 'daytime', startDate: planningDate },
  });
  actions.push(section === 'evening' ? {
    label: 'Move to Earlier Today',
    input: { destination: 'today', todaySection: 'daytime', startDate: planningDate },
  } : {
    label: 'Move to This Evening',
    input: { destination: 'today', todaySection: 'evening', startDate: planningDate },
  });
  actions.push({
    label: 'Move to Tomorrow',
    input: {
      destination: 'today',
      todaySection: 'daytime',
      startDate: addTaskCalendarDays(planningDate, 1),
    },
  }, anytime, someday);
  return actions;
}

function projectPlanningLabel(
  project: TaskProject,
  view: TaskListView,
  planningDate: string,
  areaTitle: string | null,
): string {
  const details: string[] = [];
  if (view === 'logbook') {
    const terminalAt = project.lifecycle === 'completed' ? project.completed_at : project.canceled_at;
    details.push(project.lifecycle === 'completed' ? 'Completed' : 'Canceled');
    if (terminalAt) details.push(formatTerminalDate(terminalAt));
  } else if (view === 'today') {
    const section = getTodayProjectSection(project, planningDate);
    if (section === 'unfinished') {
      details.push(`Unfinished Since ${formatCalendarDate(project.start_date ?? planningDate)}`);
    } else if (section === 'evening') {
      details.push('This Evening');
    }
  } else if (view === 'upcoming' && project.start_date) {
    details.push(`Starts ${formatCalendarDate(project.start_date)}`);
  }
  if (project.deadline) details.push(`Due ${formatCalendarDate(project.deadline)}`);
  if (areaTitle) details.push(areaTitle);
  return details.length > 0 ? details.join(' · ') : 'Project';
}

function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return calendarDateFormatter.format(new Date(year, month - 1, day));
}

function formatTerminalDate(value: string): string {
  return terminalDateFormatter.format(new Date(value));
}

const calendarDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const terminalDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
