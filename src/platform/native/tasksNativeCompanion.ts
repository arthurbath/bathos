export const TASKS_NATIVE_BRIDGE_HANDLER = 'bathosTasksWidget';
export const TASKS_NATIVE_NOTIFICATION_STATUS_EVENT =
  'bathos:tasks-native-notification-status';

export const tasksNativeNotificationAuthorizationStatuses = [
  'checking',
  'not-determined',
  'denied',
  'enabled',
  'unavailable',
  'error',
] as const;

export type TasksNativeNotificationAuthorizationStatus =
  (typeof tasksNativeNotificationAuthorizationStatuses)[number];

export type TasksNativeMessageHandler = {
  postMessage: (message: unknown) => void;
};

type TasksNativeBridgeWindow = Window & {
  __bathosTasksNative?: {
    schemaVersion?: unknown;
    installationId?: unknown;
    notificationsEnabled?: unknown;
    notificationAuthorizationStatus?: unknown;
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

export function getTasksNativeNotificationsEnabled(target: Window = window): boolean {
  if (!isTasksNativeCompanion(target)) return false;
  return (target as TasksNativeBridgeWindow).__bathosTasksNative?.notificationsEnabled === true;
}

export function getTasksNativeNotificationAuthorizationStatus(
  target: Window = window,
): TasksNativeNotificationAuthorizationStatus {
  if (!isTasksNativeCompanion(target)) return 'unavailable';
  const context = (target as TasksNativeBridgeWindow).__bathosTasksNative;
  if (context?.notificationsEnabled === true) return 'enabled';
  return isTasksNativeNotificationAuthorizationStatus(
    context?.notificationAuthorizationStatus,
  )
    ? context.notificationAuthorizationStatus
    : 'checking';
}

export function isTasksNativeNotificationAuthorizationStatus(
  value: unknown,
): value is TasksNativeNotificationAuthorizationStatus {
  return typeof value === 'string'
    && tasksNativeNotificationAuthorizationStatuses.includes(
      value as TasksNativeNotificationAuthorizationStatus,
    );
}

export function requestTasksNativeNotificationStatus(
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler || getTasksNativeInstallationId(target) === null) return false;
  handler.postMessage({
    type: 'request-notification-status',
    schemaVersion: 2,
  });
  return true;
}

export function configureTasksNativeNotifications(
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler || getTasksNativeInstallationId(target) === null) return false;
  handler.postMessage({
    type: 'configure-notifications',
    schemaVersion: 2,
  });
  return true;
}
