export const TASKS_NATIVE_BRIDGE_HANDLER = 'bathosTasksWidget';

export type TasksNativeMessageHandler = {
  postMessage: (message: unknown) => void;
};

type TasksNativeBridgeWindow = Window & {
  webkit?: {
    messageHandlers?: Partial<Record<string, TasksNativeMessageHandler>>;
  };
};

export function getTasksNativeMessageHandler(
  target: Window = window,
): TasksNativeMessageHandler | null {
  const nativeWindow = target as TasksNativeBridgeWindow;
  const handler = nativeWindow.webkit?.messageHandlers?.[TASKS_NATIVE_BRIDGE_HANDLER];
  return handler && typeof handler.postMessage === 'function' ? handler : null;
}

export function isTasksNativeCompanion(target: Window = window): boolean {
  return getTasksNativeMessageHandler(target) !== null;
}
