import { useEffect, useRef } from 'react';

import type { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import {
  getTasksNativeInstallationId,
  getTasksNativePushRegistration,
  setTasksNativePushRegistrationActive,
  TASKS_NATIVE_NOTIFICATION_STATUS_EVENT,
  TASKS_NATIVE_PUSH_TOKEN_EVENT,
  type TasksNativeNotificationAuthorizationStatus,
} from '@/platform/native/tasksNativeCompanion';

export function useTaskNativePushRegistration({
  mode,
  status,
  reminderService,
}: {
  mode: 'connected' | 'local';
  status: TasksNativeNotificationAuthorizationStatus;
  reminderService: TaskReminderService;
}) {
  const lastOperation = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'connected') return;
    let canceled = false;

    const synchronize = async () => {
      const registration = getTasksNativePushRegistration();
      const installationId = registration?.installationId
        ?? getTasksNativeInstallationId();
      if (status === 'enabled' && registration) {
        const operation = `register:${registration.deviceToken}`;
        if (lastOperation.current === operation) return;
        lastOperation.current = operation;
        try {
          await reminderService.registerNativePush({
            ...registration,
            label: registration.platform === 'ios' ? 'This iPhone or iPad' : 'This Mac',
          });
          if (!canceled) setTasksNativePushRegistrationActive(true);
        } catch {
          if (!canceled) {
            lastOperation.current = null;
            setTasksNativePushRegistrationActive(false);
          }
        }
        return;
      }
      if (
        installationId
        && ['denied', 'unavailable', 'error'].includes(status)
      ) {
        const operation = `revoke:${installationId}:${status}`;
        if (lastOperation.current === operation) return;
        lastOperation.current = operation;
        try {
          await reminderService.revokeNativePush(installationId);
          if (!canceled) setTasksNativePushRegistrationActive(false);
        } catch {
          if (!canceled) {
            lastOperation.current = null;
            setTasksNativePushRegistrationActive(false);
          }
        }
      }
    };

    const handleBridgeUpdate = () => void synchronize();
    window.addEventListener(TASKS_NATIVE_PUSH_TOKEN_EVENT, handleBridgeUpdate);
    window.addEventListener(TASKS_NATIVE_NOTIFICATION_STATUS_EVENT, handleBridgeUpdate);
    void synchronize();
    return () => {
      canceled = true;
      window.removeEventListener(TASKS_NATIVE_PUSH_TOKEN_EVENT, handleBridgeUpdate);
      window.removeEventListener(TASKS_NATIVE_NOTIFICATION_STATUS_EVENT, handleBridgeUpdate);
    };
  }, [mode, reminderService, status]);
}
