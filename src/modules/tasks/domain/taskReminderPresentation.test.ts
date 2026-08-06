import { describe, expect, it } from 'vitest';

import { getTaskReminderPresentationMode } from './taskReminderPresentation';

describe('getTaskReminderPresentationMode', () => {
  it('waits for browser capability inspection before choosing fallback delivery', () => {
    expect(getTaskReminderPresentationMode({
      webPushStatus: 'checking',
      nativeNotificationsEnabled: false,
    })).toBe('checking');
    expect(getTaskReminderPresentationMode({
      webPushStatus: 'unsupported',
      nativeNotificationsEnabled: false,
      nativeNotificationsChecking: true,
    })).toBe('checking');
  });

  it('prefers native and browser notifications over in-app fallback delivery', () => {
    expect(getTaskReminderPresentationMode({
      webPushStatus: 'available',
      nativeNotificationsEnabled: true,
    })).toBe('native-notification');
    expect(getTaskReminderPresentationMode({
      webPushStatus: 'active',
      nativeNotificationsEnabled: false,
    })).toBe('browser-notification');
  });

  it('uses an in-app toast when no notification surface is enabled', () => {
    for (const webPushStatus of [
      'available',
      'denied',
      'unsupported',
      'unconfigured',
      'revoked',
      'error',
      undefined,
    ] as const) {
      expect(getTaskReminderPresentationMode({
        webPushStatus,
        nativeNotificationsEnabled: false,
      })).toBe('in-app-toast');
    }
  });
});
