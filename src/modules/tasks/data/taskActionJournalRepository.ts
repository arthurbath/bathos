import type { AbstractPowerSyncDatabase } from '@powersync/web';

import {
  TASK_ACTION_JOURNAL_LIMIT,
  TASK_ACTION_JOURNAL_RETENTION_MS,
  TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
  parseTaskActionJournalEntry,
  type TaskActionJournalChange,
  type TaskActionJournalEntry,
  type TaskActionJournalStorageRow,
} from '@/modules/tasks/domain/taskActionJournal';

export class TaskActionJournalRepository {
  constructor(
    private readonly database: Pick<
      AbstractPowerSyncDatabase,
      'writeTransaction' | 'getOptional'
    >,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => globalThis.crypto.randomUUID(),
  ) {}

  async append(
    ownerId: string,
    actionId: string,
    occurredAt: string,
    changes: readonly TaskActionJournalChange[],
  ): Promise<TaskActionJournalEntry | null> {
    const meaningfulChanges = changes.filter(
      ({ before, after }) => JSON.stringify(before) !== JSON.stringify(after),
    );
    if (meaningfulChanges.length === 0) return null;
    const now = this.now();
    const expiresAt = new Date(now.getTime() + TASK_ACTION_JOURNAL_RETENTION_MS).toISOString();
    return this.database.writeTransaction(async (transaction) => {
      await transaction.execute(
        'DELETE FROM tasks_action_journal WHERE owner_id = ? AND (expires_at <= ? OR state = ?)',
        [ownerId, now.toISOString(), 'undone'],
      );
      const latest = await transaction.getOptional<{ sequence: number }>(
        'SELECT sequence FROM tasks_action_journal WHERE owner_id = ? ORDER BY sequence DESC LIMIT 1',
        [ownerId],
      );
      const entry: TaskActionJournalEntry = {
        id: this.createId(),
        owner_id: ownerId,
        sequence: (latest?.sequence ?? 0) + 1,
        action_id: actionId,
        occurred_at: occurredAt,
        expires_at: expiresAt,
        state: 'applied',
        snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
        changes: [...meaningfulChanges],
      };
      await transaction.execute(
        `INSERT INTO tasks_action_journal
          (id, owner_id, sequence, action_id, occurred_at, expires_at, state, snapshot_version, changes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entry.owner_id,
          entry.sequence,
          entry.action_id,
          entry.occurred_at,
          entry.expires_at,
          entry.state,
          entry.snapshot_version,
          JSON.stringify(entry.changes),
        ],
      );
      await transaction.execute(
        `DELETE FROM tasks_action_journal
         WHERE owner_id = ? AND id NOT IN (
           SELECT id FROM tasks_action_journal
           WHERE owner_id = ? ORDER BY sequence DESC LIMIT ${TASK_ACTION_JOURNAL_LIMIT}
         )`,
        [ownerId, ownerId],
      );
      return entry;
    });
  }

  async next(ownerId: string, direction: 'undo' | 'redo'): Promise<TaskActionJournalEntry | null> {
    const now = this.now().toISOString();
    const row = await this.database.getOptional<TaskActionJournalStorageRow>(
      direction === 'undo'
        ? `SELECT * FROM tasks_action_journal
           WHERE owner_id = ? AND state = 'applied' AND expires_at > ?
           ORDER BY sequence DESC LIMIT 1`
        : `SELECT * FROM tasks_action_journal
           WHERE owner_id = ? AND state = 'undone' AND expires_at > ?
           ORDER BY sequence ASC LIMIT 1`,
      [ownerId, now],
    );
    return row === null ? null : parseTaskActionJournalEntry(row);
  }

  async mark(entry: TaskActionJournalEntry, direction: 'undo' | 'redo'): Promise<void> {
    await this.database.writeTransaction(async (transaction) => {
      const result = await transaction.execute(
        'UPDATE tasks_action_journal SET state = ? WHERE id = ? AND owner_id = ? AND state = ?',
        [
          direction === 'undo' ? 'undone' : 'applied',
          entry.id,
          entry.owner_id,
          direction === 'undo' ? 'applied' : 'undone',
        ],
      );
      if (result.rowsAffected !== 1) {
        throw new TaskActionJournalCursorError(entry.id, direction);
      }
    });
  }
}

export class TaskActionJournalCursorError extends Error {
  constructor(readonly entryId: string, readonly direction: 'undo' | 'redo') {
    super(`The task action cursor could not move ${direction === 'undo' ? 'backward' : 'forward'}`);
    this.name = 'TaskActionJournalCursorError';
  }
}
