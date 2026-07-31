// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';
import { afterEach, describe, expect, it } from 'vitest';

import { TaskHierarchyRepository } from '@/modules/tasks/data/taskHierarchyRepository';
import { TaskRepository } from '@/modules/tasks/data/taskRepository';
import { tasksPowerSyncSchema } from '@/modules/tasks/sync/schema';

let database: PowerSyncDatabase | null = null;
let testDirectory: string | null = null;

afterEach(async () => {
  if (database !== null) {
    await database.close().catch(() => undefined);
    database = null;
  }
  if (testDirectory !== null) {
    await rm(testDirectory, { recursive: true, force: true });
    testDirectory = null;
  }
});

describe('checklist persistence', () => {
  it('retains a completed checklist item after the local database reopens', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'bathos-checklist-persistence-'));
    const databaseFilename = 'checklist-persistence.db';
    const ownerId = crypto.randomUUID();

    database = createDatabase(testDirectory, databaseFilename);
    await database.waitForReady();

    const task = await new TaskRepository(database).createTask({
      ownerId,
      title: 'Disposable Checklist Persistence Task',
      destination: 'anytime',
    });
    const hierarchy = new TaskHierarchyRepository(database);
    const item = await hierarchy.createChecklistItem({
      ownerId,
      taskId: task.id,
      title: 'Persist Completion',
    });

    await hierarchy.completeChecklistItem(ownerId, item.id, true);
    await expect(readCompletion(database, ownerId, item.id)).resolves.toMatchObject({
      completed: 1,
      completed_at: expect.any(String),
      last_operation_id: expect.any(String),
      revision: 2,
    });

    await database.close();
    database = createDatabase(testDirectory, databaseFilename);
    await database.waitForReady();

    await expect(readCompletion(database, ownerId, item.id)).resolves.toMatchObject({
      completed: 1,
      completed_at: expect.any(String),
      last_operation_id: expect.any(String),
      revision: 2,
    });
  });
});

function createDatabase(directory: string, databaseFilename: string): PowerSyncDatabase {
  return new PowerSyncDatabase({
    schema: tasksPowerSyncSchema,
    database: {
      dbFilename: databaseFilename,
      dbLocation: directory,
      implementation: { type: 'better-sqlite3' },
    },
  });
}

function readCompletion(
  activeDatabase: PowerSyncDatabase,
  ownerId: string,
  itemId: string,
) {
  return activeDatabase.getOptional<{
    completed: number;
    completed_at: string | null;
    last_operation_id: string | null;
    revision: number;
  }>(
    `SELECT completed, completed_at, last_operation_id, revision
     FROM tasks_checklist_items
     WHERE owner_id = ? AND id = ?`,
    [ownerId, itemId],
  );
}
