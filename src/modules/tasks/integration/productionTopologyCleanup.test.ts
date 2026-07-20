import { describe, expect, it, vi } from 'vitest';

import { cleanupProductionTopology } from './productionTopologyCleanup';

describe('production topology cleanup', () => {
  it('clears every disposable resource and removes successful user IDs', async () => {
    const disconnectAndClear = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const removeTestDirectory = vi.fn().mockResolvedValue(undefined);
    const syntheticUserIds = new Set(['owner-a', 'owner-b']);

    await cleanupProductionTopology({
      databases: [{ disconnectAndClear, close }],
      signedInClients: [{ auth: { signOut } }],
      syntheticUserIds,
      admin: { auth: { admin: { deleteUser } } },
      testDirectory: '/tmp/bathos-tasks-production-topology-test',
      removeTestDirectory,
    });

    expect(disconnectAndClear).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(deleteUser).toHaveBeenCalledTimes(2);
    expect(removeTestDirectory).toHaveBeenCalledOnce();
    expect(syntheticUserIds).toEqual(new Set());
  });

  it('attempts every cleanup step and reports every failure', async () => {
    const disconnectAndClear = vi.fn().mockRejectedValue(new Error('clear failed'));
    const close = vi.fn().mockRejectedValue(new Error('close failed'));
    const signOut = vi.fn().mockResolvedValue({ error: new Error('sign-out failed') });
    const deleteUser = vi.fn().mockResolvedValue({ error: new Error('delete failed') });
    const removeTestDirectory = vi.fn().mockRejectedValue(new Error('remove failed'));
    const syntheticUserIds = new Set(['owner-a']);

    const cleanup = cleanupProductionTopology({
      databases: [{ disconnectAndClear, close }],
      signedInClients: [{ auth: { signOut } }],
      syntheticUserIds,
      admin: { auth: { admin: { deleteUser } } },
      testDirectory: '/tmp/bathos-tasks-production-topology-test',
      removeTestDirectory,
    });

    await expect(cleanup).rejects.toMatchObject({
      message: 'Tasks production-topology cleanup failed in 5 steps',
      errors: [
        { message: 'clear a local PowerSync database: clear failed' },
        { message: 'close a local PowerSync database: close failed' },
        { message: 'sign out a synthetic client: sign-out failed' },
        { message: 'delete synthetic user owner-a: delete failed' },
        { message: 'remove the local topology test directory: remove failed' },
      ],
    });
    expect(close).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
    expect(deleteUser).toHaveBeenCalledOnce();
    expect(removeTestDirectory).toHaveBeenCalledOnce();
    expect(syntheticUserIds).toEqual(new Set(['owner-a']));
  });
});
