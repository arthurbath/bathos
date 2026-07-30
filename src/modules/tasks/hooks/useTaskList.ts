import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  CreateTaskInput,
  EditableTaskPatch,
  TaskBulkPatchInput,
  TaskMutationContext,
  TaskPlanningMoveInput,
} from '@/modules/tasks/data/taskRepository';
import {
  compareTaskOrder,
  generateTaskDropOrderKey,
  generateTaskMoveOrderKey,
  generateTaskOrderKey,
} from '@/modules/tasks/domain/taskOrder';
import { taskCalendarDateInTimeZone } from '@/modules/tasks/domain/taskDates';
import {
  getTaskUpcomingDate,
  getTaskUpcomingGroup,
} from '@/modules/tasks/domain/taskUpcoming';
import type { TaskStateTransition } from '@/modules/tasks/domain/taskState';
import type {
  TaskForwardMutationReservation,
  TaskForwardMutationSource,
} from '@/modules/tasks/hooks/useTaskUndo';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskDestination, TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskListView = TaskDestination | 'today' | 'upcoming' | 'done';
export type TodayTaskSection = 'inbox' | 'now' | 'next' | 'later';
export type TaskMetadataMutation = {
  before: TaskTodo;
  after: TaskTodo;
};
type TaskListQueryRow = TaskTodo & {
  has_checklist_items?: number;
};
export type RetainedTaskViewPlacement = Pick<
  TaskTodo,
  | 'destination'
  | 'today_section'
  | 'start_date'
  | 'deadline'
  | 'actionability'
  | 'order_key'
  | 'area_id'
>;
export type TaskListCreateInput = Omit<
  CreateTaskInput,
  'ownerId' | 'orderKey' | 'todaySection'
> & {
  todaySection?: TodayTaskSection | null;
  atTop?: boolean;
};

const TASK_LIST_SELECT = `SELECT todo.*,
         EXISTS (
           SELECT 1
           FROM tasks_checklist_items AS checklist
           WHERE checklist.owner_id = todo.owner_id
             AND checklist.task_id = todo.id
             AND checklist.disposition = 'present'
         ) AS has_checklist_items
         FROM tasks_todos AS todo`;

export function useTaskList(
  ownerId: string,
  view: TaskListView,
  retainedTaskId: string | null = null,
  onForwardMutation?: (task: TaskTodo) => void,
  reserveForwardMutation?: (
    source: TaskForwardMutationSource,
  ) => TaskForwardMutationReservation,
  onMetadataMutation?: (
    mutations: readonly TaskMetadataMutation[],
  ) => void,
) {
  const { repository, planningTimeZone } = useTasksRuntime();
  const planningDate = useTaskPlanningDate(planningTimeZone);
  const [optimisticTasks, setOptimisticTasks] = useState<Record<string, TaskTodo | null>>({});
  const query = useQuery<TaskListQueryRow>(
    view === 'done'
      ? `${TASK_LIST_SELECT}
         WHERE owner_id = ?
           AND recurrence_superseded_at IS NULL
           AND ((disposition = 'deleted' AND deletion_root_id = id)
             OR (disposition = 'present' AND lifecycle IN ('completed', 'canceled')))
         ORDER BY COALESCE(deleted_at, completed_at, canceled_at) DESC, id`
      : view === 'upcoming'
          ? `${TASK_LIST_SELECT}
             WHERE owner_id = ?
               AND recurrence_superseded_at IS NULL
               AND destination = 'anytime'
               AND lifecycle = 'open'
               AND disposition = 'present'
               AND (
                 start_date > ?
                 OR ((start_date IS NULL OR start_date <= ?) AND deadline > ?)
               )
             ORDER BY COALESCE(
               CASE WHEN start_date > ? THEN start_date END,
               deadline
             ), order_key, id`
          : view === 'today'
            ? `${TASK_LIST_SELECT}
         WHERE owner_id = ?
           AND recurrence_superseded_at IS NULL
           AND destination = 'anytime'
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND today_section IS NOT NULL
           AND (start_date IS NULL OR start_date <= ?)
         ORDER BY order_key, id`
            : `${TASK_LIST_SELECT}
         WHERE owner_id = ?
           AND recurrence_superseded_at IS NULL
           AND destination = ?
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND (? <> 'anytime' OR start_date IS NULL OR start_date <= ?)
         ORDER BY order_key, id`,
    view === 'done'
      ? [ownerId]
      : view === 'upcoming'
        ? [ownerId, planningDate, planningDate, planningDate, planningDate]
        : view === 'today'
          ? [ownerId, planningDate]
        : [ownerId, view, view, planningDate],
  );
  const checklistTaskIds = useMemo(() => new Set(
    query.data
      .filter(({ has_checklist_items }) => Boolean(has_checklist_items))
      .map(({ id }) => id),
  ), [query.data]);

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

  const allTasks = useMemo(() => mergeTaskRecords(
    query.data,
    optimisticTasks,
  ), [optimisticTasks, query.data]);
  const retainedProjectionRef = useRef<{
    id: string;
    view: TaskListView;
    task: TaskTodo;
  } | null>(null);
  if (retainedTaskId === null) {
    retainedProjectionRef.current = null;
  } else if (
    retainedProjectionRef.current?.id !== retainedTaskId
    || retainedProjectionRef.current.view !== view
  ) {
    const retainedTask = allTasks.find((task) => task.id === retainedTaskId) ?? null;
    if (retainedTask !== null) {
      retainedProjectionRef.current = {
        id: retainedTask.id,
        view,
        task: retainedTask,
      };
    } else {
      retainedProjectionRef.current = null;
    }
  }
  const retainedProjection = retainedProjectionRef.current;
  const tasks = useMemo(() => deriveTaskViewTasks(
    allTasks,
    ownerId,
    view,
    planningDate,
    retainedTaskId,
    retainedProjection?.task ?? null,
  ), [allTasks, ownerId, planningDate, retainedProjection, retainedTaskId, view]);

  const previousRetainedTaskIdRef = useRef<string | null>(retainedTaskId);
  useEffect(() => {
    const previousTaskId = previousRetainedTaskIdRef.current;
    previousRetainedTaskIdRef.current = retainedTaskId;
    if (previousTaskId === null || previousTaskId === retainedTaskId) return;
    setOptimisticTasks((current) => {
      const optimisticTask = current[previousTaskId];
      if (optimisticTask === undefined || optimisticTask === null) return current;
      if (taskIsVisible(optimisticTask, ownerId, view, planningDate)) return current;
      return { ...current, [previousTaskId]: null };
    });
  }, [ownerId, planningDate, retainedTaskId, view]);

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
    async (input: string | TaskListCreateInput) => {
      if (typeof input === 'string' && (view === 'done' || view === 'upcoming')) {
        const label = view === 'done' ? 'Done' : 'Upcoming';
        throw new Error(`Tasks cannot be created in ${label}`);
      }
      const defaults: TaskListCreateInput = {
        title: typeof input === 'string' ? input : input.title,
        destination: view === 'someday' ? 'someday' : 'anytime',
        todaySection: view === 'someday' || view === 'upcoming' ? null : 'next',
        startDate: null,
      };
      const requested = typeof input === 'string' ? defaults : { ...defaults, ...input };
      const firstScopedTask = requested.atTop
        ? allTasks
          .filter((task) => task.destination === requested.destination
            && task.lifecycle === 'open'
            && task.disposition === 'present')
          .sort((left, right) => compareTaskOrder(
            { id: left.id, orderKey: left.order_key },
            { id: right.id, orderKey: right.order_key },
          ))[0]
        : null;
      const { atTop, ...createInput } = requested;
      const createdTask = await repository.createTask({
        ...createInput,
        ownerId,
        ...(atTop ? {
          orderKey: generateTaskOrderKey(null, firstScopedTask?.order_key ?? null),
        } : {}),
      });
      setOptimisticTask(createdTask.id, createdTask);
      onForwardMutation?.(createdTask);
      return createdTask;
    },
    [allTasks, onForwardMutation, ownerId, repository, setOptimisticTask, view],
  );
  const updateTask = useCallback(
    async (taskId: string, patch: EditableTaskPatch) => {
      const currentTask = allTasks.find((task) => task.id === taskId);
      const reservation = currentTask
        ? reserveForwardMutation?.(currentTask)
        : undefined;
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
          retainedTaskId === taskId || taskIsVisible(optimisticTask, ownerId, view, planningDate)
            ? optimisticTask
            : null,
        );
      }

      try {
        const updatedTask = await repository.updateTask(ownerId, taskId, patch);
        reservation?.commit(updatedTask);
        onForwardMutation?.(updatedTask);
        if (currentTask) {
          onMetadataMutation?.([{ before: currentTask, after: updatedTask }]);
        }
        setOptimisticTask(
          taskId,
          retainedTaskId === taskId || taskIsVisible(updatedTask, ownerId, view, planningDate)
            ? updatedTask
            : null,
        );
        return updatedTask;
      } catch (error) {
        reservation?.cancel();
        setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [
      allTasks,
      onForwardMutation,
      onMetadataMutation,
      ownerId,
      planningDate,
      repository,
      reserveForwardMutation,
      retainedTaskId,
      setOptimisticTask,
      view,
    ],
  );
  const transitionTask = useCallback(
    async (
      taskId: string,
      transition: TaskStateTransition,
      reservedMutation?: TaskForwardMutationReservation,
      context?: TaskMutationContext,
    ) => {
      const currentTask = allTasks.find((task) => task.id === taskId);
      const reservation = reservedMutation ?? (
        currentTask ? reserveForwardMutation?.(currentTask) : undefined
      );
      const leavesCurrentView = transition === 'complete'
        || transition === 'cancel'
        || transition === 'delete'
        || (view === 'done' && (transition === 'reopen' || transition === 'restore'));
      if (leavesCurrentView && retainedTaskId !== taskId) {
        setOptimisticTask(taskId, null);
      }

      try {
        const transitionedTask = await repository.transitionTask(
          ownerId,
          taskId,
          transition,
          context,
        );
        reservation?.commit(transitionedTask);
        onForwardMutation?.(transitionedTask);
        setOptimisticTask(
          taskId,
          retainedTaskId === taskId
            || taskIsVisible(transitionedTask, ownerId, view, planningDate)
            ? transitionedTask
            : null,
        );
        return transitionedTask;
      } catch (error) {
        reservation?.cancel();
        setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [
      allTasks,
      onForwardMutation,
      ownerId,
      planningDate,
      repository,
      reserveForwardMutation,
      retainedTaskId,
      setOptimisticTask,
      view,
    ],
  );
  const duplicateTask = useCallback(
    async (taskId: string) => {
      const source = allTasks.find((task) => task.id === taskId);
      if (!source || source.lifecycle !== 'open' || source.disposition !== 'present') {
        throw new Error('Only an open task can be duplicated');
      }
      const duplicated = await repository.createTask({
        ownerId,
        title: source.title,
        notes: source.notes,
        destination: source.destination,
        todaySection: source.today_section,
        startDate: source.start_date,
        deadline: source.deadline,
        primaryLink: source.primary_link,
        actionability: source.actionability,
        areaId: source.area_id,
      });
      setOptimisticTask(duplicated.id, taskIsVisible(
        duplicated,
        ownerId,
        view,
        planningDate,
      ) ? duplicated : null);
      return duplicated;
    },
    [allTasks, ownerId, planningDate, repository, setOptimisticTask, view],
  );
  const moveTask = useCallback(
    async (taskId: string, input: TaskPlanningMoveInput) => {
      const currentTask = allTasks.find((task) => task.id === taskId);
      const reservation = currentTask
        ? reserveForwardMutation?.(currentTask)
        : undefined;
      if (currentTask) {
        const optimisticTask = {
          ...currentTask,
          destination: input.destination,
          today_section: input.destination === 'someday'
            ? null
            : input.startDate
              ? null
              : input.todaySection ?? null,
          start_date: input.startDate ?? null,
          revision: currentTask.revision + 1,
          client_mutation_id: `optimistic:${currentTask.client_mutation_id}`,
          updated_at: new Date().toISOString(),
        };
        setOptimisticTask(
          taskId,
          retainedTaskId === taskId || taskIsVisible(optimisticTask, ownerId, view, planningDate)
            ? optimisticTask
            : null,
        );
      }

      try {
        const movedTask = await repository.moveTask(ownerId, taskId, input);
        reservation?.commit(movedTask);
        onForwardMutation?.(movedTask);
        if (currentTask) {
          onMetadataMutation?.([{ before: currentTask, after: movedTask }]);
        }
        setOptimisticTask(
          taskId,
          retainedTaskId === taskId || taskIsVisible(movedTask, ownerId, view, planningDate)
            ? movedTask
            : null,
        );
        return movedTask;
      } catch (error) {
        reservation?.cancel();
        setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [
      allTasks,
      onForwardMutation,
      onMetadataMutation,
      ownerId,
      planningDate,
      repository,
      reserveForwardMutation,
      retainedTaskId,
      setOptimisticTask,
      view,
    ],
  );
  const moveTasks = useCallback(
    async (taskIds: string[], input: TaskPlanningMoveInput) => {
      const taskIdSet = new Set(taskIds);
      const currentTasks = allTasks.filter((task) => taskIdSet.has(task.id));
      const reservations = new Map(currentTasks.map((task) => [
        task.id,
        reserveForwardMutation?.(task),
      ]));
      for (const currentTask of currentTasks) {
        const optimisticTask = {
          ...currentTask,
          destination: input.destination,
          today_section: input.destination === 'someday'
            ? null
            : input.startDate
              ? null
              : input.todaySection ?? null,
          start_date: input.startDate ?? null,
          revision: currentTask.revision + 1,
          client_mutation_id: `optimistic:${currentTask.client_mutation_id}`,
          updated_at: new Date().toISOString(),
        };
        setOptimisticTask(
          currentTask.id,
          retainedTaskId === currentTask.id
            || taskIsVisible(optimisticTask, ownerId, view, planningDate)
            ? optimisticTask
            : null,
        );
      }
      try {
        const movedTasks = await repository.moveTasks(ownerId, taskIds, input);
        const movedTaskIds = new Set(movedTasks.map(({ id }) => id));
        for (const movedTask of movedTasks) {
          reservations.get(movedTask.id)?.commit(movedTask);
          onForwardMutation?.(movedTask);
          setOptimisticTask(
            movedTask.id,
            retainedTaskId === movedTask.id
              || taskIsVisible(movedTask, ownerId, view, planningDate)
              ? movedTask
            : null,
          );
        }
        for (const [taskId, reservation] of reservations) {
          if (!movedTaskIds.has(taskId)) reservation?.cancel();
        }
        const currentTaskById = new Map(currentTasks.map((task) => [task.id, task]));
        const mutations = movedTasks.flatMap((after) => {
          const before = currentTaskById.get(after.id);
          return before ? [{ before, after }] : [];
        });
        if (mutations.length > 0) onMetadataMutation?.(mutations);
        return movedTasks;
      } catch (error) {
        for (const reservation of reservations.values()) reservation?.cancel();
        for (const taskId of taskIds) setOptimisticTask(taskId, undefined);
        throw error;
      }
    },
    [
      allTasks,
      onForwardMutation,
      onMetadataMutation,
      ownerId,
      planningDate,
      repository,
      reserveForwardMutation,
      retainedTaskId,
      setOptimisticTask,
      view,
    ],
  );
  const applyTaskPatches = useCallback(async (inputs: readonly TaskBulkPatchInput[]) => {
    const inputById = new Map(inputs.map((input) => [input.taskId, input]));
    const currentTasks = allTasks.filter((task) => inputById.has(task.id));
    const reservations = new Map(currentTasks.map((task) => [
      task.id,
      reserveForwardMutation?.(task),
    ]));
    for (const currentTask of currentTasks) {
      const optimisticTask = {
        ...currentTask,
        ...inputById.get(currentTask.id)!.patch,
        revision: currentTask.revision + 1,
        client_mutation_id: `optimistic:${currentTask.client_mutation_id}`,
        updated_at: new Date().toISOString(),
      };
      setOptimisticTask(currentTask.id, optimisticTask);
    }
    try {
      const updatedTasks = await repository.applyTaskPatches(ownerId, inputs);
      for (const updatedTask of updatedTasks) {
        reservations.get(updatedTask.id)?.commit(updatedTask);
        onForwardMutation?.(updatedTask);
        setOptimisticTask(
          updatedTask.id,
          taskIsVisible(updatedTask, ownerId, view, planningDate) ? updatedTask : null,
        );
      }
      const currentTaskById = new Map(currentTasks.map((task) => [task.id, task]));
      const mutations = updatedTasks.flatMap((after) => {
        const before = currentTaskById.get(after.id);
        return before ? [{ before, after }] : [];
      });
      if (mutations.length > 0) onMetadataMutation?.(mutations);
      return updatedTasks;
    } catch (error) {
      for (const reservation of reservations.values()) reservation?.cancel();
      for (const { taskId } of inputs) setOptimisticTask(taskId, undefined);
      throw error;
    }
  }, [
    allTasks,
    onForwardMutation,
    onMetadataMutation,
    ownerId,
    planningDate,
    repository,
    reserveForwardMutation,
    setOptimisticTask,
    view,
  ]);
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
    async (
      taskId: string,
      targetTaskId: string,
      placement: 'before' | 'after',
      dropPatch?: Pick<
        EditableTaskPatch,
        | 'area_id'
        | 'destination'
        | 'start_date'
        | 'today_section'
      >,
    ) => {
      const currentTask = tasks.find((task) => task.id === taskId);
      const targetTask = tasks.find((task) => task.id === targetTaskId);
      if (!currentTask || !targetTask || currentTask.id === targetTask.id) {
        return currentTask;
      }
      const currentSection = taskOrderSection(currentTask, view, planningDate);
      const targetSection = taskOrderSection(targetTask, view, planningDate);
      const isCrossHorizonTodayDrop = view === 'today' && currentSection !== targetSection;
      const isCrossUpcomingDrop = view === 'upcoming'
        && currentSection !== targetSection
        && dropPatch?.start_date !== undefined
        && dropPatch.start_date !== null;
      if (
        currentSection !== targetSection
        && !isCrossHorizonTodayDrop
        && !isCrossUpcomingDrop
      ) {
        return currentTask;
      }
      const targetSectionTasks = tasks.filter((task) => (
        task.id !== currentTask.id
        && taskOrderSection(task, view, planningDate) === targetSection
      ));
      if (!targetSectionTasks.some((task) => task.id === targetTaskId)) {
        return currentTask;
      }
      const orderKey = generateTaskDropOrderKey(
        targetSectionTasks.map((task) => ({ id: task.id, orderKey: task.order_key })),
        targetTaskId,
        placement,
      );
      const patch: EditableTaskPatch = {
        ...dropPatch,
        order_key: orderKey,
      };
      if (isCrossHorizonTodayDrop) {
        patch.today_section = getTodayTaskSection(targetTask, planningDate);
      }
      return updateTask(taskId, patch);
    },
    [planningDate, tasks, updateTask, view],
  );

  return {
    tasks,
    checklistTaskIds,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    createTask,
    updateTask,
    moveTask,
    moveTasks,
    applyTaskPatches,
    reorderTask,
    reorderTaskTo,
    transitionTask,
    duplicateTask,
    planningDate,
    retainedTaskPlacement: retainedProjection?.task ?? null,
  };
}

export function deriveTaskViewTasks(
  mergedTasks: readonly TaskTodo[],
  ownerId: string,
  view: TaskListView,
  planningDate: string,
  retainedTaskId: string | null = null,
  retainedProjection: TaskTodo | null = null,
): TaskTodo[] {
  return mergedTasks
    .filter((task) => task.id === retainedTaskId
      || taskIsVisible(task, ownerId, view, planningDate))
    .sort((left, right) => compareTasksForView(
      taskWithRetainedViewPlacement(left, retainedTaskId, retainedProjection),
      taskWithRetainedViewPlacement(right, retainedTaskId, retainedProjection),
      view,
      planningDate,
    ));
}

function mergeTaskRecords(
  queriedTasks: readonly TaskTodo[],
  optimisticTasks: Readonly<Record<string, TaskTodo | null>>,
): TaskTodo[] {
  const merged = new Map(queriedTasks.map((task) => [task.id, task]));
  for (const [taskId, optimisticTask] of Object.entries(optimisticTasks)) {
    if (optimisticTask === null) merged.delete(taskId);
    else merged.set(taskId, optimisticTask);
  }
  return Array.from(merged.values());
}

export function taskWithRetainedViewPlacement(
  task: TaskTodo,
  retainedTaskId: string | null,
  retainedPlacement: RetainedTaskViewPlacement | null,
): TaskTodo {
  if (task.id !== retainedTaskId || retainedPlacement === null) return task;
  return {
    ...task,
    destination: retainedPlacement.destination,
    today_section: retainedPlacement.today_section,
    start_date: retainedPlacement.start_date,
    deadline: retainedPlacement.deadline,
    actionability: retainedPlacement.actionability,
    order_key: retainedPlacement.order_key,
    area_id: retainedPlacement.area_id,
  };
}

export function taskIsVisible(
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
      && task.destination === 'anytime'
      && getTaskUpcomingDate(task, planningDate) !== null;
  }
  if (view === 'today') {
    return task.destination === 'anytime'
      && task.lifecycle === 'open'
      && task.disposition === 'present'
      && task.today_section !== null
      && (task.start_date === null || task.start_date <= planningDate);
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
    const leftDate = getTaskUpcomingDate(left, planningDate);
    const rightDate = getTaskUpcomingDate(right, planningDate);
    const leftSectionDate = leftDate === null
      ? ''
      : getTaskUpcomingGroup(leftDate, planningDate).date;
    const rightSectionDate = rightDate === null
      ? ''
      : getTaskUpcomingGroup(rightDate, planningDate).date;
    return leftSectionDate.localeCompare(rightSectionDate)
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
  return task.today_section ?? 'next';
}

export function getTaskTodayMembershipSection(
  task: TaskTodo,
  planningDate: string,
): TodayTaskSection | null {
  const belongsToToday = task.destination === 'anytime'
    && task.lifecycle === 'open'
    && task.disposition === 'present'
    && task.today_section !== null
    && (task.start_date === null || task.start_date <= planningDate);
  return belongsToToday ? getTodayTaskSection(task, planningDate) : null;
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
    const upcomingDate = getTaskUpcomingDate(task, planningDate);
    return upcomingDate === null
      ? 'upcoming:'
      : `upcoming:${getTaskUpcomingGroup(upcomingDate, planningDate).key}`;
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
