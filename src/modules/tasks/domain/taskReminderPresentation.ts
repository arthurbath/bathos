import type { TaskWebPushStatus } from '@/modules/tasks/hooks/useTaskWebPush';

export type TaskReminderPresentationMode =
  | 'checking'
  | 'browser-notification'
  | 'native-notification'
  | 'in-app-toast';

export function getTaskReminderPresentationMode({
  webPushStatus,
  nativeNotificationsEnabled,
}: {
  webPushStatus: TaskWebPushStatus | undefined;
  nativeNotificationsEnabled: boolean;
}): TaskReminderPresentationMode {
  if (nativeNotificationsEnabled) return 'native-notification';
  if (webPushStatus === 'checking') return 'checking';
  if (webPushStatus === 'active') return 'browser-notification';
  return 'in-app-toast';
}
