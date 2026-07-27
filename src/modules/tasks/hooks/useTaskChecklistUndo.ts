import { useQuery } from '@powersync/react';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { TaskChecklistItemPatch } from '@/modules/tasks/data/taskHierarchyRepository';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type {
  TaskChecklistItem,
  TaskHierarchyHistoryEvent,
} from '@/modules/tasks/types/tasks';

type ChecklistSnapshot = Omit<TaskChecklistItem, 'owner_id'>;
type StoredChecklistHistoryEvent = Omit<
  TaskHierarchyHistoryEvent,
  'before_state' | 'after_state'
> & {
  before_state: unknown;
  after_state: unknown;
};

type ChecklistHistoryCursor = {
  undo: StoredChecklistHistoryEvent[];
  redo: StoredChecklistHistoryEvent[];
};

const emptyCursor = (): ChecklistHistoryCursor => ({ undo: [], redo: [] });

export function useTaskChecklistUndo(ownerId: string) {
  const { hierarchyOperationsRepository, hierarchyRepository } = useTasksRuntime();
  const query = useQuery<StoredChecklistHistoryEvent>(
    `SELECT * FROM tasks_hierarchy_history_events
     WHERE owner_id = ? AND entity_type = 'checklist_item'
     ORDER BY occurred_at, id`,
    [ownerId],
  );
  const events = useMemo(
    () => query.data.map(parseEvent).filter(
      (event): event is StoredChecklistHistoryEvent => event !== null,
    ),
    [query.data],
  );
  const projectedCursor = useMemo(() => replayChecklistHistory(events), [events]);
  const cursorRef = useRef<ChecklistHistoryCursor>(emptyCursor());
  const projectionKeyRef = useRef('');
  const projectionKey = events.map(({ id }) => id).join(',');
  if (projectionKeyRef.current !== projectionKey) {
    projectionKeyRef.current = projectionKey;
    cursorRef.current = projectedCursor;
  }
  const [, rerender] = useState(0);
  const pendingRef = useRef(false);

  const apply = useCallback(async (
    event: StoredChecklistHistoryEvent,
    direction: 'undo' | 'redo',
  ) => {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    try {
      const sourceSnapshot = direction === 'undo'
        ? snapshot(event.before_state)
        : snapshot(event.after_state);
      const shouldDelete = (
        direction === 'undo'
        && (event.transition === 'create' || event.transition === 'restore')
      ) || (
        direction === 'redo'
        && event.transition === 'delete'
      );
      const shouldRestore = (
        direction === 'undo'
        && event.transition === 'delete'
      ) || (
        direction === 'redo'
        && (event.transition === 'create' || event.transition === 'restore')
      );
      if (sourceSnapshot === null || shouldDelete) {
        await hierarchyOperationsRepository.request({
          ownerId,
          rootType: 'checklist_item',
          rootId: event.entity_id,
          operation: 'delete',
          descendantPolicy: 'reject',
        });
      } else if (shouldRestore) {
        await hierarchyOperationsRepository.request({
          ownerId,
          rootType: 'checklist_item',
          rootId: event.entity_id,
          operation: 'restore',
          descendantPolicy: 'reject',
        });
      } else {
        await hierarchyRepository.updateChecklistItem(
          ownerId,
          event.entity_id,
          mutablePatch(sourceSnapshot),
        );
      }
      cursorRef.current = direction === 'undo'
        ? {
            undo: cursorRef.current.undo.slice(0, -1),
            redo: [...cursorRef.current.redo, event],
          }
        : {
            undo: [...cursorRef.current.undo, event],
            redo: cursorRef.current.redo.slice(0, -1),
          };
      rerender((value) => value + 1);
      return event;
    } finally {
      pendingRef.current = false;
    }
  }, [hierarchyOperationsRepository, hierarchyRepository, ownerId]);

  const undo = useCallback(() => {
    const event = cursorRef.current.undo.at(-1);
    return event ? apply(event, 'undo') : Promise.resolve(null);
  }, [apply]);
  const redo = useCallback(() => {
    const event = cursorRef.current.redo.at(-1);
    return event ? apply(event, 'redo') : Promise.resolve(null);
  }, [apply]);

  return {
    event: cursorRef.current.undo.at(-1) ?? null,
    redoEvent: cursorRef.current.redo.at(-1) ?? null,
    pending: pendingRef.current,
    loading: query.isLoading,
    error: query.error,
    undo,
    redo,
  };
}

function replayChecklistHistory(
  events: readonly StoredChecklistHistoryEvent[],
): ChecklistHistoryCursor {
  return events.reduce((cursor, event) => {
    if (event.transition === 'baseline') return cursor;
    const undoSource = cursor.undo.at(-1);
    if (undoSource && isInverse(event, undoSource)) {
      return {
        undo: cursor.undo.slice(0, -1),
        redo: [...cursor.redo, undoSource],
      };
    }
    const redoSource = cursor.redo.at(-1);
    if (redoSource && isReplay(event, redoSource)) {
      return {
        undo: [...cursor.undo, redoSource],
        redo: cursor.redo.slice(0, -1),
      };
    }
    return { undo: [...cursor.undo, event], redo: [] };
  }, emptyCursor());
}

function isInverse(
  candidate: StoredChecklistHistoryEvent,
  source: StoredChecklistHistoryEvent,
): boolean {
  if (candidate.entity_id !== source.entity_id) return false;
  if (source.transition === 'create') return candidate.transition === 'delete';
  if (source.transition === 'delete') return candidate.transition === 'restore';
  if (source.transition === 'restore') return candidate.transition === 'delete';
  return equalSnapshot(candidate.before_state, source.after_state)
    && equalSnapshot(candidate.after_state, source.before_state);
}

function isReplay(
  candidate: StoredChecklistHistoryEvent,
  source: StoredChecklistHistoryEvent,
): boolean {
  if (candidate.entity_id !== source.entity_id) return false;
  if (source.transition === 'create') return candidate.transition === 'restore';
  if (source.transition === 'delete') return candidate.transition === 'delete';
  if (source.transition === 'restore') return candidate.transition === 'restore';
  return equalSnapshot(candidate.before_state, source.before_state)
    && equalSnapshot(candidate.after_state, source.after_state);
}

function mutablePatch(snapshotValue: ChecklistSnapshot): TaskChecklistItemPatch {
  return {
    title: snapshotValue.title,
    completed: Boolean(snapshotValue.completed),
    completed_at: snapshotValue.completed_at,
    order_key: snapshotValue.order_key,
  };
}

function parseEvent(
  event: StoredChecklistHistoryEvent,
): StoredChecklistHistoryEvent | null {
  return snapshot(event.after_state) === null ? null : event;
}

function snapshot(value: unknown): ChecklistSnapshot | null {
  if (value === null) return null;
  const parsed = typeof value === 'string' ? safeParse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as ChecklistSnapshot;
}

function equalSnapshot(left: unknown, right: unknown): boolean {
  const normalizedLeft = snapshot(left);
  const normalizedRight = snapshot(right);
  return JSON.stringify(comparableSnapshot(normalizedLeft))
    === JSON.stringify(comparableSnapshot(normalizedRight));
}

function comparableSnapshot(value: ChecklistSnapshot | null) {
  if (value === null) return null;
  return {
    title: value.title,
    completed: Boolean(value.completed),
    completed_at: value.completed_at,
    order_key: value.order_key,
    disposition: value.disposition,
    deleted_at: value.deleted_at,
    deletion_root_id: value.deletion_root_id,
  };
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
