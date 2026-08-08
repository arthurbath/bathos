import {
  configureTasksNativeNotifications,
  getTasksNativeNotificationAuthorizationStatus,
  getTasksNativeMessageHandler,
  getTasksNativeNotificationsEnabled,
  getTasksNativePushRegistration,
  isTasksNativeCompanion,
  requestTasksNativeNotificationStatus,
  setTasksNativePushRegistrationActive,
  TASKS_NATIVE_BRIDGE_HANDLER,
} from './tasksNativeCompanion';

function nativeCompanionWindow(postMessage: (message: unknown) => void): Window {
  return {
    webkit: {
      messageHandlers: {
        [TASKS_NATIVE_BRIDGE_HANDLER]: { postMessage },
      },
    },
  } as unknown as Window;
}

describe('tasksNativeCompanion', () => {
  it('accepts only the approved callable Tasks bridge', () => {
    const postMessage = vi.fn();
    const target = nativeCompanionWindow(postMessage);

    expect(isTasksNativeCompanion(target)).toBe(true);
    expect(getTasksNativeMessageHandler(target)).toEqual({ postMessage });
  });

  it('rejects ordinary browsers and malformed bridge handlers', () => {
    expect(isTasksNativeCompanion({} as Window)).toBe(false);
    expect(isTasksNativeCompanion({
      webkit: {
        messageHandlers: {
          [TASKS_NATIVE_BRIDGE_HANDLER]: { postMessage: 'not-callable' },
        },
      },
    } as unknown as Window)).toBe(false);
  });

  it('reads native notification enablement only from an authenticated Tasks bridge', () => {
    const target = nativeCompanionWindow(vi.fn()) as Window & {
      __bathosTasksNative?: { notificationsEnabled: boolean };
    };
    target.__bathosTasksNative = { notificationsEnabled: true };

    expect(getTasksNativeNotificationsEnabled(target)).toBe(true);
    expect(getTasksNativeNotificationsEnabled({
      __bathosTasksNative: { notificationsEnabled: true },
    } as unknown as Window)).toBe(false);
    expect(getTasksNativeNotificationsEnabled(nativeCompanionWindow(vi.fn()))).toBe(false);
  });

  it('reads authorization status and posts only versioned notification commands', () => {
    const messages: unknown[] = [];
    const target = nativeCompanionWindow((message) => messages.push(message)) as Window & {
      __bathosTasksNative?: {
        schemaVersion: number;
        installationId: string;
        notificationsEnabled: boolean;
        notificationAuthorizationStatus: string;
      };
    };
    target.__bathosTasksNative = {
      schemaVersion: 2,
      installationId: '30000000-0000-4000-8000-000000000001',
      notificationsEnabled: false,
      notificationAuthorizationStatus: 'denied',
    };

    expect(getTasksNativeNotificationAuthorizationStatus(target)).toBe('denied');
    expect(requestTasksNativeNotificationStatus(target)).toBe(true);
    expect(configureTasksNativeNotifications(target)).toBe(true);
    expect(setTasksNativePushRegistrationActive(true, target)).toBe(true);
    expect(messages).toEqual([
      { type: 'request-notification-status', schemaVersion: 2 },
      { type: 'configure-notifications', schemaVersion: 2 },
      { type: 'native-push-registration-state', schemaVersion: 2, active: true },
    ]);
    expect(requestTasksNativeNotificationStatus(nativeCompanionWindow(vi.fn()))).toBe(false);
  });

  it('reads only a complete, valid native APNs registration', () => {
    const target = nativeCompanionWindow(vi.fn()) as Window & {
      __bathosTasksNative?: Record<string, unknown>;
    };
    target.__bathosTasksNative = {
      schemaVersion: 2,
      installationId: '30000000-0000-4000-8000-000000000001',
      nativePushPlatform: 'ios',
      nativePushEnvironment: 'development',
      nativePushTopic: 'garden.bath.tasks',
      nativePushToken: 'ab'.repeat(32),
    };
    expect(getTasksNativePushRegistration(target)).toEqual({
      installationId: '30000000-0000-4000-8000-000000000001',
      platform: 'ios',
      environment: 'development',
      topic: 'garden.bath.tasks',
      deviceToken: 'ab'.repeat(32),
    });
    target.__bathosTasksNative.nativePushTopic = 'wrong.topic';
    expect(getTasksNativePushRegistration(target)).toBeNull();
  });
});
