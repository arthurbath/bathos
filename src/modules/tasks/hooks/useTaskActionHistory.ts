import { useQuery } from '@powersync/react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { TaskActionJournalRepository } from '@/modules/tasks/data/taskActionJournalRepository';
import {
  checklistJournalSnapshot,
  checklistJournalSnapshotsEqual,
  parseTaskActionJournalEntry,
  taskJournalSnapshot,
  taskJournalSnapshotsEqual,
  type TaskActionJournalChange,
  type TaskActionJournalEntry,
  type TaskActionJournalStorageRow,
  type TaskChecklistHistorySnapshot,
} from '@/modules/tasks/domain/taskActionJournal';
import {
  UnsafeTaskRedoError,
  UnsafeTaskUndoError,
  type TaskHistorySnapshot,
} from '@/modules/tasks/domain/taskHistory';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type { TaskChecklistItem, TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskForwardMutationSource = TaskTodo;

export type TaskForwardMutationReservation = {
  commit: (task: TaskTodo) => void;
  cancel: () => void;
};

export type TaskForwardMutationGroupReservation = {
  commit: (tasks: readonly TaskTodo[]) => void;
  cancel: () => void;
};

export class TaskActionReplayRollbackError extends Error {
  constructor(readonly replayError: unknown, readonly rollbackError: unknown) {
    super('The task action failed and its partial replay could not be rolled back');
    this.name = 'TaskActionReplayRollbackError';
  }
}

type PreparedTaskActionChange =
  | {
      entityType: 'task';
      change: Extract<TaskActionJournalChange, { entityType: 'task' }>;
      expected: TaskHistorySnapshot | null;
      target: TaskHistorySnapshot | null;
    }
  | {
      entityType: 'checklist_item';
      change: Extract<TaskActionJournalChange, { entityType: 'checklist_item' }>;
      expected: TaskChecklistHistorySnapshot | null;
      target: TaskChecklistHistorySnapshot | null;
    };

type PendingJournalAction = {
  actionId: string;
  occurredAt: string;
  changes: readonly TaskActionJournalChange[];
};

const journalQuery = `
  SELECT * FROM tasks_action_journal
  WHERE owner_id = ? AND expires_at > ?
  ORDER BY sequence
`;

export function useTaskActionHistory(ownerId: string) {
  const {
    database,
    repository,
    hierarchyRepository,
    hierarchyOperationsRepository,
  } = useTasksRuntime();
  const journal = useMemo(
    () => new TaskActionJournalRepository(database),
    [database],
  );
  const now = new Date().toISOString();
  const query = useQuery<TaskActionJournalStorageRow>(journalQuery, [ownerId, now]);
  const parsedJournal = useMemo(() => {
    try {
      return {
        entries: query.data.map(parseTaskActionJournalEntry),
        error: null as Error | null,
      };
    } catch (error) {
      return {
        entries: [] as TaskActionJournalEntry[],
        error: error instanceof Error ? error : new Error('Task action history is invalid'),
      };
    }
  }, [query.data]);
  const entries = parsedJournal.entries;
  const appendChainRef = useRef<Promise<void>>(Promise.resolve());
  const appendErrorRef = useRef<unknown>(null);
  const queuedReservationIdsRef = useRef(new Set<string>());
  const journalActionIdsRef = useRef(new Set<string>());
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [pendingAppendCount, setPendingAppendCount] = useState(0);

  const queuePendingAction = useCallback((
    reservationId: string,
    settled: Promise<PendingJournalAction | null>,
  ) => {
    if (queuedReservationIdsRef.current.has(reservationId)) return;
    queuedReservationIdsRef.current.add(reservationId);
    setPendingAppendCount((count) => count + 1);
    const append = appendChainRef.current.then(async () => {
      const action = await settled;
      if (action === null) return;
      if (journalActionIdsRef.current.has(action.actionId)) return;
      journalActionIdsRef.current.add(action.actionId);
      try {
        await journal.append(
          ownerId,
          action.actionId,
          action.occurredAt,
          action.changes,
        );
      } catch (error) {
        journalActionIdsRef.current.delete(action.actionId);
        throw error;
      }
      appendErrorRef.current = null;
      await query.refresh?.().catch(() => undefined);
    });
    appendChainRef.current = append.catch((error) => {
      appendErrorRef.current = error;
      queuedReservationIdsRef.current.delete(reservationId);
    }).finally(() => {
      setPendingAppendCount((count) => Math.max(0, count - 1));
    });
  }, [journal, ownerId, query]);

  const queueAction = useCallback((
    actionId: string,
    occurredAt: string,
    changes: readonly TaskActionJournalChange[],
  ) => {
    queuePendingAction(
      `action:${actionId}`,
      Promise.resolve({ actionId, occurredAt, changes }),
    );
  }, [queuePendingAction]);

  const reserveForwardMutation = useCallback((
    before: TaskForwardMutationSource,
  ): TaskForwardMutationReservation => {
    const reservationId = `task:${globalThis.crypto.randomUUID()}`;
    const deferred = createDeferred<PendingJournalAction | null>();
    queuePendingAction(reservationId, deferred.promise);
    let settled = false;
    return {
      commit(after) {
        if (settled) return;
        settled = true;
        if (after.id !== before.id) {
          deferred.resolve(null);
          return;
        }
        deferred.resolve({
          actionId: after.last_operation_id ?? after.client_mutation_id,
          occurredAt: after.updated_at,
          changes: [{
            entityType: 'task',
            entityId: after.id,
            before: taskJournalSnapshot(before),
            after: taskJournalSnapshot(after),
          }],
        });
      },
      cancel() {
        if (settled) return;
        settled = true;
        deferred.resolve(null);
      },
    };
  }, [queuePendingAction]);

  const registerForwardMutation = useCallback((task: TaskTodo) => {
    queueAction(
      task.last_operation_id ?? task.client_mutation_id,
      task.updated_at,
      [{
        entityType: 'task',
        entityId: task.id,
        before: null,
        after: taskJournalSnapshot(task),
      }],
    );
  }, [queueAction]);

  const registerForwardMutations = useCallback((tasks: readonly TaskTodo[]) => {
    if (tasks.length === 0) return;
    const sourceActionIds = new Set(tasks.map((task) => (
      task.last_operation_id ?? task.client_mutation_id
    )));
    const occurredAt = tasks.reduce(
      (latest, task) => task.updated_at > latest ? task.updated_at : latest,
      tasks[0].updated_at,
    );
    queueAction(
      sourceActionIds.size === 1
        ? sourceActionIds.values().next().value ?? globalThis.crypto.randomUUID()
        : globalThis.crypto.randomUUID(),
      occurredAt,
      tasks.map((task) => ({
        entityType: 'task' as const,
        entityId: task.id,
        before: null,
        after: taskJournalSnapshot(task),
      })),
    );
  }, [queueAction]);

  const reserveForwardMutations = useCallback((
    beforeTasks: readonly TaskTodo[],
  ): TaskForwardMutationGroupReservation => {
    const beforeById = new Map(beforeTasks.map((task) => [task.id, task]));
    const reservationId = `task-group:${globalThis.crypto.randomUUID()}`;
    const deferred = createDeferred<PendingJournalAction | null>();
    queuePendingAction(reservationId, deferred.promise);
    let settled = false;
    return {
      commit(afterTasks) {
        if (settled) return;
        settled = true;
        const changes = afterTasks.flatMap((after) => {
          const before = beforeById.get(after.id);
          return before ? [{
            entityType: 'task' as const,
            entityId: after.id,
            before: taskJournalSnapshot(before),
            after: taskJournalSnapshot(after),
          }] : [];
        });
        if (changes.length === 0) {
          deferred.resolve(null);
          return;
        }
        const occurredAt = afterTasks.reduce(
          (latest, task) => task.updated_at > latest ? task.updated_at : latest,
          afterTasks[0]?.updated_at ?? new Date().toISOString(),
        );
        deferred.resolve({
          actionId: globalThis.crypto.randomUUID(),
          occurredAt,
          changes,
        });
      },
      cancel() {
        if (settled) return;
        settled = true;
        deferred.resolve(null);
      },
    };
  }, [queuePendingAction]);

  const registerChecklistForwardAction = useCallback((input: {
    actionId: string;
    occurredAt: string;
    settled: Promise<readonly TaskActionJournalChange[] | null>;
  }) => {
    queuePendingAction(
      `checklist:${input.actionId}`,
      input.settled.then((changes) => changes === null ? null : {
        actionId: input.actionId,
        occurredAt: input.occurredAt,
        changes,
      }),
    );
  }, [queuePendingAction]);

  const apply = useCallback(async (
    entry: TaskActionJournalEntry,
    direction: 'undo' | 'redo',
  ) => {
    const changes = direction === 'undo' ? [...entry.changes].reverse() : entry.changes;
    const prepared: PreparedTaskActionChange[] = [];
    for (const change of changes) {
      if (change.entityType === 'task') {
        const expected = direction === 'undo' ? change.after : change.before;
        const target = direction === 'undo' ? change.before : change.after;
        const current = await database.getOptional<TaskTodo>(
          'SELECT * FROM tasks_todos WHERE id = ? AND owner_id = ?',
          [change.entityId, ownerId],
        );
        const currentSnapshot = current === null
          || (expected === null && current.disposition === 'deleted')
          ? null
          : taskJournalSnapshot(current);
        if (!taskJournalSnapshotsEqual(currentSnapshot, expected)) {
          throw unsafe(direction, 'The task changed after the recorded action');
        }
        prepared.push({ entityType: 'task', change, expected, target });
        continue;
      }

      const expected = direction === 'undo' ? change.after : change.before;
      const target = direction === 'undo' ? change.before : change.after;
      const current = await database.getOptional<TaskChecklistItem>(
        'SELECT * FROM tasks_checklist_items WHERE id = ? AND owner_id = ?',
        [change.entityId, ownerId],
      );
      const currentSnapshot = current === null
        || (expected === null && current.disposition === 'deleted')
        ? null
        : checklistJournalSnapshot(current);
      if (!checklistJournalSnapshotsEqual(currentSnapshot, expected)) {
        throw unsafe(direction, 'The checklist item changed after the recorded action');
      }
      prepared.push({ entityType: 'checklist_item', change, expected, target });
    }

    const applied: typeof prepared = [];
    try {
      for (const preparedChange of prepared) {
        await applyPreparedChange(
          preparedChange,
          `${direction}-${entry.action_id}`,
        );
        applied.push(preparedChange);
      }
    } catch (error) {
      try {
        for (const preparedChange of [...applied].reverse()) {
          await applyPreparedChange(
            invertPreparedTaskActionChange(preparedChange),
            `rollback-${direction}-${entry.action_id}`,
          );
        }
      } catch (rollbackError) {
        throw new TaskActionReplayRollbackError(error, rollbackError);
      }
      throw error;
    }
    await journal.mark(entry, direction);
    await query.refresh?.().catch(() => undefined);
    return entry;

    async function applyPreparedChange(input: PreparedTaskActionChange, operationId: string) {
      const { change } = input;
      const context = { operationId, occurredAt: new Date().toISOString() };
      if (input.entityType === 'task') {
        const { expected, target } = input;
        if (target === null) {
          await hierarchyOperationsRepository.request({
            ownerId,
            rootType: 'todo',
            rootId: change.entityId,
            operation: 'delete',
            descendantPolicy: 'cascade',
            context,
          });
        } else if (expected === null) {
          await hierarchyOperationsRepository.request({
            ownerId,
            rootType: 'todo',
            rootId: change.entityId,
            operation: 'restore',
            descendantPolicy: 'cascade',
            context,
          });
        } else {
          await repository.replayTaskSnapshot(
            ownerId,
            change.entityId,
            expected,
            target,
            context,
          );
        }
        return;
      }
      const { expected, target } = input;
      if (target === null) {
        await hierarchyOperationsRepository.request({
          ownerId,
          rootType: 'checklist_item',
          rootId: change.entityId,
          operation: 'delete',
          descendantPolicy: 'reject',
          context,
        });
      } else if (expected === null) {
        await hierarchyOperationsRepository.request({
          ownerId,
          rootType: 'checklist_item',
          rootId: change.entityId,
          operation: 'restore',
          descendantPolicy: 'reject',
          context,
        });
      } else {
        await hierarchyRepository.replayChecklistItemSnapshot(
          ownerId,
          change.entityId,
          expected,
          target,
          context,
        );
      }
    }
  }, [
    database,
    hierarchyOperationsRepository,
    hierarchyRepository,
    journal,
    ownerId,
    query,
    repository,
  ]);

  const move = useCallback(async (direction: 'undo' | 'redo') => {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    setPending(true);
    try {
      await appendChainRef.current;
      if (appendErrorRef.current) throw appendErrorRef.current;
      const entry = await journal.next(ownerId, direction);
      if (entry === null) return null;
      return await apply(entry, direction);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [apply, journal, ownerId]);

  const undoEntries = entries.filter(({ state }) => state === 'applied');
  const redoEntries = entries.filter(({ state }) => state === 'undone');
  return {
    available: (pendingAppendCount > 0 || undoEntries.length > 0) && !pending,
    redoAvailable: pendingAppendCount === 0 && redoEntries.length > 0 && !pending,
    pending,
    loading: query.isLoading,
    error: query.error ?? parsedJournal.error,
    event: undoEntries.at(-1) ?? null,
    redoEvent: redoEntries[0] ?? null,
    undoDepth: undoEntries.length,
    redoDepth: redoEntries.length,
    forwardMutationPending: pendingAppendCount > 0,
    undoWhenAvailable: () => move('undo'),
    redoWhenAvailable: () => move('redo'),
    undo: () => move('undo'),
    redo: () => move('redo'),
    reserveForwardMutation,
    reserveForwardMutations,
    registerForwardMutation,
    registerForwardMutations,
    registerChecklistForwardAction,
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function invertPreparedTaskActionChange(
  input: PreparedTaskActionChange,
): PreparedTaskActionChange {
  if (input.entityType === 'task') {
    return {
      entityType: 'task',
      change: input.change,
      expected: input.target,
      target: input.expected,
    };
  }
  return {
    entityType: 'checklist_item',
    change: input.change,
    expected: input.target,
    target: input.expected,
  };
}

function unsafe(direction: 'undo' | 'redo', message: string) {
  return direction === 'undo'
    ? new UnsafeTaskUndoError(message)
    : new UnsafeTaskRedoError(message);
}
