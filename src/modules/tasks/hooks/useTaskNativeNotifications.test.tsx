import { act, renderHook } from '@testing-library/react';

import { useTaskNativeNotifications } from './useTaskNativeNotifications';

type NativeTestWindow = Window & {
  __bathosTasksNative?: {
    schemaVersion: number;
    installationId: string;
    notificationsEnabled: boolean;
    notificationAuthorizationStatus: string;
  };
  webkit?: {
    messageHandlers?: {
      bathosTasksWidget?: { postMessage: (message: unknown) => void };
    };
  };
};

describe('useTaskNativeNotifications', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__bathosTasksNative');
    Reflect.deleteProperty(window, 'webkit');
  });

  it('requests status and reacts to native authorization changes', () => {
    const messages: unknown[] = [];
    const nativeWindow = window as NativeTestWindow;
    nativeWindow.__bathosTasksNative = {
      schemaVersion: 2,
      installationId: '30000000-0000-4000-8000-000000000001',
      notificationsEnabled: false,
      notificationAuthorizationStatus: 'checking',
    };
    nativeWindow.webkit = {
      messageHandlers: {
        bathosTasksWidget: { postMessage: (message) => messages.push(message) },
      },
    };

    const { result } = renderHook(useTaskNativeNotifications);
    expect(messages).toEqual([{ type: 'request-notification-status', schemaVersion: 2 }]);
    expect(result.current.enabled).toBe(false);

    act(() => {
      window.dispatchEvent(new CustomEvent('bathos:tasks-native-notification-status', {
        detail: { status: 'enabled', enabled: true },
      }));
    });
    expect(result.current.status).toBe('enabled');
    expect(result.current.enabled).toBe(true);

    act(() => {
      expect(result.current.enable()).toBe(true);
    });
    expect(messages.at(-1)).toEqual({
      type: 'configure-notifications',
      schemaVersion: 2,
    });
  });

  it('reports unavailable in an ordinary browser', () => {
    const { result } = renderHook(useTaskNativeNotifications);
    expect(result.current.available).toBe(false);
    expect(result.current.status).toBe('unavailable');
    expect(result.current.enable()).toBe(false);
  });
});
