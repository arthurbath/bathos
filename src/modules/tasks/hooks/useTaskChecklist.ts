import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TaskChecklistItemPatch } from '@/modules/tasks/data/taskHierarchyRepository';
import {
  compareTaskOrder,
  generateTaskMoveOrderKey,
  generateTaskOrderKey,
} from '@/modules/tasks/domain/taskOrder';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskChecklistItem } from '@/modules/tasks/types/tasks';

export function useTaskChecklist(ownerId: string, taskId: string) {
  const { hierarchyOperationsRepository, hierarchyRepository } = useTasksRuntime();
  const query = useQuery<TaskChecklistItem>(
    `SELECT * FROM tasks_checklist_items
     WHERE owner_id = ? AND task_id = ? AND disposition = 'present'
     ORDER BY order_key, id`,
    [ownerId, taskId],
  );
  const [optimistic, setOptimistic] = useState<Record<string, TaskChecklistItem | null>>({});

  useEffect(() => {
    setOptimistic((current) => clearCaughtUpRows(current, query.data));
  }, [query.data]);

  const items = useMemo(() => {
    const rows = new Map(query.data.map((item) => [item.id, item]));
    for (const [id, item] of Object.entries(optimistic)) {
      if (item === null) rows.delete(id);
      else rows.set(id, item);
    }
    return Array.from(rows.values()).sort(compareChecklistRows);
  }, [optimistic, query.data]);

  const createItem = useCallback(async (title: string) => {
    const item = await hierarchyRepository.createChecklistItem({
      ownerId,
      taskId,
      title,
    });
    setOptimistic((current) => ({ ...current, [item.id]: item }));
    return item;
  }, [hierarchyRepository, ownerId, taskId]);

  const updateItem = useCallback(async (itemId: string, patch: TaskChecklistItemPatch) => {
    const item = await hierarchyRepository.updateChecklistItem(ownerId, itemId, patch);
    setOptimistic((current) => ({ ...current, [item.id]: item }));
    return item;
  }, [hierarchyRepository, ownerId]);

  const setCompleted = useCallback(async (item: TaskChecklistItem, completed: boolean) => {
    const lastKey = items.filter(({ id }) => id !== item.id).at(-1)?.order_key ?? null;
    const patch: TaskChecklistItemPatch = completed
      ? {
          completed: true,
          completed_at: new Date().toISOString(),
          order_key: generateTaskOrderKey(lastKey, null),
        }
      : { completed: false, completed_at: null };
    return updateItem(item.id, patch);
  }, [items, updateItem]);

  const deleteItem = useCallback(async (itemId: string) => {
    await hierarchyOperationsRepository.request({
      ownerId,
      rootType: 'checklist_item',
      rootId: itemId,
      operation: 'delete',
      descendantPolicy: 'reject',
    });
    setOptimistic((current) => ({ ...current, [itemId]: null }));
  }, [hierarchyOperationsRepository, ownerId]);

  const reorderItem = useCallback(async (itemId: string, destinationIndex: number) => {
    const orderKey = generateTaskMoveOrderKey(
      items.map((item) => ({ id: item.id, orderKey: item.order_key })),
      itemId,
      destinationIndex,
    );
    return updateItem(itemId, { order_key: orderKey });
  }, [items, updateItem]);

  return {
    items,
    loading: query.isLoading,
    createItem,
    updateItem,
    setCompleted,
    deleteItem,
    reorderItem,
  };
}

function compareChecklistRows(left: TaskChecklistItem, right: TaskChecklistItem): number {
  return compareTaskOrder(
    { id: left.id, orderKey: left.order_key },
    { id: right.id, orderKey: right.order_key },
  );
}

function clearCaughtUpRows(
  optimistic: Record<string, TaskChecklistItem | null>,
  queried: readonly TaskChecklistItem[],
): Record<string, TaskChecklistItem | null> {
  const next = { ...optimistic };
  let changed = false;
  for (const [id, item] of Object.entries(optimistic)) {
    const queriedItem = queried.find((candidate) => candidate.id === id);
    if (
      (item === null && queriedItem === undefined)
      || (
        item !== null
        && queriedItem?.client_mutation_id === item.client_mutation_id
      )
    ) {
      delete next[id];
      changed = true;
    }
  }
  return changed ? next : optimistic;
}
