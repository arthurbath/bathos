import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getExistingUserBoundBrowserPushSubscription,
  unsubscribeUserBoundBrowserPush,
} from './userBoundBrowserPush';

describe('user-bound browser push', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats a service-worker registration without Push support as unsubscribed', async () => {
    const getRegistration = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration },
    });

    await expect(getExistingUserBoundBrowserPushSubscription()).resolves.toBeNull();
    await expect(unsubscribeUserBoundBrowserPush()).resolves.toBe(false);
    expect(getRegistration).toHaveBeenCalledWith('/');
  });

  it('returns and unsubscribes an existing browser Push subscription', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const subscription = { unsubscribe };
    const getSubscription = vi.fn().mockResolvedValue(subscription);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: { getSubscription },
        }),
      },
    });

    await expect(getExistingUserBoundBrowserPushSubscription()).resolves.toBe(subscription);
    await expect(unsubscribeUserBoundBrowserPush()).resolves.toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
