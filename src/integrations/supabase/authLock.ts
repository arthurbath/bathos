import { processLock, type LockFunc } from '@supabase/auth-js';
import { isTasksNativeCompanion } from '@/platform/native/tasksNativeCompanion';

export function resolveSupabaseAuthLock(
  target: Window = window,
): LockFunc | undefined {
  return isTasksNativeCompanion(target) ? processLock : undefined;
}
