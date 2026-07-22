import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  EditableTaskPatch,
  TaskPlanningMoveInput,
} from '@/modules/tasks/data/taskRepository';
import { compareTaskOrder, generateTaskMoveOrderKey } from '@/modules/tasks/domain/taskOrder';
import { taskCalendarDateInTimeZone } from '@/modules/tasks/domain/taskDates';
import type { TaskStateTransition } from '@/modules/tasks/domain/taskState';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskDestination, TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskListView = TaskDestination | 'today' | 'upcoming' | 'done';
export type TodayTaskSection = 'inbox' | 'now' | 'next' | 'later';

export function useTaskList(ownerId: string, view: TaskListView) {
  const { repository, planningTimeZone } = useTasksRuntime();
  const planningDate = useTaskPlanningDate(planningTimeZone);
  const [optimisticTasks, setOptimisticTasks] = useState<Record<string, TaskTodo | null>>({});
  const query = useQuery<TaskTodo>(
    view === 'done'
      ? `SELECT *
         FROM tasks_todos
         WHERE owner_id = ?
           AND ((disposition = 'deleted' AND deletion_root_id = id)
             OR (disposition = 'present' AND lifecycle IN ('completed', 'canceled')))
         ORDER BY COALESCE(deleted_at, completed_at, canceled_at) DESC, id`
      : view === 'upcoming'
          ? `SELECT *
             FROM tasks_todos
             WHERE owner_id = ?
               AND destination = 'anytime'
               AND start_date > ?
               AND lifecycle = 'open'
               AND disposition = 'present'
             ORDER BY start_date, order_key, id`
          : view === 'today'
            ? `SELECT *
         FROM tasks_todos
         WHERE owner_id = ?
           AND destination = 'anytime'
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND (
             (start_date IS NULL AND today_section <> 'none')
             OR start_date <= ?
           )
         ORDER BY order_key, id`
            : `SELECT *
         FROM tasks_todos
         WHERE owner_id = ?
           AND destination = ?
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND (? <> 'anytime' OR start_date IS NULL OR start_date <= ?)
         ORDER BY order_key, id`,
    view === 'done'
      ? [ownerId]
      : view === 'upcoming'
        ? [ownerId, planningDate]
        : view === 'today'
          ? [ownerId, planningDate]
          : [ownerId, view, view, planningDate],
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

  const tasks = useMemo(() => deriveTaskViewTasks(
    query.data,
    optimisticTasks,
    ownerId,
    view,
    planningDate,
  ), [optimisticTasks, ownerId, planningDate, query.data, view]);

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
      if (view === 'done' || view === 'upcoming') {
        const label = view === 'done' ? 'Done' : 'Upcoming';
        throw new Error(`Tasks cannot be created in ${label}`);
      }
      const createdTask = await repository.createTask({
        ownerId,
        title,
        destination: view === 'today' ? 'anytime' : view,
        todaySection: view === 'someday' ? 'none' : 'inbox',
        startDate: null,
      });
      setOptimisticTask(createdTask.id, createdTask);
      return createdTask;
    },
    [ownerId, repository, setOptimisticTask, view],
  );
  const updateTask = useCallback(
    async (taskId: string, patch: EditableTaskPatch) => {
      const currentTask = tasks.find((task) => task.id === taskId);
      if (currentTask) {
        const optimisticTask = {
          ...currentTask,
          ...patch,
          revision: currentTask.revision + 1,
          client_mutation_id: `optimistic:${currentTask.client_mutation_id}`,
          updated_at: new Date().toISOString(),
        };
        setOptimisticTask(
          taskId,
          taskIsVisible(optimisticTask, ownerId, view, planningDate) ? optimisticTask : null,
        );
      }

      try {
        const updatedTask = await repository.updateTask(ownerId, taskId, patch);
        setOptimisticTask(
          taskId,
          taskIsVisible(updatedTask, ownerId, view, planningDate) ? updatedTask : null,
        );
        return updatedTask;
      } catch (error) {
        setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [ownerId, planningDate, repository, setOptimisticTask, tasks, view],
  );
  const transitionTask = useCallback(
    async (taskId: string, transition: TaskStateTransition) => {
      const leavesCurrentView = transition === 'complete'
        || transition === 'cancel'
        || transition === 'delete'
        || (view === 'done' && (transition === 'reopen' || transition === 'restore'));
      if (leavesCurrentView) {
        setOptimisticTask(taskId, null);
      }

      try {
        const transitionedTask = await repository.transitionTask(ownerId, taskId, transition);
        setOptimisticTask(taskId, taskIsVisible(transitionedTask, ownerId, view, planningDate)
          ? transitionedTask
          : null);
        return transitionedTask;
      } catch (error) {
        setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [ownerId, planningDate, repository, setOptimisticTask, view],
  );
  const moveTask = useCallback(
    async (taskId: string, input: TaskPlanningMoveInput) => {
      const currentTask = tasks.find((task) => task.id === taskId);
      if (currentTask) {
        const optimisticTask = {
          ...currentTask,
          destination: input.destination,
          today_section: input.todaySection ?? 'none',
          start_date: input.startDate ?? null,
          revision: currentTask.revision + 1,
          client_mutation_id: `optimistic:${currentTask.client_mutation_id}`,
          updated_at: new Date().toISOString(),
        };
        setOptimisticTask(
          taskId,
          taskIsVisible(optimisticTask, ownerId, view, planningDate) ? optimisticTask : null,
        );
      }

      try {
        const movedTask = await repository.moveTask(ownerId, taskId, input);
        setOptimisticTask(
          taskId,
          taskIsVisible(movedTask, ownerId, view, planningDate) ? movedTask : null,
        );
        return movedTask;
      } catch (error) {
        setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [ownerId, planningDate, repository, setOptimisticTask, tasks, view],
  );
  const moveTasks = useCallback(
    async (taskIds: string[], input: TaskPlanningMoveInput) => {
      const movedTasks = await repository.moveTasks(ownerId, taskIds, input);
      for (const movedTask of movedTasks) {
        setOptimisticTask(
          movedTask.id,
          taskIsVisible(movedTask, ownerId, view, planningDate) ? movedTask : null,
        );
      }
      return movedTasks;
    },
    [ownerId, planningDate, repository, setOptimisticTask, view],
  );
  const reorderTask = useCallback(
    async (taskId: string, direction: 'up' | 'down') => {
      const currentTask = tasks.find((task) => task.id === taskId);
      if (!currentTask) {
        return undefined;
      }
      const sectionTasks = tasks.filter((task) => (
        taskOrderSection(task, view, planningDate) === taskOrderSection(currentTask, view, planningDate)
      ));
      const currentIndex = sectionTasks.findIndex((task) => task.id === taskId);
      const destinationIndex = currentIndex + (direction === 'up' ? -1 : 1);
      if (currentIndex < 0 || destinationIndex < 0 || destinationIndex >= sectionTasks.length) {
        return currentTask;
      }
      const orderKey = generateTaskMoveOrderKey(
        sectionTasks.map((task) => ({ id: task.id, orderKey: task.order_key })),
        taskId,
        destinationIndex,
      );
      return updateTask(taskId, { order_key: orderKey });
    },
    [planningDate, tasks, updateTask, view],
  );
  const reorderTaskTo = useCallback(
    async (taskId: string, targetTaskId: string, placement: 'before' | 'after') => {
      const currentTask = tasks.find((task) => task.id === taskId);
      const targetTask = tasks.find((task) => task.id === targetTaskId);
      if (!currentTask || !targetTask || currentTask.id === targetTask.id) {
        return currentTask;
      }
      if (
        taskOrderSection(currentTask, view, planningDate)
        !== taskOrderSection(targetTask, view, planningDate)
      ) {
        return currentTask;
      }
      const sectionTasks = tasks.filter((task) => (
        taskOrderSection(task, view, planningDate) === taskOrderSection(currentTask, view, planningDate)
      ));
      const remaining = sectionTasks.filter((task) => task.id !== taskId);
      const targetIndex = remaining.findIndex((task) => task.id === targetTaskId);
      if (targetIndex < 0) {
        return currentTask;
      }
      const destinationIndex = targetIndex + (placement === 'after' ? 1 : 0);
      const currentIndex = sectionTasks.findIndex((task) => task.id === taskId);
      if (currentIndex === destinationIndex) {
        return currentTask;
      }
      const orderKey = generateTaskMoveOrderKey(
        sectionTasks.map((task) => ({ id: task.id, orderKey: task.order_key })),
        taskId,
        destinationIndex,
      );
      return updateTask(taskId, { order_key: orderKey });
    },
    [planningDate, tasks, updateTask, view],
  );

  return {
    tasks,
    loading: query.isLoading,
    error: query.error,
    createTask,
    updateTask,
    moveTask,
    moveTasks,
    reorderTask,
    reorderTaskTo,
    transitionTask,
    planningDate,
  };
}

export function deriveTaskViewTasks(
  queriedTasks: readonly TaskTodo[],
  optimisticTasks: Readonly<Record<string, TaskTodo | null>>,
  ownerId: string,
  view: TaskListView,
  planningDate: string,
): TaskTodo[] {
  const merged = new Map(queriedTasks.map((task) => [task.id, task]));
  for (const [taskId, optimisticTask] of Object.entries(optimisticTasks)) {
    if (optimisticTask === null) {
      merged.delete(taskId);
    } else {
      merged.set(taskId, optimisticTask);
    }
  }

  return Array.from(merged.values())
    .filter((task) => taskIsVisible(task, ownerId, view, planningDate))
    .sort((left, right) => compareTasksForView(left, right, view, planningDate));
}

function taskIsVisible(
  task: TaskTodo,
  ownerId: string,
  view: TaskListView,
  planningDate: string,
): boolean {
  if (task.owner_id !== ownerId) {
    return false;
  }
  if (view === 'done') {
    return (task.disposition === 'deleted' && task.deletion_root_id === task.id)
      || (task.disposition === 'present' && task.lifecycle !== 'open');
  }
  if (view === 'upcoming') {
    return task.disposition === 'present'
      && task.lifecycle === 'open'
      && task.start_date !== null
      && task.start_date > planningDate;
  }
  if (view === 'today') {
    return task.destination === 'anytime'
      && task.lifecycle === 'open'
      && task.disposition === 'present'
      && (
        (task.start_date === null && task.today_section !== 'none')
        || (task.start_date !== null && task.start_date <= planningDate)
      );
  }
  return task.destination === view
    && task.lifecycle === 'open'
    && task.disposition === 'present'
    && (view !== 'anytime'
      || task.start_date === null
      || task.start_date <= planningDate);
}

function compareTasksForView(
  left: TaskTodo,
  right: TaskTodo,
  view: TaskListView,
  planningDate: string,
): number {
  if (view === 'done') {
    return (right.deleted_at ?? right.completed_at ?? right.canceled_at ?? '').localeCompare(
      left.deleted_at ?? left.completed_at ?? left.canceled_at ?? '',
    ) || left.id.localeCompare(right.id);
  }
  if (view === 'upcoming') {
    return (left.start_date ?? '').localeCompare(right.start_date ?? '')
      || compareTaskOrder(
        { id: left.id, orderKey: left.order_key },
        { id: right.id, orderKey: right.order_key },
      );
  }
  if (view === 'today') {
    return compareTodaySection(left, right, planningDate)
      || compareTaskOrder(
        { id: left.id, orderKey: left.order_key },
        { id: right.id, orderKey: right.order_key },
      );
  }
  return compareTaskOrder(
    { id: left.id, orderKey: left.order_key },
    { id: right.id, orderKey: right.order_key },
  );
}

export function getTodayTaskSection(task: TaskTodo, _planningDate: string): TodayTaskSection {
  return task.today_section === 'none' ? 'inbox' : task.today_section;
}

function compareTodaySection(left: TaskTodo, right: TaskTodo, planningDate: string): number {
  const ranks: Record<TodayTaskSection, number> = { inbox: 0, now: 1, next: 2, later: 3 };
  return ranks[getTodayTaskSection(left, planningDate)]
    - ranks[getTodayTaskSection(right, planningDate)];
}

function taskOrderSection(task: TaskTodo, view: TaskListView, planningDate: string): string {
  if (view === 'today') {
    return getTodayTaskSection(task, planningDate);
  }
  if (view === 'upcoming') {
    return `upcoming:${task.start_date ?? ''}`;
  }
  return view;
}

function useTaskPlanningDate(planningTimeZone: string): string {
  const [planningDate, setPlanningDate] = useState(() => (
    taskCalendarDateInTimeZone(planningTimeZone)
  ));

  useEffect(() => {
    setPlanningDate(taskCalendarDateInTimeZone(planningTimeZone));
    const timer = window.setInterval(() => {
      const current = taskCalendarDateInTimeZone(planningTimeZone);
      setPlanningDate((previous) => previous === current ? previous : current);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [planningTimeZone]);

  return planningDate;
}
