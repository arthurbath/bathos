import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import type { TaskChecklistItemPatch } from '@/modules/tasks/data/taskHierarchyRepository';
import {
  compareTaskOrder,
  generateTaskMoveOrderKey,
  generateTaskOrderKey,
} from '@/modules/tasks/domain/taskOrder';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskChecklistItem, TaskTodo } from '@/modules/tasks/types/tasks';

export function useTaskProjectDetail(ownerId: string, projectId: string) {
  const { repository, hierarchyRepository } = useTasksRuntime();
  const tasksQuery = useQuery<TaskTodo>(
    `SELECT * FROM tasks_todos
     WHERE owner_id = ?
       AND project_id = ?
       AND lifecycle = 'open'
       AND disposition = 'present'
     ORDER BY heading_id, hierarchy_order_key, id`,
    [ownerId, projectId],
  );
  const checklistQuery = useQuery<TaskChecklistItem>(
    `SELECT checklist.*
     FROM tasks_checklist_items checklist
     JOIN tasks_todos todo
       ON todo.id = checklist.task_id
      AND todo.owner_id = checklist.owner_id
     WHERE checklist.owner_id = ?
       AND todo.project_id = ?
       AND checklist.disposition = 'present'
     ORDER BY checklist.task_id, checklist.order_key, checklist.id`,
    [ownerId, projectId],
  );
  const [optimisticTasks, setOptimisticTasks] = useState<Record<string, TaskTodo | null>>({});
  const [optimisticChecklist, setOptimisticChecklist] = useState<
    Record<string, TaskChecklistItem | null>
  >({});

  useEffect(() => {
    setOptimisticTasks((current) => clearCaughtUpRows(current, tasksQuery.data));
  }, [tasksQuery.data]);
  useEffect(() => {
    setOptimisticChecklist((current) => clearCaughtUpRows(
      current,
      checklistQuery.data.map(normalizeChecklistItem),
    ));
  }, [checklistQuery.data]);

  const tasks = useMemo(
    () => mergeRows(tasksQuery.data, optimisticTasks).sort(compareProjectTasks),
    [optimisticTasks, tasksQuery.data],
  );
  const checklistItems = useMemo(
    () => mergeRows(
      checklistQuery.data.map(normalizeChecklistItem),
      optimisticChecklist,
    ).sort(compareChecklistItems),
    [checklistQuery.data, optimisticChecklist],
  );

  const createTask = useCallback(async (title: string, headingId: string | null) => {
    const orderKey = nextTaskOrderKey(tasks, headingId);
    const task = await repository.createTask({
      ownerId,
      title,
      destination: 'anytime',
      projectId,
      headingId,
      hierarchyOrderKey: orderKey,
    });
    setOptimisticTasks((current) => ({ ...current, [task.id]: task }));
    return task;
  }, [ownerId, projectId, repository, tasks]);

  const updateTask = useCallback(async (taskId: string, patch: EditableTaskPatch) => {
    const currentTask = tasks.find(({ id }) => id === taskId);
    if (currentTask) {
      setOptimisticTasks((current) => ({
        ...current,
        [taskId]: { ...currentTask, ...patch },
      }));
    }
    try {
      const task = await repository.updateTask(ownerId, taskId, patch);
      setOptimisticTasks((current) => ({ ...current, [taskId]: task }));
      return task;
    } catch (error) {
      setOptimisticTasks((current) => withoutKey(current, taskId));
      throw error;
    }
  }, [ownerId, repository, tasks]);

  const moveTaskToHeading = useCallback(async (taskId: string, headingId: string | null) => {
    const peers = tasks.filter((task) => task.id !== taskId && task.heading_id === headingId);
    const tail = peers.at(-1);
    const task = await repository.moveTaskToContainer(ownerId, taskId, {
      projectId,
      headingId,
      hierarchyOrderKey: generateTaskOrderKey(tail ? taskStructuralKey(tail) : null, null),
    });
    setOptimisticTasks((current) => ({ ...current, [taskId]: task }));
    return task;
  }, [ownerId, projectId, repository, tasks]);

  const reorderTask = useCallback(async (taskId: string, direction: 'up' | 'down') => {
    const task = tasks.find(({ id }) => id === taskId);
    if (!task) return undefined;
    const peers = tasks.filter(({ heading_id }) => heading_id === task.heading_id);
    const orderKey = moveOrderKey(
      peers.map((peer) => ({ id: peer.id, order_key: taskStructuralKey(peer) })),
      taskId,
      direction,
    );
    return orderKey === null ? task : updateTask(taskId, { hierarchy_order_key: orderKey });
  }, [tasks, updateTask]);

  const createChecklistItem = useCallback(async (taskId: string, title: string) => {
    const item = await hierarchyRepository.createChecklistItem({ ownerId, taskId, title });
    setOptimisticChecklist((current) => ({ ...current, [item.id]: item }));
    return item;
  }, [hierarchyRepository, ownerId]);

  const updateChecklistItem = useCallback(async (
    itemId: string,
    patch: TaskChecklistItemPatch,
  ) => {
    const item = await hierarchyRepository.updateChecklistItem(ownerId, itemId, patch);
    setOptimisticChecklist((current) => ({ ...current, [itemId]: item }));
    return item;
  }, [hierarchyRepository, ownerId]);

  const completeChecklistItem = useCallback(async (itemId: string, completed: boolean) => {
    const currentItem = checklistItems.find(({ id }) => id === itemId);
    if (currentItem) {
      setOptimisticChecklist((current) => ({
        ...current,
        [itemId]: {
          ...currentItem,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
      }));
    }
    try {
      const item = await hierarchyRepository.completeChecklistItem(
        ownerId,
        itemId,
        completed,
      );
      setOptimisticChecklist((current) => ({ ...current, [itemId]: item }));
      return item;
    } catch (error) {
      setOptimisticChecklist((current) => withoutKey(current, itemId));
      throw error;
    }
  }, [checklistItems, hierarchyRepository, ownerId]);

  const reorderChecklistItem = useCallback(async (
    itemId: string,
    direction: 'up' | 'down',
  ) => {
    const item = checklistItems.find(({ id }) => id === itemId);
    if (!item) return undefined;
    const peers = checklistItems.filter(({ task_id }) => task_id === item.task_id);
    const orderKey = moveOrderKey(peers, itemId, direction);
    return orderKey === null ? item : updateChecklistItem(itemId, { order_key: orderKey });
  }, [checklistItems, updateChecklistItem]);

  return {
    tasks,
    checklistItems,
    loading: tasksQuery.isLoading || checklistQuery.isLoading,
    error: tasksQuery.error ?? checklistQuery.error,
    createTask,
    updateTask,
    moveTaskToHeading,
    reorderTask,
    createChecklistItem,
    updateChecklistItem,
    completeChecklistItem,
    reorderChecklistItem,
  };
}

export type TaskProjectDetailModel = ReturnType<typeof useTaskProjectDetail>;

function taskStructuralKey(task: TaskTodo): string {
  return task.hierarchy_order_key ?? task.order_key;
}

function nextTaskOrderKey(tasks: TaskTodo[], headingId: string | null): string {
  const peers = tasks.filter((task) => task.heading_id === headingId);
  const tail = peers.at(-1);
  return generateTaskOrderKey(tail ? taskStructuralKey(tail) : null, null);
}

function compareProjectTasks(left: TaskTodo, right: TaskTodo): number {
  return compareTaskOrder(
    { id: left.id, orderKey: taskStructuralKey(left) },
    { id: right.id, orderKey: taskStructuralKey(right) },
  );
}

function compareChecklistItems(left: TaskChecklistItem, right: TaskChecklistItem): number {
  return compareTaskOrder(
    { id: left.id, orderKey: left.order_key },
    { id: right.id, orderKey: right.order_key },
  );
}

function normalizeChecklistItem(item: TaskChecklistItem): TaskChecklistItem {
  return { ...item, completed: Boolean(item.completed) };
}

function moveOrderKey<T extends { id: string; order_key: string }>(
  rows: T[],
  id: string,
  direction: 'up' | 'down',
): string | null {
  const index = rows.findIndex((row) => row.id === id);
  const destination = index + (direction === 'up' ? -1 : 1);
  if (index < 0 || destination < 0 || destination >= rows.length) return null;
  return generateTaskMoveOrderKey(
    rows.map((row) => ({ id: row.id, orderKey: row.order_key })),
    id,
    destination,
  );
}

function mergeRows<T extends { id: string }>(
  queried: readonly T[],
  optimistic: Record<string, T | null>,
): T[] {
  const rows = new Map(queried.map((row) => [row.id, row]));
  for (const [id, row] of Object.entries(optimistic)) {
    if (row === null) rows.delete(id);
    else rows.set(id, row);
  }
  return Array.from(rows.values());
}

function clearCaughtUpRows<T extends { id: string; client_mutation_id: string }>(
  optimistic: Record<string, T | null>,
  queried: readonly T[],
): Record<string, T | null> {
  let changed = false;
  const next = { ...optimistic };
  for (const [id, row] of Object.entries(optimistic)) {
    const queriedRow = queried.find((candidate) => candidate.id === id);
    if (
      (row === null && queriedRow === undefined)
      || (row !== null && queriedRow?.client_mutation_id === row.client_mutation_id)
    ) {
      delete next[id];
      changed = true;
    }
  }
  return changed ? next : optimistic;
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}
