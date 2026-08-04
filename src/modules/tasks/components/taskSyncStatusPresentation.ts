import type { TaskSyncHealthState } from '@/modules/tasks/domain/taskSyncReliability';

export function formatTaskSyncHealth(state: TaskSyncHealthState): string {
  if (state === 'local-only') return 'Local Only';
  if (state === 'upload-error') return 'Upload Error';
  if (state === 'download-error') return 'Download Error';
  if (state === 'offline') return 'Offline';
  if (state === 'connecting') return 'Connecting';
  if (state === 'first-sync-pending') return 'Preparing Sync';
  if (state === 'synchronizing') return 'Synchronizing';
  return 'Healthy';
}

export function formatTaskSyncStatusTimestamp(value: Date | null): string {
  if (value === null || Number.isNaN(value.getTime())) return 'Not Yet';
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(value);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(value);
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(value);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(value);
  return `${year} ${month} ${day}, ${time}`;
}
