import { useCallback, useEffect, useState } from 'react';

import type { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import {
  registerTasksServiceWorker,
  TASKS_SERVICE_WORKER_SCOPE,
} from '@/modules/tasks/pwa/taskServiceWorker';
import type { TaskDeliveryTarget } from '@/modules/tasks/types/tasks';

export type TaskWebPushStatus =
  | 'checking'
  | 'active'
  | 'available'
  | 'denied'
  | 'unsupported'
  | 'unconfigured'
  | 'revoked'
  | 'error';

export type TaskWebPushModel = {
  status: TaskWebPushStatus;
  busy: boolean;
  error: Error | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

type WebPushEnvironment = {
  secureContext: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotifications: boolean;
  publicKey: string;
};

export function getTaskWebPushAvailability(environment: WebPushEnvironment):
  'available' | 'unsupported' | 'unconfigured' {
  if (
    !environment.secureContext
    || !environment.hasServiceWorker
    || !environment.hasPushManager
    || !environment.hasNotifications
  ) {
    return 'unsupported';
  }
  return environment.publicKey.trim() ? 'available' : 'unconfigured';
}

export function decodeVapidPublicKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(normalized);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function currentEnvironment(publicKey: string): WebPushEnvironment {
  return {
    secureContext: window.isSecureContext,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotifications: 'Notification' in window,
    publicKey,
  };
}

function parseSubscription(subscription: PushSubscription) {
  const value = subscription.toJSON();
  const p256dh = value.keys?.p256dh;
  const auth = value.keys?.auth;
  if (!value.endpoint || !p256dh || !auth) {
    throw new Error('The browser returned an incomplete notification subscription');
  }
  return { endpoint: value.endpoint, keys: { p256dh, auth } };
}

export function useTaskWebPush(
  mode: 'local' | 'connected',
  reminderService: TaskReminderService,
): TaskWebPushModel {
  const publicKey = import.meta.env.VITE_TASKS_WEB_PUSH_PUBLIC_KEY?.trim() ?? '';
  const [status, setStatus] = useState<TaskWebPushStatus>('checking');
  const [target, setTarget] = useState<TaskDeliveryTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let canceled = false;
    const initialize = async () => {
      if (mode !== 'connected') {
        setStatus('unconfigured');
        return;
      }
      const availability = getTaskWebPushAvailability(currentEnvironment(publicKey));
      if (availability !== 'available') {
        setStatus(availability);
        return;
      }
      if (Notification.permission === 'denied') {
        setStatus('denied');
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (!registration) {
          if (!canceled) setStatus('available');
          return;
        }
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          if (!canceled) setStatus('available');
          return;
        }
        const result = await reminderService.registerWebPush(
          parseSubscription(subscription),
          'This Browser',
          false,
        );
        if (canceled) return;
        if (result.outcome === 'revoked') {
          await subscription.unsubscribe();
          setTarget(result.target);
          setStatus('revoked');
          return;
        }
        setTarget(result.target);
        if (result.target.capability_status === 'degraded') {
          setError(new Error('The notification provider reported a recent delivery failure.'));
          setStatus('error');
        } else {
          setStatus('active');
          setError(null);
        }
      } catch (initializationError) {
        if (canceled) return;
        setError(initializationError instanceof Error
          ? initializationError
          : new Error('Unable to check browser reminders'));
        setStatus('error');
      }
    };
    void initialize();
    return () => {
      canceled = true;
    };
  }, [mode, publicKey, reminderService]);

  const enable = useCallback(async () => {
    if (busy || mode !== 'connected') return;
    setBusy(true);
    try {
      const availability = getTaskWebPushAvailability(currentEnvironment(publicKey));
      if (availability !== 'available') {
        setStatus(availability);
        return;
      }
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const registration = await registerTasksServiceWorker();
      if (!registration) {
        setStatus('unsupported');
        return;
      }
      const existing = await registration.pushManager.getSubscription();
      if (existing && status === 'revoked') await existing.unsubscribe();
      const subscription = status === 'revoked' || !existing
        ? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(publicKey),
        })
        : existing;
      const result = await reminderService.registerWebPush(
        parseSubscription(subscription),
        'This Browser',
        true,
      );
      setTarget(result.target);
      if (result.target.capability_status === 'degraded') {
        setError(new Error('The notification provider reported a recent delivery failure.'));
        setStatus('error');
      } else {
        setStatus('active');
        setError(null);
      }
    } catch (enableError) {
      setError(enableError instanceof Error
        ? enableError
        : new Error('Unable to enable browser reminders'));
      setStatus('error');
      throw enableError;
    } finally {
      setBusy(false);
    }
  }, [busy, mode, publicKey, reminderService, status]);

  const disable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (target) await reminderService.revokeWebPush(target.id);
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration(TASKS_SERVICE_WORKER_SCOPE);
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
      }
      setTarget(null);
      setStatus('available');
      setError(null);
    } catch (disableError) {
      setError(disableError instanceof Error
        ? disableError
        : new Error('Unable to disable browser reminders'));
      setStatus('error');
      throw disableError;
    } finally {
      setBusy(false);
    }
  }, [busy, reminderService, target]);

  return { status, busy, error, enable, disable };
}
