import { compareTaskOrder } from '@/modules/tasks/domain/taskOrder';
import {
  compareTaskUpcomingDates,
  getTaskUpcomingDate,
} from '@/modules/tasks/domain/taskUpcoming';
import type { TaskDestination, TaskProject } from '@/modules/tasks/types/tasks';

type TaskProjectListView = TaskDestination | 'today' | 'upcoming' | 'done';
type TodayProjectSection = 'inbox' | 'now' | 'next' | 'later';

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
  _planningDate: string,
): TodayProjectSection {
  return project.today_section === 'none' ? 'inbox' : project.today_section;
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
    return `upcoming:${getTaskUpcomingDate(project, planningDate) ?? ''}`;
  }
  return view;
}

function projectIsVisible(
  project: TaskProject,
  ownerId: string,
  view: TaskProjectListView,
  planningDate: string,
): boolean {
  if (project.owner_id !== ownerId) {
    return false;
  }
  if (view === 'done') {
    return project.disposition === 'present' && project.lifecycle !== 'open';
  }
  if (view === 'upcoming') {
    return project.disposition === 'present'
      && project.lifecycle === 'open'
      && project.destination === 'anytime'
      && getTaskUpcomingDate(project, planningDate) !== null;
  }
  if (view === 'today') {
    return project.destination === 'anytime'
      && project.lifecycle === 'open'
      && project.disposition === 'present'
      && (
        (project.start_date === null && project.today_section !== 'none')
        || (project.start_date !== null && project.start_date <= planningDate)
      );
  }
  return project.destination === view
    && project.lifecycle === 'open'
    && project.disposition === 'present'
    && (view !== 'anytime'
      || project.start_date === null
      || project.start_date <= planningDate);
}

function compareProjectsForView(
  left: TaskProject,
  right: TaskProject,
  view: TaskProjectListView,
  planningDate: string,
): number {
  if (view === 'done') {
    return (right.deleted_at ?? right.completed_at ?? right.canceled_at ?? '').localeCompare(
      left.deleted_at ?? left.completed_at ?? left.canceled_at ?? '',
    ) || left.id.localeCompare(right.id);
  }
  if (view === 'upcoming') {
    return compareTaskUpcomingDates(left, right, planningDate)
      || compareProjectOrder(left, right);
  }
  if (view === 'today') {
    const ranks: Record<TodayProjectSection, number> = {
      inbox: 0,
      now: 1,
      next: 2,
      later: 3,
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
