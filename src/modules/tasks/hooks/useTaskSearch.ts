import { useQuery } from '@powersync/react';

import type { TaskTodo } from '@/modules/tasks/types/tasks';

export function useTaskSearch(ownerId: string, active = true) {
  const query = useQuery<TaskTodo>(
    `SELECT *
     FROM tasks_todos
     WHERE owner_id = ?
       AND ? = 1
       AND (
         disposition = 'present'
         OR (disposition = 'deleted' AND deletion_root_id = id)
       )
     ORDER BY updated_at DESC, id`,
    [ownerId, active ? 1 : 0],
  );

  return {
    tasks: query.data,
    loading: query.isLoading,
    error: query.error,
  };
}
