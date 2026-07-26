import type { TaskHierarchyRepository } from '@/modules/tasks/data/taskHierarchyRepository';
import type { TaskRepository } from '@/modules/tasks/data/taskRepository';

export async function activateTaskPlanningDate({
  ownerId,
  planningDate,
  planningTimeZone,
  repository,
  hierarchyRepository,
}: {
  ownerId: string;
  planningDate: string;
  planningTimeZone: string;
  repository: Pick<
    TaskRepository,
    'rolloverTodayTasks' | 'activateDueStartDates'
  >;
  hierarchyRepository: Pick<
    TaskHierarchyRepository,
    'activateDueProjectStartDates'
  >;
}): Promise<void> {
  await repository.rolloverTodayTasks(ownerId, planningDate, planningTimeZone);
  await repository.activateDueStartDates(ownerId, planningDate);
  await hierarchyRepository.activateDueProjectStartDates(ownerId, planningDate);
}
