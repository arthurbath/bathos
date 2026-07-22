import { ChevronLeft, ChevronRight, FolderKanban, ListTodo } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { shouldHandleWithBrowser, handleClientSideLinkNavigation } from '@/lib/navigation';
import { TaskHierarchyEditableTitle } from '@/modules/tasks/components/TaskProjectsView';
import { TaskSourceIndicator } from '@/modules/tasks/components/TaskSourceIndicator';
import { getTaskPlanningRoute } from '@/modules/tasks/domain/taskPlanningRoute';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import { useTaskAreaDetail } from '@/modules/tasks/hooks/useTaskAreaDetail';
import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

export function TaskAreaDetailView({
  ownerId,
  areaId,
  hierarchy,
  planningDate,
  onOpenTask,
}: {
  ownerId: string;
  areaId: string;
  hierarchy: TaskHierarchyModel;
  planningDate: string;
  onOpenTask: (taskId: string, href: string) => void;
}) {
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const detail = useTaskAreaDetail(ownerId, areaId);
  const area = hierarchy.areas.find(({ id }) => id === areaId);

  if (hierarchy.loading || detail.loading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  if (hierarchy.error || detail.error) {
    return (
      <p role="alert" className="py-12 text-center text-sm text-destructive">
        Area Could Not Be Loaded
      </p>
    );
  }
  if (!area) {
    return (
      <p role="alert" className="py-12 text-center text-sm text-muted-foreground">
        Area Not Found
      </p>
    );
  }

  const activeProjects = hierarchy.projects.filter((project) => (
    project.area_id === areaId && project.lifecycle === 'open'
  ));
  const projectsHref = `${basePath}/projects`;

  return (
    <div className="space-y-7">
      <a
        href={projectsHref}
        onClick={(event) => handleClientSideLinkNavigation(event, navigate, projectsHref)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Projects
      </a>

      <div className="flex min-h-10 items-center gap-2">
        <FolderKanban className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <TaskHierarchyEditableTitle
          value={area.title}
          onSave={(title) => hierarchy.updateArea(area.id, { title })}
        />
      </div>

      <AreaWorkSection
        title="Loose To-Dos"
        icon={ListTodo}
        count={detail.tasks.length}
      >
        {detail.tasks.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">No Loose To-Dos</p>
        ) : detail.tasks.map((task) => {
          const route = getTaskPlanningRoute(task, planningDate);
          const href = `${basePath}/${route}`;
          return (
            <div key={task.id} className="flex min-h-14 items-center">
              <a
                href={href}
                onClick={(event) => {
                  if (shouldHandleWithBrowser(event)) return;
                  event.preventDefault();
                  onOpenTask(task.id, href);
                }}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {task.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {getAreaTaskMetadata(task, route)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </a>
              <span className="mr-3 shrink-0 sm:mr-4">
                <TaskSourceIndicator task={task} />
              </span>
            </div>
          );
        })}
      </AreaWorkSection>

      <AreaWorkSection
        title="Projects"
        icon={FolderKanban}
        count={activeProjects.length}
      >
        {activeProjects.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">No Active Projects</p>
        ) : activeProjects.map((project) => {
          const href = `${basePath}/projects/${project.id}`;
          return (
            <a
              key={project.id}
              href={href}
              onClick={(event) => handleClientSideLinkNavigation(event, navigate, href)}
              className="flex min-h-14 items-center gap-2 px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
            >
              <span className="min-w-0 flex-1 truncate">{project.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          );
        })}
      </AreaWorkSection>
    </div>
  );
}

function AreaWorkSection({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  children: ReactNode;
}) {
  const headingId = `task-area-${title.toLocaleLowerCase().replaceAll(' ', '-')}`;
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex min-h-9 items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 id={headingId} className="text-sm font-semibold text-foreground">
          {title} ({count})
        </h3>
      </div>
      <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
        {children}
      </div>
    </section>
  );
}

function getAreaTaskMetadata(
  task: TaskTodo,
  route: ReturnType<typeof getTaskPlanningRoute>,
): string {
  const values = [
    route === 'today' && task.today_section !== 'none'
      ? `Today ${task.today_section[0].toUpperCase()}${task.today_section.slice(1)}`
      : route[0].toUpperCase() + route.slice(1),
    task.actionability === 'waiting' ? 'Waiting' : null,
  ].filter(Boolean);
  return values.join(' / ');
}
