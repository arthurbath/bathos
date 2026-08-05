import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useState } from 'react';

import {
  sanitizeTaskDragHandleVisibility,
  type TaskDragHandleVisibility,
} from '@/modules/tasks/domain/taskDragHandles';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';

type DragHandleVisibilityRow = {
  drag_handle_visibility: string;
};

export function useTaskDragHandleVisibility(ownerId: string) {
  const { repository } = useTasksRuntime();
  const query = useQuery<DragHandleVisibilityRow>(
    `SELECT drag_handle_visibility
     FROM tasks_user_settings
     WHERE owner_id = ?
     LIMIT 1`,
    [ownerId],
  );
  const synchronizedVisibility = sanitizeTaskDragHandleVisibility(
    query.data[0]?.drag_handle_visibility,
  );
  const [optimisticVisibility, setOptimisticVisibility] = useState<
    TaskDragHandleVisibility | null
  >(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (optimisticVisibility === synchronizedVisibility) {
      setOptimisticVisibility(null);
    }
  }, [optimisticVisibility, synchronizedVisibility]);

  const setVisibility = useCallback(async (visibility: TaskDragHandleVisibility) => {
    setOptimisticVisibility(visibility);
    setPending(true);
    try {
      await repository.setDragHandleVisibility(ownerId, visibility);
    } catch (error) {
      setOptimisticVisibility(null);
      throw error;
    } finally {
      setPending(false);
    }
  }, [ownerId, repository]);

  return {
    visibility: optimisticVisibility ?? synchronizedVisibility,
    loading: query.isLoading,
    error: query.error,
    pending,
    setVisibility,
  };
}
