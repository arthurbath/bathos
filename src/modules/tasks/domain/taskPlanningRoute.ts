import type { TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskPlanningRoute = 'today' | 'upcoming' | 'anytime' | 'someday' | 'done';

export function getTaskPlanningRoute(
  task: Pick<TaskTodo, 'destination' | 'lifecycle' | 'disposition' | 'start_date' | 'today_section'>,
  planningDate: string,
): TaskPlanningRoute {
  if (task.lifecycle !== 'open' || task.disposition === 'deleted') return 'done';
  if (
    task.start_date
    && task.start_date > planningDate
    && task.destination === 'anytime'
  ) return 'upcoming';
  if (task.destination === 'anytime'
    && task.today_section !== null
    && (task.start_date === null || task.start_date <= planningDate)) return 'today';
  return task.destination;
}
