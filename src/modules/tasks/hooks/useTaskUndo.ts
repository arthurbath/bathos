import { useQuery } from '@powersync/react';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  parseTaskHistoryEvent,
  UnsafeTaskUndoError,
  type TaskHistoryEvent,
  type TaskHistoryStorageRow,
} from '@/modules/tasks/domain/taskHistory';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';

const latestUndoableTaskEventQuery = `
  SELECT event.*
  FROM tasks_history_events AS event
  INNER JOIN tasks_todos AS task
    ON task.id = event.task_id
   AND task.owner_id = event.owner_id
  WHERE event.owner_id = ?
    AND event.outcome = 'accepted'
    AND event.transition NOT IN ('baseline', 'create', 'undo')
    AND event.result_revision = task.revision
  ORDER BY event.occurred_at DESC, event.id DESC
  LIMIT 1
`;

export function useTaskUndo(ownerId: string) {
  const { repository } = useTasksRuntime();
  const query = useQuery<TaskHistoryStorageRow>(latestUndoableTaskEventQuery, [ownerId]);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const parsed = useMemo(() => parseLatestUndoableEvent(query.data), [query.data]);

  const undo = useCallback(async () => {
    if (pendingRef.current || parsed.event === null) {
      throw new UnsafeTaskUndoError('There is no current task change available to undo');
    }

    pendingRef.current = true;
    setPending(true);
    try {
      return await repository.undoTask(ownerId, parsed.event.id);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [ownerId, parsed.event, repository]);

  return {
    available: parsed.event !== null,
    pending,
    loading: query.isLoading,
    error: query.error ?? parsed.error,
    event: parsed.event,
    undo,
  };
}

function parseLatestUndoableEvent(rows: readonly TaskHistoryStorageRow[]): {
  event: TaskHistoryEvent | null;
  error: Error | null;
} {
  if (rows.length === 0) {
    return { event: null, error: null };
  }

  try {
    return { event: parseTaskHistoryEvent(rows[0]), error: null };
  } catch (error) {
    return {
      event: null,
      error: error instanceof Error ? error : new Error('Task history could not be read'),
    };
  }
}
