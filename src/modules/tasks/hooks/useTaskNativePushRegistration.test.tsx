import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTaskNativePushRegistration } from './useTaskNativePushRegistration';

type NativeTestWindow = Window & {
  __bathosTasksNative?: Record<string, unknown>;
  webkit?: { messageHandlers?: Record<string, { postMessage: (message: unknown) => void }> };
};

describe('useTaskNativePushRegistration', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__bathosTasksNative');
    Reflect.deleteProperty(window, 'webkit');
  });

  it('registers the APNs token exposed by the signed native surface', async () => {
    const target = window as NativeTestWindow;
    target.webkit = { messageHandlers: { bathosTasksWidget: { postMessage: vi.fn() } } };
    target.__bathosTasksNative = {
      schemaVersion: 2,
      installationId: '30000000-0000-4000-8000-000000000001',
      nativePushPlatform: 'macos',
      nativePushEnvironment: 'production',
      nativePushTopic: 'garden.bath.tasks',
      nativePushToken: 'ab'.repeat(32),
    };
    const reminderService = {
      registerNativePush: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
      revokeNativePush: vi.fn(),
    };

    renderHook(() => useTaskNativePushRegistration({
      mode: 'connected',
      status: 'enabled',
      reminderService: reminderService as never,
    }));
    await act(async () => { await Promise.resolve(); });

    expect(reminderService.registerNativePush).toHaveBeenCalledWith({
      installationId: '30000000-0000-4000-8000-000000000001',
      platform: 'macos',
      environment: 'production',
      topic: 'garden.bath.tasks',
      deviceToken: 'ab'.repeat(32),
      label: 'This Mac',
    });
    expect(target.webkit?.messageHandlers?.bathosTasksWidget.postMessage).toHaveBeenCalledWith({
      type: 'native-push-registration-state',
      schemaVersion: 2,
      active: true,
    });
  });

  it('revokes the installation after native permission is denied', async () => {
    const target = window as NativeTestWindow;
    target.webkit = { messageHandlers: { bathosTasksWidget: { postMessage: vi.fn() } } };
    target.__bathosTasksNative = {
      schemaVersion: 2,
      installationId: '30000000-0000-4000-8000-000000000001',
    };
    const reminderService = {
      registerNativePush: vi.fn(),
      revokeNativePush: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
    };

    renderHook(() => useTaskNativePushRegistration({
      mode: 'connected',
      status: 'denied',
      reminderService: reminderService as never,
    }));
    await act(async () => { await Promise.resolve(); });

    expect(reminderService.revokeNativePush).toHaveBeenCalledWith(
      '30000000-0000-4000-8000-000000000001',
    );
    expect(target.webkit?.messageHandlers?.bathosTasksWidget.postMessage).toHaveBeenCalledWith({
      type: 'native-push-registration-state',
      schemaVersion: 2,
      active: false,
    });
  });
});
