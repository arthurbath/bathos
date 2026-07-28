import {
  getTasksNativeMessageHandler,
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
});
