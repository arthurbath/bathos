import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TaskAreaPatch } from '@/modules/tasks/data/taskHierarchyRepository';
import {
  compareTaskOrder,
  generateTaskMoveOrderKey,
} from '@/modules/tasks/domain/taskOrder';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskArea } from '@/modules/tasks/types/tasks';

export function useTaskHierarchy(ownerId: string) {
  const { hierarchyOperationsRepository, hierarchyRepository } = useTasksRuntime();
  const areasQuery = useQuery<TaskArea>(
    `SELECT * FROM tasks_areas
     WHERE owner_id = ? AND disposition = 'present'
     ORDER BY order_key, id`,
    [ownerId],
  );
  const [optimisticAreas, setOptimisticAreas] = useState<Record<string, TaskArea | null>>({});

  useEffect(() => {
    setOptimisticAreas((current) => clearCaughtUpRows(current, areasQuery.data));
  }, [areasQuery.data]);

  const areas = useMemo(
    () => mergeRows(areasQuery.data, optimisticAreas).sort(compareHierarchyRows),
    [areasQuery.data, optimisticAreas],
  );

  const createArea = useCallback(async (title: string) => {
    const area = await hierarchyRepository.createArea({ ownerId, title });
    setOptimisticAreas((current) => ({ ...current, [area.id]: area }));
    return area;
  }, [hierarchyRepository, ownerId]);

  const updateArea = useCallback(async (areaId: string, patch: TaskAreaPatch) => {
    const area = await hierarchyRepository.updateArea(ownerId, areaId, patch);
    setOptimisticAreas((current) => ({
      ...current,
      [areaId]: area.disposition === 'present' ? area : null,
    }));
    return area;
  }, [hierarchyRepository, ownerId]);

  const reorderArea = useCallback(async (areaId: string, direction: 'up' | 'down') => {
    const orderKey = moveOrderKey(areas, areaId, direction);
    return orderKey === null ? undefined : updateArea(areaId, { order_key: orderKey });
  }, [areas, updateArea]);

  const deleteHierarchy = useCallback(async (
    rootType: 'area',
    rootId: string,
  ) => {
    const result = await hierarchyOperationsRepository.request({
      ownerId,
      rootType,
      rootId,
      operation: 'delete',
      descendantPolicy: 'cascade',
    });
    setOptimisticAreas((current) => ({ ...current, [rootId]: null }));
    return result;
  }, [hierarchyOperationsRepository, ownerId]);

  return {
    areas,
    loading: areasQuery.isLoading,
    error: areasQuery.error,
    createArea,
    updateArea,
    reorderArea,
    deleteHierarchy,
  };
}

export type TaskHierarchyModel = ReturnType<typeof useTaskHierarchy>;

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
  const next = { ...optimistic };
  let changed = false;
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

function compareHierarchyRows(
  left: { order_key: string; id: string },
  right: { order_key: string; id: string },
): number {
  return compareTaskOrder(
    { id: left.id, orderKey: left.order_key },
    { id: right.id, orderKey: right.order_key },
  );
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
