import type { TaskPlanningRoute } from '@/modules/tasks/domain/taskPlanningRoute';
import {
  taskQuickFilterLabels,
  type TaskQuickFilter,
} from '@/modules/tasks/domain/taskQuickFilters';
import type { TaskListView } from '@/modules/tasks/hooks/useTaskList';

export type TaskDeparture = {
  kind: 'moved';
  destination: TaskPlanningRoute;
} | {
  kind: 'filtered';
  filter: Exclude<TaskQuickFilter, 'all'>;
};

export type TaskDepartureToast = {
  title: string;
  description: string;
};

export function classifyTaskDeparture({
  wasRendered,
  remainsInCurrentList,
  matchesCurrentFilter,
  currentFilter,
  destination,
}: {
  wasRendered: boolean;
  remainsInCurrentList: boolean;
  matchesCurrentFilter: boolean;
  currentFilter: TaskQuickFilter;
  destination: TaskPlanningRoute;
}): TaskDeparture | null {
  if (!wasRendered) return null;
  if (!remainsInCurrentList) return { kind: 'moved', destination };
  if (currentFilter !== 'all' && !matchesCurrentFilter) {
    return { kind: 'filtered', filter: currentFilter };
  }
  return null;
}

export function getTaskDepartureToast(
  departures: readonly TaskDeparture[],
  currentView: TaskListView,
): TaskDepartureToast | null {
  if (departures.length === 0) return null;

  const moved = departures.filter(
    (departure): departure is Extract<TaskDeparture, { kind: 'moved' }> => (
      departure.kind === 'moved'
    ),
  );
  const filtered = departures.filter(
    (departure): departure is Extract<TaskDeparture, { kind: 'filtered' }> => (
      departure.kind === 'filtered'
    ),
  );

  if (moved.length === 1 && filtered.length === 0) {
    return {
      title: 'Task Moved',
      description: `The task now appears in ${taskPlanningRouteLabel(moved[0].destination)}.`,
    };
  }
  if (moved.length === 0 && filtered.length === 1) {
    return {
      title: 'Task Hidden by Quick Filter',
      description: `The task no longer matches ${taskQuickFilterLabels[filtered[0].filter]}.`,
    };
  }

  const descriptions: string[] = [];
  if (moved.length > 0) {
    const destinations = new Set(moved.map(({ destination }) => destination));
    descriptions.push(destinations.size === 1
      ? `${moved.length} ${taskCountNoun(moved.length)} now appear in ${
          taskPlanningRouteLabel(moved[0].destination)
        }.`
      : `${moved.length} ${taskCountNoun(moved.length)} moved out of ${
          taskListViewLabel(currentView)
        }.`);
  }
  if (filtered.length > 0) {
    const filters = new Set(filtered.map(({ filter }) => filter));
    descriptions.push(filters.size === 1
      ? `${filtered.length} ${taskCountNoun(filtered.length)} no longer ${
          filtered.length === 1 ? 'matches' : 'match'
        } ${taskQuickFilterLabels[filtered[0].filter]}.`
      : `${filtered.length} ${taskCountNoun(filtered.length)} were hidden by the active quick filter.`);
  }

  return {
    title: departures.length === 1 ? 'Task Updated' : 'Tasks Updated',
    description: descriptions.join(' '),
  };
}

function taskPlanningRouteLabel(route: TaskPlanningRoute): string {
  if (route === 'today') return 'Today';
  if (route === 'upcoming') return 'Upcoming';
  if (route === 'anytime') return 'Anytime';
  if (route === 'someday') return 'Someday';
  return 'Done';
}

function taskListViewLabel(view: TaskListView): string {
  if (view === 'today') return 'Today';
  if (view === 'upcoming') return 'Upcoming';
  if (view === 'anytime') return 'Anytime';
  if (view === 'someday') return 'Someday';
  return 'Done';
}

function taskCountNoun(count: number): string {
  return count === 1 ? 'task' : 'tasks';
}
