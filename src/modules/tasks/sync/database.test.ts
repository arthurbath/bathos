import { describe, expect, it, vi } from 'vitest';

import {
  advanceTasksDatabaseGeneration,
  bindTasksDatabaseOwner,
  clearTasksDatabaseForSignOut,
  normalizeTasksDatabaseGeneration,
  readTasksDatabaseGeneration,
  TASKS_DATABASE_GENERATION_STORAGE_KEY,
  tasksDatabaseFilenameForGeneration,
  type TasksDatabaseGenerationStorage,
  type TasksOwnerBindingDatabase,
} from './database';

function createGenerationStorage(
  initialValue: string | null = null,
): TasksDatabaseGenerationStorage {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key, nextValue) => {
      value = nextValue;
    }),
  };
}

describe('tasks local database generation', () => {
  it('preserves generation 1 for missing or invalid installation state', () => {
    expect(normalizeTasksDatabaseGeneration(null)).toBe(1);
    expect(normalizeTasksDatabaseGeneration('not-a-number')).toBe(1);
    expect(normalizeTasksDatabaseGeneration(0)).toBe(1);
    expect(readTasksDatabaseGeneration(createGenerationStorage())).toBe(1);
    expect(tasksDatabaseFilenameForGeneration(1)).toBe('bathos-tasks-v1.db');
  });

  it('advances the persisted generation monotonically', () => {
    const storage = createGenerationStorage('4');

    expect(advanceTasksDatabaseGeneration(4, storage)).toEqual({
      advanced: true,
      generation: 5,
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      TASKS_DATABASE_GENERATION_STORAGE_KEY,
      '5',
    );
    expect(readTasksDatabaseGeneration(storage)).toBe(5);
    expect(tasksDatabaseFilenameForGeneration(5)).toBe('bathos-tasks-v5.db');
  });

  it('does not let a stale client overwrite a newer generation', () => {
    const storage = createGenerationStorage('3');

    expect(advanceTasksDatabaseGeneration(2, storage)).toEqual({
      advanced: false,
      generation: 3,
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

function createDatabase(ownerId: string | null): TasksOwnerBindingDatabase {
  return {
    disconnectAndClear: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue({ rows: undefined, rowsAffected: 1 }),
    getOptional: vi.fn().mockResolvedValue(ownerId === null ? null : { owner_id: ownerId }),
  };
}

describe('tasks local owner binding', () => {
  it('records the first owner without clearing the database', async () => {
    const database = createDatabase(null);

    await expect(
      bindTasksDatabaseOwner(database, 'owner-a', '2026-07-20T04:00:00.000Z'),
    ).resolves.toEqual({ clearedPreviousOwner: false });
    expect(database.disconnectAndClear).not.toHaveBeenCalled();
    expect(database.execute).toHaveBeenCalledWith(
      'INSERT INTO tasks_owner_binding (id, owner_id, bound_at) VALUES (?, ?, ?)',
      ['current-owner', 'owner-a', '2026-07-20T04:00:00.000Z'],
    );
  });

  it('reuses data only for the same owner', async () => {
    const database = createDatabase('owner-a');

    await expect(bindTasksDatabaseOwner(database, 'owner-a')).resolves.toEqual({
      clearedPreviousOwner: false,
    });
    expect(database.disconnectAndClear).not.toHaveBeenCalled();
    expect(database.execute).not.toHaveBeenCalled();
  });

  it('clears all local data before binding a different owner', async () => {
    const database = createDatabase('owner-a');

    await expect(
      bindTasksDatabaseOwner(database, 'owner-b', '2026-07-20T04:00:00.000Z'),
    ).resolves.toEqual({ clearedPreviousOwner: true });
    expect(database.disconnectAndClear).toHaveBeenCalledOnce();
    expect(database.execute).toHaveBeenCalledWith(
      'INSERT INTO tasks_owner_binding (id, owner_id, bound_at) VALUES (?, ?, ?)',
      ['current-owner', 'owner-b', '2026-07-20T04:00:00.000Z'],
    );
    expect(vi.mocked(database.disconnectAndClear).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(database.execute).mock.invocationCallOrder[0],
    );
  });

  it('clears synchronized and local-only task data on sign-out', async () => {
    const database = createDatabase('owner-a');

    await clearTasksDatabaseForSignOut(database);

    expect(database.disconnectAndClear).toHaveBeenCalledWith();
  });

  it('rejects an empty owner identity', async () => {
    const database = createDatabase(null);
    await expect(bindTasksDatabaseOwner(database, '')).rejects.toThrow(
      'A signed-in owner is required',
    );
  });
});
