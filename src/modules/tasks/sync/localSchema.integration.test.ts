// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';
import { column, Schema, Table } from '@powersync/web';
import type { PowerSyncDatabase as WebPowerSyncDatabase } from '@powersync/web';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TaskActionJournalRepository } from '@/modules/tasks/data/taskActionJournalRepository';
import type { TaskActionJournalChange } from '@/modules/tasks/domain/taskActionJournal';
import {
  assertTasksDatabaseSchemaCompatibility,
  TasksDatabaseSchemaCompatibilityError,
} from './database';
import {
  createAutomaticCorruptTasksCacheReplacement,
  createTasksCorruptCacheRecoveryController,
} from '@/modules/tasks/runtime/taskRuntimeRecovery';
import { tasksPowerSyncSchema } from './schema';

let activeDatabase: PowerSyncDatabase | null = null;
let testDirectory: string | null = null;

afterEach(async () => {
  await activeDatabase?.close().catch(() => undefined);
  activeDatabase = null;
  vi.unstubAllGlobals();
  if (testDirectory !== null) {
    await rm(testDirectory, { recursive: true, force: true });
    testDirectory = null;
  }
});

describe('Tasks generated local schema', () => {
  it('exposes the undo schema and preserves the local journal across a database reopen', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'bathos-task-journal-schema-'));
    const databaseFilename = 'tasks.db';
    activeDatabase = createDatabase(testDirectory, databaseFilename);
    await activeDatabase.waitForReady();
    await expect(assertTasksDatabaseSchemaCompatibility(activeDatabase)).resolves.toBeUndefined();

    const journal = new TaskActionJournalRepository(
      activeDatabase,
      () => new Date('2026-08-06T20:00:00.000Z'),
      () => 'journal-a',
    );
    await journal.append(
      'owner-a',
      'action-a',
      '2026-08-06T19:59:00.000Z',
      [taskTitleChange()],
    );
    expect((await activeDatabase.getUploadQueueStats()).count).toBe(0);
    await activeDatabase.close();

    activeDatabase = createDatabase(testDirectory, databaseFilename);
    await activeDatabase.waitForReady();
    await expect(assertTasksDatabaseSchemaCompatibility(activeDatabase)).resolves.toBeUndefined();
    const relaunchedJournal = new TaskActionJournalRepository(
      activeDatabase,
      () => new Date('2026-08-06T20:01:00.000Z'),
    );
    expect((await relaunchedJournal.next('owner-a', 'undo'))?.action_id).toBe('action-a');
    expect((await activeDatabase.getUploadQueueStats()).count).toBe(0);
  });

  it('rotates an actual empty-queue legacy cache into a compatible generation', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'bathos-task-legacy-schema-'));
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });

    activeDatabase = new PowerSyncDatabase({
      schema: legacyTasksPowerSyncSchema,
      database: {
        dbFilename: 'tasks-v1.db',
        dbLocation: testDirectory,
        implementation: { type: 'better-sqlite3' },
      },
    });
    await activeDatabase.waitForReady();
    await expect(assertTasksDatabaseSchemaCompatibility(activeDatabase))
      .rejects.toBeInstanceOf(TasksDatabaseSchemaCompatibilityError);
    expect((await activeDatabase.getUploadQueueStats()).count).toBe(0);

    const legacyDatabase = activeDatabase;
    const result = await createAutomaticCorruptTasksCacheReplacement(
      new TasksDatabaseSchemaCompatibilityError(new Error('legacy schema')),
      createTasksCorruptCacheRecoveryController(),
      legacyDatabase as unknown as WebPowerSyncDatabase,
      (generation) => createDatabase(
        testDirectory!,
        `tasks-v${generation}.db`,
      ) as unknown as WebPowerSyncDatabase,
    );

    expect(result).toMatchObject({
      outcome: 'replacement-created',
      queueCount: 0,
      previousGeneration: 1,
      nextGeneration: 2,
    });
    if (result.outcome !== 'replacement-created') {
      throw new Error('The compatible cache replacement was not created');
    }
    activeDatabase = result.replacement as unknown as PowerSyncDatabase;
    await activeDatabase.waitForReady();
    await expect(assertTasksDatabaseSchemaCompatibility(activeDatabase)).resolves.toBeUndefined();
    expect((await activeDatabase.getUploadQueueStats()).count).toBe(0);
    expect(storage.getItem('bathos.tasks.database-generation')).toBe('2');
  });
});

const legacyTasksPowerSyncSchema = new Schema({
  tasks_hierarchy_history_events: new Table({
    owner_id: column.text,
    entity_type: column.text,
    entity_id: column.text,
    operation_id: column.text,
  }),
});

function createDatabase(directory: string, filename: string): PowerSyncDatabase {
  return new PowerSyncDatabase({
    schema: tasksPowerSyncSchema,
    database: {
      dbFilename: filename,
      dbLocation: directory,
      implementation: { type: 'better-sqlite3' },
    },
  });
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function taskTitleChange(): TaskActionJournalChange {
  const base = {
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
  return {
    entityType: 'task',
    entityId: 'task-a',
    before: { ...base, title: 'Before' },
    after: { ...base, title: 'After' },
  };
}
