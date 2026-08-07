import {
  PowerSyncDatabase,
  WASQLiteOpenFactory,
  WASQLiteVFS,
  type AbstractPowerSyncDatabase,
} from '@powersync/web';

import { tasksPowerSyncSchema } from './schema';

export const TASKS_DATABASE_GENERATION_STORAGE_KEY = 'bathos.tasks.database-generation';
export const TASKS_DATABASE_INITIAL_GENERATION = 1;
export const tasksDatabaseFilename = tasksDatabaseFilenameForGeneration(
  TASKS_DATABASE_INITIAL_GENERATION,
);
const ownerBindingId = 'current-owner';
const databaseGenerations = new WeakMap<PowerSyncDatabase, number>();

export type TasksDatabaseGenerationStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type TasksDatabaseGenerationAdvanceResult = {
  advanced: boolean;
  generation: number;
};

export type TasksOwnerBindingDatabase = Pick<
  AbstractPowerSyncDatabase,
  'disconnectAndClear' | 'execute' | 'getOptional'
>;

export type TasksOwnerBindingResult = {
  clearedPreviousOwner: boolean;
};

export type TasksSchemaCompatibilityDatabase = Pick<
  AbstractPowerSyncDatabase,
  'getOptional'
>;

export class TasksDatabaseSchemaCompatibilityError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super('The local Tasks cache schema is incompatible with this application version');
    this.name = 'TasksDatabaseSchemaCompatibilityError';
    this.cause = cause;
  }
}

const TASKS_DATABASE_SCHEMA_PROBES = [
  `SELECT action_id
   FROM tasks_hierarchy_history_events
   WHERE 0 = 1`,
  `SELECT sequence, action_id, occurred_at, expires_at, state, snapshot_version, changes
   FROM tasks_action_journal
   WHERE 0 = 1`,
] as const;

export function tasksDatabaseFilenameForGeneration(generation: number): string {
  return `bathos-tasks-v${normalizeTasksDatabaseGeneration(generation)}.db`;
}

export function normalizeTasksDatabaseGeneration(value: unknown): number {
  const generation = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(generation) && generation >= TASKS_DATABASE_INITIAL_GENERATION
    ? generation
    : TASKS_DATABASE_INITIAL_GENERATION;
}

export function readTasksDatabaseGeneration(
  storage: TasksDatabaseGenerationStorage | undefined = browserStorage(),
): number {
  if (!storage) return TASKS_DATABASE_INITIAL_GENERATION;
  try {
    return normalizeTasksDatabaseGeneration(
      storage.getItem(TASKS_DATABASE_GENERATION_STORAGE_KEY),
    );
  } catch {
    return TASKS_DATABASE_INITIAL_GENERATION;
  }
}

export function advanceTasksDatabaseGeneration(
  expectedGeneration: number,
  storage: TasksDatabaseGenerationStorage | undefined = browserStorage(),
): TasksDatabaseGenerationAdvanceResult {
  const normalizedExpected = normalizeTasksDatabaseGeneration(expectedGeneration);
  const currentGeneration = readTasksDatabaseGeneration(storage);
  if (currentGeneration !== normalizedExpected) {
    return { advanced: false, generation: currentGeneration };
  }

  const generation = currentGeneration + 1;
  if (!storage) {
    throw new Error('Task cache generation storage is unavailable');
  }
  storage.setItem(TASKS_DATABASE_GENERATION_STORAGE_KEY, String(generation));
  return { advanced: true, generation };
}

export function createTasksPowerSyncDatabase(
  generation = readTasksDatabaseGeneration(),
): PowerSyncDatabase {
  if (typeof window === 'undefined') {
    throw new Error('The tasks PowerSync database can only be created in a browser');
  }

  const normalizedGeneration = normalizeTasksDatabaseGeneration(generation);
  const flags = { enableMultiTabs: true };
  const database = new WASQLiteOpenFactory({
    dbFilename: tasksDatabaseFilenameForGeneration(normalizedGeneration),
    vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    flags,
  });

  const powerSyncDatabase = new PowerSyncDatabase({
    schema: tasksPowerSyncSchema,
    database,
    flags,
  });
  databaseGenerations.set(powerSyncDatabase, normalizedGeneration);
  return powerSyncDatabase;
}

export function getTasksPowerSyncDatabaseGeneration(
  database: PowerSyncDatabase,
): number {
  return databaseGenerations.get(database) ?? readTasksDatabaseGeneration();
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

export async function assertTasksDatabaseSchemaCompatibility(
  database: TasksSchemaCompatibilityDatabase,
): Promise<void> {
  try {
    for (const query of TASKS_DATABASE_SCHEMA_PROBES) {
      await database.getOptional(query);
    }
  } catch (error) {
    throw new TasksDatabaseSchemaCompatibilityError(error);
  }
}

export async function clearTasksDatabaseForSignOut(
  database: Pick<AbstractPowerSyncDatabase, 'disconnectAndClear'>,
): Promise<void> {
  await database.disconnectAndClear();
}

function browserStorage(): TasksDatabaseGenerationStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
