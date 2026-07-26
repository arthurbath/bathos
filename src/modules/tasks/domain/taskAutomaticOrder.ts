import { compareTaskOrder, generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import type {
  TaskActionability,
  TaskTodaySection,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

const horizonRanks: Record<TaskTodaySection, number> = {
  inbox: 0,
  now: 1,
  next: 2,
  later: 3,
};

const actionabilityRanks: Record<TaskActionability, number> = {
  actionable: 0,
  rechecking: 1,
  waiting: 2,
};

export type TaskAutomaticOrderTuple = {
  deadline: string | null;
  horizon: TaskTodaySection | null;
  actionability: TaskActionability;
};

export type TaskAutomaticDropTarget = {
  targetTaskId: string;
  placement: 'before' | 'after';
};

export function getTaskAutomaticOrderTuple(
  task: Pick<TaskTodo, 'deadline' | 'today_section' | 'actionability'>,
): TaskAutomaticOrderTuple {
  return {
    deadline: task.deadline,
    horizon: task.today_section,
    actionability: task.actionability,
  };
}

export function taskAutomaticOrderTuplesEqual(
  left: Pick<TaskTodo, 'deadline' | 'today_section' | 'actionability'>,
  right: Pick<TaskTodo, 'deadline' | 'today_section' | 'actionability'>,
): boolean {
  const leftTuple = getTaskAutomaticOrderTuple(left);
  const rightTuple = getTaskAutomaticOrderTuple(right);
  return leftTuple.deadline === rightTuple.deadline
    && leftTuple.horizon === rightTuple.horizon
    && leftTuple.actionability === rightTuple.actionability;
}

export function compareTaskAutomaticTuple(
  left: Pick<TaskTodo, 'deadline' | 'today_section' | 'actionability'>,
  right: Pick<TaskTodo, 'deadline' | 'today_section' | 'actionability'>,
): number {
  const deadlineComparison = compareNullableCalendarDates(left.deadline, right.deadline);
  if (deadlineComparison !== 0) return deadlineComparison;

  const horizonComparison = getHorizonRank(left.today_section)
    - getHorizonRank(right.today_section);
  if (horizonComparison !== 0) return horizonComparison;

  return actionabilityRanks[left.actionability] - actionabilityRanks[right.actionability];
}

export function compareTaskAutomaticOrder(left: TaskTodo, right: TaskTodo): number {
  return compareTaskAutomaticTuple(left, right)
    || compareTaskOrder(
      { id: left.id, orderKey: left.order_key },
      { id: right.id, orderKey: right.order_key },
    );
}

export function assignMaterializedTaskOrderKeys(
  taskGroups: readonly (readonly TaskTodo[])[],
): Map<string, string> {
  const result = new Map<string, string>();
  let previousKey: string | null = null;
  for (const tasks of taskGroups) {
    for (const task of tasks) {
      const nextKey = generateTaskOrderKey(previousKey, null);
      result.set(task.id, nextKey);
      previousKey = nextKey;
    }
  }
  return result;
}

export function getAutomaticTaskDropTarget(
  draggedTask: TaskTodo,
  hoveredTask: TaskTodo,
  targetAreaTasks: readonly TaskTodo[],
  pointerPlacement: 'before' | 'after',
  crossArea: boolean,
): TaskAutomaticDropTarget | null {
  if (taskAutomaticOrderTuplesEqual(draggedTask, hoveredTask)) {
    return {
      targetTaskId: hoveredTask.id,
      placement: pointerPlacement,
    };
  }
  if (!crossArea) return null;

  const orderedTargets = targetAreaTasks
    .filter(({ id }) => id !== draggedTask.id)
    .sort(compareTaskAutomaticOrder);
  const firstLaterTask = orderedTargets.find(
    (candidate) => compareTaskAutomaticTuple(draggedTask, candidate) < 0,
  );
  if (firstLaterTask) {
    return {
      targetTaskId: firstLaterTask.id,
      placement: 'before',
    };
  }
  const lastTask = orderedTargets.at(-1);
  return lastTask
    ? { targetTaskId: lastTask.id, placement: 'after' }
    : null;
}

function compareNullableCalendarDates(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function getHorizonRank(horizon: TaskTodaySection | null): number {
  return horizon === null ? 4 : horizonRanks[horizon];
}
