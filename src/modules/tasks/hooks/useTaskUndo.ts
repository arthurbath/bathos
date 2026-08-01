import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createTaskRedoPatch,
  createTaskUndoPatch,
  deletedCreationSnapshotMatches,
  parseTaskHistoryEvent,
  TaskHistoryReconstructionError,
  UnsafeTaskRedoError,
  UnsafeTaskUndoError,
  type TaskHistoryEvent,
  type TaskHistorySnapshot,
  type TaskHistoryStorageRow,
} from '@/modules/tasks/domain/taskHistory';
import { reportTaskHistoryReconstructionFailure } from '@/modules/tasks/runtime/taskHistoryReporting';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

export const TASK_HISTORY_LIMIT = 100;
const TASK_HISTORY_REPLAY_LIMIT = 500;
export const TASK_HISTORY_PROJECTION_WAIT_MS = 5_000;
const TASK_HISTORY_PROJECTION_POLL_MS = 25;

const taskHistoryQuery = `
  SELECT event.*
  FROM tasks_history_events AS event
  WHERE event.owner_id = ?
    AND event.outcome = 'accepted'
  ORDER BY event.occurred_at DESC, event.id DESC
  LIMIT ${TASK_HISTORY_REPLAY_LIMIT}
`;

export type TaskHistoryCursor = {
  undo: TaskHistoryEvent[];
  redo: TaskHistoryEvent[];
};

export type TaskForwardMutationSource = Pick<TaskTodo, 'id' | 'client_mutation_id'>;

export type TaskForwardMutationReservation = {
  commit: (task: TaskTodo) => void;
  cancel: () => void;
};

type PendingForwardMutation = {
  token: number;
  taskId: string;
  previousMutationId: string;
  mutationId: string | null;
  status: 'pending' | 'accepted' | 'canceled';
};

type ForwardMutationProjection = Pick<
  PendingForwardMutation,
  'token' | 'taskId' | 'mutationId' | 'status'
>;

const emptyCursor = (): TaskHistoryCursor => ({ undo: [], redo: [] });

export function useTaskUndo(ownerId: string) {
  const { repository } = useTasksRuntime();
  const query = useQuery<TaskHistoryStorageRow>(taskHistoryQuery, [ownerId]);
  const pendingRef = useRef(false);
  const cursorRef = useRef<TaskHistoryCursor>(emptyCursor());
  const projectedCursorRef = useRef<TaskHistoryCursor>(emptyCursor());
  const projectedCursorKeyRef = useRef('');
  const projectedEventsRef = useRef<TaskHistoryEvent[]>([]);
  const taskProjectionRef = useRef<TaskTodo[]>([]);
  const pendingForwardMutationsRef = useRef<PendingForwardMutation[]>([]);
  const forwardMutationSequenceRef = useRef(0);
  const historyRequestPendingRef = useRef(false);
  const reportedHistoryErrorRef = useRef<string | null>(null);
  const [cursor, setCursor] = useState<TaskHistoryCursor>(emptyCursor);
  const [pending, setPending] = useState(false);
  const [projectionWaitPending, setProjectionWaitPending] = useState(false);
  const [pendingForwardMutations, setPendingForwardMutations] = useState<
    ForwardMutationProjection[]
  >([]);
  const parsed = useMemo(() => parseHistoryEvents(query.data), [query.data]);
  projectedEventsRef.current = parsed.events;
  const projectionKey = `${ownerId}:${parsed.events.map(({ id }) => id).join(',')}`;
  if (projectedCursorKeyRef.current !== projectionKey) {
    projectedCursorKeyRef.current = projectionKey;
    projectedCursorRef.current = replayTaskHistory(parsed.events);
  }
  const undoEvent = cursor.undo.at(-1) ?? null;
  const redoEvent = cursor.redo.at(-1) ?? null;
  const tipTaskIds = [...new Set(
    [
      ...historyOperationEvents(undoEvent).map(({ task_id }) => task_id),
      ...historyOperationEvents(redoEvent).map(({ task_id }) => task_id),
      ...pendingForwardMutations.map(({ taskId }) => taskId),
    ].filter((value): value is string => Boolean(value)),
  )];
  const taskQuery = useQuery<TaskTodo>(
    tipTaskIds.length > 0
      ? `SELECT * FROM tasks_todos WHERE owner_id = ? AND id IN (${tipTaskIds.map(() => '?').join(', ')})`
      : 'SELECT * FROM tasks_todos WHERE 0 = 1',
    tipTaskIds.length > 0 ? [ownerId, ...tipTaskIds] : [],
  );
  taskProjectionRef.current = taskQuery.data;
  const undoTasks = historyOperationTasks(taskQuery.data, undoEvent);
  const redoTasks = historyOperationTasks(taskQuery.data, redoEvent);
  const undoSafe = undoEvent !== null
    && undoTasks.length === historyOperationEvents(undoEvent).length
    && taskHistoryOperationIsSafe(undoTasks, undoEvent, 'undo');
  const redoSafe = redoEvent !== null
    && redoTasks.length === historyOperationEvents(redoEvent).length
    && taskHistoryOperationIsSafe(redoTasks, redoEvent, 'redo');

  useEffect(() => {
    if (!(parsed.error instanceof TaskHistoryReconstructionError)) {
      reportedHistoryErrorRef.current = null;
      return;
    }
    const diagnosticKey = `${parsed.error.eventId}:${parsed.error.reason}`;
    if (reportedHistoryErrorRef.current === diagnosticKey) return;
    reportedHistoryErrorRef.current = diagnosticKey;
    reportTaskHistoryReconstructionFailure(parsed.error, query.data.length);
  }, [parsed.error, query.data.length]);

  useEffect(() => {
    const next = projectedCursorRef.current;
    cursorRef.current = next;
    setCursor(next);
  }, [projectionKey]);

  useEffect(() => {
    const projectedMutationIds = new Set(
      projectedEventsRef.current.map(({ client_mutation_id }) => client_mutation_id),
    );
    const next = pendingForwardMutationsRef.current.filter(
      (mutation) => mutation.status === 'pending'
        || (
          mutation.status === 'accepted'
          && mutation.mutationId !== null
          && !projectedMutationIds.has(mutation.mutationId)
        ),
    );
    if (next.length === pendingForwardMutationsRef.current.length) return;
    pendingForwardMutationsRef.current = next;
    setPendingForwardMutations(projectForwardMutations(next));
  }, [projectionKey]);

  const removeForwardMutation = useCallback((mutation: PendingForwardMutation) => {
    const next = pendingForwardMutationsRef.current.filter(
      ({ token }) => token !== mutation.token,
    );
    if (next.length === pendingForwardMutationsRef.current.length) return;
    pendingForwardMutationsRef.current = next;
    setPendingForwardMutations(projectForwardMutations(next));
  }, []);

  const reserveForwardMutation = useCallback((
    source: TaskForwardMutationSource,
  ): TaskForwardMutationReservation => {
    const mutation: PendingForwardMutation = {
      token: forwardMutationSequenceRef.current + 1,
      taskId: source.id,
      previousMutationId: source.client_mutation_id,
      mutationId: null,
      status: 'pending',
    };
    forwardMutationSequenceRef.current = mutation.token;
    const next = [...pendingForwardMutationsRef.current, mutation];
    pendingForwardMutationsRef.current = next;
    setPendingForwardMutations(projectForwardMutations(next));

    let settled = false;
    return {
      commit(task) {
        if (settled) return;
        settled = true;
        if (
          task.id !== mutation.taskId
          || task.client_mutation_id === mutation.previousMutationId
        ) {
          mutation.status = 'canceled';
          removeForwardMutation(mutation);
          return;
        }
        mutation.status = 'accepted';
        mutation.mutationId = task.client_mutation_id;
        setPendingForwardMutations(projectForwardMutations(
          pendingForwardMutationsRef.current,
        ));
      },
      cancel() {
        if (settled) return;
        settled = true;
        mutation.status = 'canceled';
        removeForwardMutation(mutation);
      },
    };
  }, [removeForwardMutation]);

  const registerForwardMutation = useCallback((task: TaskTodo) => {
    const mutationId = task.client_mutation_id;
    if (
      projectedEventsRef.current.some(
        ({ client_mutation_id }) => client_mutation_id === mutationId,
      )
      || pendingForwardMutationsRef.current.some(
        (mutation) => mutation.mutationId === mutationId,
      )
    ) return;
    const mutation: PendingForwardMutation = {
      token: forwardMutationSequenceRef.current + 1,
      taskId: task.id,
      previousMutationId: '',
      mutationId,
      status: 'accepted',
    };
    forwardMutationSequenceRef.current = mutation.token;
    const next = [...pendingForwardMutationsRef.current, mutation];
    pendingForwardMutationsRef.current = next;
    setPendingForwardMutations(projectForwardMutations(next));
  }, []);

  const applyUndoEvent = useCallback(async (event: TaskHistoryEvent) => {
    pendingRef.current = true;
    setPending(true);
    try {
      const operationEvents = historyOperationEvents(event);
      const task = operationEvents.length === 1
        ? await repository.undoTask(ownerId, event.id)
        : (await repository.undoTaskOperation(
            ownerId,
            operationEvents.map(({ id }) => id),
          ))[0];
      const next = moveUndoCursorBackward(cursorRef.current, event);
      cursorRef.current = next;
      setCursor(next);
      return task;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [ownerId, repository]);

  const undo = useCallback(async () => {
    const event = cursorRef.current.undo.at(-1) ?? null;
    const currentTasks = historyOperationTasks(taskProjectionRef.current, event);
    if (
      pendingRef.current
      || event === null
      || currentTasks.length !== historyOperationEvents(event).length
      || !taskHistoryOperationIsSafe(currentTasks, event, 'undo')
    ) {
      throw new UnsafeTaskUndoError('There is no current task change available to undo');
    }

    return applyUndoEvent(event);
  }, [applyUndoEvent]);

  const applyRedoEvent = useCallback(async (event: TaskHistoryEvent) => {
    pendingRef.current = true;
    setPending(true);
    try {
      const operationEvents = historyOperationEvents(event);
      const task = operationEvents.length === 1
        ? await repository.redoTask(ownerId, event.id)
        : (await repository.redoTaskOperation(
            ownerId,
            operationEvents.map(({ id }) => id),
          ))[0];
      const next = moveUndoCursorForward(cursorRef.current, event);
      cursorRef.current = next;
      setCursor(next);
      return task;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [ownerId, repository]);

  const redo = useCallback(async () => {
    const event = cursorRef.current.redo.at(-1) ?? null;
    const currentTasks = historyOperationTasks(taskProjectionRef.current, event);
    if (
      pendingRef.current
      || event === null
      || currentTasks.length !== historyOperationEvents(event).length
      || !taskHistoryOperationIsSafe(currentTasks, event, 'redo')
    ) {
      throw new UnsafeTaskRedoError('There is no current task change available to redo');
    }

    return applyRedoEvent(event);
  }, [applyRedoEvent]);

  const undoWhenAvailable = useCallback(async (
    waitMs = TASK_HISTORY_PROJECTION_WAIT_MS,
  ): Promise<TaskTodo | null> => {
    if (pendingRef.current || historyRequestPendingRef.current) return null;
    const expectedReservation = pendingForwardMutationsRef.current.at(-1) ?? null;
    const expectedEventId = expectedReservation === null
      ? cursorRef.current.undo.at(-1)?.id ?? null
      : null;
    if (expectedReservation === null && expectedEventId === null) return null;

    historyRequestPendingRef.current = true;
    setProjectionWaitPending(true);
    try {
      const deadline = Date.now() + Math.max(0, waitMs);
      while (true) {
        if (expectedReservation?.status === 'canceled') return null;
        const expectedMutationId = expectedReservation?.mutationId ?? null;
        const projectedEvent = expectedReservation === null
          ? cursorRef.current.undo.at(-1) ?? null
          : expectedMutationId === null
            ? null
            : projectedEventsRef.current.find(
              ({ client_mutation_id }) => client_mutation_id === expectedMutationId,
            ) ?? null;
        const expectedEvent = projectedEvent === null
          ? null
          : cursorRef.current.undo.find((candidate) => (
            historyOperationEvents(candidate).some(
              ({ client_mutation_id }) => (
                client_mutation_id === projectedEvent.client_mutation_id
              ),
            )
          )) ?? null;
        if (
          expectedEvent !== null
          && (
            expectedReservation !== null
            || historyOperationEvents(expectedEvent).some(({ id }) => id === expectedEventId)
          )
        ) {
          if (!taskHistoryEventSupportsMovement(expectedEvent)) return null;
          const cursorEvent = cursorRef.current.undo.at(-1) ?? null;
          const currentTasks = historyOperationTasks(
            taskProjectionRef.current,
            expectedEvent,
          );
          if (
            cursorEvent?.id === expectedEvent.id
            && currentTasks.length === historyOperationEvents(expectedEvent).length
            && taskHistoryOperationIsSafe(currentTasks, expectedEvent, 'undo')
          ) {
            return await applyUndoEvent(expectedEvent);
          }
        }
        if (Date.now() >= deadline) {
          if (expectedReservation?.status === 'pending') {
            expectedReservation.status = 'canceled';
            removeForwardMutation(expectedReservation);
          }
          return null;
        }
        await waitForTaskHistoryProjection();
      }
    } finally {
      historyRequestPendingRef.current = false;
      setProjectionWaitPending(false);
    }
  }, [applyUndoEvent, removeForwardMutation]);

  const redoWhenAvailable = useCallback(async (
    waitMs = TASK_HISTORY_PROJECTION_WAIT_MS,
  ): Promise<TaskTodo | null> => {
    if (pendingRef.current || historyRequestPendingRef.current) return null;
    const expectedEventId = cursorRef.current.redo.at(-1)?.id ?? null;
    if (expectedEventId === null || pendingForwardMutationsRef.current.length > 0) return null;

    historyRequestPendingRef.current = true;
    setProjectionWaitPending(true);
    try {
      const deadline = Date.now() + Math.max(0, waitMs);
      while (true) {
        const event = cursorRef.current.redo.at(-1) ?? null;
        const currentTasks = historyOperationTasks(taskProjectionRef.current, event);
        if (
          event?.id === expectedEventId
          && currentTasks.length === historyOperationEvents(event).length
          && taskHistoryOperationIsSafe(currentTasks, event, 'redo')
        ) {
          return await applyRedoEvent(event);
        }
        if (Date.now() >= deadline) return null;
        await waitForTaskHistoryProjection();
      }
    } finally {
      historyRequestPendingRef.current = false;
      setProjectionWaitPending(false);
    }
  }, [applyRedoEvent]);

  return {
    available: pendingForwardMutations.length === 0
      && undoSafe
      && !pending
      && !projectionWaitPending,
    redoAvailable: pendingForwardMutations.length === 0
      && redoSafe
      && !pending
      && !projectionWaitPending,
    pending: pending || projectionWaitPending,
    loading: query.isLoading || taskQuery.isLoading,
    error: query.error ?? taskQuery.error ?? parsed.error,
    event: undoEvent,
    redoEvent,
    undoDepth: cursor.undo.length,
    redoDepth: cursor.redo.length,
    undo,
    redo,
    undoWhenAvailable,
    redoWhenAvailable,
    reserveForwardMutation,
    registerForwardMutation,
  };
}

function projectForwardMutations(
  mutations: readonly PendingForwardMutation[],
): ForwardMutationProjection[] {
  return mutations.map(({ token, taskId, mutationId, status }) => ({
    token,
    taskId,
    mutationId,
    status,
  }));
}

function taskHistoryEventSupportsMovement(event: TaskHistoryEvent): boolean {
  return event.transition !== 'baseline'
    && event.transition !== 'undo'
    && event.transition !== 'redo'
    && (event.transition === 'create' || event.before_state !== null);
}

function waitForTaskHistoryProjection(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, TASK_HISTORY_PROJECTION_POLL_MS);
  });
}

export function taskHistoryMovementIsSafe(
  task: TaskTodo,
  event: TaskHistoryEvent,
  direction: 'undo' | 'redo',
): boolean {
  try {
    if (direction === 'undo') {
      createTaskUndoPatch(task, event);
    } else {
      createTaskRedoPatch(task, event);
    }
    return true;
  } catch (error) {
    if (error instanceof UnsafeTaskUndoError || error instanceof UnsafeTaskRedoError) {
      return false;
    }
    throw error;
  }
}

export function replayTaskHistory(events: readonly TaskHistoryEvent[]): TaskHistoryCursor {
  return collapseHistoryOperations([...events]
    .sort(compareHistoryEvents)
  ).reduce(applyTaskHistoryEvent, emptyCursor());
}

export function applyTaskHistoryEvent(
  cursor: TaskHistoryCursor,
  event: TaskHistoryEvent,
): TaskHistoryCursor {
  if (event.transition === 'baseline') {
    return cursor;
  }
  if (event.transition === 'create') {
    return {
      undo: [...cursor.undo, event].slice(-TASK_HISTORY_LIMIT),
      redo: [],
    };
  }
  if (event.transition === 'undo') {
    const source = cursor.undo.at(-1);
    if (source && inverseMatchesSource(event, source, 'undo')) {
      return moveUndoCursorBackward(cursor, source);
    }
    return cursor;
  }
  if (event.transition === 'redo') {
    const source = cursor.redo.at(-1);
    if (source && inverseMatchesSource(event, source, 'redo')) {
      return moveUndoCursorForward(cursor, source);
    }
    return cursor;
  }

  return {
    undo: [...cursor.undo, event].slice(-TASK_HISTORY_LIMIT),
    redo: [],
  };
}

function moveUndoCursorBackward(
  cursor: TaskHistoryCursor,
  event: TaskHistoryEvent,
): TaskHistoryCursor {
  if (cursor.undo.at(-1)?.id !== event.id) {
    return cursor;
  }
  return {
    undo: cursor.undo.slice(0, -1),
    redo: [...cursor.redo, event].slice(-TASK_HISTORY_LIMIT),
  };
}

function moveUndoCursorForward(
  cursor: TaskHistoryCursor,
  event: TaskHistoryEvent,
): TaskHistoryCursor {
  if (cursor.redo.at(-1)?.id !== event.id) {
    return cursor;
  }
  return {
    undo: [...cursor.undo, event].slice(-TASK_HISTORY_LIMIT),
    redo: cursor.redo.slice(0, -1),
  };
}

function inverseMatchesSource(
  inverse: TaskHistoryEvent,
  source: TaskHistoryEvent,
  direction: 'undo' | 'redo',
): boolean {
  const inverseEvents = historyOperationEvents(inverse);
  const sourceEvents = historyOperationEvents(source);
  if (inverseEvents.length !== sourceEvents.length) return false;
  return sourceEvents.every((sourceEvent) => {
    const inverseEvent = inverseEvents.find((candidate) => (
      candidate.owner_id === sourceEvent.owner_id
      && candidate.task_id === sourceEvent.task_id
    ));
    if (!inverseEvent) return false;
    if (sourceEvent.transition === 'create' && sourceEvent.before_state === null) {
      return direction === 'undo'
        ? snapshotsEqual(inverseEvent.before_state, sourceEvent.after_state)
          && deletedCreationSnapshotMatches(
            inverseEvent.after_state,
            sourceEvent.after_state,
            sourceEvent.task_id,
          )
        : deletedCreationSnapshotMatches(
          inverseEvent.before_state ?? sourceEvent.after_state,
          sourceEvent.after_state,
          sourceEvent.task_id,
        ) && snapshotsEqual(inverseEvent.after_state, sourceEvent.after_state);
    }
    if (sourceEvent.before_state === null) return false;
    return direction === 'undo'
      ? snapshotsEqual(inverseEvent.before_state, sourceEvent.after_state)
        && snapshotsEqual(inverseEvent.after_state, sourceEvent.before_state)
      : snapshotsEqual(inverseEvent.before_state, sourceEvent.before_state)
        && snapshotsEqual(inverseEvent.after_state, sourceEvent.after_state);
  });
}

function collapseHistoryOperations(events: readonly TaskHistoryEvent[]): TaskHistoryEvent[] {
  const result: TaskHistoryEvent[] = [];
  for (const event of events) {
    const previous = result.at(-1);
    if (previous?.operation_id === event.operation_id) {
      const operationEvents = [...historyOperationEvents(previous), event];
      result[result.length - 1] = {
        ...event,
        affected_ids: [...new Set(operationEvents.flatMap(({ affected_ids }) => affected_ids))],
        operation_events: operationEvents,
      };
    } else {
      result.push(event);
    }
  }
  return result;
}

function historyOperationEvents(event: TaskHistoryEvent | null): TaskHistoryEvent[] {
  if (event === null) return [];
  return event.operation_events ?? [event];
}

function historyOperationTasks(
  tasks: readonly TaskTodo[],
  event: TaskHistoryEvent | null,
): TaskTodo[] {
  const taskIds = new Set(historyOperationEvents(event).map(({ task_id }) => task_id));
  return tasks.filter(({ id }) => taskIds.has(id));
}

function taskHistoryOperationIsSafe(
  tasks: readonly TaskTodo[],
  event: TaskHistoryEvent,
  direction: 'undo' | 'redo',
): boolean {
  const byTaskId = new Map(tasks.map((task) => [task.id, task]));
  return historyOperationEvents(event).every((operationEvent) => {
    const task = byTaskId.get(operationEvent.task_id);
    return task !== undefined && taskHistoryMovementIsSafe(task, operationEvent, direction);
  });
}

function snapshotsEqual(
  left: TaskHistorySnapshot | null,
  right: TaskHistorySnapshot | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compareHistoryEvents(left: TaskHistoryEvent, right: TaskHistoryEvent): number {
  return left.occurred_at.localeCompare(right.occurred_at) || left.id.localeCompare(right.id);
}

export function parseHistoryEvents(rows: readonly TaskHistoryStorageRow[]): {
  events: TaskHistoryEvent[];
  error: Error | null;
} {
  const events: TaskHistoryEvent[] = [];
  for (const row of rows) {
    try {
      events.push(parseTaskHistoryEvent(row));
    } catch (error) {
      const cause = error instanceof Error ? error : new Error('Task history could not be read');
      return {
        events: [],
        error: new TaskHistoryReconstructionError(row.id, cause),
      };
    }
  }
  return { events: events.sort(compareHistoryEvents), error: null };
}
