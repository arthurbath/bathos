import type { Transaction } from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import {
  TASK_SYNC_HEALTH_EVENT_RETENTION,
  TaskSyncHealthEventStore,
  type TaskSyncHealthEventStorageRow,
  type TaskSyncHealthEventStoreDatabase,
} from './taskSyncHealthEventStore';

function createHarness(initialRows: TaskSyncHealthEventStorageRow[] = []) {
  const rows = initialRows.map((row) => ({ ...row }));
  const transaction = {
    getAll: vi.fn(async () => rows
      .filter(({ resolved_at }) => resolved_at === null)
      .sort(compareRows)),
    getOptional: vi.fn(async (_sql: string, parameters: unknown[] = []) => rows
      .filter(({ resolved_at, state }) => (
        resolved_at === null && (parameters.length === 0 || state === parameters[0])
      ))
      .sort(compareRows)[0] ?? null),
    execute: vi.fn(async (sql: string, parameters: unknown[] = []) => {
      if (sql.includes('INSERT INTO tasks_sync_health_events')) {
        rows.push({
          id: String(parameters[0]),
          state: String(parameters[1]),
          started_at: String(parameters[2]),
          resolved_at: null,
          pending_upload_bucket: String(parameters[3]),
          had_completed_sync: Number(parameters[4]),
          last_successful_sync_at: parameters[5] === null ? null : String(parameters[5]),
          reported_at: null,
        });
      } else if (sql.includes('SET reported_at')) {
        const row = rows.find(({ id }) => id === parameters[1]);
        if (row && row.resolved_at === null && row.reported_at === null) {
          row.reported_at = String(parameters[0]);
        }
      } else if (sql.includes('SET resolved_at') && sql.includes('id <>')) {
        for (const row of rows) {
          if (row.resolved_at === null && row.id !== parameters[1]) {
            row.resolved_at = String(parameters[0]);
          }
        }
      } else if (sql.includes('SET resolved_at')) {
        for (const row of rows) {
          if (row.resolved_at === null) row.resolved_at = String(parameters[0]);
        }
      } else if (sql.includes('DELETE FROM tasks_sync_health_events')) {
        const retained = rows.slice().sort(compareRows).slice(0, TASK_SYNC_HEALTH_EVENT_RETENTION);
        const ids = new Set(retained.map(({ id }) => id));
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (!ids.has(rows[index].id)) rows.splice(index, 1);
        }
      }
      return { rowsAffected: 1 };
    }),
  } as unknown as Transaction;
  let tail: Promise<unknown> = Promise.resolve();
  const database = {
    writeTransaction: vi.fn(<T>(callback: (value: Transaction) => Promise<T>) => {
      const result = tail.then(() => callback(transaction));
      tail = result.then(() => undefined, () => undefined);
      return result;
    }),
  } as unknown as TaskSyncHealthEventStoreDatabase;
  return { database, rows };
}

function compareRows(left: TaskSyncHealthEventStorageRow, right: TaskSyncHealthEventStorageRow) {
  return right.started_at.localeCompare(left.started_at) || right.id.localeCompare(left.id);
}

function reconciliationInput(
  state: 'offline' | 'download-error' | 'healthy',
  observedAt: string,
) {
  return {
    state,
    pendingUploadCount: 3,
    hasCompletedSync: true,
    lastSuccessfulSyncAt: '2026-07-21T15:00:00.000Z',
    observedAt,
  } as const;
}

describe('TaskSyncHealthEventStore', () => {
  it('serializes concurrent observers into one open content-free episode', async () => {
    const harness = createHarness();
    const first = new TaskSyncHealthEventStore(harness.database, { createId: () => 'health-a' });
    const second = new TaskSyncHealthEventStore(harness.database, { createId: () => 'health-b' });

    const results = await Promise.all([
      first.reconcile(reconciliationInput('offline', '2026-07-21T15:01:00.000Z')),
      second.reconcile(reconciliationInput('offline', '2026-07-21T15:01:00.000Z')),
    ]);

    expect(harness.rows).toHaveLength(1);
    expect(harness.rows[0]).toEqual({
      id: 'health-a',
      state: 'offline',
      started_at: '2026-07-21T15:01:00.000Z',
      resolved_at: null,
      pending_upload_bucket: '2-9',
      had_completed_sync: 1,
      last_successful_sync_at: '2026-07-21T15:00:00.000Z',
      reported_at: null,
    });
    expect(results[1].openEvent?.id).toBe('health-a');
    expect(JSON.stringify(harness.rows)).not.toContain('title');
    expect(JSON.stringify(harness.rows)).not.toContain('owner');
  });

  it('closes a changed category and closes the final episode on recovery', async () => {
    const harness = createHarness();
    const ids = ['health-a', 'health-b'];
    const store = new TaskSyncHealthEventStore(harness.database, {
      createId: () => ids.shift() ?? 'unexpected',
    });

    await store.reconcile(reconciliationInput('offline', '2026-07-21T15:01:00.000Z'));
    const changed = await store.reconcile(
      reconciliationInput('download-error', '2026-07-21T15:03:00.000Z'),
    );
    const recovered = await store.reconcile(
      reconciliationInput('healthy', '2026-07-21T15:05:00.000Z'),
    );

    expect(changed.resolvedEvent).toMatchObject({ id: 'health-a', state: 'offline' });
    expect(changed.openEvent).toMatchObject({ id: 'health-b', state: 'download-error' });
    expect(recovered.resolvedEvent).toMatchObject({ id: 'health-b' });
    expect(harness.rows.every(({ resolved_at }) => resolved_at !== null)).toBe(true);
  });

  it('captures a due warning once across concurrent observers', async () => {
    const harness = createHarness();
    const first = new TaskSyncHealthEventStore(harness.database, { createId: () => 'health-a' });
    const second = new TaskSyncHealthEventStore(harness.database, { createId: () => 'health-b' });
    await first.reconcile(reconciliationInput('offline', '2026-07-21T15:00:00.000Z'));
    const capture = vi.fn(() => 'sentry-event');

    const results = await Promise.all([
      first.reportCurrentIfDue({
        state: 'offline', observedAt: '2026-07-21T15:02:00.000Z', capture,
      }),
      second.reportCurrentIfDue({
        state: 'offline', observedAt: '2026-07-21T15:02:00.000Z', capture,
      }),
    ]);

    expect(capture).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({
      durationBucket: '2-4m',
      event: expect.objectContaining({ state: 'offline', pendingUploadBucket: '2-9' }),
    }));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(harness.rows[0].reported_at).toBe('2026-07-21T15:02:00.000Z');
  });

  it('does not mark an episode reported before the threshold or without an event identifier', async () => {
    const harness = createHarness();
    const store = new TaskSyncHealthEventStore(harness.database, { createId: () => 'health-a' });
    await store.reconcile(reconciliationInput('offline', '2026-07-21T15:00:00.000Z'));
    const capture = vi.fn(() => null);

    await store.reportCurrentIfDue({
      state: 'offline', observedAt: '2026-07-21T15:01:59.999Z', capture,
    });
    await store.reportCurrentIfDue({
      state: 'offline', observedAt: '2026-07-21T15:02:00.000Z', capture,
    });

    expect(capture).toHaveBeenCalledOnce();
    expect(harness.rows[0].reported_at).toBeNull();
  });

  it('retains only the 50 most recent episodes', async () => {
    const harness = createHarness();
    let id = 0;
    const store = new TaskSyncHealthEventStore(harness.database, {
      createId: () => `health-${String(id += 1).padStart(2, '0')}`,
    });

    for (let minute = 0; minute < 55; minute += 1) {
      const startedAt = new Date(Date.UTC(2026, 6, 21, 15, minute)).toISOString();
      const resolvedAt = new Date(Date.UTC(2026, 6, 21, 15, minute, 30)).toISOString();
      await store.reconcile(reconciliationInput('offline', startedAt));
      await store.reconcile(reconciliationInput('healthy', resolvedAt));
    }

    expect(harness.rows).toHaveLength(TASK_SYNC_HEALTH_EVENT_RETENTION);
    expect(harness.rows.some(({ id: rowId }) => rowId === 'health-01')).toBe(false);
    expect(harness.rows.some(({ id: rowId }) => rowId === 'health-55')).toBe(true);
  });
});
