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
