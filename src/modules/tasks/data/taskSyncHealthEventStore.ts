import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/web';

import {
  bucketTaskSyncDuration,
  bucketTaskSyncQueueCount,
  isTaskSyncDegradationState,
  type TaskSyncDegradationState,
  type TaskSyncDurationBucket,
  type TaskSyncHealthState,
  type TaskSyncQueueCountBucket,
} from '@/modules/tasks/domain/taskSyncReliability';

export const TASK_SYNC_HEALTH_EVENT_RETENTION = 50;
export const TASK_SYNC_DEGRADATION_REPORT_DELAY_MS = 2 * 60_000;

export type TaskSyncHealthEventStorageRow = {
  id: string;
  state: string;
  started_at: string;
  resolved_at: string | null;
  pending_upload_bucket: string;
  had_completed_sync: number;
  last_successful_sync_at: string | null;
  reported_at: string | null;
};

export type TaskSyncHealthEvent = {
  id: string;
  state: TaskSyncDegradationState;
  startedAt: string;
  resolvedAt: string | null;
  pendingUploadBucket: TaskSyncQueueCountBucket;
  hadCompletedSync: boolean;
  lastSuccessfulSyncAt: string | null;
  reportedAt: string | null;
};

export type TaskSyncHealthReconciliation = {
  openEvent: TaskSyncHealthEvent | null;
  resolvedEvent: TaskSyncHealthEvent | null;
};

export type TaskSyncHealthReport = {
  event: TaskSyncHealthEvent;
  durationBucket: TaskSyncDurationBucket;
};

export type TaskSyncHealthEventStoreDatabase = Pick<
  AbstractPowerSyncDatabase,
  'writeTransaction'
>;

export class TaskSyncHealthEventStore {
  private readonly createId: () => string;

  constructor(
    private readonly database: TaskSyncHealthEventStoreDatabase,
    options: { createId?: () => string } = {},
  ) {
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  reconcile(input: {
    state: TaskSyncHealthState;
    pendingUploadCount: number;
    hasCompletedSync: boolean;
    lastSuccessfulSyncAt: string | null;
    observedAt: string;
  }): Promise<TaskSyncHealthReconciliation> {
    assertIsoTimestamp(input.observedAt);
    if (input.lastSuccessfulSyncAt !== null) assertIsoTimestamp(input.lastSuccessfulSyncAt);

    return this.database.writeTransaction(async (transaction) => {
      const openRows = await transaction.getAll<TaskSyncHealthEventStorageRow>(
        `${selectTaskSyncHealthEvents}
         WHERE resolved_at IS NULL
         ORDER BY started_at DESC, id DESC`,
      );
      const openEvents = openRows.map(parseTaskSyncHealthEvent);

      if (!isTaskSyncDegradationState(input.state)) {
        if (openEvents.length === 0) {
          await trimTaskSyncHealthEvents(transaction);
          return { openEvent: null, resolvedEvent: null };
        }
        await resolveAllOpenEvents(transaction, input.observedAt);
        await trimTaskSyncHealthEvents(transaction);
        return {
          openEvent: null,
          resolvedEvent: { ...openEvents[0], resolvedAt: input.observedAt },
        };
      }

      const current = openEvents[0] ?? null;
      if (current?.state === input.state) {
        if (openEvents.length > 1) {
          await transaction.execute(
            `UPDATE tasks_sync_health_events
             SET resolved_at = ?
             WHERE resolved_at IS NULL AND id <> ?`,
            [input.observedAt, current.id],
          );
        }
        await trimTaskSyncHealthEvents(transaction);
        return { openEvent: current, resolvedEvent: null };
      }

      const resolvedEvent = openEvents.length > 0
        ? { ...openEvents[0], resolvedAt: input.observedAt }
        : null;
      if (openEvents.length > 0) {
        await resolveAllOpenEvents(transaction, input.observedAt);
      }

      const event: TaskSyncHealthEvent = {
        id: this.createId(),
        state: input.state,
        startedAt: input.observedAt,
        resolvedAt: null,
        pendingUploadBucket: bucketTaskSyncQueueCount(input.pendingUploadCount),
        hadCompletedSync: input.hasCompletedSync,
        lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
        reportedAt: null,
      };
      await transaction.execute(
        `INSERT INTO tasks_sync_health_events (
          id, state, started_at, resolved_at, pending_upload_bucket,
          had_completed_sync, last_successful_sync_at, reported_at
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL)`,
        [
          event.id,
          event.state,
          event.startedAt,
          event.pendingUploadBucket,
          event.hadCompletedSync ? 1 : 0,
          event.lastSuccessfulSyncAt,
        ],
      );
      await trimTaskSyncHealthEvents(transaction);
      return { openEvent: event, resolvedEvent };
    });
  }

  reportCurrentIfDue(input: {
    state: TaskSyncHealthState;
    observedAt: string;
    capture: (report: TaskSyncHealthReport) => string | null;
  }): Promise<TaskSyncHealthEvent | null> {
    assertIsoTimestamp(input.observedAt);
    if (!isTaskSyncDegradationState(input.state)) return Promise.resolve(null);

    return this.database.writeTransaction(async (transaction) => {
      const row = await transaction.getOptional<TaskSyncHealthEventStorageRow>(
        `${selectTaskSyncHealthEvents}
         WHERE resolved_at IS NULL
         ORDER BY started_at DESC, id DESC
         LIMIT 1`,
      );
      if (row === null) return null;

      const event = parseTaskSyncHealthEvent(row);
      if (event.state !== input.state) return null;
      const durationMs = Date.parse(input.observedAt) - Date.parse(event.startedAt);
      if (
        event.reportedAt !== null
        || durationMs < TASK_SYNC_DEGRADATION_REPORT_DELAY_MS
      ) {
        return null;
      }

      const eventId = input.capture({
        event,
        durationBucket: bucketTaskSyncDuration(durationMs),
      });
      if (typeof eventId !== 'string' || eventId.length === 0) return null;

      await transaction.execute(
        `UPDATE tasks_sync_health_events
         SET reported_at = ?
         WHERE id = ? AND resolved_at IS NULL AND reported_at IS NULL`,
        [input.observedAt, event.id],
      );
      return { ...event, reportedAt: input.observedAt };
    });
  }
}

export function parseTaskSyncHealthEvent(
  row: TaskSyncHealthEventStorageRow,
): TaskSyncHealthEvent {
  const state = row.state as TaskSyncHealthState;
  if (!isTaskSyncDegradationState(state)) {
    throw new Error('Expected a bounded synchronization degradation state');
  }
  if (!isTaskSyncQueueCountBucket(row.pending_upload_bucket)) {
    throw new Error('Expected a bounded pending-upload bucket');
  }
  if (row.had_completed_sync !== 0 && row.had_completed_sync !== 1) {
    throw new Error('Expected a synchronization completion boolean');
  }

  return {
    id: requireText(row.id),
    state,
    startedAt: requireIsoTimestamp(row.started_at),
    resolvedAt: optionalIsoTimestamp(row.resolved_at),
    pendingUploadBucket: row.pending_upload_bucket,
    hadCompletedSync: row.had_completed_sync === 1,
    lastSuccessfulSyncAt: optionalIsoTimestamp(row.last_successful_sync_at),
    reportedAt: optionalIsoTimestamp(row.reported_at),
  };
}

const selectTaskSyncHealthEvents = `
  SELECT id, state, started_at, resolved_at, pending_upload_bucket,
         had_completed_sync, last_successful_sync_at, reported_at
  FROM tasks_sync_health_events`;

async function resolveAllOpenEvents(transaction: Transaction, resolvedAt: string) {
  await transaction.execute(
    `UPDATE tasks_sync_health_events
     SET resolved_at = ?
     WHERE resolved_at IS NULL`,
    [resolvedAt],
  );
}

async function trimTaskSyncHealthEvents(transaction: Transaction) {
  await transaction.execute(
    `DELETE FROM tasks_sync_health_events
     WHERE id IN (
       SELECT id
       FROM tasks_sync_health_events
       ORDER BY started_at DESC, id DESC
       LIMIT -1 OFFSET ${TASK_SYNC_HEALTH_EVENT_RETENTION}
     )`,
  );
}

function isTaskSyncQueueCountBucket(value: string): value is TaskSyncQueueCountBucket {
  return value === '0' || value === '1' || value === '2-9'
    || value === '10-49' || value === '50+';
}

function requireText(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Expected nonempty text');
  }
  return value;
}

function assertIsoTimestamp(value: string) {
  requireIsoTimestamp(value);
}

function requireIsoTimestamp(value: unknown): string {
  const timestamp = requireText(value);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error('Expected an ISO timestamp');
  }
  return timestamp;
}

function optionalIsoTimestamp(value: unknown): string | null {
  return value === null ? null : requireIsoTimestamp(value);
}
