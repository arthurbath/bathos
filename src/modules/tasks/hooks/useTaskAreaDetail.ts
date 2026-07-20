import { useQuery } from '@powersync/react';

import type { TaskTodo } from '@/modules/tasks/types/tasks';

export function useTaskAreaDetail(ownerId: string, areaId: string) {
  const query = useQuery<TaskTodo>(
    `SELECT * FROM tasks_todos
     WHERE owner_id = ?
       AND area_id = ?
       AND project_id IS NULL
       AND disposition = 'present'
       AND lifecycle = 'open'
     ORDER BY hierarchy_order_key, id`,
    [ownerId, areaId],
  );

  return {
    tasks: query.data,
    loading: query.isLoading,
    error: query.error,
  };
}

export type TaskAreaDetailModel = ReturnType<typeof useTaskAreaDetail>;
