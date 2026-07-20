import type { TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskPlanningRoute = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook';

export function getTaskPlanningRoute(
  task: Pick<TaskTodo, 'destination' | 'lifecycle' | 'start_date'>,
  planningDate: string,
): TaskPlanningRoute {
  if (task.lifecycle !== 'open') return 'logbook';
  if (
    task.start_date
    && task.start_date > planningDate
    && (task.destination === 'today' || task.destination === 'anytime')
  ) return 'upcoming';
  return task.destination;
}
