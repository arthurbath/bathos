import type { TaskRepository } from '@/modules/tasks/data/taskRepository';

export const TASKS_ACTIVE_QUEUE_POLL_MS = 1_000;
export const TASKS_IDLE_QUEUE_POLL_MS = 15_000;

export function taskQueuePollDelay(pendingUploadCount: number): number {
  return pendingUploadCount > 0
    ? TASKS_ACTIVE_QUEUE_POLL_MS
    : TASKS_IDLE_QUEUE_POLL_MS;
}

export function shouldActivateTaskPlanningDate(
  previousPlanningDate: string | null,
  currentPlanningDate: string,
): boolean {
  return previousPlanningDate !== currentPlanningDate;
}

export async function activateTaskPlanningDate({
  ownerId,
  planningDate,
  planningTimeZone,
  repository,
}: {
  ownerId: string;
  planningDate: string;
  planningTimeZone: string;
  repository: Pick<
    TaskRepository,
    'rolloverTodayTasks' | 'activateDueStartDates'
  >;
}): Promise<void> {
  await repository.rolloverTodayTasks(ownerId, planningDate, planningTimeZone);
  await repository.activateDueStartDates(ownerId, planningDate);
}
