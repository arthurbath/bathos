import type { TaskWebPushStatus } from '@/modules/tasks/hooks/useTaskWebPush';

export type TaskReminderPresentationMode =
  | 'checking'
  | 'browser-notification'
  | 'native-notification'
  | 'in-app-toast';

export function getTaskReminderPresentationMode({
  webPushStatus,
  nativeNotificationsEnabled,
  nativeNotificationsChecking = false,
}: {
  webPushStatus: TaskWebPushStatus | undefined;
  nativeNotificationsEnabled: boolean;
  nativeNotificationsChecking?: boolean;
}): TaskReminderPresentationMode {
  if (nativeNotificationsEnabled) return 'native-notification';
  if (nativeNotificationsChecking) return 'checking';
  if (webPushStatus === 'checking') return 'checking';
  if (webPushStatus === 'active') return 'browser-notification';
  return 'in-app-toast';
}
