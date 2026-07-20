import { describe, expect, it } from 'vitest';

import { decodeVapidPublicKey, getTaskWebPushAvailability } from './useTaskWebPush';

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
});
