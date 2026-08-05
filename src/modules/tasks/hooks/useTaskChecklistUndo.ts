import { useQuery } from '@powersync/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  operation_events?: StoredChecklistHistoryEvent[];
};

type ChecklistHistoryCursor = {
  undo: StoredChecklistHistoryEvent[];
  redo: StoredChecklistHistoryEvent[];
};

const emptyCursor = (): ChecklistHistoryCursor => ({ undo: [], redo: [] });
export const CHECKLIST_HISTORY_PROJECTION_WAIT_MS = 30_000;
const CHECKLIST_HISTORY_PROJECTION_POLL_MS = 100;

export type TaskChecklistForwardAction = {
  actionId: string;
  occurredAt: string;
};

export function useTaskChecklistUndo(ownerId: string) {
  const { hierarchyOperationsRepository, hierarchyRepository } = useTasksRuntime();
  const query = useQuery<StoredChecklistHistoryEvent>(
    `SELECT * FROM tasks_hierarchy_history_events
     WHERE owner_id = ? AND entity_type = 'checklist_item'
     ORDER BY occurred_at, action_id, id`,
    [ownerId],
  );
  const events = useMemo(
    () => collapseChecklistOperations(query.data.map(parseEvent).filter(
      (event): event is StoredChecklistHistoryEvent => event !== null,
    )),
    [query.data],
  );
  const eventsRef = useRef<StoredChecklistHistoryEvent[]>([]);
  eventsRef.current = events;
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
  const historyRequestPendingRef = useRef(false);
  const historyRefreshRef = useRef(query.refresh);
  historyRefreshRef.current = query.refresh;
  const pendingForwardActionsRef = useRef<TaskChecklistForwardAction[]>([]);
  const [pendingForwardActions, setPendingForwardActions] = useState<
    TaskChecklistForwardAction[]
  >([]);
  const [pending, setPending] = useState(false);
  const [projectionWaitPending, setProjectionWaitPending] = useState(false);

  useEffect(() => {
    const projectedActionIds = new Set(eventsRef.current.map(({ action_id }) => action_id));
    const next = pendingForwardActionsRef.current.filter(
      ({ actionId }) => !projectedActionIds.has(actionId),
    );
    if (next.length === pendingForwardActionsRef.current.length) return;
    pendingForwardActionsRef.current = next;
    setPendingForwardActions(next);
  }, [projectionKey]);

  const removeForwardAction = useCallback((actionId: string) => {
    const next = pendingForwardActionsRef.current.filter(
      (action) => action.actionId !== actionId,
    );
    if (next.length === pendingForwardActionsRef.current.length) return;
    pendingForwardActionsRef.current = next;
    setPendingForwardActions(next);
  }, []);

  const registerForwardAction = useCallback((action: TaskChecklistForwardAction) => {
    if (
      eventsRef.current.some(({ action_id }) => action_id === action.actionId)
      || pendingForwardActionsRef.current.some(
        ({ actionId }) => actionId === action.actionId,
      )
    ) return;
    const next = [...pendingForwardActionsRef.current, action];
    pendingForwardActionsRef.current = next;
    setPendingForwardActions(next);
  }, []);

  const hasPendingForwardAction = useCallback(
    () => pendingForwardActionsRef.current.length > 0,
    [],
  );

  const apply = useCallback(async (
    event: StoredChecklistHistoryEvent,
    direction: 'undo' | 'redo',
  ) => {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    setPending(true);
    try {
      const occurredAt = new Date().toISOString();
      const operationId = globalThis.crypto.randomUUID();
      const context = { occurredAt, operationId };
      const operationEvents = checklistOperationEvents(event);
      const replayOrder = direction === 'undo'
        ? [...operationEvents].reverse()
        : operationEvents;
      for (const operationEvent of replayOrder) {
        const sourceSnapshot = direction === 'undo'
          ? snapshot(operationEvent.before_state)
          : snapshot(operationEvent.after_state);
        const shouldDelete = (
          direction === 'undo'
          && (
            operationEvent.transition === 'create'
            || operationEvent.transition === 'restore'
          )
        ) || (
          direction === 'redo'
          && operationEvent.transition === 'delete'
        );
        const shouldRestore = (
          direction === 'undo'
          && operationEvent.transition === 'delete'
        ) || (
          direction === 'redo'
          && (
            operationEvent.transition === 'create'
            || operationEvent.transition === 'restore'
          )
        );
        if (sourceSnapshot === null || shouldDelete) {
          await hierarchyOperationsRepository.request({
            ownerId,
            rootType: 'checklist_item',
            rootId: operationEvent.entity_id,
            operation: 'delete',
            descendantPolicy: 'reject',
            context,
          });
        } else if (shouldRestore) {
          await hierarchyOperationsRepository.request({
            ownerId,
            rootType: 'checklist_item',
            rootId: operationEvent.entity_id,
            operation: 'restore',
            descendantPolicy: 'reject',
            context,
          });
        } else {
          await hierarchyRepository.updateChecklistItem(
            ownerId,
            operationEvent.entity_id,
            mutablePatch(sourceSnapshot),
            context,
          );
        }
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
      setPending(false);
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

  const undoWhenAvailable = useCallback(async (
    waitMs = CHECKLIST_HISTORY_PROJECTION_WAIT_MS,
  ) => {
    if (pendingRef.current || historyRequestPendingRef.current) return null;
    const expectedAction = pendingForwardActionsRef.current.at(-1) ?? null;
    const expectedEventId = expectedAction === null
      ? cursorRef.current.undo.at(-1)?.id ?? null
      : null;
    if (expectedAction === null && expectedEventId === null) return null;

    historyRequestPendingRef.current = true;
    setProjectionWaitPending(true);
    try {
      const deadline = Date.now() + Math.max(0, waitMs);
      while (true) {
        const expectedEvent = expectedAction === null
          ? cursorRef.current.undo.at(-1) ?? null
          : cursorRef.current.undo.find(
            ({ action_id }) => action_id === expectedAction.actionId,
          ) ?? null;
        const cursorEvent = cursorRef.current.undo.at(-1) ?? null;
        if (
          expectedEvent !== null
          && cursorEvent?.id === expectedEvent.id
          && (
            expectedAction !== null
            || expectedEvent.id === expectedEventId
          )
        ) {
          return await apply(expectedEvent, 'undo');
        }
        if (Date.now() >= deadline) {
          if (expectedAction !== null) removeForwardAction(expectedAction.actionId);
          return null;
        }
        await refreshChecklistHistoryProjection(historyRefreshRef.current);
      }
    } finally {
      historyRequestPendingRef.current = false;
      setProjectionWaitPending(false);
    }
  }, [apply, removeForwardAction]);

  const redoWhenAvailable = useCallback(async (
    waitMs = CHECKLIST_HISTORY_PROJECTION_WAIT_MS,
  ) => {
    if (
      pendingRef.current
      || historyRequestPendingRef.current
      || pendingForwardActionsRef.current.length > 0
    ) return null;
    const expectedEventId = cursorRef.current.redo.at(-1)?.id ?? null;
    if (expectedEventId === null) return null;

    historyRequestPendingRef.current = true;
    setProjectionWaitPending(true);
    try {
      const deadline = Date.now() + Math.max(0, waitMs);
      while (true) {
        const event = cursorRef.current.redo.at(-1) ?? null;
        if (event?.id === expectedEventId) return await apply(event, 'redo');
        if (Date.now() >= deadline) return null;
        await refreshChecklistHistoryProjection(historyRefreshRef.current);
      }
    } finally {
      historyRequestPendingRef.current = false;
      setProjectionWaitPending(false);
    }
  }, [apply]);

  return {
    event: cursorRef.current.undo.at(-1) ?? null,
    redoEvent: cursorRef.current.redo.at(-1) ?? null,
    available: (pendingForwardActions.length > 0 || cursorRef.current.undo.length > 0)
      && !pending
      && !projectionWaitPending,
    redoAvailable: pendingForwardActions.length === 0
      && cursorRef.current.redo.length > 0
      && !pending
      && !projectionWaitPending,
    pending: pending || projectionWaitPending,
    forwardActionPending: pendingForwardActions.length > 0,
    loading: query.isLoading,
    error: query.error,
    undo,
    redo,
    undoWhenAvailable,
    redoWhenAvailable,
    registerForwardAction,
    hasPendingForwardAction,
  };
}

async function refreshChecklistHistoryProjection(
  refreshHistory: ((signal?: AbortSignal) => Promise<void>) | undefined,
): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, CHECKLIST_HISTORY_PROJECTION_POLL_MS);
  });
  await refreshHistory?.();
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
  const candidateEvents = checklistOperationEvents(candidate);
  const sourceEvents = checklistOperationEvents(source);
  if (candidateEvents.length !== sourceEvents.length) return false;
  return sourceEvents.every((sourceEvent) => {
    const candidateEvent = candidateEvents.find(
      ({ entity_id }) => entity_id === sourceEvent.entity_id,
    );
    return candidateEvent !== undefined && singleEventIsInverse(candidateEvent, sourceEvent);
  });
}

function singleEventIsInverse(
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
  const candidateEvents = checklistOperationEvents(candidate);
  const sourceEvents = checklistOperationEvents(source);
  if (candidateEvents.length !== sourceEvents.length) return false;
  return sourceEvents.every((sourceEvent) => {
    const candidateEvent = candidateEvents.find(
      ({ entity_id }) => entity_id === sourceEvent.entity_id,
    );
    return candidateEvent !== undefined && singleEventIsReplay(candidateEvent, sourceEvent);
  });
}

function singleEventIsReplay(
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

function collapseChecklistOperations(
  events: readonly StoredChecklistHistoryEvent[],
): StoredChecklistHistoryEvent[] {
  const result: StoredChecklistHistoryEvent[] = [];
  for (const event of events) {
    const previous = result.at(-1);
    if (
      previous !== undefined
      && previous.action_id === event.action_id
      && previous.actor_type === event.actor_type
      && previous.mutation_channel === event.mutation_channel
      && checklistTaskId(previous) === checklistTaskId(event)
    ) {
      const operationEvents = [...checklistOperationEvents(previous), event];
      result[result.length - 1] = {
        ...event,
        affected_ids: [...new Set(
          operationEvents.flatMap(({ affected_ids }) => affected_ids),
        )],
        operation_events: operationEvents,
      };
    } else {
      result.push(event);
    }
  }
  return result;
}

function checklistOperationEvents(
  event: StoredChecklistHistoryEvent,
): StoredChecklistHistoryEvent[] {
  return event.operation_events ?? [event];
}

function checklistTaskId(event: StoredChecklistHistoryEvent): string | null {
  return snapshot(event.after_state)?.task_id
    ?? snapshot(event.before_state)?.task_id
    ?? null;
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
