import type { TaskTodo } from '@/modules/tasks/types/tasks';

export function taskHasReminderEligibleStart(
  task: Pick<TaskTodo, 'destination' | 'start_date' | 'today_section'>,
  planningDate: string,
): boolean {
  if (task.destination !== 'anytime') return false;
  if (task.today_section !== null) return true;
  return task.start_date !== null && task.start_date > planningDate;
}
