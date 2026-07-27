import type { Transaction } from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import { taskChecklistItemFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskChecklistItem } from '@/modules/tasks/types/tasks';
import {
  TaskHierarchyRepository,
  type TaskHierarchyRepositoryDatabase,
} from './taskHierarchyRepository';

const timestamp = '2026-07-20T06:30:00.000Z';

function createHarness(results: unknown[] = []) {
  const transaction = {
    execute: vi.fn().mockResolvedValue({ rows: undefined, rowsAffected: 1 }),
    getAll: vi.fn().mockResolvedValue([]),
    getOptional: vi.fn(),
  } as unknown as Transaction;
  for (const result of results) vi.mocked(transaction.getOptional).mockResolvedValueOnce(result);
  const database = {
    writeTransaction: vi.fn(async (callback: (value: Transaction) => Promise<unknown>) =>
      callback(transaction)),
  } as unknown as TaskHierarchyRepositoryDatabase;
  const ids = ['entity-new', 'mutation-new', 'entity-next', 'mutation-next'];
  const repository = new TaskHierarchyRepository(database, {
    createId: () => ids.shift() ?? 'mutation-fallback',
    now: () => timestamp,
  });
  return { repository, transaction };
}

describe('task hierarchy repository', () => {
  it('creates an Area with owner-scoped order and mutation metadata', async () => {
    const { repository, transaction } = createHarness([{ order_key: 'a0' }]);
    await expect(repository.createArea({
      ownerId: 'owner-a',
      title: '  Work  ',
      entryChannel: 'raycast',
    })).resolves.toMatchObject({
      id: 'entity-new',
      owner_id: 'owner-a',
      title: 'Work',
      entry_channel: 'raycast',
      revision: 1,
    });
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain('INSERT INTO tasks_areas');
  });

  it('creates checklist items beneath one explicit task', async () => {
    const { repository, transaction } = createHarness([{ id: 'task-a' }, null]);
    await expect(repository.createChecklistItem({
      ownerId: 'owner-a',
      taskId: 'task-a',
      title: 'Confirm details',
    })).resolves.toMatchObject({ task_id: 'task-a', completed: false });
    expect(vi.mocked(transaction.execute).mock.calls[0][0])
      .toContain('INSERT INTO tasks_checklist_items');
  });

  it('completes a checklist item with one revision-safe mutation', async () => {
    const existing: TaskChecklistItem = taskChecklistItemFixture({ id: 'item-a' });
    const { repository } = createHarness([existing]);
    await expect(repository.completeChecklistItem('owner-a', 'item-a', true))
      .resolves.toMatchObject({ completed: true, completed_at: timestamp, revision: 2 });
  });
});
