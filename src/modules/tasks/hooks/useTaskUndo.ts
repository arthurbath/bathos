import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createTaskRedoPatch,
  createTaskUndoPatch,
  parseTaskHistoryEvent,
  UnsafeTaskRedoError,
  UnsafeTaskUndoError,
  type TaskHistoryEvent,
  type TaskHistorySnapshot,
  type TaskHistoryStorageRow,
} from '@/modules/tasks/domain/taskHistory';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

export const TASK_HISTORY_LIMIT = 100;
const TASK_HISTORY_REPLAY_LIMIT = 500;

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

const emptyCursor = (): TaskHistoryCursor => ({ undo: [], redo: [] });

export function useTaskUndo(ownerId: string) {
  const { repository } = useTasksRuntime();
  const query = useQuery<TaskHistoryStorageRow>(taskHistoryQuery, [ownerId]);
  const pendingRef = useRef(false);
  const cursorRef = useRef<TaskHistoryCursor>(emptyCursor());
  const projectedCursorRef = useRef<TaskHistoryCursor>(emptyCursor());
  const projectedCursorKeyRef = useRef('');
  const [cursor, setCursor] = useState<TaskHistoryCursor>(emptyCursor);
  const [pending, setPending] = useState(false);
  const parsed = useMemo(() => parseHistoryEvents(query.data), [query.data]);
  const projectionKey = `${ownerId}:${parsed.events.map(({ id }) => id).join(',')}`;
  if (projectedCursorKeyRef.current !== projectionKey) {
    projectedCursorKeyRef.current = projectionKey;
    projectedCursorRef.current = replayTaskHistory(parsed.events);
  }
  const undoEvent = cursor.undo.at(-1) ?? null;
  const redoEvent = cursor.redo.at(-1) ?? null;
  const tipTaskIds = [...new Set(
    [undoEvent?.task_id, redoEvent?.task_id].filter((value): value is string => Boolean(value)),
  )];
  const taskQuery = useQuery<TaskTodo>(
    tipTaskIds.length > 0
      ? `SELECT * FROM tasks_todos WHERE owner_id = ? AND id IN (${tipTaskIds.map(() => '?').join(', ')})`
      : 'SELECT * FROM tasks_todos WHERE 0 = 1',
    tipTaskIds.length > 0 ? [ownerId, ...tipTaskIds] : [],
  );
  const undoTask = undoEvent === null
    ? null
    : taskQuery.data.find((task) => task.id === undoEvent.task_id) ?? null;
  const redoTask = redoEvent === null
    ? null
    : taskQuery.data.find((task) => task.id === redoEvent.task_id) ?? null;
  const undoSafe = undoEvent !== null
    && undoTask !== null
    && taskHistoryMovementIsSafe(undoTask, undoEvent, 'undo');
  const redoSafe = redoEvent !== null
    && redoTask !== null
    && taskHistoryMovementIsSafe(redoTask, redoEvent, 'redo');

  useEffect(() => {
    const next = projectedCursorRef.current;
    cursorRef.current = next;
    setCursor(next);
  }, [projectionKey]);

  const undo = useCallback(async () => {
    const event = cursorRef.current.undo.at(-1) ?? null;
    const currentTask = event === null
      ? null
      : taskQuery.data.find((task) => task.id === event.task_id) ?? null;
    if (
      pendingRef.current
      || event === null
      || currentTask === null
      || !taskHistoryMovementIsSafe(currentTask, event, 'undo')
    ) {
      throw new UnsafeTaskUndoError('There is no current task change available to undo');
    }

    pendingRef.current = true;
    setPending(true);
    try {
      const task = await repository.undoTask(ownerId, event.id);
      const next = moveUndoCursorBackward(cursorRef.current, event);
      cursorRef.current = next;
      setCursor(next);
      return task;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [ownerId, repository, taskQuery.data]);

  const redo = useCallback(async () => {
    const event = cursorRef.current.redo.at(-1) ?? null;
    const currentTask = event === null
      ? null
      : taskQuery.data.find((task) => task.id === event.task_id) ?? null;
    if (
      pendingRef.current
      || event === null
      || currentTask === null
      || !taskHistoryMovementIsSafe(currentTask, event, 'redo')
    ) {
      throw new UnsafeTaskRedoError('There is no current task change available to redo');
    }

    pendingRef.current = true;
    setPending(true);
    try {
      const task = await repository.redoTask(ownerId, event.id);
      const next = moveUndoCursorForward(cursorRef.current, event);
      cursorRef.current = next;
      setCursor(next);
      return task;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [ownerId, repository, taskQuery.data]);

  return {
    available: undoSafe && !pending,
    redoAvailable: redoSafe && !pending,
    pending,
    loading: query.isLoading || taskQuery.isLoading,
    error: query.error ?? taskQuery.error ?? parsed.error,
    event: undoEvent,
    redoEvent,
    undoDepth: cursor.undo.length,
    redoDepth: cursor.redo.length,
    undo,
    redo,
  };
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
  return [...events]
    .sort(compareHistoryEvents)
    .reduce(applyTaskHistoryEvent, emptyCursor());
}

export function applyTaskHistoryEvent(
  cursor: TaskHistoryCursor,
  event: TaskHistoryEvent,
): TaskHistoryCursor {
  if (event.transition === 'baseline') {
    return cursor;
  }
  if (event.transition === 'create') {
    return { ...cursor, redo: [] };
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
  if (
    source.before_state === null
    || inverse.owner_id !== source.owner_id
    || inverse.task_id !== source.task_id
  ) {
    return false;
  }
  return direction === 'undo'
    ? snapshotsEqual(inverse.before_state, source.after_state)
      && snapshotsEqual(inverse.after_state, source.before_state)
    : snapshotsEqual(inverse.before_state, source.before_state)
      && snapshotsEqual(inverse.after_state, source.after_state);
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

function parseHistoryEvents(rows: readonly TaskHistoryStorageRow[]): {
  events: TaskHistoryEvent[];
  error: Error | null;
} {
  const events: TaskHistoryEvent[] = [];
  for (const row of rows) {
    try {
      events.push(parseTaskHistoryEvent(row));
    } catch (error) {
      return {
        events: [],
        error: error instanceof Error ? error : new Error('Task history could not be read'),
      };
    }
  }
  return { events: events.sort(compareHistoryEvents), error: null };
}
