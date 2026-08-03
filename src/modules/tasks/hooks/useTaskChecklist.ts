import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TaskChecklistItemPatch } from '@/modules/tasks/data/taskHierarchyRepository';
import type { TaskMutationContext } from '@/modules/tasks/data/taskRepository';
import {
  compareTaskOrder,
  generateTaskMoveOrderKey,
  generateTaskOrderKey,
} from '@/modules/tasks/domain/taskOrder';
import {
  planChecklistBatchInsertionOrderKeys,
  planChecklistGroupMove,
} from '@/modules/tasks/domain/taskChecklistOrder';
import type {
  TaskChecklistClipboardItem,
} from '@/modules/tasks/domain/taskChecklistClipboard';
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

  const createItem = useCallback(async (
    title: string,
    destinationIndex = items.length,
    context?: TaskMutationContext,
  ) => {
    const boundedIndex = Math.max(0, Math.min(destinationIndex, items.length));
    const orderKey = checklistInsertionOrderKey(items, boundedIndex);
    const occurredAt = context?.occurredAt ?? new Date().toISOString();
    const operationId = context?.operationId ?? globalThis.crypto.randomUUID();
    const item = await hierarchyRepository.createChecklistItem({
      ownerId,
      taskId,
      title,
      orderKey,
      operationId,
      occurredAt,
    });
    setOptimistic((current) => ({ ...current, [item.id]: item }));
    notifyTaskChecklistForwardMutation();
    return item;
  }, [hierarchyRepository, items, ownerId, taskId]);

  const createItemCopies = useCallback(async (
    copiedItems: readonly TaskChecklistClipboardItem[],
    destinationIndex = items.length,
    context?: TaskMutationContext,
  ) => {
    const normalizedItems = copiedItems
      .map((item) => ({ ...item, title: item.title.trim() }))
      .filter(({ title }) => Boolean(title));
    if (normalizedItems.length === 0) return [];

    const orderKeys = planChecklistBatchInsertionOrderKeys(
      items.map((item) => ({ id: item.id, orderKey: item.order_key })),
      destinationIndex,
      normalizedItems.length,
    );
    const created: TaskChecklistItem[] = [];
    const occurredAt = context?.occurredAt ?? new Date().toISOString();
    const operationId = context?.operationId ?? globalThis.crypto.randomUUID();
    const mutationContext = { ...context, occurredAt, operationId };
    for (const [index, copiedItem] of normalizedItems.entries()) {
      let item = await hierarchyRepository.createChecklistItem({
        ownerId,
        taskId,
        title: copiedItem.title,
        orderKey: orderKeys[index],
        operationId,
        occurredAt,
      });
      if (copiedItem.completed) {
        item = await hierarchyRepository.completeChecklistItem(
          ownerId,
          item.id,
          true,
          mutationContext,
        );
      }
      created.push(item);
      setOptimistic((current) => ({ ...current, [item.id]: item }));
    }
    notifyTaskChecklistForwardMutation();
    return created;
  }, [hierarchyRepository, items, ownerId, taskId]);

  const createItems = useCallback((
    titles: readonly string[],
    destinationIndex = items.length,
    context?: TaskMutationContext,
  ) => createItemCopies(
    titles.map((title) => ({ title, completed: false })),
    destinationIndex,
    context,
  ), [createItemCopies, items.length]);

  const updateItem = useCallback(async (
    itemId: string,
    patch: TaskChecklistItemPatch,
    context?: TaskMutationContext,
  ) => {
    const mutationContext = {
      ...context,
      operationId: context?.operationId ?? globalThis.crypto.randomUUID(),
    };
    const item = await hierarchyRepository.updateChecklistItem(
      ownerId,
      itemId,
      patch,
      mutationContext,
    );
    setOptimistic((current) => ({ ...current, [item.id]: item }));
    notifyTaskChecklistForwardMutation();
    return item;
  }, [hierarchyRepository, ownerId]);

  const setCompleted = useCallback(async (
    item: TaskChecklistItem,
    completed: boolean,
    context?: TaskMutationContext,
  ) => {
    const occurredAt = context?.occurredAt ?? new Date().toISOString();
    const operationId = context?.operationId ?? globalThis.crypto.randomUUID();
    const lastKey = items.filter(({ id }) => id !== item.id).at(-1)?.order_key ?? null;
    const patch: TaskChecklistItemPatch = completed
      ? {
          completed: true,
          completed_at: occurredAt,
          order_key: generateTaskOrderKey(lastKey, null),
        }
      : { completed: false, completed_at: null };
    const optimisticMutationId = `optimistic-checklist-completion-${globalThis.crypto.randomUUID()}`;
    const projected = {
      ...item,
      ...patch,
      last_operation_id: operationId,
      revision: item.revision + 1,
      client_mutation_id: optimisticMutationId,
      updated_at: occurredAt,
    };

    setOptimistic((current) => ({ ...current, [item.id]: projected }));

    try {
      const saved = await hierarchyRepository.updateChecklistItem(
        ownerId,
        item.id,
        patch,
        { ...context, occurredAt, operationId },
      );
      setOptimistic((current) => (
        current[item.id]?.client_mutation_id === optimisticMutationId
          ? { ...current, [item.id]: saved }
          : current
      ));
      notifyTaskChecklistForwardMutation();
      return saved;
    } catch (error) {
      setOptimistic((current) => {
        if (current[item.id]?.client_mutation_id !== optimisticMutationId) return current;
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      throw error;
    }
  }, [hierarchyRepository, items, ownerId]);

  const deleteItem = useCallback(async (itemId: string, context?: TaskMutationContext) => {
    const mutationContext = {
      ...context,
      operationId: context?.operationId ?? globalThis.crypto.randomUUID(),
    };
    await hierarchyOperationsRepository.request({
      ownerId,
      rootType: 'checklist_item',
      rootId: itemId,
      operation: 'delete',
      descendantPolicy: 'reject',
      context: mutationContext,
    });
    setOptimistic((current) => ({ ...current, [itemId]: null }));
    notifyTaskChecklistForwardMutation();
  }, [hierarchyOperationsRepository, ownerId]);

  const deleteItems = useCallback(async (
    itemIds: readonly string[],
    context?: TaskMutationContext,
  ) => {
    const requestedIds = new Set(itemIds);
    const targets = items.filter(({ id }) => requestedIds.has(id));
    if (targets.length === 0) return;

    setOptimistic((current) => {
      const next = { ...current };
      for (const item of targets) next[item.id] = null;
      return next;
    });

    const deletedIds = new Set<string>();
    const occurredAt = context?.occurredAt ?? new Date().toISOString();
    const operationId = context?.operationId ?? globalThis.crypto.randomUUID();
    const mutationContext = { ...context, occurredAt, operationId };
    try {
      for (const item of targets) {
        await hierarchyOperationsRepository.request({
          ownerId,
          rootType: 'checklist_item',
          rootId: item.id,
          operation: 'delete',
          descendantPolicy: 'reject',
          context: mutationContext,
        });
        deletedIds.add(item.id);
      }
    } catch (error) {
      setOptimistic((current) => {
        const next = { ...current };
        for (const item of targets) {
          next[item.id] = deletedIds.has(item.id) ? null : item;
        }
        return next;
      });
      throw error;
    }
    notifyTaskChecklistForwardMutation();
  }, [hierarchyOperationsRepository, items, ownerId]);

  const reorderItem = useCallback(async (
    itemId: string,
    destinationIndex: number,
    context?: TaskMutationContext,
  ) => {
    const orderKey = generateTaskMoveOrderKey(
      items.map((item) => ({ id: item.id, orderKey: item.order_key })),
      itemId,
      destinationIndex,
    );
    return updateItem(itemId, { order_key: orderKey }, context);
  }, [items, updateItem]);

  const reorderItems = useCallback(async (
    itemIds: readonly string[],
    destinationIndex: number,
    context?: TaskMutationContext,
  ) => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    const move = planChecklistGroupMove(
      items.map(({ id }) => id),
      itemIds,
      destinationIndex,
    );
    const movingItems = move.movingIds.flatMap((id) => {
      const item = itemById.get(id);
      return item ? [item] : [];
    });
    if (movingItems.length === 0) return [];

    const workingItems = move.remainingIds.flatMap((id) => {
      const item = itemById.get(id);
      return item ? [item] : [];
    });
    const projections = movingItems.map((item, offset) => {
      const insertionIndex = move.insertionIndex + offset;
      const projected = {
        ...item,
        order_key: checklistInsertionOrderKey(workingItems, insertionIndex),
        revision: item.revision + 1,
        client_mutation_id: `optimistic-checklist-reorder-${Date.now()}-${item.id}`,
      };
      workingItems.splice(insertionIndex, 0, projected);
      return projected;
    });

    if (move.orderedIds.every((id, index) => items[index]?.id === id)) {
      return movingItems;
    }

    setOptimistic((current) => ({
      ...current,
      ...Object.fromEntries(projections.map((item) => [item.id, item])),
    }));

    const savedItems: TaskChecklistItem[] = [];
    const occurredAt = context?.occurredAt ?? new Date().toISOString();
    const operationId = context?.operationId ?? globalThis.crypto.randomUUID();
    const mutationContext = { ...context, occurredAt, operationId };
    try {
      for (const projected of projections) {
        savedItems.push(await hierarchyRepository.updateChecklistItem(
          ownerId,
          projected.id,
          { order_key: projected.order_key },
          mutationContext,
        ));
      }
      setOptimistic((current) => ({
        ...current,
        ...Object.fromEntries(savedItems.map((item) => [item.id, item])),
      }));
      notifyTaskChecklistForwardMutation();
      return savedItems;
    } catch (error) {
      setOptimistic((current) => {
        const next = { ...current };
        for (const projection of projections) delete next[projection.id];
        for (const item of savedItems) next[item.id] = item;
        return next;
      });
      throw error;
    }
  }, [hierarchyRepository, items, ownerId]);

  return {
    items,
    loading: query.isLoading,
    createItem,
    createItems,
    createItemCopies,
    updateItem,
    setCompleted,
    deleteItem,
    deleteItems,
    reorderItem,
    reorderItems,
  };
}

function notifyTaskChecklistForwardMutation() {
  globalThis.dispatchEvent?.(new Event('bathos:task-checklist-forward-mutation'));
}

function compareChecklistRows(left: TaskChecklistItem, right: TaskChecklistItem): number {
  return compareTaskOrder(
    { id: left.id, orderKey: left.order_key },
    { id: right.id, orderKey: right.order_key },
  );
}

function checklistInsertionOrderKey(
  items: readonly TaskChecklistItem[],
  destinationIndex: number,
): string {
  const previousKey = items[destinationIndex - 1]?.order_key ?? null;
  const nextKey = items[destinationIndex]?.order_key ?? null;
  if (previousKey === null || nextKey === null || previousKey !== nextKey) {
    return generateTaskOrderKey(previousKey, nextKey);
  }

  let firstTiedIndex = destinationIndex - 1;
  while (firstTiedIndex > 0 && items[firstTiedIndex - 1].order_key === nextKey) {
    firstTiedIndex -= 1;
  }
  return generateTaskOrderKey(
    items[firstTiedIndex - 1]?.order_key ?? null,
    nextKey,
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
