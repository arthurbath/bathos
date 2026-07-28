import { useQuery } from '@powersync/react';
import { useEffect, useMemo } from 'react';

import type { TaskQuickFilter } from '@/modules/tasks/domain/taskQuickFilters';
import {
  buildTaskNativeWidgetSnapshot,
  publishTaskNativeWidgetSnapshot,
} from '@/modules/tasks/native/taskNativeWidgetBridge';
import type { TaskArea, TaskTodo } from '@/modules/tasks/types/tasks';

export function useTaskNativeWidgetBridge({
  ownerId,
  planningDate,
  areas,
  automaticListSorting,
  quickFilter,
}: {
  ownerId: string;
  planningDate: string;
  areas: readonly TaskArea[];
  automaticListSorting: boolean;
  quickFilter: TaskQuickFilter;
}): void {
  const query = useQuery<TaskTodo>(
    `SELECT *
     FROM tasks_todos
     WHERE owner_id = ?
       AND (
         (disposition = 'present' AND lifecycle IN ('open', 'completed', 'canceled'))
         OR (disposition = 'deleted' AND deletion_root_id = id)
       )
     ORDER BY id`,
    [ownerId],
  );
  const snapshot = useMemo(() => buildTaskNativeWidgetSnapshot({
    ownerId,
    planningDate,
    tasks: query.data,
    areas,
    automaticListSorting,
    quickFilter,
  }), [
    areas,
    automaticListSorting,
    ownerId,
    planningDate,
    query.data,
    quickFilter,
  ]);

  useEffect(() => {
    if (query.isLoading || query.error) return;
    publishTaskNativeWidgetSnapshot(snapshot);
  }, [query.error, query.isLoading, snapshot]);
}
