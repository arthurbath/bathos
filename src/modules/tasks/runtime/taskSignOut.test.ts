import { describe, expect, it, vi } from 'vitest';

import { prepareTasksForSignOut } from './taskSignOut';

describe('Tasks sign-out preparation', () => {
  it('revokes the server endpoint and browser subscription before clearing task data', async () => {
    const revokeWebPushByEndpoint = vi.fn().mockResolvedValue({ outcome: 'accepted' });
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const disconnectAndClear = vi.fn().mockResolvedValue(undefined);

    await prepareTasksForSignOut({
      database: { disconnectAndClear } as never,
      reminderService: { revokeWebPushByEndpoint },
      mode: 'connected',
      getSubscription: vi.fn().mockResolvedValue({
        endpoint: 'https://push.example.test/subscription-a',
        unsubscribe,
      }),
    });

    expect(revokeWebPushByEndpoint).toHaveBeenCalledWith(
      'https://push.example.test/subscription-a',
    );
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(disconnectAndClear).toHaveBeenCalledOnce();
    expect(revokeWebPushByEndpoint.mock.invocationCallOrder[0]).toBeLessThan(
      disconnectAndClear.mock.invocationCallOrder[0],
    );
    expect(unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
      disconnectAndClear.mock.invocationCallOrder[0],
    );
  });

  it('continues sign-out when browser unsubscribe succeeds after server revocation fails', async () => {
    const disconnectAndClear = vi.fn().mockResolvedValue(undefined);

    await expect(prepareTasksForSignOut({
      database: { disconnectAndClear } as never,
      reminderService: {
        revokeWebPushByEndpoint: vi.fn().mockRejectedValue(new Error('offline')),
      },
      mode: 'connected',
      getSubscription: vi.fn().mockResolvedValue({
        endpoint: 'https://push.example.test/subscription-a',
        unsubscribe: vi.fn().mockResolvedValue(true),
      }),
    })).resolves.toBeUndefined();
    expect(disconnectAndClear).toHaveBeenCalledOnce();
  });

  it('clears local task data but blocks completion when neither invalidation path succeeds', async () => {
    const disconnectAndClear = vi.fn().mockResolvedValue(undefined);

    await expect(prepareTasksForSignOut({
      database: { disconnectAndClear } as never,
      reminderService: {
        revokeWebPushByEndpoint: vi.fn().mockRejectedValue(new Error('offline')),
      },
      mode: 'connected',
      getSubscription: vi.fn().mockResolvedValue({
        endpoint: 'https://push.example.test/subscription-a',
        unsubscribe: vi.fn().mockResolvedValue(false),
      }),
    })).rejects.toThrow('Browser reminders could not be invalidated');
    expect(disconnectAndClear).toHaveBeenCalledOnce();
  });
});
