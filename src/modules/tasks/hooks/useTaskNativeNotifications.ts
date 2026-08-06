import { useCallback, useEffect, useState } from 'react';

import {
  configureTasksNativeNotifications,
  getTasksNativeNotificationAuthorizationStatus,
  isTasksNativeCompanion,
  isTasksNativeNotificationAuthorizationStatus,
  requestTasksNativeNotificationStatus,
  TASKS_NATIVE_NOTIFICATION_STATUS_EVENT,
  type TasksNativeNotificationAuthorizationStatus,
} from '@/platform/native/tasksNativeCompanion';

type TaskNativeNotificationStatusEventDetail = {
  status?: unknown;
  enabled?: unknown;
};

export type TaskNativeNotificationsModel = {
  available: boolean;
  enabled: boolean;
  status: TasksNativeNotificationAuthorizationStatus;
  enable: () => boolean;
};

export function useTaskNativeNotifications(): TaskNativeNotificationsModel {
  const available = isTasksNativeCompanion();
  const [status, setStatus] = useState<TasksNativeNotificationAuthorizationStatus>(
    () => getTasksNativeNotificationAuthorizationStatus(),
  );

  useEffect(() => {
    if (!available) {
      setStatus('unavailable');
      return;
    }

    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<TaskNativeNotificationStatusEventDetail>).detail;
      if (isTasksNativeNotificationAuthorizationStatus(detail?.status)) {
        setStatus(detail.status);
      } else if (detail?.enabled === true) {
        setStatus('enabled');
      }
    };

    window.addEventListener(TASKS_NATIVE_NOTIFICATION_STATUS_EVENT, handleStatus);
    requestTasksNativeNotificationStatus();
    return () => {
      window.removeEventListener(TASKS_NATIVE_NOTIFICATION_STATUS_EVENT, handleStatus);
    };
  }, [available]);

  const enable = useCallback(() => configureTasksNativeNotifications(), []);

  return {
    available,
    enabled: status === 'enabled',
    status,
    enable,
  };
}
