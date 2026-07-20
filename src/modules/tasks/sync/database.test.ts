import { describe, expect, it, vi } from 'vitest';

import {
  bindTasksDatabaseOwner,
  clearTasksDatabaseForSignOut,
  type TasksOwnerBindingDatabase,
} from './database';

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
