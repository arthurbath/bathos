import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  parseTaskHistoryEvent,
  UnsafeTaskRedoError,
  UnsafeTaskUndoError,
  type TaskHistoryEvent,
  type TaskHistorySnapshot,
  type TaskHistoryStorageRow,
} from '@/modules/tasks/domain/taskHistory';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';

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
  const processedEventIdsRef = useRef(new Set<string>());
  const ownerIdRef = useRef(ownerId);
  const [cursor, setCursor] = useState<TaskHistoryCursor>(emptyCursor);
  const [pending, setPending] = useState(false);
  const parsed = useMemo(() => parseHistoryEvents(query.data), [query.data]);

  useEffect(() => {
    if (ownerIdRef.current !== ownerId) {
      ownerIdRef.current = ownerId;
      processedEventIdsRef.current = new Set();
      cursorRef.current = emptyCursor();
      setCursor(cursorRef.current);
    }

    let next = cursorRef.current;
    let changed = false;
    for (const event of parsed.events) {
      if (processedEventIdsRef.current.has(event.id)) {
        continue;
      }
      processedEventIdsRef.current.add(event.id);
      next = applyTaskHistoryEvent(next, event);
      changed = true;
    }
    if (changed) {
      cursorRef.current = next;
      setCursor(next);
    }
  }, [ownerId, parsed.events]);

  const undo = useCallback(async () => {
    const event = cursorRef.current.undo.at(-1) ?? null;
    if (pendingRef.current || event === null) {
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
  }, [ownerId, repository]);

  const redo = useCallback(async () => {
    const event = cursorRef.current.redo.at(-1) ?? null;
    if (pendingRef.current || event === null) {
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
  }, [ownerId, repository]);

  return {
    available: cursor.undo.length > 0,
    redoAvailable: cursor.redo.length > 0,
    pending,
    loading: query.isLoading,
    error: query.error ?? parsed.error,
    event: cursor.undo.at(-1) ?? null,
    redoEvent: cursor.redo.at(-1) ?? null,
    undoDepth: cursor.undo.length,
    redoDepth: cursor.redo.length,
    undo,
    redo,
  };
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
