import { useQuery } from '@powersync/react';
import { useCallback } from 'react';

import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskHierarchyRootType } from '@/modules/tasks/types/tasks';

export type DeletedTaskHierarchyRoot = {
  id: string;
  title: string;
  deleted_at: string;
  root_type: Exclude<TaskHierarchyRootType, 'todo'>;
};

export function useTaskDeletedHierarchyRoots(ownerId: string) {
  const { hierarchyOperationsRepository } = useTasksRuntime();
  const query = useQuery<DeletedTaskHierarchyRoot>(
    `SELECT id, title, deleted_at, 'area' AS root_type FROM tasks_areas
     WHERE owner_id = ? AND disposition = 'deleted' AND deletion_root_id = id
     UNION ALL
     SELECT id, title, deleted_at, 'project' AS root_type FROM tasks_projects
     WHERE owner_id = ? AND disposition = 'deleted' AND deletion_root_id = id
     UNION ALL
     SELECT id, title, deleted_at, 'heading' AS root_type FROM tasks_headings
     WHERE owner_id = ? AND disposition = 'deleted' AND deletion_root_id = id
     UNION ALL
     SELECT id, title, deleted_at, 'checklist_item' AS root_type FROM tasks_checklist_items
     WHERE owner_id = ? AND disposition = 'deleted' AND deletion_root_id = id
     ORDER BY deleted_at DESC, id`,
    [ownerId, ownerId, ownerId, ownerId],
  );

  const restore = useCallback((root: DeletedTaskHierarchyRoot) => (
    hierarchyOperationsRepository.request({
      ownerId,
      rootType: root.root_type,
      rootId: root.id,
      operation: 'restore',
      descendantPolicy: 'cascade',
    })
  ), [hierarchyOperationsRepository, ownerId]);

  return {
    roots: query.data,
    loading: query.isLoading,
    error: query.error,
    restore,
  };
}
