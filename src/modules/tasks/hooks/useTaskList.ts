import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import type { TaskStateTransition } from '@/modules/tasks/domain/taskState';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskDestination, TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskListView = TaskDestination | 'trash';

export function useTaskList(ownerId: string, view: TaskListView) {
  const { repository } = useTasksRuntime();
  const [optimisticTasks, setOptimisticTasks] = useState<Record<string, TaskTodo | null>>({});
  const trash = view === 'trash';
  const query = useQuery<TaskTodo>(
    trash
      ? `SELECT *
         FROM tasks_todos
         WHERE owner_id = ?
           AND disposition = 'deleted'
         ORDER BY deleted_at DESC, id`
      : `SELECT *
         FROM tasks_todos
         WHERE owner_id = ?
           AND destination = ?
           AND lifecycle = 'open'
           AND disposition = 'present'
         ORDER BY order_key, id`,
    trash ? [ownerId] : [ownerId, view],
  );

  useEffect(() => {
    setOptimisticTasks((current) => {
      const next = { ...current };
      let changed = false;

      for (const [taskId, optimisticTask] of Object.entries(current)) {
        const queriedTask = query.data.find((task) => task.id === taskId);
        const queryCaughtUp = optimisticTask === null
          ? queriedTask === undefined
          : queriedTask?.client_mutation_id === optimisticTask.client_mutation_id;

        if (queryCaughtUp) {
          delete next[taskId];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [query.data]);

  const tasks = useMemo(() => {
    const merged = new Map(query.data.map((task) => [task.id, task]));
    for (const [taskId, optimisticTask] of Object.entries(optimisticTasks)) {
      if (optimisticTask === null) {
        merged.delete(taskId);
      } else {
        merged.set(taskId, optimisticTask);
      }
    }

    return Array.from(merged.values())
      .filter((task) => (
        taskIsVisible(task, ownerId, view)
      ))
      .sort((left, right) => compareTasksForView(left, right, view));
  }, [optimisticTasks, ownerId, query.data, view]);

  const setOptimisticTask = useCallback((taskId: string, task: TaskTodo | null | undefined) => {
    setOptimisticTasks((current) => {
      if (task === undefined) {
        const next = { ...current };
        delete next[taskId];
        return next;
      }
      return { ...current, [taskId]: task };
    });
  }, []);

  const createTask = useCallback(
    async (title: string) => {
      if (view === 'trash') {
        throw new Error('Tasks cannot be created in Trash');
      }
      const createdTask = await repository.createTask({ ownerId, title, destination: view });
      setOptimisticTask(createdTask.id, createdTask);
      return createdTask;
    },
    [ownerId, repository, setOptimisticTask, view],
  );
  const updateTask = useCallback(
    async (taskId: string, patch: EditableTaskPatch) => {
      const currentTask = tasks.find((task) => task.id === taskId);
      if (currentTask) {
        setOptimisticTask(taskId, {
          ...currentTask,
          ...patch,
          revision: currentTask.revision + 1,
          client_mutation_id: `optimistic:${currentTask.client_mutation_id}`,
          updated_at: new Date().toISOString(),
        });
      }

      try {
        const updatedTask = await repository.updateTask(ownerId, taskId, patch);
        setOptimisticTask(taskId, updatedTask);
        return updatedTask;
      } catch (error) {
        setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [ownerId, repository, setOptimisticTask, tasks],
  );
  const transitionTask = useCallback(
    async (taskId: string, transition: TaskStateTransition) => {
      const leavesCurrentView = transition === 'complete'
        || transition === 'cancel'
        || transition === 'delete'
        || (view === 'trash' && transition === 'restore');
      if (leavesCurrentView) {
        setOptimisticTask(taskId, null);
      }

      try {
        const transitionedTask = await repository.transitionTask(ownerId, taskId, transition);
        setOptimisticTask(taskId, taskIsVisible(transitionedTask, ownerId, view)
          ? transitionedTask
          : null);
        return transitionedTask;
      } catch (error) {
        setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [ownerId, repository, setOptimisticTask, view],
  );

  return {
    tasks,
    loading: query.isLoading,
    error: query.error,
    createTask,
    updateTask,
    transitionTask,
  };
}

function taskIsVisible(task: TaskTodo, ownerId: string, view: TaskListView): boolean {
  if (task.owner_id !== ownerId) {
    return false;
  }
  if (view === 'trash') {
    return task.disposition === 'deleted';
  }
  return task.destination === view && task.lifecycle === 'open' && task.disposition === 'present';
}

function compareTasksForView(left: TaskTodo, right: TaskTodo, view: TaskListView): number {
  if (view === 'trash') {
    return (right.deleted_at ?? '').localeCompare(left.deleted_at ?? '')
      || left.id.localeCompare(right.id);
  }
  return left.order_key.localeCompare(right.order_key) || left.id.localeCompare(right.id);
}
