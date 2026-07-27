import {
  compareTaskAutomaticOrder,
  compareTaskAutomaticTuple,
  taskAutomaticOrderTuplesEqual,
} from '@/modules/tasks/domain/taskAutomaticOrder';
import { assignMaterializedTaskOrderKeys } from '@/modules/tasks/domain/taskAutomaticOrder';
import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskBulkDropProjection = {
  orderedTaskIds: string[];
  patches: Array<{ taskId: string; patch: EditableTaskPatch }>;
};

export function projectTaskBulkDrop({
  tasks,
  selectedTaskIds,
  targetTaskId,
  placement,
  patchesByTaskId = new Map(),
  automaticSort = false,
}: {
  tasks: readonly TaskTodo[];
  selectedTaskIds: ReadonlySet<string>;
  targetTaskId: string;
  placement: 'before' | 'after';
  patchesByTaskId?: ReadonlyMap<string, EditableTaskPatch>;
  automaticSort?: boolean;
}): TaskBulkDropProjection | null {
  const selected = tasks
    .filter((task) => selectedTaskIds.has(task.id))
    .map((task) => ({ ...task, ...(patchesByTaskId.get(task.id) ?? {}) }));
  const remaining = tasks.filter((task) => !selectedTaskIds.has(task.id));
  if (selected.length === 0) return null;

  const targetIndex = remaining.findIndex(({ id }) => id === targetTaskId);
  if (targetIndex < 0) return null;
  const desiredIndex = targetIndex + (placement === 'after' ? 1 : 0);
  const ordered = automaticSort
    ? insertAutomaticSubgroups(remaining, selected, targetTaskId, placement)
    : [
      ...remaining.slice(0, desiredIndex),
      ...selected,
      ...remaining.slice(desiredIndex),
    ];
  const orderKeys = assignMaterializedTaskOrderKeys([ordered]);
  return {
    orderedTaskIds: ordered.map(({ id }) => id),
    patches: ordered.flatMap((task) => {
      const metadataPatch = patchesByTaskId.get(task.id) ?? {};
      const orderKey = orderKeys.get(task.id);
      if (!orderKey) return [];
      return [{
        taskId: task.id,
        patch: { ...metadataPatch, order_key: orderKey },
      }];
    }),
  };
}

function insertAutomaticSubgroups(
  remaining: readonly TaskTodo[],
  selected: readonly TaskTodo[],
  targetTaskId: string,
  placement: 'before' | 'after',
): TaskTodo[] {
  const groups: TaskTodo[][] = [];
  for (const task of selected) {
    const group = groups.find(([candidate]) => (
      taskAutomaticOrderTuplesEqual(candidate, task)
    ));
    if (group) group.push(task);
    else groups.push([task]);
  }

  let ordered = [...remaining].sort(compareTaskAutomaticOrder);
  for (const group of groups.sort(([left], [right]) => compareTaskAutomaticTuple(left, right))) {
    const targetIndex = ordered.findIndex(({ id }) => id === targetTaskId);
    const desiredIndex = targetIndex < 0
      ? ordered.length
      : targetIndex + (placement === 'after' ? 1 : 0);
    const peers = ordered
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => taskAutomaticOrderTuplesEqual(task, group[0]));
    let insertionIndex: number;
    if (peers.length > 0) {
      const first = peers[0].index;
      const afterLast = peers.at(-1)!.index + 1;
      insertionIndex = Math.max(first, Math.min(desiredIndex, afterLast));
    } else {
      const firstLater = ordered.findIndex(
        (task) => compareTaskAutomaticTuple(group[0], task) < 0,
      );
      insertionIndex = firstLater < 0 ? ordered.length : firstLater;
    }
    ordered = [
      ...ordered.slice(0, insertionIndex),
      ...group,
      ...ordered.slice(insertionIndex),
    ];
  }
  return ordered;
}
