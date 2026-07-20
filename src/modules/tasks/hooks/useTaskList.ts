import { useQuery } from '@powersync/react';
import { useCallback } from 'react';

import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import type { TaskStateTransition } from '@/modules/tasks/domain/taskState';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskDestination, TaskTodo } from '@/modules/tasks/types/tasks';

export function useTaskList(ownerId: string, destination: TaskDestination) {
  const { repository } = useTasksRuntime();
  const query = useQuery<TaskTodo>(
    `SELECT *
     FROM tasks_todos
     WHERE owner_id = ?
       AND destination = ?
       AND lifecycle = 'open'
       AND disposition = 'present'
     ORDER BY order_key, id`,
    [ownerId, destination],
  );

  const createTask = useCallback(
    (title: string) => repository.createTask({ ownerId, title, destination }),
    [destination, ownerId, repository],
  );
  const updateTask = useCallback(
    (taskId: string, patch: EditableTaskPatch) => repository.updateTask(ownerId, taskId, patch),
    [ownerId, repository],
  );
  const transitionTask = useCallback(
    (taskId: string, transition: TaskStateTransition) =>
      repository.transitionTask(ownerId, taskId, transition),
    [ownerId, repository],
  );

  return {
    tasks: query.data,
    loading: query.isLoading,
    error: query.error,
    createTask,
    updateTask,
    transitionTask,
  };
}
