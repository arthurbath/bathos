import type { TaskRepository } from '@/modules/tasks/data/taskRepository';

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
