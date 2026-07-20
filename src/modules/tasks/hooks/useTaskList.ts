import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import type { TaskStateTransition } from '@/modules/tasks/domain/taskState';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskDestination, TaskTodo } from '@/modules/tasks/types/tasks';

export function useTaskList(ownerId: string, destination: TaskDestination) {
  const { repository } = useTasksRuntime();
  const [optimisticTasks, setOptimisticTasks] = useState<Record<string, TaskTodo | null>>({});
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
        task.owner_id === ownerId
        && task.destination === destination
        && task.lifecycle === 'open'
        && task.disposition === 'present'
      ))
      .sort((left, right) => (
        left.order_key.localeCompare(right.order_key) || left.id.localeCompare(right.id)
      ));
  }, [destination, optimisticTasks, ownerId, query.data]);

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
      const createdTask = await repository.createTask({ ownerId, title, destination });
      setOptimisticTask(createdTask.id, createdTask);
      return createdTask;
    },
    [destination, ownerId, repository, setOptimisticTask],
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
      const leavesOpenList = transition === 'complete' || transition === 'cancel' || transition === 'delete';
      if (leavesOpenList) {
        setOptimisticTask(taskId, null);
      }

      try {
        const transitionedTask = await repository.transitionTask(ownerId, taskId, transition);
        setOptimisticTask(taskId, taskIsVisible(transitionedTask, ownerId, destination)
          ? transitionedTask
          : null);
        return transitionedTask;
      } catch (error) {
        setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [destination, ownerId, repository, setOptimisticTask],
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

function taskIsVisible(task: TaskTodo, ownerId: string, destination: TaskDestination): boolean {
  return task.owner_id === ownerId
    && task.destination === destination
    && task.lifecycle === 'open'
    && task.disposition === 'present';
}
