export type TaskReminderAvailability = 'local' | 'loading' | 'connected' | 'unavailable';

export function getTaskReminderAvailability(
  mode: 'local' | 'connected',
  loading: boolean,
  error: unknown,
): TaskReminderAvailability {
  if (mode === 'local') return 'local';
  if (loading) return 'loading';
  if (error) return 'unavailable';
  return 'connected';
}

export function getTaskReminderUnavailableMessage(
  availability: Exclude<TaskReminderAvailability, 'connected'>,
): string {
  if (availability === 'local') {
    return 'Reminders require connected task storage so the server can own delivery identity.';
  }
  if (availability === 'loading') {
    return 'Reminder data is loading. Editing will be available when current schedules are known.';
  }
  return 'Reminder data could not be loaded. Editing is disabled to protect existing schedules.';
}
