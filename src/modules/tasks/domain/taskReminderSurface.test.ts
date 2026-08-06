import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaskInAppReminderSurface } from './taskReminderSurface';

type TestWindow = Window & {
  __bathosNativeApp?: {
    schemaVersion: number;
    moduleId: string;
    platform: 'ios' | 'macos';
  };
  __bathosTasksNative?: {
    schemaVersion: number;
    installationId: string;
  };
  webkit?: {
    messageHandlers: {
      bathosTasksWidget: { postMessage: ReturnType<typeof vi.fn> };
    };
  };
};

describe('task reminder surface identity', () => {
  beforeEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(window as TestWindow, '__bathosNativeApp');
    Reflect.deleteProperty(window as TestWindow, '__bathosTasksNative');
    Reflect.deleteProperty(window as TestWindow, 'webkit');
  });

  it('persists one identity for tabs in the same browser storage surface', () => {
    const first = getTaskInAppReminderSurface();
    const second = getTaskInAppReminderSurface();

    expect(first).toEqual(second);
    expect(first).toMatchObject({ label: 'This Browser' });
    expect(first.endpointKey).toMatch(/^browser:[0-9a-f-]{36}$/i);
  });

  it('uses the stable native installation identity and platform label', () => {
    const nativeWindow = window as TestWindow;
    nativeWindow.__bathosNativeApp = {
      schemaVersion: 1,
      moduleId: 'tasks',
      platform: 'macos',
    };
    nativeWindow.__bathosTasksNative = {
      schemaVersion: 2,
      installationId: '10000000-0000-4000-8000-000000000001',
    };
    nativeWindow.webkit = {
      messageHandlers: { bathosTasksWidget: { postMessage: vi.fn() } },
    };

    expect(getTaskInAppReminderSurface()).toEqual({
      endpointKey: 'macos:10000000-0000-4000-8000-000000000001',
      label: 'Mac App',
    });
  });
});
