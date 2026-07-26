import { compareTaskOrder } from '@/modules/tasks/domain/taskOrder';
import { compareTaskAutomaticOrder } from '@/modules/tasks/domain/taskAutomaticOrder';
import type { TaskArea, TaskProject, TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskAreaSection = {
  area: TaskArea | null;
  areaId: string | null;
  tasks: TaskTodo[];
};

export function getTaskEffectiveAreaId(
  task: Pick<TaskTodo, 'area_id' | 'project_id'>,
  projects: readonly Pick<TaskProject, 'id' | 'area_id'>[],
): string | null {
  if (task.area_id !== null) return task.area_id;
  if (task.project_id === null) return null;
  return projects.find((project) => project.id === task.project_id)?.area_id ?? null;
}

export function deriveTaskAreaSections(
  tasks: readonly TaskTodo[],
  areas: readonly TaskArea[],
  projects: readonly TaskProject[],
  automaticSort = false,
): TaskAreaSection[] {
  const orderedTasks = [...tasks].sort(automaticSort
    ? compareTaskAutomaticOrder
    : (left, right) => compareTaskOrder(
      { id: left.id, orderKey: left.order_key },
      { id: right.id, orderKey: right.order_key },
    ));
  const presentAreaIds = new Set(areas.map(({ id }) => id));
  const tasksByArea = new Map<string | null, TaskTodo[]>([[null, []]]);

  for (const task of orderedTasks) {
    const effectiveAreaId = getTaskEffectiveAreaId(task, projects);
    const areaId = effectiveAreaId !== null && presentAreaIds.has(effectiveAreaId)
      ? effectiveAreaId
      : null;
    const sectionTasks = tasksByArea.get(areaId) ?? [];
    sectionTasks.push(task);
    tasksByArea.set(areaId, sectionTasks);
  }

  const orderedAreas = [...areas].sort((left, right) => compareTaskOrder(
    { id: left.id, orderKey: left.order_key },
    { id: right.id, orderKey: right.order_key },
  ));
  return [
    {
      area: null,
      areaId: null,
      tasks: tasksByArea.get(null) ?? [],
    },
    ...orderedAreas.flatMap((area) => {
      const sectionTasks = tasksByArea.get(area.id) ?? [];
      return sectionTasks.length > 0
        ? [{ area, areaId: area.id, tasks: sectionTasks }]
        : [];
    }),
  ];
}
