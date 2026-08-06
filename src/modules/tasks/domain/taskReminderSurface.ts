import { getDeclaredNativePlatform } from '@/platform/installedApp';
import { getTasksNativeInstallationId } from '@/platform/native/tasksNativeCompanion';

const TASK_REMINDER_SURFACE_STORAGE_KEY = 'bathos_tasks_reminder_surface_id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let transientSurfaceId: string | null = null;

export type TaskInAppReminderSurface = {
  endpointKey: string;
  label: string;
};

function readOrCreateBrowserSurfaceId(targetWindow: Window): string {
  try {
    const existing = targetWindow.localStorage.getItem(TASK_REMINDER_SURFACE_STORAGE_KEY);
    if (existing && UUID_PATTERN.test(existing)) return existing;

    const created = targetWindow.crypto.randomUUID();
    targetWindow.localStorage.setItem(TASK_REMINDER_SURFACE_STORAGE_KEY, created);
    return created;
  } catch {
    transientSurfaceId ??= targetWindow.crypto.randomUUID();
    return transientSurfaceId;
  }
}

export function getTaskInAppReminderSurface(
  targetWindow: Window = window,
): TaskInAppReminderSurface {
  const platform = getDeclaredNativePlatform(targetWindow);
  const nativeInstallationId = getTasksNativeInstallationId(targetWindow);
  const surfaceId = nativeInstallationId ?? readOrCreateBrowserSurfaceId(targetWindow);

  if (platform === 'macos') {
    return { endpointKey: `macos:${surfaceId}`, label: 'Mac App' };
  }
  if (platform === 'ios') {
    return { endpointKey: `ios:${surfaceId}`, label: 'iOS App' };
  }
  return { endpointKey: `browser:${surfaceId}`, label: 'This Browser' };
}
