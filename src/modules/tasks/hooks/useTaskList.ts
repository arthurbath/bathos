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

export type TaskListView = TaskDestination | 'upcoming' | 'logbook' | 'trash';
export type TodayTaskSection = 'unfinished' | 'daytime' | 'evening';

export function useTaskList(ownerId: string, view: TaskListView) {
  const { repository, planningTimeZone } = useTasksRuntime();
  const planningDate = useTaskPlanningDate(planningTimeZone);
  const [optimisticTasks, setOptimisticTasks] = useState<Record<string, TaskTodo | null>>({});
  const historical = view === 'logbook';
  const trash = view === 'trash';
  const query = useQuery<TaskTodo>(
    trash
      ? `SELECT *
         FROM tasks_todos
         WHERE owner_id = ?
           AND disposition = 'deleted'
         ORDER BY deleted_at DESC, id`
      : historical
        ? `SELECT *
         FROM tasks_todos
         WHERE owner_id = ?
           AND lifecycle IN ('completed', 'canceled')
           AND disposition = 'present'
         ORDER BY COALESCE(completed_at, canceled_at) DESC, id`
        : view === 'upcoming'
          ? `SELECT *
             FROM tasks_todos
             WHERE owner_id = ?
               AND start_date > ?
               AND lifecycle = 'open'
               AND disposition = 'present'
             ORDER BY start_date, order_key, id`
          : `SELECT *
         FROM tasks_todos
         WHERE owner_id = ?
           AND destination = ?
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND (? <> 'today' OR start_date IS NULL OR start_date <= ?)
         ORDER BY order_key, id`,
    trash || historical
      ? [ownerId]
      : view === 'upcoming'
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
        taskIsVisible(task, ownerId, view, planningDate)
      ))
      .sort((left, right) => compareTasksForView(left, right, view, planningDate));
  }, [optimisticTasks, ownerId, planningDate, query.data, view]);

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
      if (view === 'trash' || view === 'logbook' || view === 'upcoming') {
        const label = view === 'trash' ? 'Trash' : view === 'logbook' ? 'Logbook' : 'Upcoming';
        throw new Error(`Tasks cannot be created in ${label}`);
      }
      const createdTask = await repository.createTask({
        ownerId,
        title,
        destination: view,
        startDate: view === 'today' ? planningDate : null,
      });
      setOptimisticTask(createdTask.id, createdTask);
      return createdTask;
    },
    [ownerId, planningDate, repository, setOptimisticTask, view],
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
        || (view === 'logbook' && transition === 'reopen')
        || (view === 'trash' && transition === 'restore');
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
          today_section: input.todaySection ?? 'daytime',
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

  return {
    tasks,
    loading: query.isLoading,
    error: query.error,
    createTask,
    updateTask,
    moveTask,
    reorderTask,
    transitionTask,
    planningDate,
  };
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
  if (view === 'trash') {
    return task.disposition === 'deleted';
  }
  if (view === 'logbook') {
    return task.disposition === 'present' && task.lifecycle !== 'open';
  }
  if (view === 'upcoming') {
    return task.disposition === 'present'
      && task.lifecycle === 'open'
      && task.start_date !== null
      && task.start_date > planningDate;
  }
  return task.destination === view
    && task.lifecycle === 'open'
    && task.disposition === 'present'
    && (view !== 'today' || task.start_date === null || task.start_date <= planningDate);
}

function compareTasksForView(
  left: TaskTodo,
  right: TaskTodo,
  view: TaskListView,
  planningDate: string,
): number {
  if (view === 'trash') {
    return (right.deleted_at ?? '').localeCompare(left.deleted_at ?? '')
      || left.id.localeCompare(right.id);
  }
  if (view === 'logbook') {
    return (right.completed_at ?? right.canceled_at ?? '').localeCompare(
      left.completed_at ?? left.canceled_at ?? '',
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

export function getTodayTaskSection(task: TaskTodo, planningDate: string): TodayTaskSection {
  if (task.start_date !== null && task.start_date < planningDate) {
    return 'unfinished';
  }
  return task.today_section;
}

function compareTodaySection(left: TaskTodo, right: TaskTodo, planningDate: string): number {
  const ranks: Record<TodayTaskSection, number> = { unfinished: 0, daytime: 1, evening: 2 };
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
