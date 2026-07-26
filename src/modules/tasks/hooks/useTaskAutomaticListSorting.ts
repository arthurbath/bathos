import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useState } from 'react';

import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';

type AutomaticListSortingRow = {
  automatic_list_sorting: boolean | number;
};

export function useTaskAutomaticListSorting(ownerId: string) {
  const { repository } = useTasksRuntime();
  const query = useQuery<AutomaticListSortingRow>(
    `SELECT automatic_list_sorting
     FROM tasks_user_settings
     WHERE owner_id = ?
     LIMIT 1`,
    [ownerId],
  );
  const synchronizedEnabled = Boolean(query.data[0]?.automatic_list_sorting);
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (optimisticEnabled === synchronizedEnabled) {
      setOptimisticEnabled(null);
    }
  }, [optimisticEnabled, synchronizedEnabled]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) setOptimisticEnabled(true);
    setPending(true);
    try {
      await repository.setAutomaticListSorting(ownerId, enabled);
      setOptimisticEnabled(enabled);
    } catch (error) {
      setOptimisticEnabled(null);
      throw error;
    } finally {
      setPending(false);
    }
  }, [ownerId, repository]);

  return {
    enabled: optimisticEnabled ?? synchronizedEnabled,
    loading: query.isLoading,
    error: query.error,
    pending,
    setEnabled,
  };
}
