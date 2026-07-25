import type { TaskActionability } from '@/modules/tasks/types/tasks';

const nextSingleTaskActionability: Record<TaskActionability, TaskActionability> = {
  actionable: 'waiting',
  waiting: 'rechecking',
  rechecking: 'actionable',
};

export function getNextTaskActionability(
  actionabilities: readonly TaskActionability[],
): TaskActionability | null {
  if (actionabilities.length === 0) return null;
  if (actionabilities.length === 1) {
    return nextSingleTaskActionability[actionabilities[0]];
  }
  if (actionabilities.every((actionability) => actionability === 'waiting')) {
    return 'rechecking';
  }
  if (actionabilities.every((actionability) => actionability === 'rechecking')) {
    return 'actionable';
  }
  return 'waiting';
}
