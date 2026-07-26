import type { TaskActionability } from '@/modules/tasks/types/tasks';

export const taskQuickFilters = [
  'all',
  'actionable',
  'non_actionable',
  'rechecking',
  'waiting',
] as const;

export type TaskQuickFilter = (typeof taskQuickFilters)[number];

export const taskQuickFilterLabels: Record<TaskQuickFilter, string> = {
  all: 'All Tasks',
  actionable: 'Only Ready',
  non_actionable: 'Only Not Ready',
  rechecking: 'Only Rechecking',
  waiting: 'Only Waiting',
};

export function sanitizeTaskQuickFilter(value: unknown): TaskQuickFilter {
  return typeof value === 'string'
    && taskQuickFilters.includes(value as TaskQuickFilter)
    ? value as TaskQuickFilter
    : 'all';
}

export function taskMatchesQuickFilter(
  actionability: TaskActionability,
  filter: TaskQuickFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'non_actionable') return actionability !== 'actionable';
  return actionability === filter;
}
