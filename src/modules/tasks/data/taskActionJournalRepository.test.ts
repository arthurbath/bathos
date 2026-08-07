import { describe, expect, it } from 'vitest';
import type { AbstractPowerSyncDatabase } from '@powersync/web';

import { TaskActionJournalRepository } from './taskActionJournalRepository';
import {
  TASK_ACTION_JOURNAL_LIMIT,
  type TaskActionJournalChange,
  type TaskActionJournalStorageRow,
} from '@/modules/tasks/domain/taskActionJournal';

describe('TaskActionJournalRepository', () => {
  it('retains one local chronological cursor and invalidates redo on a new action', async () => {
    const database = createJournalDatabase();
    let id = 0;
    const repository = new TaskActionJournalRepository(
      database,
      () => new Date('2026-08-06T20:00:00.000Z'),
      () => `journal-${++id}`,
    );

    const first = await repository.append(
      'owner-a',
      'action-a',
      '2026-08-06T19:59:00.000Z',
      [change('task-a', 'Before A', 'After A')],
    );
    const second = await repository.append(
      'owner-a',
      'action-b',
      '2026-08-06T20:00:00.000Z',
      [change('task-b', 'Before B', 'After B')],
    );
    expect(first?.sequence).toBe(1);
    expect(second?.sequence).toBe(2);
    await repository.mark(second!, 'undo');
    expect((await repository.next('owner-a', 'redo'))?.id).toBe(second?.id);

    await repository.append(
      'owner-a',
      'action-c',
      '2026-08-06T20:01:00.000Z',
      [change('task-c', 'Before C', 'After C')],
    );

    expect(await repository.next('owner-a', 'redo')).toBeNull();
    expect((await repository.next('owner-a', 'undo'))?.action_id).toBe('action-c');
  });

  it('does not append a semantic no-op', async () => {
    const database = createJournalDatabase();
    const repository = new TaskActionJournalRepository(database);
    const snapshot = taskSnapshot('Same');

    await expect(repository.append(
      'owner-a',
      'action-a',
      new Date().toISOString(),
      [{ entityType: 'task', entityId: 'task-a', before: snapshot, after: snapshot }],
    )).resolves.toBeNull();
    expect(database.rows).toHaveLength(0);
  });

  it('reconstructs the cursor from the persisted local database after a repository relaunch', async () => {
    const database = createJournalDatabase();
    const firstRepository = new TaskActionJournalRepository(
      database,
      () => new Date('2026-08-06T20:00:00.000Z'),
      () => 'journal-a',
    );
    await firstRepository.append(
      'owner-a',
      'action-a',
      '2026-08-06T19:59:00.000Z',
      [change('task-a', 'Before', 'After')],
    );

    const relaunchedRepository = new TaskActionJournalRepository(
      database,
      () => new Date('2026-08-06T20:01:00.000Z'),
    );
    expect((await relaunchedRepository.next('owner-a', 'undo'))?.action_id).toBe('action-a');
  });

  it('expires actions after thirty minutes and retains only the newest one hundred', async () => {
    const database = createJournalDatabase();
    let now = new Date('2026-08-06T20:00:00.000Z');
    let id = 0;
    const repository = new TaskActionJournalRepository(
      database,
      () => now,
      () => `journal-${++id}`,
    );

    for (let index = 0; index < TASK_ACTION_JOURNAL_LIMIT + 5; index += 1) {
      await repository.append(
        'owner-a',
        `action-${index}`,
        new Date(now.getTime() + index).toISOString(),
        [change(`task-${index}`, `Before ${index}`, `After ${index}`)],
      );
    }

    expect(database.rows).toHaveLength(TASK_ACTION_JOURNAL_LIMIT);
    expect(database.rows[0]?.action_id).toBe('action-5');
    expect((await repository.next('owner-a', 'undo'))?.action_id).toBe('action-104');

    now = new Date('2026-08-06T20:30:00.001Z');
    expect(await repository.next('owner-a', 'undo')).toBeNull();
  });
});

function change(
  entityId: string,
  beforeTitle: string,
  afterTitle: string,
): TaskActionJournalChange {
  return {
    entityType: 'task',
    entityId,
    before: taskSnapshot(beforeTitle),
    after: taskSnapshot(afterTitle),
  };
}

function taskSnapshot(title: string) {
  return {
    title,
    actionability: 'actionable' as const,
    notes: '',
    lifecycle: 'open' as const,
    completed_at: null,
    canceled_at: null,
    disposition: 'present' as const,
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime' as const,
    today_section: 'inbox' as const,
    order_key: 'a0',
    area_id: null,
    hierarchy_order_key: null,
    start_date: null,
    deadline: null,
    primary_link: null,
    source_kind: null,
    source_url: null,
    source_title: null,
    source_external_id: null,
  };
}

function createJournalDatabase() {
  const rows: TaskActionJournalStorageRow[] = [];
  const transaction = {
    execute: async (sql: string, params: unknown[]) => {
      if (sql.startsWith('INSERT INTO tasks_action_journal')) {
        rows.push({
          id: params[0] as string,
          owner_id: params[1] as string,
          sequence: params[2] as number,
          action_id: params[3] as string,
          occurred_at: params[4] as string,
          expires_at: params[5] as string,
          state: params[6] as 'applied' | 'undone',
          snapshot_version: params[7] as number,
          changes: params[8] as string,
        });
      } else if (sql.includes("expires_at <= ? OR state = ?")) {
        const [ownerId, expiresAt, state] = params as [string, string, string];
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (rows[index].owner_id === ownerId
            && (rows[index].expires_at <= expiresAt || rows[index].state === state)) {
            rows.splice(index, 1);
          }
        }
      } else if (sql.includes('id NOT IN')) {
        const ownerId = params[0] as string;
        const retainedIds = new Set(rows
          .filter((candidate) => candidate.owner_id === ownerId)
          .sort((left, right) => right.sequence - left.sequence)
          .slice(0, TASK_ACTION_JOURNAL_LIMIT)
          .map(({ id }) => id));
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (rows[index].owner_id === ownerId && !retainedIds.has(rows[index].id)) {
            rows.splice(index, 1);
          }
        }
      } else if (sql.startsWith('UPDATE tasks_action_journal SET state')) {
        const [state, id, ownerId, expectedState] = params as [
          'applied' | 'undone', string, string, 'applied' | 'undone',
        ];
        const row = rows.find((candidate) => candidate.id === id
          && candidate.owner_id === ownerId
          && candidate.state === expectedState);
        if (row) {
          row.state = state;
          return { rowsAffected: 1 };
        }
        return { rowsAffected: 0 };
      }
      return { rowsAffected: 1 };
    },
    getOptional: async <T,>(sql: string, params: unknown[]): Promise<T | null> => {
      if (sql.includes('SELECT sequence')) {
        const ownerId = params[0];
        const row = rows.filter((candidate) => candidate.owner_id === ownerId)
          .sort((left, right) => right.sequence - left.sequence)[0];
        return (row ? { sequence: row.sequence } : null) as T | null;
      }
      return null;
    },
  };
  return {
    rows,
    writeTransaction: async <T,>(callback: (value: typeof transaction) => Promise<T>) => (
      callback(transaction)
    ),
    getOptional: async <T,>(sql: string, params: unknown[]): Promise<T | null> => {
      const [ownerId, now] = params as [string, string];
      const candidates = rows.filter((row) => row.owner_id === ownerId
        && row.expires_at > now
        && row.state === (sql.includes("state = 'applied'") ? 'applied' : 'undone'));
      candidates.sort((left, right) => sql.includes('DESC')
        ? right.sequence - left.sequence
        : left.sequence - right.sequence);
      return (candidates[0] ?? null) as T | null;
    },
  } as unknown as Pick<AbstractPowerSyncDatabase, 'writeTransaction' | 'getOptional'> & {
    rows: TaskActionJournalStorageRow[];
  };
}
