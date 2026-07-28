import type { TaskTodaySection, TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskShortcutHorizon = Exclude<TaskTodaySection, 'inbox'>;

const nextHorizon: Record<TaskShortcutHorizon, TaskShortcutHorizon> = {
  now: 'next',
  next: 'later',
  later: 'now',
};

export function cycleTaskShortcutHorizon(
  horizon: TaskTodaySection | null,
): TaskShortcutHorizon {
  if (horizon === 'now' || horizon === 'next' || horizon === 'later') {
    return nextHorizon[horizon];
  }
  return 'now';
}

export function getTaskTodayShortcutHorizon(
  task: Pick<TaskTodo, 'destination' | 'start_date' | 'today_section'>,
  planningDate: string,
): TaskShortcutHorizon {
  const isToday = task.destination === 'anytime'
    && task.today_section !== null
    && (task.start_date === null || task.start_date <= planningDate);
  return isToday ? cycleTaskShortcutHorizon(task.today_section) : 'now';
}

function getCurrentTaskShortcutHorizon(
  task: Pick<TaskTodo, 'destination' | 'start_date' | 'today_section'>,
  planningDate: string,
): TaskShortcutHorizon | null {
  const isCycleHorizon = task.today_section === 'now'
    || task.today_section === 'next'
    || task.today_section === 'later';
  const isToday = task.destination === 'anytime'
    && isCycleHorizon
    && (task.start_date === null || task.start_date <= planningDate);
  if (!isToday) return null;
  return task.today_section as TaskShortcutHorizon;
}

export function getBulkTaskTodayShortcutHorizon(
  tasks: ReadonlyArray<Pick<TaskTodo, 'destination' | 'start_date' | 'today_section'>>,
  planningDate: string,
): TaskShortcutHorizon {
  const first = tasks[0] === undefined
    ? null
    : getCurrentTaskShortcutHorizon(tasks[0], planningDate);
  if (
    first === null
    || tasks.some((task) => getCurrentTaskShortcutHorizon(task, planningDate) !== first)
  ) return 'now';
  return cycleTaskShortcutHorizon(first);
}
