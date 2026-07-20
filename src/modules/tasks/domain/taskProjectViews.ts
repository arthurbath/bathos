import { compareTaskOrder } from '@/modules/tasks/domain/taskOrder';
import type { TaskDestination, TaskProject } from '@/modules/tasks/types/tasks';

type TaskProjectListView = TaskDestination | 'upcoming' | 'logbook' | 'trash';
type TodayProjectSection = 'unfinished' | 'daytime' | 'evening';

export function deriveTaskViewProjects(
  projects: readonly TaskProject[],
  ownerId: string,
  view: TaskProjectListView,
  planningDate: string,
): TaskProject[] {
  return projects
    .filter((project) => projectIsVisible(project, ownerId, view, planningDate))
    .sort((left, right) => compareProjectsForView(left, right, view, planningDate));
}

export function getTodayProjectSection(
  project: TaskProject,
  planningDate: string,
): TodayProjectSection {
  if (project.start_date !== null && project.start_date < planningDate) {
    return 'unfinished';
  }
  return project.today_section;
}

export function projectPlanningOrderSection(
  project: TaskProject,
  view: TaskProjectListView,
  planningDate: string,
): string {
  if (view === 'today') {
    return getTodayProjectSection(project, planningDate);
  }
  if (view === 'upcoming') {
    return `upcoming:${project.start_date ?? ''}`;
  }
  return view;
}

function projectIsVisible(
  project: TaskProject,
  ownerId: string,
  view: TaskProjectListView,
  planningDate: string,
): boolean {
  if (project.owner_id !== ownerId || view === 'inbox' || view === 'trash') {
    return false;
  }
  if (view === 'logbook') {
    return project.disposition === 'present' && project.lifecycle !== 'open';
  }
  if (view === 'upcoming') {
    return project.disposition === 'present'
      && project.lifecycle === 'open'
      && project.start_date !== null
      && project.start_date > planningDate;
  }
  return project.destination === view
    && project.lifecycle === 'open'
    && project.disposition === 'present'
    && ((view !== 'today' && view !== 'anytime')
      || project.start_date === null
      || project.start_date <= planningDate);
}

function compareProjectsForView(
  left: TaskProject,
  right: TaskProject,
  view: TaskProjectListView,
  planningDate: string,
): number {
  if (view === 'logbook') {
    return (right.completed_at ?? right.canceled_at ?? '').localeCompare(
      left.completed_at ?? left.canceled_at ?? '',
    ) || left.id.localeCompare(right.id);
  }
  if (view === 'upcoming') {
    return (left.start_date ?? '').localeCompare(right.start_date ?? '')
      || compareProjectOrder(left, right);
  }
  if (view === 'today') {
    const ranks: Record<TodayProjectSection, number> = {
      unfinished: 0,
      daytime: 1,
      evening: 2,
    };
    return ranks[getTodayProjectSection(left, planningDate)]
      - ranks[getTodayProjectSection(right, planningDate)]
      || compareProjectOrder(left, right);
  }
  return compareProjectOrder(left, right);
}

function compareProjectOrder(left: TaskProject, right: TaskProject): number {
  return compareTaskOrder(
    { id: left.id, orderKey: left.planning_order_key },
    { id: right.id, orderKey: right.planning_order_key },
  );
}
