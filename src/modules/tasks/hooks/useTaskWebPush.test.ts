import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import {
  decodeVapidPublicKey,
  getTaskWebPushAvailability,
  useTaskWebPush,
} from './useTaskWebPush';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('task Web Push capability', () => {
  it('requires every standards-based browser capability', () => {
    const supported = {
      secureContext: true,
      hasServiceWorker: true,
      hasPushManager: true,
      hasNotifications: true,
      publicKey: 'BAg',
    };
    expect(getTaskWebPushAvailability(supported)).toBe('available');
    expect(getTaskWebPushAvailability({ ...supported, hasPushManager: false }))
      .toBe('unsupported');
    expect(getTaskWebPushAvailability({ ...supported, secureContext: false }))
      .toBe('unsupported');
    expect(getTaskWebPushAvailability({ ...supported, publicKey: '' }))
      .toBe('unconfigured');
  });

  it('decodes a URL-safe VAPID public key for PushManager', () => {
    expect(Array.from(decodeVapidPublicKey('AQIDBA'))).toEqual([1, 2, 3, 4]);
  });

  it('inspects passively on mount and registers only after the explicit enable action', async () => {
    vi.stubEnv('VITE_TASKS_WEB_PUSH_PUBLIC_KEY', 'AQIDBA');
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('PushManager', class PushManager {});
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission,
    });
    const subscription = {
      toJSON: () => ({
        endpoint: 'https://push.example.test/subscription-a',
        keys: { p256dh: 'p256dh-a', auth: 'auth-a' },
      }),
    };
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    };
    const registration = { pushManager };
    const getRegistration = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue(registration);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration, register },
    });
    const registerWebPush = vi.fn().mockResolvedValue({
      outcome: 'accepted',
      target: { capability_status: 'active' },
    });
    const reminderService = { registerWebPush } as unknown as TaskReminderService;

    const { result } = renderHook(() => useTaskWebPush('connected', reminderService));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getRegistration).toHaveBeenCalledWith('/');
    expect(register).not.toHaveBeenCalled();
    expect(result.current.status).toBe('available');

    await act(async () => {
      await result.current.enable();
    });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('/tasks-service-worker.js', { scope: '/' });
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(registerWebPush).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example.test/subscription-a',
        keys: { p256dh: 'p256dh-a', auth: 'auth-a' },
      },
      'This Browser',
      true,
    );
    expect(result.current.status).toBe('active');
  });
});
