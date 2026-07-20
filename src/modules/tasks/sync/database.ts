import {
  PowerSyncDatabase,
  WASQLiteOpenFactory,
  WASQLiteVFS,
  type AbstractPowerSyncDatabase,
} from '@powersync/web';

import { tasksPowerSyncSchema } from './schema';

export const tasksDatabaseFilename = 'bathos-tasks-v1.db';
const ownerBindingId = 'current-owner';

export type TasksOwnerBindingDatabase = Pick<
  AbstractPowerSyncDatabase,
  'disconnectAndClear' | 'execute' | 'getOptional'
>;

export type TasksOwnerBindingResult = {
  clearedPreviousOwner: boolean;
};

export function createTasksPowerSyncDatabase(): PowerSyncDatabase {
  if (typeof window === 'undefined') {
    throw new Error('The tasks PowerSync database can only be created in a browser');
  }

  const flags = { enableMultiTabs: true };
  const database = new WASQLiteOpenFactory({
    dbFilename: tasksDatabaseFilename,
    vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    flags,
  });

  return new PowerSyncDatabase({
    schema: tasksPowerSyncSchema,
    database,
    flags,
  });
}

export async function bindTasksDatabaseOwner(
  database: TasksOwnerBindingDatabase,
  ownerId: string,
  boundAt = new Date().toISOString(),
): Promise<TasksOwnerBindingResult> {
  if (!ownerId) {
    throw new Error('A signed-in owner is required before opening task data');
  }

  const binding = await database.getOptional<{ owner_id: string }>(
    'SELECT owner_id FROM tasks_owner_binding WHERE id = ?',
    [ownerBindingId],
  );
  const clearedPreviousOwner = binding !== null && binding.owner_id !== ownerId;

  if (clearedPreviousOwner) {
    await database.disconnectAndClear();
  }

  if (binding === null || clearedPreviousOwner) {
    await database.execute(
      'INSERT INTO tasks_owner_binding (id, owner_id, bound_at) VALUES (?, ?, ?)',
      [ownerBindingId, ownerId, boundAt],
    );
  }

  return { clearedPreviousOwner };
}

export async function clearTasksDatabaseForSignOut(
  database: Pick<AbstractPowerSyncDatabase, 'disconnectAndClear'>,
): Promise<void> {
  await database.disconnectAndClear();
}
