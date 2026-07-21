import type { AbstractPowerSyncDatabase } from '@powersync/web';

import type { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import { clearTasksDatabaseForSignOut } from '@/modules/tasks/sync/database';
import { getExistingUserBoundBrowserPushSubscription } from '@/platform/push/userBoundBrowserPush';

type ExistingPushSubscription = Pick<PushSubscription, 'endpoint' | 'unsubscribe'>;

export async function prepareTasksForSignOut({
  database,
  reminderService,
  mode,
  getSubscription = getExistingUserBoundBrowserPushSubscription,
}: {
  database: Pick<AbstractPowerSyncDatabase, 'disconnectAndClear'>;
  reminderService: Pick<TaskReminderService, 'revokeWebPushByEndpoint'>;
  mode: 'local' | 'connected';
  getSubscription?: () => Promise<ExistingPushSubscription | null>;
}): Promise<void> {
  const subscription = await getSubscription();
  let serverRevoked = false;
  let browserUnsubscribed = false;

  if (subscription) {
    if (mode === 'connected') {
      try {
        await reminderService.revokeWebPushByEndpoint(subscription.endpoint);
        serverRevoked = true;
      } catch {
        serverRevoked = false;
      }
    }
    try {
      browserUnsubscribed = await subscription.unsubscribe();
    } catch {
      browserUnsubscribed = false;
    }
  }

  await clearTasksDatabaseForSignOut(database);
  if (subscription && !serverRevoked && !browserUnsubscribed) {
    throw new Error('Browser reminders could not be invalidated before sign-out');
  }
}
