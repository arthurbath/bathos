import { describe, expect, it } from 'vitest';

import { getTaskReminderPresentationMode } from './taskReminderPresentation';

describe('getTaskReminderPresentationMode', () => {
  it('waits for browser capability inspection before choosing fallback delivery', () => {
    expect(getTaskReminderPresentationMode({
      webPushStatus: 'checking',
      nativeNotificationsEnabled: false,
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
    expect(getTaskReminderPresentationMode({
      webPushStatus: 'denied',
      nativeNotificationsEnabled: false,
    })).toBe('in-app-toast');
    expect(getTaskReminderPresentationMode({
      webPushStatus: undefined,
      nativeNotificationsEnabled: false,
    })).toBe('in-app-toast');
  });
});
