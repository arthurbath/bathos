import { describe, expect, it } from 'vitest';

import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import {
  InvalidTaskActionJournalError,
  TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
  parseTaskActionJournalEntry,
  taskJournalSnapshot,
  type TaskActionJournalStorageRow,
} from './taskActionJournal';

describe('task action journal snapshots', () => {
  it('decodes a complete versioned semantic snapshot', () => {
    const task = taskTodoFixture({ id: 'task-a', title: 'After' });
    const row = storageRow(JSON.stringify([{
      entityType: 'task',
      entityId: task.id,
      before: { ...taskJournalSnapshot(task)!, title: 'Before' },
      after: taskJournalSnapshot(task),
    }]));

    expect(parseTaskActionJournalEntry(row).changes).toEqual([
      expect.objectContaining({ entityType: 'task', entityId: task.id }),
    ]);
  });

  it('rejects unknown versions and structurally incomplete snapshots', () => {
    expect(() => parseTaskActionJournalEntry({
      ...storageRow('[]'),
      snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION + 1,
    })).toThrow(InvalidTaskActionJournalError);
    expect(() => parseTaskActionJournalEntry(storageRow(JSON.stringify([{
      entityType: 'checklist_item',
      entityId: 'item-a',
      before: { title: 'Missing required fields' },
      after: null,
    }])))).toThrow('invalid changes');
  });
});

function storageRow(changes: string): TaskActionJournalStorageRow {
  return {
    id: 'journal-a',
    owner_id: 'owner-a',
    sequence: 1,
    action_id: 'action-a',
    occurred_at: '2026-08-06T20:00:00.000Z',
    expires_at: '2026-08-06T20:30:00.000Z',
    state: 'applied',
    snapshot_version: TASK_ACTION_JOURNAL_SNAPSHOT_VERSION,
    changes,
  };
}
