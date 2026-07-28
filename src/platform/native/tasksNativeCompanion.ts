export const TASKS_NATIVE_BRIDGE_HANDLER = 'bathosTasksWidget';

export type TasksNativeMessageHandler = {
  postMessage: (message: unknown) => void;
};

type TasksNativeBridgeWindow = Window & {
  __bathosTasksNative?: {
    schemaVersion?: unknown;
    installationId?: unknown;
  };
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getTasksNativeInstallationId(target: Window = window): string | null {
  if (!isTasksNativeCompanion(target)) return null;
  const context = (target as TasksNativeBridgeWindow).__bathosTasksNative;
  return context?.schemaVersion === 2
    && typeof context.installationId === 'string'
    && uuidPattern.test(context.installationId)
    ? context.installationId
    : null;
}
