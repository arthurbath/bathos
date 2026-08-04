import {
  getTasksNativeMessageHandler,
  getTasksNativeNotificationsEnabled,
  isTasksNativeCompanion,
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
});
